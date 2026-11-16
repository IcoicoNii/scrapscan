import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { fil } from "../i18n/fil";
import { format, localeFromAcceptLanguage, plural } from "../i18n/config";

type Tree = { [k: string]: string | Tree };
const flatten = (t: Tree, prefix = ""): Record<string, string> =>
  Object.fromEntries(
    Object.entries(t).flatMap(([k, v]) => (typeof v === "string" ? [[prefix + k, v]] : Object.entries(flatten(v, `${prefix}${k}.`)))),
  );
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  const E = flatten(en as unknown as Tree);
  const F = flatten(fil as unknown as Tree);

  it("Filipino has exactly the English keys, none empty", () => {
    expect(Object.keys(F).sort()).toEqual(Object.keys(E).sort());
    for (const [k, v] of Object.entries(F)) expect(v.trim(), k).not.toBe("");
  });

  it("every Filipino string keeps the English {placeholders}", () => {
    for (const k of Object.keys(E)) expect(placeholders(F[k]), k).toEqual(placeholders(E[k]));
  });
});

describe("helpers", () => {
  it("fills placeholders and picks plural forms", () => {
    expect(format("Hi {name}, {n} pts", { name: "Ana", n: 5 })).toBe("Hi Ana, 5 pts");
    expect(format("Keep {unknown}")).toBe("Keep {unknown}");
    expect(plural(1, "{n} scan", "{n} scans")).toBe("1 scan");
    expect(plural(3, "{n} scan", "{n} scans")).toBe("3 scans");
  });

  it("reads the browser's preferred language", () => {
    expect(localeFromAcceptLanguage("fil-PH,fil;q=0.9,en;q=0.8")).toBe("fil");
    expect(localeFromAcceptLanguage("tl,en;q=0.5")).toBe("fil");
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,fil;q=0.5")).toBe("en");
    expect(localeFromAcceptLanguage("ja,fil;q=0.8")).toBe("fil");
    expect(localeFromAcceptLanguage("ja")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("en");
  });
});
