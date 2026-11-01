import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { compile } from "tailwindcss";

/**
 * WCAG contrast for unit tests, computed from the stylesheet the site really
 * ships, so a test can hold AA without pinning WHICH colour a designer picked.
 *
 * jsdom applies no CSS, so this does the browser's job for the part a test
 * needs. It compiles app.css with Tailwind (the same `@theme` tokens, the same
 * default palette, the same utility order the build emits) for every class in
 * the rendered document, then runs the cascade: a rule applies when jsdom's
 * own `Element.matches` says its selector matches and its media query holds,
 * and the winner is decided by `!important`, then layer (theme < base <
 * components < utilities < unlayered), then specificity, then source order.
 * Custom properties inherit, so `var(--color-*)` resolves the way it does in
 * the page. The approach is vida-legacy-foundation's `src/test/theme-contrast.ts`,
 * extended to states.
 *
 * States. `hover`, `focus`, `focusVisible`, `active`, `visited` and `target`
 * are passed in, because jsdom cannot hover and never matches `:visited` or
 * `:target`: the selector's pseudo-class is rewritten to a marker attribute
 * this helper sets for the call. Unset, the element's own states are off.
 * A state on ANOTHER element (`group-*:`, `peer-*:`, `in-*:`, or any
 * selector whose state pseudo-class sits before a combinator) is `group`
 * (every ancestor) or `peer` (every preceding sibling, of the element or of
 * an ancestor). Those throw unless passed: `{ group: {} }` is "no ancestor in
 * any state", `{ group: { focusVisible: true } }` a keyboard-focused card.
 * The element's own `hover` and `active` imply its ancestors' (the pointer is
 * on them too), and its focus their `focusWithin`. `disabled`, `aria-*` and
 * every other attribute state come from the DOM itself, so a test puts the
 * element in that state (`button.disabled = true`) and measures. The
 * viewport is `width`; `viewportWidths()` gives one width in every range the
 * compiled sheet's media queries distinguish.
 *
 * It is an allowlist, and it never guesses (review rounds 1 to 3 of #62 each
 * found a form it decided silently). It models exactly the forms the site's
 * own classes compile to today, and `unmodelled()` proves that against every
 * class in `src/`:
 *   - at-rules: `@layer` theme/base/components/utilities (properties is
 *     skipped), `@media`, `@container`, the `@supports` conditions in
 *     `SUPPORTED` and their `not`, and the inert `@keyframes`, `@font-face`,
 *     `@property` and `@starting-style`;
 *   - media: width ranges (`width >= N`, `min-width: N`), `screen`, `all`,
 *     `print`, `not`, `and`, comma lists, and the features `hover`,
 *     `pointer`, `forced-colors`, `prefers-color-scheme`, `prefers-contrast`
 *     and `prefers-reduced-motion`, each of which throws unless its state is
 *     passed (`canHover`, `pointer`, `forcedColors`, `dark`, `contrast`,
 *     `reducedMotion`; `width` and `containerWidth` likewise), except
 *     `(hover: hover)` inside a rule that also needs `:hover` (outside a
 *     `:not()`), unless `canHover` is passed;
 *   - container queries only under an ancestor that sets `container-type`,
 *     and never in `em`;
 *   - pseudo-classes: the states above, `:-moz-focusring` (as
 *     `:focus-visible`), the structural and form ones in `FROM_DOM`, `:host`
 *     (never, no shadow roots), `:open` (the `open` attribute) and
 *     `:popover-open` (never, or a throw on a popover);
 *   - effects that change the colour painted without a colour class: a
 *     `filter` or `backdrop-filter` (`brightness-*`, `invert`, `blur`), a
 *     `mix-blend-mode` or `background-blend-mode`, `-webkit-text-fill-color`,
 *     `-webkit-text-stroke`, `background-clip: text`, a mask, and an
 *     animation whose keyframes set a colour, opacity or filter
 *     (`animate-pulse`). On the element or any ancestor, each one throws in
 *     `textColour`, `groundOf`, `opacityOf`, `colourOf` and `everyColour`,
 *     naming the class. Neutral values (`none`, `normal`, an unset
 *     filter chain) are read as what they are;
 *   - fills painted over the ground, which `groundOf` refuses, naming the
 *     class: an `inset` box-shadow layer that paints (a colour with alpha,
 *     unless its spread, blur and offsets are all 0), read from the resolved
 *     `box-shadow` on the element or an ancestor up to its ground, with
 *     Tailwind's `--tw-*` variables resolved from each element's own rules
 *     (they do not inherit; a `@property` initial value stands in for an
 *     unset one); an outline with a negative `outline-offset` that paints
 *     (style, width and colour, `currentColor` included), on the element; and
 *     a `::before` or `::after` that paints a box by any of: a background
 *     colour or image, a border side, an outline, a box-shadow layer, a mask
 *     or a filter (the sliding fill of a hover state), on either. Outer
 *     shadows on the element are not read;
 *   - the pseudo-elements that restyle the element's own text or its
 *     content (`::first-line`, `::first-letter`, `::selection` and the other
 *     highlights, `::details-content`): never modelled, so a rule that sets
 *     a property asked for throws.
 * Anything else throws when it could decide the value asked for, naming the
 * rule: a colour value it cannot read, a pseudo-class or at-rule outside the
 * list, a selector jsdom cannot parse, and, in `groundOf`, a gradient, an
 * image or an unreadable `background` shorthand. The sheet parser honours
 * escapes and quoted strings (`font-['Nunito']`) and throws if it ends out of
 * step.
 *
 * What it does not measure: Svelte's scoped component styles (vitest does
 * not load them), and the text of another box: `::before`, `::after`,
 * `::marker`, `::placeholder`, `::file-selector-button` and `::backdrop` are
 * skipped, so their colours are not checked. A `::before` or `::after` that
 * paints a box under the text is refused by `groundOf` (above): one in the
 * flow, or positioned to cover the element on both axes. A positioned one
 * that covers only part of an axis (an underline below the element, a bullet
 * in its padding, a half-width fill) is not read, so a half-width fill under
 * the label is a known false green. A length this file cannot size (`%`,
 * `em`, viewport units, `min()`, `max()`, `clamp()`) throws where a fill
 * or an inward outline depends on it. A positioned child that
 * paints a fill (`<span class="absolute inset-0 -z-10 bg-white">`) is not
 * read: `groundOf` walks ancestors only. Out-of-gamut oklch is clipped to sRGB.
 */

const root = process.cwd();
const require = createRequire(resolve(root, "package.json"));
const twDir = dirname(require.resolve("tailwindcss/package.json"));

const appCss = readFileSync(resolve(root, "src/app.css"), "utf8");
const themeVars = (css: string) =>
  [...css.slice(css.indexOf("@theme")).matchAll(/(--color-[\w-]+):\s*([^;]+);/g)].map(
    ([, name, value]) => [name, value.trim()] as [string, string],
  );
// Every colour token Tailwind's palette and app.css declare, used or not (the
// build emits only the used ones); app.css's own win, as they do in the build.
const sourceVars = new Map([
  ...themeVars(readFileSync(resolve(twDir, "theme.css"), "utf8")),
  ...themeVars(appCss),
]);

// A compiler remembers every candidate it has built, so the shared one's sheet
// only grows; `unmodelled` takes a fresh one to see exactly its classes.
const newCompiler = () =>
  compile(appCss, {
    base: resolve(root, "src"),
    loadStylesheet: async (id: string, base: string) => {
      const path = id === "tailwindcss" ? resolve(twDir, "index.css") : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, "utf8") };
    },
  });
const compiler = await newCompiler();

// ---------------------------------------------------------------- the sheet

interface Decl {
  prop: string;
  value: string;
  important: boolean;
}
interface Node {
  prelude: string;
  decls: Decl[];
  children: Node[];
}

function parse(css: string): Node[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  function block(nested = false): { decls: Decl[]; children: Node[] } {
    const decls: Decl[] = [];
    const children: Node[] = [];
    let buf = "";
    let quote = "";
    let depth = 0;
    let closed = false;
    while (i < src.length) {
      const ch = src[i++];
      if (ch === "\\") {
        // An escape (`\'` in `.font-\[\'Nunito\'\]`): the next character is
        // literal, in a string or out of one.
        buf += ch + (src[i++] ?? "");
      } else if (quote) {
        buf += ch;
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        buf += ch;
      } else if (ch === "(") {
        depth++;
        buf += ch;
      } else if (ch === ")") {
        depth--;
        buf += ch;
      } else if (ch === "{" && depth === 0) {
        const prelude = buf.trim();
        buf = "";
        children.push({ prelude, ...block(true) });
      } else if (ch === "}" && depth === 0) {
        closed = true;
        break;
      } else if (ch === ";" && depth === 0) {
        pushDecl(buf, decls, children);
        buf = "";
      } else {
        buf += ch;
      }
    }
    if (quote || depth !== 0 || (nested && !closed))
      throw new Error(
        `theme-colors cannot parse the compiled sheet near "${src.slice(Math.max(0, i - 80), i)}"`,
      );
    pushDecl(buf, decls, children);
    return { decls, children };
  }
  function pushDecl(text: string, decls: Decl[], children: Node[]) {
    const t = text.trim();
    if (!t) return;
    if (t.startsWith("@")) {
      children.push({ prelude: t, decls: [], children: [] });
      return;
    }
    const colon = t.indexOf(":");
    if (colon < 0) return;
    let value = t.slice(colon + 1).trim();
    const important = /!important$/.test(value);
    if (important) value = value.replace(/\s*!important$/, "");
    decls.push({ prop: t.slice(0, colon).trim(), value, important });
  }
  const top = block();
  if (i < src.length)
    throw new Error(`theme-colors cannot parse the compiled sheet: an unmatched "}" at ${i}`);
  return top.children;
}

const LAYERS = ["theme", "base", "components", "utilities"];
const UNLAYERED = LAYERS.length;

/** The conditional blocks a rule sits inside. */
interface Ctx {
  media: string[];
  /** `@container` preludes: a size query on the nearest container. */
  container: string[];
  /** At-rules this file has no model for; a rule under one throws when it
   *  matches the element and sets the property asked for. */
  unknown: string[];
}

