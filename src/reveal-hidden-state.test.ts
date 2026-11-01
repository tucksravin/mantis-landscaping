import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The scroll reveal's hidden state has three halves that have to agree, and
// none of them is reachable from jsdom (which resolves no stylesheets and
// never parses app.html):
//
//   1. app.css hides `[data-reveal]` under `prefers-reduced-motion:
//      no-preference`, so server-rendered markup is hidden at FIRST PAINT
//      rather than yanked to opacity 0 at hydration.
//   2. app.html's <noscript> style forces it back, so a browser that will
//      never run the reveal is never shown less than a crawler gets.
//   3. animateIn's inline write has to be byte-identical to (1), or hydration
//      is a visible state change instead of the no-op it is meant to be.
//
// Resolved from the project root, not `import.meta.url`: under the jsdom
// environment vite serves this module over http, so `new URL(..., import.meta.url)`
// is not a file: URL and readFileSync rejects it.
const root = process.cwd();
const css = readFileSync(resolve(root, "src/app.css"), "utf-8");
const html = readFileSync(resolve(root, "src/app.html"), "utf-8");
const action = readFileSync(resolve(root, "src/lib/actions/animateIn.ts"), "utf-8");

/** The body of the first rule whose selector starts at `from`. Located by
 *  string and sliced to the closing brace rather than matched by regex: a
 *  selector regex with `[^)]*` in it stops at a nested `)` and matches nothing
 *  however good the CSS is, which is how a check that can only ever fail gets
 *  written (see src/focus-floor.test.ts, same trap). */
function ruleAt(source: string, selector: string, from = 0) {
  const at = source.indexOf(selector, from);
  if (at === -1) return null;
  return source.slice(at, source.indexOf("}", at) + 1);
}

describe("the scroll reveal's first-paint hidden state", () => {
  it("hides [data-reveal] in app.css, gated on no-preference", () => {
    const gate = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(gate, "no no-preference block in app.css").toBeGreaterThan(-1);
    const rule = ruleAt(css, "[data-reveal]", gate);
    expect(rule, "no [data-reveal] rule inside the no-preference block").not.toBeNull();
    expect(rule).toMatch(/opacity:\s*0/);
    expect(rule).toMatch(/transform:\s*translateY\(/);
  });

  // If the CSS hides an element 50% down and the action reveals it from 24px,
  // hydration is a jump rather than the byte-identical no-op the whole design
  // rests on. The two are asserted against each other so they cannot drift.
  it("hides it at exactly the distance the action's default reveals from", () => {
    const gate = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    const rule = ruleAt(css, "[data-reveal]", gate)!;
    const cssTravel = /transform:\s*translateY\(([^)]+)\)/.exec(rule)?.[1]?.trim();
    const jsTravel = /translateY\s*\?\?\s*"([^"]+)"/.exec(action)?.[1]?.trim();
    expect(cssTravel, "could not read the travel out of app.css").toBeTruthy();
    expect(jsTravel, "could not read animateIn's default translateY").toBeTruthy();
    expect(cssTravel).toBe(jsTravel);
  });

  // The guard has to be a STYLE, not an inline `classList.add("js")` script:
  // this template's CSP ships script-src without 'unsafe-inline', so on
  // server-rendered routes (policy as a nonce-bearing header) the script is
  // silently dropped while prerendered routes keep it. A guard that is live on
  // some routes and dead on others is worse than no guard. style-src already
  // allows inline styles, so this half works identically everywhere.
  it("uses a style for that escape hatch, never a script", () => {
    const noscript = html.slice(html.indexOf("<noscript>"), html.indexOf("</noscript>"));
    expect(noscript).toContain("<style>");
    expect(noscript).not.toContain("<script");
  });
});
