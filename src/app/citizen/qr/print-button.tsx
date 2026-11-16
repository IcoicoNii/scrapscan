"use client";

export function PrintButton({ label = "Print QR code" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-outline w-full">
      {label}
    </button>
  );
}