interface Rule extends Ctx {
  /** The selector as written, and as handed to `matches` (state pseudo-classes
   *  rewritten to marker attributes). Null `test` when jsdom cannot parse it. */
  selector: string;
  test: string | null;
  /** When `test` is null: the selector with every pseudo-class this file
   *  does not model removed (assumed to hold), or null if even that does not
   *  parse. A rule whose loose form matches throws rather than drop. */
  loose: string | null;
  /** Why `test` is null, for the error. */
  why: string;
  /** Marker names in `test` for a state on another element (`g-hover`: an
   *  ancestor is hovered; `p-focus`: a preceding sibling has focus). */
  others: string[];
  specificity: number;
  layer: number;
  order: number;
  decls: Decl[];
  /** Set on a `::before` or `::after` fill (kept out of `rules`, see `boxSink`). */
  box?: "before" | "after";
}

// At-rules whose blocks never style an element on screen: keyframe steps,
// font and property registrations, and `@starting-style` (the first frame of
// a transition, never the resting value). `@media print` is a media query.
const INERT_AT =
  /^@(keyframes|-webkit-keyframes|font-face|property|starting-style|charset|import|namespace|page)\b/;

// The `@supports` conditions the compiled sheet holds today, each true in
// every browser the site targets: Tailwind's colour-mix and in-lab gradient
// upgrades, and preflight's placeholder-colour guard (whose `::placeholder`
// rule is a pseudo-element, skipped anyway). Compared with all whitespace
// removed. `not` of one of these is false. Anything else is not modelled.
const SUPPORTED = new Set(
  [
    "(color: color-mix(in lab, red, red))",
    "(background-image: linear-gradient(in lab, red, red))",
    "(not (-webkit-appearance: -apple-pay-button)) or (contain-intrinsic-size: 1px)",
    "(not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px)",
  ].map((c) => c.replace(/\s+/g, "")),
);

/** True or false for an `@supports` condition this file models, else null. */
function supportsHolds(cond: string): boolean | null {
  const c = cond.replace(/\s+/g, "");
  if (SUPPORTED.has(c)) return true;
  const not = /^not(.*)$/.exec(c);
  if (not && SUPPORTED.has(not[1])) return false;
  if (not && /^\((.*)\)$/.test(not[1]) && SUPPORTED.has(not[1].slice(1, -1))) return false;
  return null;
}

/** Descend into an at-rule's block: the context its rules apply under, or
 *  null for a block that styles nothing on screen. An at-rule this file does
 *  not model gives a context that throws when one of its rules decides a
 *  value. */
function atContext(prelude: string, ctx: Ctx): Ctx | null {
  if (prelude.startsWith("@media "))
    return { ...ctx, media: [...ctx.media, prelude.slice(6).trim()] };
  if (prelude.startsWith("@supports ")) {
    const holds = supportsHolds(prelude.slice(9).trim());
    if (holds === true) return ctx;
    if (holds === false) return null;
  } else if (prelude.startsWith("@container "))
    return { ...ctx, container: [...ctx.container, prelude.slice(10).trim()] };
  else if (INERT_AT.test(prelude)) return null;
  return { ...ctx, unknown: [...ctx.unknown, prelude] };
}

const marker = (state: string) => `data-tc-${state}`;

// The pseudo-classes this file models, and how. Every other one makes the
// selector unevaluable (see `Rule.loose`).
//   - States a visitor brings, rewritten to a marker attribute set from
//     `State` (jsdom cannot hover, and never matches :visited or :target).
//     Firefox's :-moz-focusring is its :focus-visible.
//   - Structure and form state jsdom reads from the DOM faithfully.
//   - :host never matches: no test renders into a shadow root.
//   - :open is the `open` attribute on the <dialog> and <details> that use
//     it here; :popover-open never matches an element without `popover`
//     (one with it throws, in `winner`).
const MARKED: Record<string, string> = {
  hover: "hover",
  focus: "focus",
  "focus-visible": "focus-visible",
  "focus-within": "focus-within",
  active: "active",
  visited: "visited",
  target: "target",
  "-moz-focusring": "focus-visible",
};
const FROM_DOM = new Set([
  "is",
  "where",
  "not",
  "first-child",
  "last-child",
  "only-child",
  "nth-child",
  "nth-last-child",
  "first-of-type",
  "last-of-type",
  "nth-of-type",
  "empty",
  "disabled",
  "enabled",
  "checked",
  "root",
]);
// Pseudo-elements that restyle the element's own text, or the content it
// holds, rather than drawing another box.
const OWN_TEXT = new Set([
  "first-line",
  "first-letter",
  "selection",
  "-moz-selection",
  "target-text",
  "spelling-error",
  "grammar-error",
  "highlight",
  "details-content",
]);
const REWRITTEN: Record<string, string> = {
  host: ":not(*)",
  open: "[open]",
  "popover-open": "[data-tc-popover-open]",
};

/** Mask escapes (`\:` in `.hover\:bg-dark`) so a scan sees real syntax, at
 *  the same offsets. */
const masked = (sel: string) => sel.replace(/\\./g, "__");

/** The index just past the bracket that closes the one at `at`. */
function closeOf(m: string, at: number): number {
  const open = m[at];
  const close = open === "(" ? ")" : "]";
  let depth = 0;
  for (let i = at; i < m.length; i++) {
    if (m[i] === open) depth++;
    else if (m[i] === close && --depth === 0) return i + 1;
  }
  return m.length;
}

/** Rewrite `sel`'s pseudo-classes for jsdom: markers and rewrites in, and
 *  every unmodelled one either kept (`drop: false`) or removed. Returns the
 *  selector, the names it did not model, and the markers it wrote for a
 *  state on another element.
 *
 *  A state pseudo-class in the subject compound (the last one, or inside an
 *  `:is()`/`:where()`/`:not()` of it whose own subject is the element) is the
 *  element's own: `[data-tc-hover]`. One in an earlier compound is another
 *  element's: `[data-tc-g-hover]` when a descendant or child combinator
 *  follows it (an ancestor: `group-hover:`, `in-focus:`), `[data-tc-p-hover]`
 *  when `~` or `+` does (a sibling: `peer-hover:`). */
function rewritePseudo(
  sel: string,
  drop: boolean,
): { sel: string; unmodelled: string[]; others: string[] } {
  const unmodelled: string[] = [];
  const others = new Set<string>();
  // `role` null: this list's subjects are the element itself. Otherwise
  // every compound in it is that other element ("g-" or "p-").
  function list(s: string, role: string | null): string {
    const m = masked(s);
    // Compounds and the separators between them, at this level.
    const segs: { a: number; b: number; sep: string }[] = [];
    let start = 0;
    for (let i = 0; i < m.length;) {
      const ch = m[i];
      if (ch === "(" || ch === "[") {
        i = closeOf(m, i);
        continue;
      }
      if (/[\s>+~,]/.test(ch)) {
        let j = i;
        while (j < m.length && /[\s>+~,]/.test(m[j])) j++;
        segs.push({ a: start, b: i, sep: m.slice(i, j) });
        start = i = j;
        continue;
      }
      i++;
    }
    segs.push({ a: start, b: m.length, sep: "" });
    // A compound is a subject when nothing but a comma or the end follows.
    const isSubject = (k: number) => {
      for (let j = k; j < segs.length; j++) {
        if (j > k && segs[j].a < segs[j].b) return false;
        if (segs[j].sep.includes(",") || !segs[j].sep) return true;
      }
      return true;
    };
    let out = "";
    segs.forEach((seg, k) => {
      const r = role ?? (isSubject(k) ? "" : /[~+]/.test(seg.sep) ? "p-" : "g-");
      out += compound(s, m, seg.a, seg.b, r) + s.slice(seg.b, seg.b + seg.sep.length);
    });
    return out;
  }
  function compound(s: string, m: string, a: number, b: number, role: string): string {
    let out = "";
    for (let i = a; i < b;) {
      if (m[i] === "[") {
        const j = closeOf(m, i);
        out += s.slice(i, j);
        i = j;
        continue;
      }
      if (m[i] !== ":") {
        out += s[i++];
        continue;
      }
      if (m[i + 1] === ":") {
        // A pseudo-element; `styleRule` has already decided what it means.
        out += s.slice(i, b);
        break;
      }
      const hit = /^:([\w-]+)(\()?/.exec(m.slice(i, b));
      if (!hit) {
        out += s[i++];
        continue;
      }
      const name = hit[1];
      let end = i + hit[0].length;
      let arg = "";
      if (hit[2]) {
        end = closeOf(m, end - 1);
        arg = s.slice(i + hit[0].length, end - 1);
      }
      if (MARKED[name] && !hit[2]) {
        if (role) others.add(role + MARKED[name]);
        out += `[${marker(role + MARKED[name])}]`;
      } else if (REWRITTEN[name] && !hit[2]) out += REWRITTEN[name];
      else if (hit[2] && (name === "is" || name === "where" || name === "not"))
        out += `:${name}(${list(arg, role || null)})`;
      else if (FROM_DOM.has(name) && !masked(arg).includes(":")) out += s.slice(i, end);
      else {
        unmodelled.push(`:${name}`);
        if (!drop) out += s.slice(i, end);
      }
      i = end;
    }
    return out;
  }
  return { sel: list(sel, null), unmodelled, others: [...others] };
}

/** Split on top-level commas (not inside parens or brackets). */
function splitList(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let quote = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\") {
      cur += ch + (s[++i] ?? "");
      continue;
    }
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0 && !quote) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function specificity(sel: string): number {
  // `:where()` weighs nothing; `:is()`/`:not()`/`:has()` weigh their argument.
  // Escaped characters (`\:` in a variant class) are part of a name.
  let s = masked(sel);
  for (let prev = ""; prev !== s;) {
    prev = s;
    s = s.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, "");
  }
  s = s.replace(/:(is|not|has)\(/g, " (");
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes =
    (s.match(/\.(?:\\.|[\w-])+/g) ?? []).length +
    (s.match(/\[[^\]]*\]/g) ?? []).length +
    (s.match(/(?<!:):[\w-]+/g) ?? []).length;
  const tags = (s.replace(/\[[^\]]*\]/g, "").match(/(?:^|[\s>+~(])([a-z][a-z0-9-]*)/g) ?? [])
    .length;
  return ids * 100 + classes * 10 + tags;
}

