"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useI18n } from "@/components/i18n";
import type { Dictionary } from "@/lib/i18n/en";

// Camera QR scanner. Uses the browser's BarcodeDetector where it exists (Android Chrome) and falls
// back to jsQR (loaded only when needed), so iPhones work too. Mount it to scan; it calls onScan once
// and stops the camera. Unmount and remount to scan again.

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
};

type Status = "starting" | "scanning" | "denied" | "no-camera" | "insecure" | "unsupported" | "error";

const MESSAGE_KEY: Record<Exclude<Status, "starting" | "scanning">, keyof Dictionary["collector"]> = {
  denied: "camDenied",
  "no-camera": "camNone",
  insecure: "camInsecure",
  unsupported: "camUnsupported",
  error: "camError",
};

const SCAN_INTERVAL_MS = 150;
const MAX_DECODE_WIDTH = 640; // jsQR works on raw pixels; smaller frames decode much faster

async function makeDecoder(): Promise<(video: HTMLVideoElement) => Promise<string | null>> {
  const BD = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (BD && (await BD.getSupportedFormats().catch((): string[] => [])).includes("qr_code")) {
    const detector = new BD({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  return async (video) => {
    const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
  };
}

export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const { t } = useI18n();
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    (async () => {
      if (!window.isSecureContext) return setStatus("insecure");
      if (!navigator.mediaDevices?.getUserMedia) return setStatus("unsupported");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        const name = (e as DOMException).name;
        return setStatus(name === "NotAllowedError" ? "denied" : name === "NotFoundError" ? "no-camera" : "error");
      }
      if (stopped) return stop();
      const video = videoRef.current!;
      video.srcObject = stream;
      try {
        await video.play();
        const decode = await makeDecoder();
        if (stopped) return;
        setStatus("scanning");
        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= video.HAVE_ENOUGH_DATA) {
            const text = await decode(video).catch(() => null);
            if (text && !stopped) {
              stop();
              navigator.vibrate?.(60);
              onScanRef.current(text);
              return;
            }
          }
          timer = setTimeout(tick, SCAN_INTERVAL_MS);
        };
        tick();
      } catch {
        if (!stopped) setStatus("error");
      }
    })();

    return stop;
  }, []);

  const failed = status !== "starting" && status !== "scanning";

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-khaki shadow-lift">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label={t.collector.cameraView}
          className={`h-full w-full object-cover ${failed ? "hidden" : ""}`}
        />
        {/* Aiming frame */}
        {!failed && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-[14%] rounded-[1.25rem] border-4 border-lawn/90 shadow-[0_0_0_100vmax_rgb(0_0_0/0.35)]" />
        )}
        {status === "starting" && (
          <p className="absolute inset-0 grid place-items-center text-sm font-semibold text-white">{t.collector.startingCamera}</p>
        )}
        {failed && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div>
              <Icon name="qr" className="mx-auto h-12 w-12 text-lawn" />
              <p className="mt-3 text-sm font-medium">{t.collector[MESSAGE_KEY[status]]}</p>
            </div>
          </div>
        )}
      </div>
      <p aria-live="polite" className="mt-3 text-center text-sm text-slate-green">
        {status === "scanning" ? t.collector.pointCamera : ""}
      </p>
    </div>
  );
}
