import { randomBytes, randomInt } from "node:crypto";
import { QR_PREFIX } from "./collection-input";
export { QR_PREFIX };

// No 0/O/1/I/L so codes survive being read aloud or handwritten.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateClaimCode(): string {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export const formatClaimCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;

export const normalizeClaimCode = (input: string) =>
  input.toUpperCase().replace(/[^A-Z0-9]/g, "");

// Opaque, non-guessable QR payload. No personal data. Revocation = status in qr_codes.
export const generateQrToken = () => QR_PREFIX + randomBytes(16).toString("base64url");
