import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("interface theme", () => {
  const appSource = readFileSync(new URL("../src/renderer/App.tsx", import.meta.url), "utf8");
  const mainSource = readFileSync(new URL("../src/main/index.ts", import.meta.url), "utf8");
  const preloadSource = readFileSync(new URL("../src/preload/index.ts", import.meta.url), "utf8");
  const rendererEntry = readFileSync(new URL("../src/renderer/main.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/renderer/styles.css", import.meta.url), "utf8");

  it("uses the native desktop font stack", () => {
    expect(rendererEntry).not.toContain("@fontsource");
    expect(styles).toContain('font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    expect(styles).not.toContain("Pixelify Sans");
    expect(styles).not.toContain("image-rendering: pixelated");
  });

  it("contains the professional desktop interface", () => {
    expect(styles).toContain("/* Professional desktop interface */");
    expect(styles).toContain("color-scheme: dark");
    expect(styles).toContain("--sheet: #0b0b0b");
    expect(styles).toContain("--accent: #f3f3f3");
    expect(styles).toContain("--on-accent: #0b0b0b");
    expect(styles).toContain("--sidebar: rgba(0, 0, 0, .28)");
    expect(styles).not.toContain("text-shadow");
  });

  it("is dark, with a dark frame, and see-through only where Windows can blur", () => {
    expect(mainSource).toContain('nativeTheme.themeSource = "dark"');
    expect(mainSource).toContain('const WINDOW_COLOR = "#0b0b0b"');
    expect(mainSource).toContain('backgroundMaterial: "acrylic"');
    expect(mainSource).toContain(">= 22621");
    // No light surface is left behind in the stylesheet.
    expect(styles).not.toMatch(/background:\s*#(?:fff|f[0-9a-f]{5}|e[0-9a-f]{5})\b/i);
    // The frame of Windows is kept, so the window can still be resized and maximised.
    expect(mainSource).not.toContain("frame: false");
    expect(mainSource).not.toContain("transparent: true");
  });

  it("does not ship a demo vault", () => {
    expect(appSource).not.toContain("loadDemo");
    expect(mainSource).not.toContain("vault:load-demo");
    expect(preloadSource).not.toContain("loadDemo");
  });

  it("keeps dash punctuation out of authored interface copy", () => {
    expect(appSource).not.toMatch(/[‐‑‒–—―]/u);
    expect(appSource).not.toMatch(
      /Compromised-password|Prefix-only|k-anonymity|change-password|full-hash|password-manager|Highest-priority|phishing-resistant|session-only|Clipboard-monitoring|garbage-collected|password-health|Password-free|SHA-1|Add-Padding/,
    );
  });

  it("uses a readable default scale and removes tiny final font overrides", () => {
    expect(mainSource).toContain("const DEFAULT_ZOOM_FACTOR = 1.08");
    expect(mainSource).toContain("width: 1480");
    expect(mainSource).toContain("minWidth: 1160");
    expect(mainSource).toContain("setZoomFactor(DEFAULT_ZOOM_FACTOR)");

    expect(styles).not.toMatch(/font-size:\s*(?:8|9|10)px/);
    expect(styles).toContain(".page-heading-row p");
    expect(styles).toContain("font-size: 15px");
    expect(styles).toContain(".account-drawer");
    expect(styles).toContain("width: 560px");
  });
});
