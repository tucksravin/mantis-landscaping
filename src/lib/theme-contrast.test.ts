import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * The palette a site sets in `app.css` has to be legible where the TEMPLATE
 * already spends it, and nothing checked that.
 *
 * What went wrong, on roalson-interests 2026-09-17: the brand's secondary
 * colour is a light warm grey, it was assigned to `--color-secondary`, and that
 * token is a TEXT role in eight places the site never touched — the footer
 * copyright, `Field.svelte`'s description, the eyebrows on LeadText,
 * TextColumns and Testimonial, the testimonial role line, the contact intro and
 * a dev fixture. So one token assignment failed axe on every page that renders
 * a footer, at 1.97:1. It was caught by the a11y gate, which is late: the gate
 * needs a built site and a browser, it names one node rather than the class,
 * and on a fresh clone it is pointed at fixtures and would not have run on a
 * real page at all.
 *
 * The naming is what makes this a trap. `--color-secondary` asserts that the
 * token is text-capable, and a brand's "secondary colour" very often is not.
 *
 * So this is a unit test, and it fails in milliseconds with no browser. It
 * encodes the pairs the template's own markup composes; a site that changes the
 * palette runs it unchanged and learns immediately.
 */

const AA_NORMAL_TEXT = 4.5;

/** Tokens the template renders as text on a LIGHT ground. */
const LIGHT_GROUND_TEXT = ["secondary", "primary", "dark", "black", "gold-deep", "olive"] as const;
/** The light grounds those land on. */
const LIGHT_GROUNDS = ["background", "white", "light"] as const;

/** Tokens the template renders as text on a DARK ground. */
const DARK_GROUND_TEXT = ["white", "gold", "accent"] as const;
/** The dark grounds those land on. */
const DARK_GROUNDS = ["primary", "dark", "black", "moss"] as const;

/**
 * The starter kept `light` out of LIGHT_GROUNDS because no component put text
 * on it. Mantis does (Steps, CaseStudies and the contact band sit on
 * `bg-light`), so it is in the list above and this constant only records that
 * the starter's caveat was resolved by adding it, not by ignoring it.
 */
const KNOWN_UNCOMPOSED_GROUND = "light";

/**
 * Pairs this site composes that the token lists above cannot express: white
 * type on the darkened gold fill (OD 62a), and the brand gold as text only on
 * the dark bands. `#dfb726` under white text measured 1.91:1 on the Blux site.
 */
const COMPOSED_PAIRS = [
  { text: "white", ground: "gold-deep" },
  { text: "gold-deep", ground: "light" },
  { text: "gold", ground: "dark" },
  { text: "gold", ground: "moss" },
  { text: "accent", ground: "dark" },
  { text: "primary", ground: "gold" },
  { text: "primary", ground: "light" },
  { text: "olive", ground: "footer" },
] as const;

type Rgb = [number, number, number];

/** CSS named colours the theme actually uses. Not a general parser — an
 *  unknown value throws below rather than being silently skipped. */
const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000" };

function parseThemeColors(css: string): Record<string, string> {
  const block = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
  if (!block) throw new Error("app.css has no @theme block");
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/**
 * An achromatic `oklch(L 0 H)`, the form app.css gives Tailwind's none-hued
 * greys (#152). With chroma 0, OKLab's a and b are 0, every LMS cone response
 * equals L, and linear sRGB is L³ in all three channels; this is that value,
 * sRGB-encoded to 8 bits (`oklch(20.5% 0 0)` is #171717, neutral-900). The
 * hue must be a number: a `none` hue is exactly what axe cannot parse, so this
 * guard refuses it too. Null for anything else.
 */
function achromaticOklch(value: string): Rgb | null {
  const m = /^oklch\(\s*([\d.]+)(%?)\s+0(?:\.0+)?%?\s+-?[\d.]+(?:deg)?\s*\)$/i.exec(value);
  if (!m) return null;
  const lightness = Number(m[1]) / (m[2] ? 100 : 1);
  const linear = lightness ** 3;
  const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  const channel = Math.round(Math.min(1, Math.max(0, encoded)) * 255);
  return [channel, channel, channel];
}

function toRgb(value: string, token: string): Rgb {
  const grey = achromaticOklch(value);
  if (grey) return grey;
  const v = NAMED[value] ?? value;
  if (!v.startsWith("#")) {
    throw new Error(
      `--color-${token} is "${value}", which this guard cannot measure. ` +
        `Use a hex value, an achromatic oklch(L 0 0), or add it to NAMED if it is a named colour.`,
    );
  }
  const h = v.slice(1).length === 3 ? v.slice(1).replace(/./g, (c) => c + c) : v.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

/** WCAG 2.x relative luminance. */
function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// cwd-relative, not `import.meta.url`: every suite here runs under jsdom (see
// vite.config.ts), where import.meta.url is not a file: URL and readFileSync
// throws "The URL must be of scheme file". Vitest's cwd is the repo root.
const REPO_ROOT = process.cwd();
const css = readFileSync(resolve(REPO_ROOT, "src/app.css"), "utf8");
const colors = parseThemeColors(css);

/** Every .svelte file under src/. A plain walk rather than fs.globSync, which
 *  needs Node 22 while package.json#engines allows 20. */
function svelteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) svelteFiles(full, acc);
    else if (entry.name.endsWith(".svelte")) acc.push(full);
  }
  return acc;
}

function resolveToken(token: string): Rgb {
  const raw = colors[token] ?? NAMED[token];
  if (raw === undefined) throw new Error(`No --color-${token} in app.css @theme`);
  return toRgb(raw, token);
}