function collect(nodes: Node[], layer: number, ctx: Ctx, out: Rule[]) {
  for (const n of nodes) {
    const layerAt = /^@layer\s+([\w-]+)$/.exec(n.prelude);
    if (layerAt && (LAYERS.includes(layerAt[1]) || layerAt[1] === "properties")) {
      if (layerAt[1] === "properties") continue;
      collect(n.children, LAYERS.indexOf(layerAt[1]), ctx, out);
      continue;
    }
    // `@layer a, b;` declares an order and holds no rules.
    if (/^@layer\s+[\w-]+(\s*,\s*[\w-]+)*$/.test(n.prelude) && !n.children.length) continue;
    // A keyframes block styles nothing at rest, but an animation that runs
    // it repaints the element; remember the ones that touch a colour.
    const frames = /^@(?:-webkit-)?keyframes\s+(\S+)/.exec(n.prelude);
    if (frames) {
      const paints = (x: Node): boolean =>
        x.decls.some((d) => PAINT.test(d.prop)) || x.children.some(paints);
      if (paints(n)) paintingKeyframes.add(frames[1]);
      continue;
    }
    if (n.prelude.startsWith("@")) {
      const inner = atContext(n.prelude, ctx);
      if (inner) collect(n.children, layer, inner, out);
      continue;
    }
    styleRule(splitList(n.prelude), n, layer, ctx, out);
  }
}

/** Whether jsdom's selector engine accepts `x`. */
function parsesSelector(x: string): boolean {
  try {
    document.documentElement.matches(x);
    return true;
  } catch {
    return false;
  }
}

/** A `::before` or `::after` that sets a fill, kept in `boxSink` for `refuseFills`.
 *  Its host is matched as any rule's is. A host this file cannot evaluate throws
 *  in `winner` when it could match, as an unmodelled rule does. */
function keepFill(sel: string, pe: RegExpExecArray, n: Node, layer: number, ctx: Ctx) {
  if (
    !n.decls.some(
      (d) => BOX_PAINT.test(d.prop) || d.prop === "content" || !PSEUDO_SAFE.test(d.prop),
    )
  )
    return;
  let host = sel.slice(0, pe.index).replace(/\s+$/, " ");
  if (!host.trim() || /[\s>+~]$/.test(host)) host += "*";
  const exact = rewritePseudo(host, false);
  const open = exact.unmodelled.length > 0 || !parsesSelector(exact.sel);
  const dropped = open ? rewritePseudo(host, true).sel.trim() || "*" : "";
  boxSink!.push({
    selector: sel,
    test: open ? null : exact.sel,
    loose: open && parsesSelector(dropped) ? dropped : null,
    why: open
      ? exact.unmodelled.length
        ? `theme-colors does not model ${exact.unmodelled.join(", ")}`
        : "jsdom cannot parse it"
      : "",
    others: exact.others,
    specificity: specificity(sel),
    layer: layer < 0 ? UNLAYERED : layer,
    order: boxSink!.length,
    ...ctx,
    decls: n.decls,
    box: pe[1] as "before" | "after",
  });
}

/** A style rule, and the conditional blocks nested in it (`&:hover`, a
 *  forced-colors fallback), each under its parent's selectors. */
function styleRule(sels: string[], n: Node, layer: number, ctx: Ctx, out: Rule[]) {
  const parses = (x: string) => {
    try {
      document.documentElement.matches(x);
      return true;
    } catch {
      return false;
    }
  };
  for (const sel of sels) {
    const pe = /::(-?[\w-]+)/.exec(masked(sel));
    if (pe && boxSink && /^(before|after)$/.test(pe[1])) {
      keepFill(sel, pe, n, layer, ctx);
      continue;
    }
    if (pe && !OWN_TEXT.has(pe[1])) continue; // another box: not measured
    // `::first-line`, `::selection`, `::details-content`: the element's own
    // glyphs, or its content's, restyled. Never modelled, so a rule that
    // sets the property asked for throws instead of dropping.
    let host = pe ? sel.slice(0, pe.index).replace(/\s+$/, " ") : sel;
    if (pe && (!host.trim() || /[\s>+~]$/.test(host))) host += "*";
    const exact = rewritePseudo(host, false);
    let test: string | null = exact.sel;
    let loose: string | null = null;
    let why = "";
    if (pe || exact.unmodelled.length || !parses(exact.sel)) {
      test = null;
      why = pe
        ? `theme-colors does not model ::${pe[1]}, which recolours the element's own text`
        : exact.unmodelled.length
          ? `theme-colors does not model ${exact.unmodelled.join(", ")}`
          : "jsdom cannot parse it";
      const dropped = rewritePseudo(host, true).sel.trim() || "*";
      loose = parses(dropped) ? dropped : null;
    }
    out.push({
      selector: sel,
      test,
      loose,
      why,
      others: exact.others,
      specificity: specificity(sel),
      layer: layer < 0 ? UNLAYERED : layer,
      order: out.length,
      ...ctx,
      decls: n.decls,
    });
  }
  for (const c of n.children) {
    if (c.prelude.startsWith("@")) {
      const inner = atContext(c.prelude, ctx);
      if (inner) styleRule(sels, c, layer, inner, out);
    } else if (masked(c.prelude).includes("&"))
      styleRule(
        sels.flatMap((p) =>
          splitList(c.prelude).map((x) =>
            [...masked(x)].map((ch, i) => (ch === "&" ? p : x[i])).join(""),
          ),
        ),
        c,
        layer,
        ctx,
        out,
      );
    else
      styleRule(
        sels.flatMap((p) => splitList(c.prelude).map((x) => `${p} ${x}`)),
        c,
        layer,
        ctx,
        out,
      );
  }
}

let cached: { size: number; rules: Rule[]; boxes: Rule[]; effects: string[] } | undefined;
/** The `initial-value` of each `@property` the compiled sheet declares: what a
 *  custom property with no value of its own takes (Tailwind's `--tw-*` defaults). */
let initials = new Map<string, string>();
function initialsOf(nodes: Node[], out: Map<string, string>) {
  for (const n of nodes) {
    const at = /^@property\s+(--[\w-]+)/.exec(n.prelude);
    const init = at && n.decls.find((d) => d.prop === "initial-value");
    if (at && init) out.set(at[1], init.value.trim());
    initialsOf(n.children, out);
  }
}
const seen = new Set<string>();
/** Where `styleRule` puts the `::before`/`::after` rules that paint a fill. Set only
 *  while `sheet()` collects, so `rulesOf` (the audit) is unchanged. */
let boxSink: Rule[] | undefined;
/** The properties of a `::before` or `::after` that can paint a box: a rule that sets
 *  one is kept for `refuseFills`. The `--tw-*` variables are kept too, since a
 *  pseudo-element's own shadow or ring is built from them. */
const BOX_PAINT =
  /^(background(-|$)|box-shadow$|border(-|$)|outline(-|$)|mask(-|$)|-webkit-mask(-|$)|filter$|--tw-)/;

/** The properties a `::before` or `::after` may set and still paint nothing: its content,
 *  where it sits, its size, its transform and opacity, its transition. A pseudo rule that sets
 *  any other property is kept and read, so the next paint property is refused too (round 7).
 *  Custom properties are read through the cascade of the properties they feed. */
const PSEUDO_SAFE =
  /^(display$|position$|top$|right$|bottom$|left$|inset(-|$)|width$|height$|min-|max-|inline-size$|block-size$|box-sizing$|margin(-|$)|padding(-|$)|z-index$|transform(-|$)|translate$|rotate$|scale$|transform-origin$|opacity$|transition(-|$)|animation-(duration|delay|timing-function|iteration-count|direction|fill-mode|play-state)$|overflow(-|$)|scroll-|flex(-|$)|order$|grid(-|$)|gap$|row-gap$|column-gap$|align-|justify-|place-|float$|clear$|pointer-events$|visibility$|isolation$|aspect-ratio$|cursor$|user-select$|vertical-align$)/;

/** Depth of the calls in progress that already read the document's classes. */
let scanning = 0;

/** Run `fn` with the document's classes read once, at the outermost call. `sheet()` walks
 *  the whole document, and the cascade asks for it on every property it reads, so a call
 *  that reads many properties would otherwise walk it hundreds of times. The classes cannot
 *  change inside one call: `withState` only sets marker attributes. */
function scan<T>(fn: () => T): T {
  if (scanning++ === 0) collectClasses();
  try {
    return fn();
  } finally {
    scanning--;
  }
}

function collectClasses() {
  for (const el of document.querySelectorAll("[class]")) {
    for (const c of el.classList) seen.add(c);
  }
}

function sheet(): Rule[] {
  if (scanning === 0) collectClasses();
  if (cached && cached.size === seen.size) return cached.rules;
  const rules: Rule[] = [];
  const boxes: Rule[] = [];
  boxSink = boxes;
  try {
    const tree = parse(compiler.build([...seen]));
    initials = new Map();
    initialsOf(tree, initials);
    collect(tree, UNLAYERED, { media: [], container: [], unknown: [] }, rules);
  } finally {
    boxSink = undefined;
  }
  cached = {
    size: seen.size,
    rules,
    boxes,
    effects: EFFECTS.filter((p) => rules.some((r) => r.decls.some((d) => d.prop === p))),
  };
  return rules;
}

// The properties that decide what colour a visitor is shown: the ones this
// file reads, and the effects it refuses to measure through.
const EFFECTS = [
  "filter",
  "backdrop-filter",
  "-webkit-backdrop-filter",
  "mix-blend-mode",
  "background-blend-mode",
  "-webkit-text-fill-color",
  "-webkit-text-stroke",
  "-webkit-text-stroke-width",
  "background-clip",
  "-webkit-background-clip",
  "mask",
  "mask-image",
  "-webkit-mask",
  "-webkit-mask-image",
  "animation",
  "animation-name",
];
const PAINT = new RegExp(
  "^(color|opacity|background(-color|-image)?|border(-(top|right|bottom|left|inline|block)(-(start|end))?)?(-color)?|outline(-color|-style|-width)?|container-type|--.*|" +
    EFFECTS.join("|") +
    ")$",
);
const paintingKeyframes = new Set<string>();

const rulesOf = async (classes: string[]) => {
  const rules: Rule[] = [];
  collect(
    parse((await newCompiler()).build(classes)),
    UNLAYERED,
    { media: [], container: [], unknown: [] },
    rules,
  );
  return rules;
};
let baseline: number | undefined;

/**
 * What `classes` compile to: `rules`, the number of rules they add to the
 * sheet app.css gives with no classes at all (so an audit of no real class
 * reads 0), and `unmodelled`, the parts this file cannot evaluate: a rule
 * with an unmodelled selector, pseudo-element or at-rule that sets a property
 * the helper reads or refuses (`PAINT`), or a media or container query that
 * throws even when every state is given. Empty `unmodelled` means every rule
 * those classes produce is modelled.
 */
