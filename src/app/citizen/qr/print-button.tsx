"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-outline w-full">
      Print QR code
    </button>
  );
}