describe("theme contrast", () => {
  it.each(LIGHT_GROUND_TEXT.flatMap((text) => LIGHT_GROUNDS.map((ground) => ({ text, ground }))))(
    "text-$text on bg-$ground meets AA",
    ({ text, ground }) => {
      const ratio = contrast(resolveToken(text), resolveToken(ground));
      expect(
        ratio,
        `--color-${text} on --color-${ground} is ${ratio.toFixed(2)}:1, below AA ` +
          `(${AA_NORMAL_TEXT}:1). The template renders text-${text} on this ground, so ` +
          `this fails on every page that does. Either darken --color-${text}, or — if the ` +
          `brand colour must stay as it is — give it a fill-only token of its own and set ` +
          `--color-${text} to an AA-safe value. Do not silence this by changing the pair.`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  it.each(DARK_GROUND_TEXT.flatMap((text) => DARK_GROUNDS.map((ground) => ({ text, ground }))))(
    "text-$text on bg-$ground meets AA",
    ({ text, ground }) => {
      const ratio = contrast(resolveToken(text), resolveToken(ground));
      expect(
        ratio,
        `--color-${text} on --color-${ground} is ${ratio.toFixed(2)}:1, below AA.`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  /**
   * The none-hued Tailwind tokens app.css overrides with a 0 hue (#152) are
   * in this @theme block, so a `text-neutral-*` in src is classified here
   * like any other token, and this guard has to be able to measure it. These
   * are Tailwind's own sRGB values for the same greys.
   */
  it("measures the none-hued palette overrides, and refuses a none hue", () => {
    const overrides = Object.keys(colors).filter((t) => /^(neutral-\d+|zinc-50|mauve-50)$/.test(t));
    expect(overrides.length).toBeGreaterThan(0);
    expect(overrides).toContain("neutral-900");
    for (const token of overrides) expect(() => resolveToken(token)).not.toThrow();
    expect(resolveToken("neutral-50")).toEqual([250, 250, 250]);
    expect(resolveToken("neutral-600")).toEqual([82, 82, 82]);
    expect(resolveToken("neutral-900")).toEqual([23, 23, 23]);
    expect(resolveToken("neutral-950")).toEqual([10, 10, 10]);
    expect(() => toRgb("oklch(20.5% 0 none)", "neutral-900")).toThrow(/cannot measure/);
  });

  /**
   * Completeness, so the lists above cannot quietly fall behind the markup.
   * A new `text-<token>` class is a new claim that the token is legible
   * somewhere; this fails until someone says which ground it lands on.
   */
  it("every text-<theme token> in src is classified by ground", () => {
    const files = svelteFiles(resolve(REPO_ROOT, "src"));
    const known = new Set<string>([...LIGHT_GROUND_TEXT, ...DARK_GROUND_TEXT]);
    const themeTokens = Object.keys(colors).filter((t) => !["transparent", "current"].includes(t));
    const found = new Set<string>();
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/\btext-([a-z0-9-]+)\b/g)) {
        if (themeTokens.includes(m[1])) found.add(m[1]);
      }
    }
    const unclassified = [...found].filter((t) => !known.has(t));
    expect(
      unclassified,
      `These tokens are used as text but are not in LIGHT_GROUND_TEXT or ` +
        `DARK_GROUND_TEXT, so their contrast is unmeasured: ${unclassified.join(", ")}. ` +
        `Add each to the list matching the ground it renders on.`,
    ).toEqual([]);
    // Guard the guard: if this found nothing at all, the scan is broken.
    expect(found.size).toBeGreaterThan(0);
    expect(KNOWN_UNCOMPOSED_GROUND).toBe("light");
  });

  it.each(COMPOSED_PAIRS)("text-$text on bg-$ground meets AA", ({ text, ground }) => {
    const ratio = contrast(resolveToken(text), resolveToken(ground));
    expect(
      ratio,
      `--color-${text} on --color-${ground} is ${ratio.toFixed(2)}:1, below AA.`,
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  /**
   * A class string that sets both a ground and a text colour is a pair the
   * markup composes directly, whatever the lists above say. Hover and focus
   * variants are skipped; they are states, not the resting pair. It only sees
   * pairs written in ONE string: a ground on a parent and a colour on a child,
   * or a class held in a variable, is invisible to it, which is what
   * COMPOSED_PAIRS above is for.
   */
  it("every bg-<token> text-<token> pair written in one class string meets AA", () => {
    const themeTokens = new Set(
      Object.keys(colors).filter((t) => !["transparent", "current"].includes(t)),
    );
    const failures: string[] = [];
    let measured = 0;
    for (const file of svelteFiles(resolve(REPO_ROOT, "src"))) {
      const src = readFileSync(file, "utf8");
      const literals = [
        ...[...src.matchAll(/"([^"]*)"/g)].map((m) => m[1].replace(/\{[^}]*\}/g, " ")),
        ...[...src.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]),
        ...[...src.matchAll(/`([^`]*)`/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, " ")),
      ];
      for (const literal of literals) {
        const classes = literal.split(/\s+/).filter((c) => c && !c.includes(":"));
        const grounds = classes
          .map((c) => /^bg-([a-z0-9-]+)$/.exec(c)?.[1])
          .filter((t): t is string => !!t && themeTokens.has(t));
        const texts = classes
          .map((c) => /^text-([a-z0-9-]+)$/.exec(c)?.[1])
          .filter((t): t is string => !!t && themeTokens.has(t));
        for (const ground of grounds) {
          for (const text of texts) {
            measured++;
            const ratio = contrast(resolveToken(text), resolveToken(ground));
            if (ratio < AA_NORMAL_TEXT) {
              failures.push(
                `${file.replace(REPO_ROOT, "")}: text-${text} on bg-${ground} ${ratio.toFixed(2)}:1`,
              );
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
    expect(measured).toBeGreaterThan(5);
  });
});
