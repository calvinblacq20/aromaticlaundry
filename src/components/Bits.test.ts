import { describe, expect, it } from "vitest";
import photoManifest from "../data/photo-manifest.json";
import { photoSrcSet } from "./Bits";

type Entry = { sm: number; w: number; w2x: number; w4k?: number; h: number };
const MANIFEST = photoManifest as Record<string, Entry>;
const BUILT = new Set(Object.keys(import.meta.glob("/public/photos/*.webp")).map((path) => path.replace("/public", "")));
const SOURCES = import.meta.glob<string>(["/src/**/*.{ts,tsx}", "!/src/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

describe("photoSrcSet", () => {
  it("lists every built size, smallest first, up to the 4K file", () => {
    expect(photoSrcSet("/photos/blazer.webp")).toBe(
      "/photos/blazer-sm.webp 480w, /photos/blazer.webp 1080w, /photos/blazer@2x.webp 2160w, /photos/blazer@4k.webp 3072w",
    );
  });

  it("gives nothing for photos the build didn't make, so the plain src is used", () => {
    expect(photoSrcSet(undefined)).toBeUndefined();
    expect(photoSrcSet("/photos/not-built.webp")).toBeUndefined();
    expect(photoSrcSet("https://example.com/photos/agbada.webp")).toBeUndefined();
  });
});

describe("built photos", () => {
  it("are all 4K: a 3840px long side", () => {
    for (const [name, entry] of Object.entries(MANIFEST)) {
      expect(entry.w4k, `${name} has no 4K file`).toBeDefined();
      const longSide = Math.max(entry.w4k!, (entry.w4k! * entry.h) / entry.w);
      expect(Math.abs(longSide - 3840), name).toBeLessThanOrEqual(4);
    }
  });

  it("exist on disk in every size the manifest promises", () => {
    for (const name of Object.keys(MANIFEST)) {
      for (const suffix of ["-sm", "", "@2x", "@4k"]) expect(BUILT.has(`/photos/${name}${suffix}.webp`), `${name}${suffix}.webp`).toBe(true);
    }
  });

  it("cover every photo the app refers to", () => {
    const referenced = new Set(Object.values(SOURCES).flatMap((code) => [...code.matchAll(/\/photos\/([\w-]+)\.webp/g)].map((m) => m[1]!)));
    expect(referenced.size).toBeGreaterThan(20);
    for (const name of referenced) expect(MANIFEST[name], `/photos/${name}.webp is used but not built`).toBeDefined();
  });
});
