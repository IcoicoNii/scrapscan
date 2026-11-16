import { en, type Dictionary } from "./en";
import { fil } from "./fil";
import type { Locale } from "./config";

// Both dictionaries are small, so they're bundled rather than loaded on demand.
export const DICTIONARIES: Record<Locale, Dictionary> = { en, fil: fil as unknown as Dictionary };