export async function audit(classes: string[]): Promise<{ rules: number; unmodelled: string[] }> {
  baseline ??= (await rulesOf([])).length;
  const rules = await rulesOf(classes);
  const read = PAINT;
  const full: State = {
    width: 1024,
    containerWidth: 512,
    dark: false,
    contrast: "no-preference",
    reducedMotion: false,
    forcedColors: false,
    pointer: "fine",
    canHover: true,
  };
  const out = new Set<string>();
  for (const r of rules) {
    const sets = r.decls.some((d) => read.test(d.prop));
    if (sets && r.test === null) out.add(`${r.selector}: ${r.why}`);
    if (sets && r.unknown.length) out.add(`${r.selector}: under ${r.unknown.join(" ")}`);
    for (const m of r.media)
      try {
        mediaHolds(m, full);
      } catch (e) {
        out.add(`@media ${m}: ${(e as Error).message}`);
      }
    for (const c of r.container)
      if (/[\d.]em\b/.test(c) || !/^(not\s+)?\(/.test(c)) out.add(`@container ${c}`);
      else
        try {
          mediaHolds(c, { width: 512 });
        } catch (e) {
          out.add(`@container ${c}: ${(e as Error).message}`);
        }
  }
  return { rules: rules.length - baseline, unmodelled: [...out] };
}

/** `audit(classes).unmodelled`. */
export async function unmodelled(classes: string[]): Promise<string[]> {
  return (await audit(classes)).unmodelled;
}

const escapeClass = (c: string) => c.replace(/[^\w-]/g, (ch) => `\\${ch}`);

// ---------------------------------------------------------------- state

/** The states of another element: an ancestor (`group`) or a preceding
 *  sibling (`peer`). Passing the object says what it is in; a flag left out
 *  is off. */
export interface OtherState {
  hover?: boolean;
  focus?: boolean;
  focusVisible?: boolean;
  focusWithin?: boolean;
  active?: boolean;
  visited?: boolean;
  target?: boolean;
}

export interface State {
  /** Every ancestor's state, for `group-*:`, `in-*:` and any selector that
   *  names a state on an ancestor. Required when one decides the value,
   *  except where the element's own `hover`, `active` or focus implies it. */
  group?: OtherState;
  /** Every preceding sibling's state (the element's and its ancestors'),
   *  for `peer-*:`. Required when one decides the value. */
  peer?: OtherState;
  hover?: boolean;
  focus?: boolean;
  focusVisible?: boolean;
  active?: boolean;
  /** `:visited`: a link the visitor has followed. */
  visited?: boolean;
  /** `:target`: the element an anchor link arrived on. */
  target?: boolean;
  /** `(pointer: ...)` and `(any-pointer: ...)`: a mouse is `fine`, a finger
   *  `coarse`. Required when a pointer query decides the value. */
  pointer?: "fine" | "coarse" | "none";
  /** `(hover: hover)`, `(any-hover: hover)`: the device can hover. Required
   *  when a hover-capability query decides the value, except inside a rule
   *  that also needs `:hover`, which only `hover: true` reaches (Tailwind's
   *  own `hover:` compiles to exactly that). */
  canHover?: boolean;
  /** Viewport width in CSS px. Required when a width query decides the value. */
  width?: number;
  /** Inline size in CSS px of the element's nearest `@container`. Required
   *  when a container query (`@md:`, `@[...]:`) decides the value. */
  containerWidth?: number;
  /** Windows forced colours. Required when a forced-colors query decides the
   *  value. */
  forcedColors?: boolean;
  /** `prefers-color-scheme: dark`. Required when a scheme query decides the
   *  value: Tailwind's `dark:` follows the OS, so both schemes are real. */
  dark?: boolean;
  /** `prefers-contrast`. Required when a contrast query decides the value. */
  contrast?: "more" | "less" | "no-preference";
  /** `prefers-reduced-motion: reduce`. Required when a motion query decides
   *  the value: reduced motion is an OS setting, so both visitors are real. */
  reducedMotion?: boolean;
}

const FLAGS: [keyof OtherState, string][] = [
  ["hover", "hover"],
  ["focus", "focus"],
  ["focusVisible", "focus-visible"],
  ["focusWithin", "focus-within"],
  ["active", "active"],
  ["visited", "visited"],
  ["target", "target"],
];

/** The markers for another element's state that the current call leaves
 *  undecided: a rule that needs one throws when it could match. */
let undecided = new Set<string>();

/** Each flag of another element's state: true, false, or undefined when the
 *  caller did not say and nothing implies it. */
function otherFlags(
  given: OtherState | undefined,
  implied: Partial<Record<keyof OtherState, boolean>>,
  who: string,
): Map<string, boolean | undefined> {
  const out = new Map<string, boolean | undefined>();
  const g = given && {
    ...given,
    focus: given.focus || given.focusVisible,
    focusWithin: given.focusWithin || given.focus || given.focusVisible,
  };
  for (const [key, name] of FLAGS) {
    const said = g ? !!g[key] : undefined;
    if (implied[key]) {
      if (said === false)
        throw new Error(
          `the element's own state puts every ancestor in ${name}, so { ${who}: { ${key}: false } } cannot hold`,
        );
      out.set(name, true);
    } else out.set(name, said);
  }
  return out;
}

/** Set the marker attributes for `state` around `fn`. Hover and active reach
 *  the ancestors too, as they do in the browser; focus is the element's own.
 *  A state on another element marks every ancestor (`group`) or every
 *  preceding sibling (`peer`). */
function withState<T>(el: Element, state: State, fn: () => T): T {
  return scan(() => withStateIn(el, state, fn));
}

function withStateIn<T>(el: Element, state: State, fn: () => T): T {
  const hovering = state.hover || state.group?.hover || state.peer?.hover;
  if (state.canHover === false && hovering)
    throw new Error(
      "{ canHover: false } is a device that cannot hover, so nothing on it is hovered",
    );
  const set: [Element, string][] = [];
  const mark = (n: Element, s: string) => {
    if (!n.hasAttribute(marker(s))) {
      n.setAttribute(marker(s), "");
      set.push([n, s]);
    }
  };
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (state.hover) mark(n, "hover");
    if (state.active) mark(n, "active");
    if ((state.focus || state.focusVisible) && n !== el) mark(n, "focus-within");
  }
  if (state.focus || state.focusVisible) mark(el, "focus");
  if (state.focusVisible) mark(el, "focus-visible");
  if (state.visited) mark(el, "visited");
  if (state.target) mark(el, "target");
  if (state.focus || state.focusVisible) mark(el, "focus-within");
  const group = otherFlags(
    state.group,
    {
      hover: state.hover,
      active: state.active,
      focusWithin: state.focus || state.focusVisible,
    },
    "group",
  );
  const peer = otherFlags(state.peer, {}, "peer");
  const open = new Set<string>();
  for (const [name, on] of group) {
    if (on === undefined) open.add(`g-${name}`);
    else if (on) for (let n = el.parentElement; n; n = n.parentElement) mark(n, `g-${name}`);
  }
  for (const [name, on] of peer) {
    if (on === undefined) open.add(`p-${name}`);
    else if (on)
      for (let n: Element | null = el; n; n = n.parentElement)
        for (let p = n.previousElementSibling; p; p = p.previousElementSibling)
          mark(p, `p-${name}`);
  }
  const outer = undecided;
  undecided = open;
  try {
    return fn();
  } finally {
    undecided = outer;
    for (const [n, s] of set) n.removeAttribute(marker(s));
  }
}

/** True or false; throws with the reason when the query cannot be decided
 *  for this state, or is not fully parsed. Never a guess. */
function mediaHolds(query: string, state: State, needsHover = false): boolean {
  return query.split(/\s*,\s*/).some((q) => {
    const r = featureHolds(q.trim(), state);
    if (typeof r === "string") throw new Error(r);
    return r;
  });
  function featureHolds(q: string, s: State): boolean | string {
    const not = /^not\s+(?:all\s+and\s+)?(.*)$/.exec(q);
    if (not) {
      const r = featureHolds(not[1], s);
      return typeof r === "string" ? r : !r;
    }
    const parts = q.split(/\s+and\s+/);
    if (parts.length > 1) {
      for (const p of parts) {
        const r = featureHolds(p, s);
        if (r !== true) return r;
      }
      return true;
    }
    if (q === "screen" || q === "all") return true;
    if (q === "print") return false;
    const width = /^\((?:(min|max)-)?width\s*(>=|<=|<|>|:)\s*([\d.]+)(rem|px|em)\)$/.exec(q);
    if (width) {
      if (s.width === undefined)
        return `the value depends on a viewport width query "${q}"; pass { width } (see viewportWidths())`;
      const px = Number(width[3]) * (width[4] === "px" ? 1 : 16);
      const op =
        width[2] === ":" ? (width[1] === "min" ? ">=" : width[1] === "max" ? "<=" : "") : width[2];
      if (!op || (width[1] && width[2] !== ":"))
        return `theme-colors cannot evaluate the media query "${q}"`;
      return { ">=": s.width >= px, "<=": s.width <= px, "<": s.width < px, ">": s.width > px }[
        op
      ]!;
    }
    const feature = /^\(([\w-]+)\s*:\s*([\w-]+)\)$/.exec(q);
    if (feature) {
      const [, name, value] = feature;
      const need = (key: string, why = "") => `the value depends on "${q}"${why}; pass { ${key} }`;
      if ((name === "hover" || name === "any-hover") && (value === "hover" || value === "none")) {
        if (value === "hover" && needsHover && s.canHover === undefined) return true;
        if (s.canHover === undefined) return need("canHover", " (phones cannot hover)");
        return (value === "hover") === s.canHover;
      }
      if (
        (name === "pointer" || name === "any-pointer") &&
        ["fine", "coarse", "none"].includes(value)
      ) {
        if (s.pointer === undefined) return need("pointer", " (phones are coarse)");
        return value === s.pointer;
      }
      if (name === "forced-colors" && (value === "active" || value === "none")) {
        if (s.forcedColors === undefined) return need("forcedColors");
        return (value === "active") === s.forcedColors;
      }
      if (name === "prefers-color-scheme" && (value === "dark" || value === "light")) {
        if (s.dark === undefined)
          return `the value depends on "${q}" (Tailwind's dark: follows the OS); pass { dark: false } and { dark: true }`;
        return (value === "dark") === s.dark;
      }
      if (name === "prefers-reduced-motion" && (value === "reduce" || value === "no-preference")) {
        if (s.reducedMotion === undefined) return need("reducedMotion");
        return (value === "reduce") === s.reducedMotion;
      }
      if (
        name === "prefers-contrast" &&
        ["more", "less", "no-preference", "custom"].includes(value)
      ) {
        if (s.contrast === undefined) return `the value depends on "${q}"; pass { contrast }`;
        return value === s.contrast || (value === "custom" && s.contrast !== "no-preference");
      }
    }
    return `theme-colors cannot evaluate the media query "${q}"`;
  }
}

