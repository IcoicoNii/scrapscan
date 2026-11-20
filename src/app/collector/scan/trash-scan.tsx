"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Notice } from "@/components/ui";
import { useI18n } from "@/components/i18n";
import { TRASH_CATEGORIES, type TrashCategory, type TrashSuggestion } from "@/lib/trash-suggestion";

// The collector picks the category the bag should hold, then takes a photo (in the app's camera view, or
// by uploading one). The AI checks the bag against that category. The collector still checks each bin and
// presses save, so the suggestion is only a starting point.

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "done"; notes: string } | { kind: "error"; error: string };
type CameraState = "off" | "starting" | "on";

const MAX_SIDE = 1280;

/** Draws an image or video frame, shrunk to fit MAX_SIDE, and returns it as base64 JPEG (no prefix). */
function toBase64Jpeg(source: CanvasImageSource, width: number, height: number): string {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

/** Uploaded or gallery photo -> base64 JPEG. */
async function fileToBase64Jpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return toBase64Jpeg(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AiTrashScan({ onSuggestion }: { onSuggestion: (s: TrashSuggestion) => void }) {
  const { t } = useI18n();
  const c = t.collector;
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [expected, setExpected] = useState<TrashCategory | "">("");
  const [camera, setCamera] = useState<CameraState>("off");
  const [cameraError, setCameraError] = useState<string | null>(null);
  // The server render has no camera, so the button appears only once the page runs in the browser.
  const canUseCamera = useSyncExternalStore(
    () => () => {},
    () => window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia),
    () => false,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = status.kind === "busy";

  // Turn the camera off if the collector leaves this screen.
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCamera("off");
  }, []);

  async function openCamera() {
    setCameraError(null);
    setCamera("starting");
    try {
      // "environment" asks for the back camera on phones.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setCamera("on");
      // The video element appears with the "on" state, so it's attached after this render.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      stopCamera();
      setCameraError(
        name === "NotAllowedError" || name === "SecurityError"
          ? c.camDenied
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? c.camNone
            : c.camUnsupported,
      );
    }
  }

  async function analyzeData(data: string, category: TrashCategory) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus({ kind: "error", error: "OFFLINE" });
      return;
    }
    setStatus({ kind: "busy" });
    try {
      const res = await fetch("/api/trash/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mediaType: "image/jpeg", expected: category, data }),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; suggestion?: TrashSuggestion; error?: string } | null;
      if (res.ok && json?.ok && json.suggestion) {
        onSuggestion(json.suggestion);
        setStatus({ kind: "done", notes: json.suggestion.notes });
        setExpected(""); // the next bag needs its own category choice
        return;
      }
      setStatus({ kind: "error", error: json?.error ?? "AI_FAILED" });
    } catch {
      setStatus({ kind: "error", error: "AI_FAILED" });
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !expected || !video.videoWidth) return;
    const data = toBase64Jpeg(video, video.videoWidth, video.videoHeight);
    stopCamera();
    analyzeData(data, expected);
  }

  async function uploadFile(file: File) {
    if (!expected) return;
    setStatus({ kind: "busy" });
    try {
      const data = await fileToBase64Jpeg(file);
      await analyzeData(data, expected);
    } catch {
      setStatus({ kind: "error", error: "AI_FAILED" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const errorText =
    status.kind === "error"
      ? status.error === "NOT_CONFIGURED"
        ? c.aiNotConfigured
        : status.error === "OFFLINE"
          ? c.aiOffline
        : status.error === "UNCLEAR"
          ? c.aiUnclear
          : c.aiFailed
      : null;

  return (
    <section className="card space-y-3" aria-labelledby="ai-scan-title">
      <h3 id="ai-scan-title" className="text-lg font-bold">
        {c.aiTitle}
      </h3>
      <p className="text-sm text-slate-green">{c.aiHint}</p>
      <div>
        <label htmlFor="ai-category" className="mb-1 block text-sm font-semibold text-slate-green">
          {c.aiPickLabel}
        </label>
        <select
          id="ai-category"
          value={expected}
          disabled={busy || camera !== "off"}
          onChange={(e) => setExpected(e.target.value as TrashCategory | "")}
          className="w-full rounded-2xl border-2 border-line bg-white px-4 py-3 font-semibold text-forest"
        >
          <option value="">{c.aiPickPlaceholder}</option>
          {TRASH_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t.bins[cat]}
            </option>
          ))}
        </select>
      </div>

      {camera !== "off" ? (
        <div className="space-y-3">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label={c.cameraView}
            className="aspect-[3/4] w-full rounded-2xl bg-black object-cover"
          />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={capture} disabled={camera !== "on" || !expected} className="btn btn-primary py-4">
              {c.aiCapture}
            </button>
            <button type="button" onClick={stopCamera} className="btn btn-ghost py-4">
              {c.aiCancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {canUseCamera && (
            <button
              type="button"
              onClick={openCamera}
              disabled={!expected || busy}
              className="btn btn-primary w-full py-4"
            >
              {busy ? c.aiAnalyzing : c.aiOpenCamera}
            </button>
          )}
          <label
            aria-disabled={!expected || busy}
            className={`btn btn-outline w-full py-4 has-focus-visible:outline-3 has-focus-visible:outline-lawn ${
              expected && !busy ? "cursor-pointer" : "cursor-not-allowed opacity-60"
            }`}
          >
            {busy && !canUseCamera ? c.aiAnalyzing : c.aiUpload}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              disabled={!expected || busy}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
          </label>
        </div>
      )}

      {cameraError && <Notice tone="warn">{cameraError}</Notice>}
      {status.kind === "done" && (
        <Notice>
          {c.aiApplied}
          {status.notes && ` ${status.notes}`}
        </Notice>
      )}
      {errorText && <Notice tone="warn">{errorText}</Notice>}
    </section>
  );
}
