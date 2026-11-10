import "server-only";
import QRCode from "qrcode";

// QR payload is just the opaque token. Library-generated SVG, safe to inline.
export function qrSvg(token: string) {
  return QRCode.toString(token, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#245900", light: "#ffffff" },
  });
}