/** True or false for a container query, given the nearest container's
 *  inline size; throws when that size is needed and not passed. */
function containerHolds(prelude: string, el: Element, state: State): boolean {
  // A named query (`@container sidebar (...)`) asks a particular ancestor,
  // which one size cannot stand for.
  if (!/^(not\s+)?\(/.test(prelude))
    throw new Error(
      `theme-colors cannot evaluate the named container query "@container ${prelude}"`,
    );
  // An `em` in a container query is the container's font size, not 16px.
  if (/[\d.]em\b/.test(prelude))
    throw new Error(`theme-colors cannot evaluate the em container query "@container ${prelude}"`);
  // With no container ancestor the query matches nothing, as in the browser.
  let container: Element | null = null;
  for (let n = el.parentElement; n && !container; n = n.parentElement) {
    const type = winner(n, "container-type", state)?.value;
    if (type !== undefined && type !== "normal") container = n;
  }
  if (!container) return false;
  if (state.containerWidth === undefined)
    throw new Error(
      `the value depends on a container query "@container ${prelude}"; pass { containerWidth } (see containerWidths())`,
    );
  try {
    return mediaHolds(prelude, { width: state.containerWidth });
  } catch {
    throw new Error(`theme-colors cannot evaluate the container query "@container ${prelude}"`);
  }
}

function edgesOf(queries: string[]): number[] {
  const edges = new Set<number>();
  for (const m of queries)
    for (const [, n, unit] of m.matchAll(/width\s*(?:>=|<=|<|>|:)\s*([\d.]+)(rem|px|em)/g))
      edges.add(Number(n) * (unit === "px" ? 1 : 16));
  const sorted = [...edges].sort((a, b) => a - b);
  return [...sorted.map((e) => e - 1), (sorted.at(-1) ?? 1279) + 1].filter((w) => w > 0);
}

/** One width in every range the compiled sheet's width queries distinguish. */
export function viewportWidths(): number[] {
  return edgesOf(sheet().flatMap((r) => r.media));
}

/** One container size in every range the compiled sheet's container queries
 *  distinguish. */
export function containerWidths(): number[] {
  return edgesOf(sheet().flatMap((r) => r.container));
}

// ---------------------------------------------------------------- cascade

interface Win {
  value: string;
  key: number[];
  /** The selector it came from, for an error. */
  from: string;
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** `sel` with every `:not(...)` removed: what it requires, not what it
 *  excludes. */
function withoutNot(sel: string): string {
  let out = sel;
  for (let at = out.indexOf(":not("); at >= 0; at = out.indexOf(":not("))
    out = out.slice(0, at) + out.slice(closeOf(out, at + 4));
  return out;
}

const otherKey = (o: string) => {
  const name = o.slice(2);
  return FLAGS.find(([, n]) => n === name)![0];
};
const otherWords = (o: string) =>
  `${o.startsWith("g-") ? "an ancestor (group)" : "a preceding sibling (peer)"} is in :${o.slice(2)}`;
const otherHint = (o: string) => `{ ${o.startsWith("g-") ? "group" : "peer"}: { ${otherKey(o)} } }`;

function namesClassOf(rule: Rule, el: Element): boolean {
  return [...el.classList].some((c) => {
    const at = rule.selector.indexOf(`.${escapeClass(c)}`);
    if (at < 0) return false;
    const next = rule.selector[at + 1 + escapeClass(c).length];
    return next === undefined || !/[\w-]/.test(next);
  });
}

/** The `::before` or `::after` rules that paint a fill, for `winner`. */
function boxRules(box: "before" | "after"): Rule[] {
  sheet();
  return cached!.boxes.filter((r) => r.box === box);
}

/** The winning declaration of `prop` on `el` itself (no inheritance), or of
 *  `prop` on its `box` pseudo-element. */
function winner(
  el: Element,
  prop: string,
  state: State,
  opts: { box?: "before" | "after"; neutralUnmodelled?: boolean } = {},
): Win | undefined {
  const box = opts.box;
  let best: Win | undefined;
  const consider = (value: string, key: number[], from: string) => {
    if (!best || compareKeys(key, best.key) > 0) best = { value, key, from };
  };
  for (const r of box ? boxRules(box) : sheet()) {
    const decls = r.decls.filter((d) => d.prop === prop);
    if (!decls.length) continue;
    if (r.test === null) {
      // A declared `none` paints nothing, so it cannot decide a fill. Passed over
      // only where `neutralUnmodelled` says so (preflight's `:-moz-ui-invalid {
      // box-shadow: none }` would otherwise refuse every element).
      if (
        opts.neutralUnmodelled &&
        decls.every((d) => UNPAINTED.test(d.value.trim().toLowerCase()))
      )
        continue;
      if (namesClassOf(r, el) || (r.loose !== null && el.matches(r.loose)))
        throw new Error(
          `"${r.selector}" may set ${prop} on <${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}">, and ${r.why}`,
        );
      continue;
    }
    const open = r.others.filter((o) => undecided.has(o));
    if (open.length) {
      let t = r.test;
      for (const o of open) t = t.split(`[${marker(o)}]`).join(":is(*)");
      if (el.matches(t))
        throw new Error(
          `"${r.selector}" may set ${prop} on <${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}"> when ${open.map(otherWords).join(" or ")}; pass ${open.map(otherHint).join(" and ")}`,
        );
    }
    if (!el.matches(r.test)) continue;
    if (r.unknown.length)
      throw new Error(
        `"${r.selector}" sets ${prop} on this element under ${r.unknown.join(" ")}, which theme-colors does not model`,
      );
    if (el.hasAttribute("popover") && masked(r.selector).includes(":popover-open"))
      throw new Error(`"${r.selector}" depends on whether this popover is open`);
    const needsHover = withoutNot(masked(r.selector)).includes(":hover");
    if (!r.media.every((m) => mediaHolds(m, state, needsHover))) continue;
    if (!r.container.every((c) => containerHolds(c, el, state))) continue;
    for (const d of decls) {
      const layer = d.important ? UNLAYERED - r.layer : r.layer;
      consider(d.value, [d.important ? 1 : 0, 0, layer, r.specificity, r.order], r.selector);
    }
  }
  // A pseudo-element has no style attribute of its own.
  const style = box ? undefined : (el as HTMLElement).style;
  const inline = style?.getPropertyValue(prop);
  if (inline) {
    const important = style.getPropertyPriority(prop) === "important";
    consider(inline, [important ? 1 : 0, 1, 0, 0, 0], "the style attribute");
  }
  return best;
}

/**
 * The value the cascade gives `prop` on `el` in `state`; undefined when no
 * rule sets it. Custom properties inherit; other properties do not here (see
 * `textColour` for `color`).
 */
export function computed(el: Element, prop: string, state: State = {}): string | undefined {
  return withState(el, state, () => {
    if (!prop.startsWith("--")) return winner(el, prop, state)?.value;
    return varOf(el, prop, state);
  });
}

/** A custom property as `el` has it, or as its `box` pseudo-element does. Tailwind's
 *  `--tw-*` variables do not inherit: the element's own value, else the initial value
 *  its `@property` gives. A theme variable (`--color-*`) inherits down the DOM. Call
 *  inside `withState`. */
function varOf(
  el: Element,
  name: string,
  state: State,
  box?: "before" | "after",
): string | undefined {
  if (name.startsWith("--tw-")) {
    sheet();
    const own = winner(el, name, state, box ? { box } : {})?.value;
    return own !== undefined && own !== "inherit" ? own : initials.get(name);
  }
  for (let n: Element | null = el; n; n = n.parentElement) {
    const v = winner(n, name, state)?.value;
    if (v !== undefined && v !== "inherit") return v;
  }
  return sourceVars.get(name);
}

/**
 * Which of several properties that set the same thing (a shorthand and its
 * longhands: `outline` and `outline-style`) wins on `el` in `state`, and its
 * value. Undefined when none is set.
 */
export function cascadeWinner(
  el: Element,
  props: string[],
  state: State = {},
): { prop: string; value: string } | undefined {
  return withState(el, state, () => {
    const w = winnerOf(el, props, state);
    return w && { prop: w.prop, value: w.value };
  });
}

/**
 * Every value any rule for `el` declares for `prop`, in any state, at any
 * width or under any media query: what "every colour it can take" means. A
 * rule naming one of `el`'s classes through a selector jsdom cannot evaluate
 * counts too.
 */
export function declaredAnywhere(el: Element, prop: string): string[] {
  const every: OtherState = Object.fromEntries(FLAGS.map(([k]) => [k, true]));
  const all: State = {
    hover: true,
    focusVisible: true,
    active: true,
    visited: true,
    target: true,
    group: every,
    peer: every,
  };
  return withState(el, all, () =>
    sheet()
      .filter(
        (r) =>
          namesClassOf(r, el) ||
          (r.test !== null && el.matches(r.test)) ||
          (r.loose !== null && el.matches(r.loose)),
      )
      .flatMap((r) => r.decls.filter((d) => d.prop === prop).map((d) => d.value)),
  );
}

// ---------------------------------------------------------------- colour

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED: Record<string, Rgba> = {
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

const num = (s: string, scale = 1) => (s.endsWith("%") ? (parseFloat(s) / 100) * scale : +s);

function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((c) => {
    const x = Math.min(1, Math.max(0, c));
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  }) as [number, number, number];
}

function parseColour(raw: string, el: Element | null, state: State): Rgba {
  const v = raw.trim();
  const named = NAMED[v.toLowerCase()];
  if (named) return named;
  if (/^currentcolor$/i.test(v)) {
    if (!el) throw new Error("currentColor outside an element");
    return textColour(el, state);
  }
  if (v === "inherit") {
    if (!el?.parentElement) return NAMED.black;
    return textColour(el.parentElement, state);
  }
  const variable = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/.exec(v);
  if (variable) {
    const value = (el && computed(el, variable[1], state)) ?? sourceVars.get(variable[1]);
    const chosen = value === undefined || value === "initial" ? variable[2] : value;
    if (chosen === undefined)
      throw new Error(`${variable[1]} is not defined in the compiled theme`);
    return parseColour(chosen, el, state);
  }
  const hex = /^#([0-9a-f]{3,8})$/i.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const rgb =
    /^rgba?\(\s*([\d.%]+)[\s,]+([\d.%]+)[\s,]+([\d.%]+)\s*(?:[/,]\s*([\d.%]+)\s*)?\)$/.exec(v);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((c) => num(c, 255));
    return { r, g, b, a: rgb[4] === undefined ? 1 : num(rgb[4]) };
  }
  // `color-mix(in oklab, X 40%, transparent)`: X may be another color-mix (Tailwind's
  // `inset-shadow-white/0`), and a missing share is 100%.
  const mix = /^color-mix\(in (?:srgb|oklab|oklch),\s*(.+)\)$/.exec(v);
  const parts = mix ? splitList(mix[1]) : [];
  if (mix && parts.length === 2 && parts[1] === "transparent") {
    const share = /^(.*\S)\s+([\d.]+)%$/.exec(parts[0]);
    const c = parseColour(share ? share[1] : parts[0], el, state);
    return { ...c, a: c.a * (share ? Number(share[2]) / 100 : 1) };
  }
  const lch =
    /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+(-?[\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/.exec(v);
  if (lch) {
    const [r, g, b] = oklchToRgb(num(lch[1]), num(lch[2], 0.4), Number(lch[3]));
    return { r, g, b, a: lch[4] === undefined ? 1 : num(lch[4]) };
  }
  throw new Error(`theme-colors cannot read the colour "${v}"`);
}

/** A theme token (`gold-deep`), a Tailwind palette name, or any CSS colour
 *  this file reads. */
export function themeColour(tokenOrColour: string): Rgba {
  const v =
    /^[a-z][\w-]*$/i.test(tokenOrColour) && !NAMED[tokenOrColour]
      ? `var(--color-${tokenOrColour})`
      : tokenOrColour;
  return parseColour(v, document.documentElement, {});
}

/** A CSS colour value as `el` would resolve it (`var()`, `currentColor`). */
export function readColour(value: string, el: Element, state: State = {}): Rgba {
  return parseColour(value, el, state);
}

/** Whether `value`, the winning `prop` of `EFFECTS` on an element, leaves
 *  the colours painted alone. `vars(name)` gives the values the element's
 *  own rules give a custom property (Tailwind's `--tw-*` filter steps do not
 *  inherit). */
function neutral(prop: string, value: string, vars: (name: string) => string[]): boolean {
  const v = value.trim().toLowerCase();
  if (/^(initial|unset|revert|revert-layer)$/.test(v)) return true;
  if (/filter$/.test(prop)) {
    if (v === "none") return true;
    // Tailwind's chain: `var(--tw-blur,) var(--tw-brightness,) ...`. Neutral
    // only when no step is set.
    const steps = v.split(/\s+(?=var\()/);
    return steps.every((step) => {
      const m = /^var\((--[\w-]+),\s*\)$/.exec(step);
      return m !== null && vars(m[1]).every((x) => !x.trim() || x.trim() === "initial");
    });
  }
  if (/blend-mode$/.test(prop)) return v === "normal";
  if (prop === "-webkit-text-fill-color") return v === "currentcolor";
  if (prop.startsWith("-webkit-text-stroke")) return /^0(px)?\b/.test(v);
  if (/background-clip$/.test(prop)) return !/\btext\b/.test(v);
  if (/mask/.test(prop)) return v === "none";
  if (prop.startsWith("animation")) {
    const names = v.replace(/var\((--[\w-]+)[^)]*\)/g, (_, name: string) => vars(name).join(" "));
    return !names.split(/[\s,]+/).some((t) => paintingKeyframes.has(t));
  }
  return false;
}

/** Throw when `el` or an ancestor has an effect in `state` that changes the
 *  colour painted (`brightness-0`, `invert`, `mix-blend-difference`,
 *  `bg-clip-text`, `animate-pulse`): this file measures colours, not what a
 *  filter makes of them. `state` undefined: in any state (`everyColour`). */
function refuseEffects(el: Element, state: State | undefined) {
  sheet();
  const props = cached!.effects;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const node = n;
    const refuse = (prop: string, value: string, from: string) => {
      throw new Error(
        `${prop} "${value}" from "${from}" changes the colour painted on <${node.tagName.toLowerCase()} class="${node.getAttribute("class") ?? ""}">; theme-colors does not measure through ${prop}`,
      );
    };
    for (const prop of props) {
      // A filter step is the element's own (it does not inherit); an
      // animation's name comes from the theme, which does.
      const inherits = prop.startsWith("animation");
      if (state) {
        // Decided while the state's markers are set.
        withState(node, state, () => {
          const w = winner(node, prop, state);
          const vars = (name: string) => {
            const v = inherits ? computed(node, name, state) : winner(node, name, state)?.value;
            return v === undefined ? [] : [v];
          };
          if (w && !neutral(prop, w.value, vars)) refuse(prop, w.value, w.from);
        });
      } else {
        const vars = (name: string) =>
          inherits
            ? [...declaredAnywhere(node, name), computed(node, name) ?? ""]
            : declaredAnywhere(node, name);
        for (const value of declaredAnywhere(node, prop))
          if (!neutral(prop, value, vars)) refuse(prop, value, "a rule for it in some state");
      }
    }
  }
}

/** The text colour `el` renders in: its own `color`, else its parent's. */
export function textColour(el: Element, state: State = {}): Rgba {
  refuseEffects(el, state);
  for (let n: Element | null = el; n; n = n.parentElement) {
    const v = computed(n, "color", state);
    if (v !== undefined && v !== "inherit") return parseColour(v, n, state);
  }
  return NAMED.black;
}

/** `prop`'s colour on `el` (a border, a fill), or undefined when unset. */
export function colourOf(el: Element, prop: string, state: State = {}): Rgba | undefined {
  refuseEffects(el, state);
  const v = computed(el, prop, state);
  return v === undefined ? undefined : parseColour(v, el, state);
}

/** Every colour `prop` can take on `el` (see `declaredAnywhere`), each read
 *  in the element's resting context. Throws on any it cannot read. */
export function everyColour(el: Element, prop: string): Rgba[] {
  refuseEffects(el, undefined);
  return declaredAnywhere(el, prop).map((v) => parseColour(v, el, {}));
}

/** `el`'s opacity times every ancestor's: how much of it reaches the page. */
export function opacityOf(el: Element, state: State = {}): number {
  refuseEffects(el, state);
  let o = 1;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const v = computed(n, "opacity", n === el ? state : { ...state, focus: false });
    if (v !== undefined) o *= num(v);
  }
  return o;
}

/** `top` laid over `bottom`, with `top`'s alpha (times `alpha`, for a faded
 *  layer). */
export function over(top: Rgba | string, bottom: Rgba | string, alpha = 1): Rgba {
  const t = typeof top === "string" ? themeColour(top) : top;
  const b = typeof bottom === "string" ? themeColour(bottom) : bottom;
  const ta = t.a * alpha;
  const a = ta + b.a * (1 - ta);
  if (a === 0) return NAMED.transparent;
  const ch = (k: "r" | "g" | "b") => (t[k] * ta + b[k] * b.a * (1 - ta)) / a;
  return { r: ch("r"), g: ch("g"), b: ch("b"), a };
}

/** `s` split on whitespace outside parentheses. */
function topWords(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && /\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** `value` with each `var(--x, fallback)` replaced by what the cascade gives `--x` on
 *  `el` (or its `box`) in `state`, else its fallback, else nothing: the value the browser
 *  resolves. */
function expandVars(
  value: string,
  el: Element,
  state: State,
  depth = 0,
  box?: "before" | "after",
): string {
  if (depth > 8)
    throw new Error(`theme-colors cannot resolve "${value}": its variables nest too deep`);
  return value.replace(
    /var\((--[\w-]+)(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g,
    (_, name: string, fallback?: string) => {
      const v = withState(el, state, () => varOf(el, name, state, box));
      const chosen = v === undefined || v === "initial" ? (fallback ?? "") : v;
      return expandVars(chosen, el, state, depth + 1, box);
    },
  );
}

const UNPAINTED = /^(none|initial|unset|revert|transparent)$/;

/** The sides a border can name: the physical four, and the logical ones a `border-x` or
 *  `border-s` utility sets. The all-sides `border` shorthand is the empty side. */
const BORDER_SIDES = [
  "",
  "-top",
  "-right",
  "-bottom",
  "-left",
  "-inline",
  "-block",
  "-inline-start",
  "-inline-end",
  "-block-start",
  "-block-end",
];
const LINE_STYLE = /^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/i;
const LINE_WIDTH = /^(thin|medium|thick)$/i;
// A length by its shape, whatever its unit: `20vmax` is a length this file cannot size, not
// a word it may skip. `pxOf` reads the ones it can and throws on the rest.
const LENGTH = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?([a-z]+|%)?$/i;

/** A length word: a number with a unit, or a math function. */
const isLength = (w: string) => LENGTH.test(w) || /^(calc|min|max|clamp)\(/i.test(w);
/** A zero length, or a math function whose every number is zero. */
const isZeroLength = (w: string) =>
  isLength(w) && [...w.matchAll(/\d*\.?\d+/g)].every(([n]) => Number(n) === 0);

/** A length in CSS pixels. `px`, `rem` (16px, the root size this file assumes), a bare zero,
 *  and `calc()` of those with `+ - * /` and parentheses. Anything else throws, since a
 *  `%`, `em`, viewport or container unit, `min()`, `max()` or `clamp()` needs layout, which
 *  this file does not have: a reader that cannot place a length does not guess its size. */
function pxOf(expr: string): number {
  const text = expr.trim();
  if (/^(initial|unset|revert|revert-layer)$/i.test(text)) return 0;
  const src = text.replace(/^calc(?=\s*\()/i, "");
  type Tok = { num: number; unit: string } | { op: string };
  const toks: Tok[] = [];
  const re = /\s*(?:(\d+\.?\d*|\.\d+)(e[-+]?\d+)?([a-z]+|%)?|([-+*/()]))/iy;
  for (let pos = 0; pos < src.length;) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) throw new Error(`cannot read the length "${text}"`);
    pos = re.lastIndex;
    if (m[4]) toks.push({ op: m[4] });
    else toks.push({ num: Number(m[1] + (m[2] ?? "")), unit: (m[3] ?? "").toLowerCase() });
  }
  type Val = { v: number; px: boolean };
  let i = 0;
  const bad = (): never => {
    throw new Error(`cannot read the length "${text}"`);
  };
  // A bare zero is a length in every position a length can stand.
  const len = (x: Val): Val => (!x.px && x.v === 0 ? { v: 0, px: true } : x);
  const factor = (): Val => {
    const t = toks[i];
    if (!t) return bad();
    if ("op" in t) {
      if (t.op === "-" || t.op === "+") {
        i++;
        const f = factor();
        return { v: t.op === "-" ? -f.v : f.v, px: f.px };
      }
      if (t.op !== "(") return bad();
      i++;
      const e = sum();
      if (!toks[i] || !("op" in toks[i]) || (toks[i] as { op: string }).op !== ")") return bad();
      i++;
      return e;
    }
    i++;
    if (t.unit === "px") return { v: t.num, px: true };
    if (t.unit === "rem") return { v: t.num * 16, px: true };
    if (t.unit === "") return { v: t.num, px: false };
    return bad();
  };
  const product = (): Val => {
    let a = factor();
    for (let t = toks[i]; t && "op" in t && (t.op === "*" || t.op === "/"); t = toks[i]) {
      i++;
      const b = factor();
      if (t.op === "*") {
        if (a.px && b.px) return bad();
        a = { v: a.v * b.v, px: a.px || b.px };
      } else {
        if (b.px || b.v === 0) return bad();
        a = { v: a.v / b.v, px: a.px };
      }
    }
    return a;
  };
  const sum = (): Val => {
    let a = product();
    for (let t = toks[i]; t && "op" in t && (t.op === "+" || t.op === "-"); t = toks[i]) {
      i++;
      const b0 = product();
      const [x, b] = [len(a), len(b0)];
      if (x.px !== b.px) return bad();
      a = { v: t.op === "+" ? x.v + b.v : x.v - b.v, px: true };
    }
    return a;
  };
  const top = sum();
  if (i !== toks.length) return bad();
  if (!top.px) return top.v === 0 ? 0 : bad();
  return top.v;
}

/** Run `fn`; a failure rethrows naming `what` and the element's class, so a reader of the
 *  error finds the fill, not a bare colour it could not parse. */
function naming<T>(n: Element, what: string, fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new Error(
      `${what} on <${n.tagName.toLowerCase()} class="${n.getAttribute("class") ?? ""}"> cannot be read: ${(e as Error).message}`,
      { cause: e },
    );
  }
}

/** `parseColour` on a value a fill declares, naming the layer on a failure. */
function colourIn(text: string, n: Element, state: State, what: string): Rgba {
  return naming(n, what, () => parseColour(text, n, state));
}

/** Whether one box-shadow layer paints: its colour has alpha, unless its spread, blur and
 *  offsets are all zero (a layer of zeros is no fill). `layer` is one comma-separated part. */
function shadowPaints(layer: string, n: Element, state: State, what: string): boolean {
  const words = topWords(layer).filter((w) => w.toLowerCase() !== "inset");
  const lengths = words.filter(isLength);
  if (lengths.length && lengths.every(isZeroLength)) return false;
  const colour = words.filter((w) => !isLength(w)).join(" ") || "currentcolor";
  return colourIn(colour, n, state, what).a > 0;
}

/** The winner among `props` (a shorthand and its longhands, which set one thing), with the
 *  selector it came from. Call inside `withState`. */
function winnerOf(
  el: Element,
  props: string[],
  state: State,
  box?: "before" | "after",
): (Win & { prop: string }) | undefined {
  let best: (Win & { prop: string }) | undefined;
  for (const prop of props) {
    const w = winner(el, prop, state, box ? { box } : {});
    if (w && (!best || compareKeys(w.key, best.key) > 0)) best = { prop, ...w };
  }
  return best;
}

type Part = "width" | "style" | "colour";

/** The words of a border or outline shorthand, split into the part each one sets. */
function edgeWords(value: string): Partial<Record<Part, string>> {
  const out: Partial<Record<Part, string>> = {};
  const colour: string[] = [];
  for (const w of topWords(value)) {
    if (LINE_STYLE.test(w)) out.style = w;
    else if (isLength(w) || LINE_WIDTH.test(w)) out.width = w;
    else colour.push(w);
  }
  if (colour.length) out.colour = colour.join(" ");
  return out;
}

/** One part (`width`, `style` or `colour`) of one side of `family` on `n` or its `box`: the
 *  longhand's own value, or a shorthand's share of its words. Undefined when the cascade
 *  gives none. Call inside `withState`. */
function edgePart(
  n: Element,
  family: "border" | "outline",
  side: string,
  part: Part,
  state: State,
  box?: "before" | "after",
): { value: string; from: string } | undefined {
  const suffix = part === "colour" ? "color" : part;
  const props = [
    ...new Set([family, `${family}-${suffix}`, `${family}${side}`, `${family}${side}-${suffix}`]),
  ];
  const w = winnerOf(n, props, state, box);
  if (!w) return undefined;
  const value = expandVars(w.value, n, state, 0, box).trim();
  const shorthand = w.prop === family || w.prop === `${family}${side}`;
  const picked = shorthand ? edgeWords(value)[part] : value;
  return picked ? { value: picked, from: w.from } : undefined;
}

/** The first side of `family` that paints on `n` or its `box` in `state`: a style that is not
 *  none or hidden, a width that is not zero, and a colour with alpha. The initial values
 *  stand in for an unset part: style none, width medium, colour currentcolor. */
function edgePainted(
  n: Element,
  family: "border" | "outline",
  sides: string[],
  state: State,
  box?: "before" | "after",
  anyColour = false,
): { prop: string; value: string; from: string } | undefined {
  for (const side of sides) {
    const style = edgePart(n, family, side, "style", state, box);
    if (!style || /^(none|hidden)$/i.test(style.value)) continue;
    const width = edgePart(n, family, side, "width", state, box)?.value ?? "medium";
    if (isZeroLength(width)) continue;
    const colour = edgePart(n, family, side, "colour", state, box)?.value ?? "currentcolor";
    if (anyColour || colourIn(colour, n, state, `${family}${side} colour`).a > 0)
      return {
        prop: `${family}${side}`,
        value: `${width} ${style.value} ${colour}`,
        from: style.from,
      };
  }
  return undefined;
}

/** Whether a background image paints: a `background-image` that is not none, or a
 *  `background` shorthand that names an image or a gradient. */
function paintsImage(prop: string, value: string): boolean {
  return prop === "background-image"
    ? !/^(none|initial|unset|revert)$/.test(value)
    : /\b(url|gradient|image|image-set|element)\(/.test(value);
}

type Side = "top" | "right" | "bottom" | "left";
const SIDE_INDEX: Record<Side, number> = { top: 0, right: 1, bottom: 2, left: 3 };

/** The value of one side from a 1-to-4-value shorthand (`padding`, `inset`). */
function pickSide(words: string[], side: Side): string {
  const i = SIDE_INDEX[side];
  if (words.length === 1) return words[0];
  if (words.length === 2) return words[i % 2];
  if (words.length === 3) return words[i === 3 ? 1 : i];
  return words[i];
}

/** The value of one axis side from a 1-or-2-value axis shorthand (`padding-block`, `inset-inline`). */
function pickAxis(words: string[], side: Side): string {
  return side === "top" || side === "left" ? words[0] : (words[1] ?? words[0]);
}

const LOGICAL_INSET = [
  "inset-block-start",
  "inset-block-end",
  "inset-inline-start",
  "inset-inline-end",
];

/** The offset of `side` of a box's `box` pseudo-element, in px; undefined when it is `auto` or
 *  not set. Throws on a logical inset or a value this file cannot size. Call inside `withState`. */
function insetPx(
  n: Element,
  box: "before" | "after",
  side: Side,
  state: State,
): number | undefined {
  if (winnerOf(n, LOGICAL_INSET, state, box))
    throw new Error(
      `a logical inset on ::${box} of <${n.tagName.toLowerCase()} class="${n.getAttribute("class") ?? ""}"> cannot be read`,
    );
  const axis = side === "top" || side === "bottom" ? "inset-block" : "inset-inline";
  const w = winnerOf(n, [side, axis, "inset"], state, box);
  if (!w) return undefined;
  const value = expandVars(w.value, n, state, 0, box).trim();
  if (/^auto$/i.test(value)) return undefined;
  const words = topWords(value);
  const pick =
    w.prop === "inset" ? pickSide(words, side) : w.prop === axis ? pickAxis(words, side) : words[0];
  return naming(n, `::${box} ${side} inset`, () => pxOf(pick));
}

/** Whether a `::before` or `::after` can lie under the text of `n`: a box in the flow, or one
 *  positioned out of it that covers the element on both axes (top and bottom at or past the
 *  edges, or `height: 100%`, and the same for left and right). A positioned box that covers
 *  only part of an axis (an underline below the element, a bullet in its padding) is not
 *  read. Call inside `withState`. */
function mayLieUnderText(n: Element, box: "before" | "after", state: State): boolean {
  const pos = winnerOf(n, ["position"], state, box)?.value.trim().toLowerCase();
  if (pos !== "absolute" && pos !== "fixed") return true;
  const covers = (a: Side, b: Side, size: string) => {
    if (winnerOf(n, [size], state, box)?.value.trim() === "100%") return true;
    const [x, y] = [insetPx(n, box, a, state), insetPx(n, box, b, state)];
    return x !== undefined && y !== undefined && x <= 0 && y <= 0;
  };
  return covers("top", "bottom", "height") && covers("left", "right", "width");
}

/** The paint of `prop`-`box`'s `content`: a box exists unless the winning content is none or
 *  normal, or no rule sets content (a `[&::before]` with no `content` generates no box). */
function generatesBox(n: Element, box: "before" | "after", state: State): boolean {
  const content = winnerOf(n, ["content"], state, box);
  if (!content) return false;
  return !/^(none|normal)$/i.test(expandVars(content.value, n, state, 0, box).trim());
}

/** The first property of `n`'s `box` that paints a box in `state`: a background (an image,
 *  or a colour with alpha), a box-shadow layer that paints, a border or outline side that
 *  paints, a border image, a mask that is not none, or a filter or other effect that is not
 *  neutral, or any other property outside `PSEUDO_SAFE`. Undefined when none does, or when the
 *  pseudo generates no box or cannot lie under the text. */
function pseudoPaints(
  n: Element,
  box: "before" | "after",
  state: State,
): { prop: string; value: string; from: string } | undefined {
  if (!generatesBox(n, box, state) || !mayLieUnderText(n, box, state)) return undefined;
  const image = winnerOf(n, ["background-image", "background"], state, box);
  if (image) {
    const value = expandVars(image.value, n, state, 0, box).trim();
    if (paintsImage(image.prop, value)) return { prop: image.prop, value, from: image.from };
  }
  const fill = winnerOf(n, ["background-color", "background"], state, box);
  if (fill) {
    const bg = naming(n, `::${box} ${fill.prop}`, () => readBackground(fill, n, state, box));
    if (bg.a > 0) return { prop: fill.prop, value: fill.value.trim(), from: fill.from };
  }
  const shadow = winnerOf(n, ["box-shadow"], state, box);
  if (shadow)
    for (const layer of splitList(expandVars(shadow.value, n, state, 0, box)))
      if (layer && shadowPaints(layer, n, state, `::${box} box-shadow layer "${layer}"`))
        return { prop: "box-shadow", value: shadow.value.trim(), from: shadow.from };
  const border = edgePainted(n, "border", BORDER_SIDES, state, box);
  if (border) return border;
  // A border image replaces the border's colour wherever the border has a style and a width.
  const image2 = winnerOf(n, ["border-image", "border-image-source"], state, box);
  if (
    image2 &&
    !/^(none|initial|unset|revert)$/i.test(expandVars(image2.value, n, state, 0, box).trim()) &&
    edgePainted(n, "border", BORDER_SIDES, state, box, true)
  )
    return { prop: image2.prop, value: image2.value.trim(), from: image2.from };
  const outline = edgePainted(n, "outline", [""], state, box);
  if (outline) return outline;
  const mask = winnerOf(
    n,
    ["mask", "mask-image", "-webkit-mask", "-webkit-mask-image"],
    state,
    box,
  );
  if (mask && !neutral(mask.prop, expandVars(mask.value, n, state, 0, box), () => []))
    return { prop: mask.prop, value: mask.value.trim(), from: mask.from };
  const filter = winnerOf(n, ["filter"], state, box);
  if (
    filter &&
    !neutral("filter", filter.value, (name) => {
      const v = varOf(n, name, state, box);
      return v === undefined ? [] : [v];
    })
  )
    return { prop: "filter", value: filter.value.trim(), from: filter.from };
  // Every other property the pseudo's rules set, read through the cascade: a backdrop filter,
  // a blend mode, a clip path. Only the custom properties and the families above are not.
  const others = new Set<string>();
  for (const r of boxRules(box)) for (const d of r.decls) others.add(d.prop);
  for (const prop of others) {
    if (
      prop.startsWith("--") ||
      prop === "content" ||
      PSEUDO_SAFE.test(prop) ||
      /^(background(-|$)|box-shadow$|border(-|$)|outline(-|$)|mask(-|$)|-webkit-mask(-|$)|filter$)/.test(
        prop,
      )
    )
      continue;
    const w = winner(n, prop, state, { box });
    if (!w) continue;
    const value = expandVars(w.value, n, state, 0, box).trim();
    if (
      !neutral(prop, value, (name) => {
        const v = varOf(n, name, state, box);
        return v === undefined ? [] : [v];
      })
    )
      return { prop, value, from: w.from };
  }
  return undefined;
}

/** The width of an edge keyword or length, in px. */
function lineWidthPx(width: string, n: Element, state: State): number {
  const w = width.trim().toLowerCase();
  if (w === "thin") return 1;
  if (w === "medium") return 3;
  if (w === "thick") return 5;
  return naming(n, "line width", () => pxOf(expandVars(w, n, state)));
}

/** The width of one side of `n`'s border in px: zero when its style is none or hidden. */
function borderPx(n: Element, side: string, state: State): number {
  const style = edgePart(n, "border", side, "style", state);
  if (!style || /^(none|hidden)$/i.test(style.value)) return 0;
  return lineWidthPx(edgePart(n, "border", side, "width", state)?.value ?? "medium", n, state);
}

/** The padding of one side of `n` in px. */
function paddingPx(n: Element, side: Side, state: State): number {
  const axis = side === "top" || side === "bottom" ? "block" : "inline";
  const w = winnerOf(n, [`padding-${side}`, `padding-${axis}`, "padding"], state);
  if (!w) return 0;
  const words = topWords(expandVars(w.value, n, state).trim());
  const pick =
    w.prop === "padding"
      ? pickSide(words, side)
      : w.prop === `padding-${axis}`
        ? pickAxis(words, side)
        : words[0];
  return naming(n, `padding-${side}`, () => pxOf(pick));
}

/** The least distance from `n`'s border edge to where its content starts, over its four sides,
 *  in px: a border plus a padding. Text can sit that close to any side. */
function clearancePx(n: Element, state: State): number {
  const sides: Side[] = ["top", "right", "bottom", "left"];
  return Math.min(
    ...sides.map((side) => borderPx(n, `-${side}`, state) + paddingPx(n, side, state)),
  );
}

/** Throw when `n` paints a fill that `groundOf` does not measure, in `state`: an inset
 *  box-shadow layer that reaches the content, or an outline with a negative offset that reaches
 *  it (both on `n`), or, on `n`'s `::before` or `::after`, a fill that paints a box under the
 *  text. Outer shadows on `n` are not read; an inset fill or an inward outline that stops short
 *  of the content (a focus ring inside the padding) is not refused. */
function refuseFills(n: Element, state: State) {
  withState(n, state, () => {
    const tag = n.tagName.toLowerCase();
    const cls = n.getAttribute("class") ?? "";
    const shadow = winner(n, "box-shadow", state, { neutralUnmodelled: true })?.value;
    if (shadow !== undefined)
      for (const layer of splitList(expandVars(shadow, n, state))) {
        if (!topWords(layer).some((w) => w.toLowerCase() === "inset")) continue;
        if (!shadowPaints(layer, n, state, `box-shadow layer "${layer}"`)) continue;
        // The layer reaches inward by its blur and spread, and its offsets, at most.
        const [x = 0, y = 0, blur = 0, spread = 0] = topWords(layer)
          .filter((w) => w.toLowerCase() !== "inset" && isLength(w))
          .map((w) => Math.abs(naming(n, `box-shadow "${layer}"`, () => pxOf(w))));
        const reach = x + y + blur + spread;
        if (reach >= clearancePx(n, state))
          throw new Error(
            `box-shadow "${layer.trim()}" paints an inset fill that reaches the content of <${tag} class="${cls}">; theme-colors does not measure through an inset box-shadow`,
          );
      }
    const offset = winnerOf(n, ["outline-offset"], state)?.value;
    if (offset !== undefined) {
      const outline = edgePainted(n, "outline", [""], state);
      if (outline) {
        const off = naming(n, `outline-offset "${offset.trim()}"`, () =>
          pxOf(expandVars(offset, n, state)),
        );
        if (off < 0) {
          const width = edgePart(n, "outline", "", "width", state);
          const reach = -off + lineWidthPx(width?.value ?? "medium", n, state);
          if (reach >= clearancePx(n, state))
            throw new Error(
              `outline "${outline.value}" with outline-offset "${offset.trim()}" paints over the content of <${tag} class="${cls}">; theme-colors does not measure an inward outline`,
            );
        }
      }
    }
    for (const box of ["before", "after"] as const) {
      const hit = pseudoPaints(n, box, state);
      if (hit)
        throw new Error(
          `${hit.prop} "${hit.value}" on ::${box} of <${tag} class="${cls}"> paints a fill that theme-colors does not measure (from "${hit.from}")`,
        );
    }
  });
}

/**
 * The ground `el` is drawn on: every background from `el` outwards,
 * composited, until one is opaque. `within` stops the walk at that ancestor
 * (inclusive) and lays what was found over `under`: for a control floating
 * over a photo, whose real ground is the photo, not its DOM parent.
 */
export function groundOf(
  el: Element,
  opts: { within?: Element; under?: Rgba | string; state?: State } = {},
): Rgba {
  return scan(() => groundIn(el, opts));
}

function groundIn(
  el: Element,
  opts: { within?: Element; under?: Rgba | string; state?: State },
): Rgba {
  const layers: Rgba[] = [];
  const state = opts.state ?? {};
  refuseEffects(el, state);
  for (let n: Element | null = el; n; n = n.parentElement) {
    refuseFills(n, state);
    // A gradient or an image paints over the colour, and its pixels are not
    // a colour this file can measure. Only a caller who says what lies
    // under the element (`under`, for a control over a photo) may pass one.
    const image = cascadeWinner(n, ["background-image", "background"], state);
    if (image && opts.under === undefined) {
      const painted =
        image.prop === "background-image"
          ? !/^(none|initial|unset|revert)$/.test(image.value)
          : /\b(url|gradient|image|image-set|element)\(/.test(image.value);
      if (painted)
        throw new Error(
          `${image.prop} "${image.value}" paints over the ground of <${n.tagName.toLowerCase()} class="${n.getAttribute("class") ?? ""}">; theme-colors cannot measure an image (pass \`under\` for a control over a photo)`,
        );
    }
    const fill = cascadeWinner(n, ["background-color", "background"], state);
    const bg = fill && readBackground(fill, n, state);
    if (bg && bg.a > 0) layers.push(bg);
    if (bg?.a === 1 || n === opts.within) break;
  }
  let base: Rgba;
  if (layers.at(-1)?.a === 1) {
    base = layers.pop()!;
  } else if (opts.under !== undefined) {
    base = typeof opts.under === "string" ? themeColour(opts.under) : opts.under;
  } else {
    throw new Error("no opaque ground found; pass `under`");
  }
  return layers.reduceRight((acc, layer) => over(layer, acc), base);
}

/** The colour a `background-color` or `background` declaration paints on `el` (or its
 *  `box`). The shorthand is read only when it is a bare colour; anything else throws. */
function readBackground(
  w: { prop: string; value: string },
  el: Element,
  state: State,
  box?: "before" | "after",
): Rgba {
  const value = expandVars(w.value, el, state, 0, box).trim();
  if (/^(none|initial|unset|revert)$/i.test(value)) return NAMED.transparent;
  try {
    return parseColour(value, el, state);
  } catch (e) {
    if (w.prop === "background")
      throw new Error(`theme-colors cannot read the background shorthand "${value}"`, {
        cause: e,
      });
    throw e;
  }
}

function luminance({ r, g, b }: Rgba): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG contrast. Strings are theme tokens or CSS colours. A translucent
 *  foreground is laid over the ground first. */
export function contrast(fg: Rgba | string, bg: Rgba | string): number {
  const ground = typeof bg === "string" ? themeColour(bg) : bg;
  const ink = over(typeof fg === "string" ? themeColour(fg) : fg, ground);
  const [a, b] = [luminance(ink), luminance(ground)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * What a visitor sees of `el`'s text: its colour on its own ground, with the
 * whole element faded by its opacity onto what lies behind it.
 */
export function shownText(el: Element, state: State = {}): { ink: Rgba; ground: Rgba } {
  const ground = groundOf(el, { state });
  const behind = el.parentElement ? groundOf(el.parentElement, { state }) : ground;
  const opacity = opacityOf(el, state);
  const ink = over(textColour(el, state), ground);
  return { ink: over(ink, behind, opacity), ground: over(ground, behind, opacity) };
}
