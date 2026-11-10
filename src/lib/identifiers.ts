export type LoginId =
  | { kind: "email"; value: string }
  | { kind: "phone"; value: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Philippine mobile: 09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX or 9XXXXXXXXX
const PH_MOBILE = /^(?:\+?63|0)?(9\d{9})$/;

export function parseLoginId(input: string): LoginId | null {
  const raw = input.trim();
  if (raw.includes("@")) {
    return EMAIL.test(raw) ? { kind: "email", value: raw.toLowerCase() } : null;
  }
  const digits = raw.replace(/[\s\-().]/g, "");
  const m = PH_MOBILE.exec(digits);
  return m ? { kind: "phone", value: `+63${m[1]}` } : null;
}
