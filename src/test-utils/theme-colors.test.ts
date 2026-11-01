import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  audit,
  colourOf,
  computed,
  contrast,
  everyColour,
  groundOf,
  opacityOf,
  shownText,
  containerWidths,
  textColour,
  themeColour,
  unmodelled,
  viewportWidths,
} from "./theme-colors";

// The instrument's own known-good and known-bad inputs. Every contrast check
// in the suite trusts these answers, so they are proved here first, against
// values app.css's comment block measured independently.

afterEach(() => {
  document.body.innerHTML = "";
});

function el(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.querySelector("[data-probe]")! as HTMLElement;
}

describe("theme-colors", () => {
  it("reproduces the ratios app.css records", () => {
    expect(contrast("gold", "dark")).toBeCloseTo(7.48, 1);
    expect(contrast("white", "gold-deep")).toBeCloseTo(5.21, 1);
    expect(contrast("gold-deep", "light")).toBeCloseTo(4.77, 1);
    expect(contrast("white", "gold")).toBeCloseTo(1.91, 1);
  });

  it("reads Tailwind's own palette, which app.css does not redeclare", () => {
    // stone-400 is oklch(70.9% 0.01 56.259), about #a6a09b.
    const stone = themeColour("stone-400");
    expect(stone.r).toBeGreaterThan(stone.b);
    expect(contrast(stone, "white")).toBeGreaterThan(2);
    expect(contrast(stone, "white")).toBeLessThan(3);
    const p = el('<p data-probe class="text-stone-400">x</p>');
    expect(textColour(p)).toEqual(stone);
  });

  it("reads alpha and arbitrary values instead of skipping them", () => {
    const faded = el('<div class="bg-dark"><p data-probe class="text-white/40">x</p></div>');
    expect(textColour(faded).a).toBeCloseTo(0.4, 5);
    expect(contrast(textColour(faded), groundOf(faded))).toBeLessThan(4.5);
    const hex = el('<p data-probe class="text-[#ccc]">x</p>');
    expect(textColour(hex)).toEqual(themeColour("#cccccc"));
    const dim = el('<p data-probe class="opacity-[0.4]">x</p>');
    expect(opacityOf(dim)).toBeCloseTo(0.4, 5);
  });

  it("inherits text colour and walks out to the first opaque ground", () => {
    const span = el('<div class="bg-dark text-white"><p><span data-probe>x</span></p></div>');
    expect(textColour(span)).toEqual(themeColour("white"));
    expect(groundOf(span)).toEqual(themeColour("dark"));
  });

  it("reads the body's own ground and text colour when nothing else sets either", () => {
    const p = el("<p data-probe>x</p>");
    expect(groundOf(p)).toEqual(themeColour("background"));
    expect(textColour(p)).toEqual(themeColour("primary"));
  });

  it("resolves two utilities on one element by the built stylesheet's order", () => {
    const plain = el('<div data-probe class="bg-white bg-dark"></div>');
    const reversed = el('<div data-probe class="bg-dark bg-white"></div>');
    expect(groundOf(plain)).toEqual(groundOf(reversed));
    const important = el('<div data-probe class="bg-white bg-dark!"></div>');
    expect(groundOf(important)).toEqual(themeColour("dark"));
  });

  it("applies hover, focus and attribute states only when they hold", () => {
    const btn = el(
      '<button data-probe class="bg-white text-white hover:bg-dark disabled:bg-light aria-busy:opacity-50 focus-visible:outline-gold">x</button>',
    );
    expect(groundOf(btn)).toEqual(themeColour("white"));
    expect(groundOf(btn, { state: { hover: true } })).toEqual(themeColour("dark"));
    expect(colourOf(btn, "outline-color")).toBeUndefined();
    expect(colourOf(btn, "outline-color", { focusVisible: true })).toEqual(themeColour("gold"));
    (btn as HTMLButtonElement).disabled = true;
    expect(groundOf(btn)).toEqual(themeColour("light"));
    expect(opacityOf(btn)).toBe(1);
    btn.setAttribute("aria-busy", "true");
    expect(opacityOf(btn)).toBeCloseTo(0.5, 5);
    // Faded onto the white page, white text on light measures lower still.
    const { ink, ground } = shownText(btn);
    expect(contrast(ink, ground)).toBeLessThan(1.5);
  });

  it("reads group-hover through the ancestor that carries `group`", () => {
    const dot = el(
      '<button class="group"><span data-probe class="bg-gray-500 group-hover:bg-gray-700"></span></button>',
    );
    // The pointer can rest on the button and not the dot: the group's state
    // is the caller's to give, unless the dot's own hover implies it.
    expect(() => colourOf(dot, "background-color")).toThrow(/group: \{ hover \}/);
    expect(colourOf(dot, "background-color", { group: {} })).toEqual(themeColour("gray-500"));
    expect(colourOf(dot, "background-color", { group: { hover: true } })).toEqual(
      themeColour("gray-700"),
    );
    expect(colourOf(dot, "background-color", { hover: true })).toEqual(themeColour("gray-700"));
    expect(() =>
      colourOf(dot, "background-color", { hover: true, group: { hover: false } }),
    ).toThrow(/cannot hold/);
  });

  it("refuses to guess a width-dependent value, and answers at a given width", () => {
    const h = el(
      '<div class="bg-gold-deep"><h1 data-probe class="text-white md:text-gold">x</h1></div>',
    );
    expect(() => textColour(h)).toThrow(/viewport width/);
    const widths = viewportWidths();
    expect(widths.some((w) => w < 768) && widths.some((w) => w >= 768)).toBe(true);
    expect(textColour(h, { width: 375 })).toEqual(themeColour("white"));
    expect(textColour(h, { width: 1280 })).toEqual(themeColour("gold"));
  });

  it("lists every colour a property can take, across states and widths", () => {
    const input = el(
      '<input data-probe class="border-secondary hover:border-stone-200 focus:border-primary aria-invalid:border-red-600 md:border-dark" />',
    );
    const all = everyColour(input, "border-color");
    for (const t of ["secondary", "stone-200", "primary", "red-600", "dark"])
      expect(all).toContainEqual(themeColour(t));
  });

  it("models the forced-colors focus fallback", () => {
    const input = el('<input data-probe class="focus:outline-hidden" />');
    expect(computed(input, "outline-style", { focus: true })).toBe("none");
    expect(computed(input, "outline", { focus: true, forcedColors: true })).toMatch(/solid/);
  });

  // Review round 2 of #62: each of these was dropped without an error, and
  // the helper measured a colour the visitor is not shown.
  it("refuses to guess a container query, and answers at a given container size", () => {
    const h = el(
      '<div class="@container bg-gold-deep"><h1 data-probe class="text-white @md:text-gold">x</h1></div>',
    );
    expect(() => textColour(h)).toThrow(/container query/);
    expect(() => textColour(h, { width: 1280 })).toThrow(/container query/);
    const sizes = containerWidths();
    expect(sizes.some((w) => w < 448) && sizes.some((w) => w >= 448)).toBe(true);
    expect(textColour(h, { containerWidth: 300 })).toEqual(themeColour("white"));
    expect(textColour(h, { containerWidth: 640 })).toEqual(themeColour("gold"));
    const arbitrary = el(
      '<div class="@container bg-dark"><p data-probe class="text-white [@container(min-width:20rem)]:text-dark">x</p></div>',
    );
    expect(() => textColour(arbitrary)).toThrow(/container query/);
    expect(textColour(arbitrary, { containerWidth: 400 })).toEqual(themeColour("dark"));
  });

  it("refuses to guess the colour scheme when dark: decides the value", () => {
    const band = el('<div data-probe class="bg-dark dark:bg-white text-white"></div>');
    expect(() => groundOf(band)).toThrow(/prefers-color-scheme/);
    expect(groundOf(band, { state: { dark: false } })).toEqual(themeColour("dark"));
    expect(groundOf(band, { state: { dark: true } })).toEqual(themeColour("white"));
    // A scheme query that does not touch the property asked for is no reason to throw.
    expect(textColour(band)).toEqual(themeColour("white"));
  });

  it("refuses to measure a ground painted by a gradient, an image or the background shorthand", () => {
    for (const paint of [
      "bg-linear-to-b from-white to-light",
      "bg-[url(/photo.jpg)]",
      "bg-[linear-gradient(white,white)]",
      "[background:url(/photo.jpg)_white]",
    ]) {
      const p = el(`<div class="bg-dark ${paint}"><p data-probe class="text-white">x</p></div>`);
      expect(() => groundOf(p), paint).toThrow(/paints over|background shorthand/);
    }
    // A bare colour in the shorthand is read, and a caller who names the
    // ground under a photo may still measure over it.
    const plain = el('<div class="[background:white]"><p data-probe>x</p></div>');
    expect(groundOf(plain)).toEqual(themeColour("white"));
    const photo = el(
      '<div class="bg-[url(/photo.jpg)]"><span data-probe class="bg-black/70"></span></div>',
    );
    expect(groundOf(photo, { under: "white" }).a).toBe(1);
  });

  // vida-legacy-foundation#127 round 3: a hand-written query reader answered
  // "does not hold" for queries it could not parse, and each was a false green.
  it("evaluates negated, ranged, listed and nested queries, or throws; it never guesses", () => {
    const at = (cls: string, width?: number) => {
      const h = el(`<div class="bg-dark"><p data-probe class="text-white ${cls}">x</p></div>`);
      return textColour(h, width === undefined ? {} : { width });
    };
    const gold = themeColour("gold");
    const white = themeColour("white");
    // not-lg: is `not (width >= 64rem)`; not-max-lg: is `not (width < 64rem)`.
    expect(() => at("not-lg:text-gold")).toThrow(/viewport width/);
    expect(at("not-lg:text-gold", 800)).toEqual(gold);
    expect(at("not-lg:text-gold", 1280)).toEqual(white);
    expect(at("not-max-lg:text-gold", 800)).toEqual(white);
    expect(at("not-max-lg:text-gold", 1280)).toEqual(gold);
    // `screen and`, and the legacy min-width form.
    expect(at("[@media_screen_and_(min-width:40rem)]:text-gold", 800)).toEqual(gold);
    expect(at("[@media_screen_and_(min-width:40rem)]:text-gold", 375)).toEqual(white);
    // A comma list holds when any member does.
    expect(at("[@media(width>=40rem),print]:text-gold", 800)).toEqual(gold);
    expect(at("[@media(width>=40rem),print]:text-gold", 375)).toEqual(white);
    // Nested media: both must hold.
    expect(at("md:max-lg:text-gold", 800)).toEqual(gold);
    expect(at("md:max-lg:text-gold", 1280)).toEqual(white);
    expect(at("md:max-lg:text-gold", 375)).toEqual(white);
    // Reversed and two-sided ranges are not parsed, so they throw at any width.
    expect(() => at("[@media(64rem<=width)]:text-gold", 1280)).toThrow(/cannot evaluate/);
    expect(() => at("[@media(40rem<=width<64rem)]:text-gold", 800)).toThrow(/cannot evaluate/);
    expect(() => at("[@media_only_screen]:text-gold", 800)).toThrow(/cannot evaluate/);
    // An exact width, and a prefix mixed with a range operator, are not read either.
    expect(() => at("[@media(width:640px)]:text-gold", 640)).toThrow(/cannot evaluate/);
    expect(() => at("[@media(min-width>=40rem)]:text-gold", 800)).toThrow(/cannot evaluate/);
    // Container queries take the same reader: not-@md: is `not (width >= 28rem)`.
    const c = el(
      '<div class="@container bg-dark"><p data-probe class="text-white not-@md:text-gold">x</p></div>',
    );
    expect(textColour(c, { containerWidth: 300 })).toEqual(gold);
    expect(textColour(c, { containerWidth: 640 })).toEqual(white);
  });

  it("lets a conditional block nested in a rule beat that rule's own base declaration", () => {
    // bg-linear-to-b sets --tw-gradient-position, then overrides it inside a
    // nested @supports, which (taken as supported) must win.
    const g = el('<div data-probe class="bg-linear-to-b"></div>');
    expect(computed(g, "--tw-gradient-position")).toBe("to bottom in oklab");
  });

  it("throws on a rule under an at-rule it has no model for", () => {
    const p = el('<p data-probe class="text-white [@scope(main)]:text-dark">x</p>');
    expect(() => textColour(p)).toThrow(/does not model/);
  });

  // Review round 3 of #62: each of these was a silent guess.
  it("parses a sheet holding quoted arbitrary values without losing step", () => {
    const alone = el(
      '<div class="bg-white"><p data-probe class="text-stone-300 hover:text-dark">x</p></div>',
    );
    const ratio = contrast(textColour(alone), groundOf(alone));
    expect(ratio).toBeLessThan(2);
    for (const neighbour of [
      "font-['Nunito']",
      "bg-[url('/a.jpg')]",
      "content-['x']",
      'content-["a}b"]',
    ]) {
      document.body.innerHTML = `<span class="${neighbour.replace(/"/g, "&quot;")}"></span><div class="bg-white"><p data-probe class="text-stone-300 hover:text-dark">x</p></div>`;
      const p = document.querySelector("[data-probe]")!;
      expect(contrast(textColour(p), groundOf(p)), neighbour).toBeCloseTo(ratio, 5);
      expect(textColour(p, { hover: true }), neighbour).toEqual(themeColour("dark"));
    }
  });

  it("refuses to guess pointer, hover capability, reduced motion or forced colours", () => {
    const probe = (cls: string) =>
      el(`<div class="bg-dark"><p data-probe class="text-white ${cls}">x</p></div>`);
    const dark = themeColour("dark");
    const white = themeColour("white");
    for (const [cls, given, shown] of [
      ["pointer-coarse:text-dark", { pointer: "coarse" }, dark],
      ["pointer-coarse:text-dark", { pointer: "fine" }, white],
      ["any-pointer-coarse:text-dark", { pointer: "coarse" }, dark],
      ["pointer-none:text-dark", { pointer: "none" }, dark],
      ["[@media(hover:none)]:text-dark", { canHover: false }, dark],
      ["[@media(hover:none)]:text-dark", { canHover: true }, white],
      ["motion-reduce:text-dark", { reducedMotion: true }, dark],
      ["motion-safe:text-dark", { reducedMotion: true }, white],
      ["forced-colors:text-dark", { forcedColors: true }, dark],
    ] as const) {
      const p = probe(cls);
      expect(() => textColour(p), cls).toThrow(/depends on/);
      expect(textColour(p, given), `${cls} ${JSON.stringify(given)}`).toEqual(shown);
    }
    // Tailwind's own hover: is `:hover` inside `(hover: hover)`; hovering
    // implies a device that can, so it needs no canHover.
    expect(textColour(probe("hover:text-dark"), { hover: true })).toEqual(dark);
    expect(textColour(probe("hover:text-dark"))).toEqual(white);
  });

  it("evaluates the @supports conditions it models and throws on any other", () => {
    const probe = (cls: string) =>
      el(`<div class="bg-dark"><p data-probe class="text-white ${cls}">x</p></div>`);
    expect(() => textColour(probe("not-supports-[display:grid]:text-dark"))).toThrow(
      /does not model/,
    );
    expect(() => textColour(probe("supports-[foo:bar]:text-dark"))).toThrow(/does not model/);
    // Tailwind's colour-mix upgrade is modelled: its negation never applies.
    expect(textColour(probe("not-supports-[color:color-mix(in_lab,red,red)]:text-dark"))).toEqual(
      themeColour("white"),
    );
    expect(textColour(probe("supports-[color:color-mix(in_lab,red,red)]:text-dark"))).toEqual(
      themeColour("dark"),
    );
  });

  it("models :visited and :target as states, and lists them among every colour", () => {
    for (const [cls, state] of [
      ["visited:text-dark", { visited: true }],
      ["target:text-dark", { target: true }],
    ] as const) {
      const a = el(
        `<div class="bg-dark"><a data-probe href="#x" class="text-white ${cls}">x</a></div>`,
      );
      expect(textColour(a), cls).toEqual(themeColour("white"));
      expect(textColour(a, state), cls).toEqual(themeColour("dark"));
    }
    const input = el(
      '<input data-probe class="border-dark visited:border-light target:border-gold" />',
    );
    const all = everyColour(input, "border-color");
    expect(all).toContainEqual(themeColour("light"));
    expect(all).toContainEqual(themeColour("gold"));
  });

  it("throws on a pseudo-class it does not model that could match", () => {
    const p = el('<input data-probe class="text-white invalid:text-dark" />');
    expect(() => textColour(p)).toThrow(/does not model :invalid/);
    const lang = el('<p data-probe class="text-white [&:lang(en)]:text-dark">x</p>');
    expect(() => textColour(lang)).toThrow(/does not model :lang/);
  });

  it("applies a container query only under a container, and refuses em", () => {
    const bare = el(
      '<div class="bg-dark"><p data-probe class="text-white @md:text-dark">x</p></div>',
    );
    expect(textColour(bare, { containerWidth: 640 })).toEqual(themeColour("white"));
    const em = el(
      '<div class="@container bg-dark text-[10px]"><p data-probe class="text-white @min-[30em]:text-dark">x</p></div>',
    );
    expect(() => textColour(em, { containerWidth: 400 })).toThrow(/em container query/);
  });

  // Review round 4 of #62: a state on another element never applied, and
  // effects repainted the text with no colour class; each was a false green.
  it("models a state on another element (peer, group, in, arbitrary), and throws without it", () => {
    const dark = themeColour("dark");
    const white = themeColour("white");
    const cases = [
      [
        '<div class="peer">h</div><a data-probe class="text-white peer-hover:text-dark">x</a>',
        { peer: { hover: true } },
        /peer: \{ hover \}/,
      ],
      [
        '<input class="peer" /><a data-probe class="text-white peer-focus:text-dark">x</a>',
        { peer: { focus: true } },
        /peer: \{ focus \}/,
      ],
      [
        '<input class="peer" /><a data-probe class="text-white peer-focus-visible:text-dark">x</a>',
        { peer: { focusVisible: true } },
        /peer: \{ focusVisible \}/,
      ],
      [
        '<a class="group"><span data-probe class="text-white group-focus-visible:text-dark">x</span></a>',
        { group: { focusVisible: true } },
        /group: \{ focusVisible \}/,
      ],
      [
        '<a class="group"><span data-probe class="text-white group-focus:text-dark">x</span></a>',
        { group: { focus: true } },
        /group: \{ focus \}/,
      ],
      [
        '<a class="group/card"><span data-probe class="text-white group-hover/card:text-dark">x</span></a>',
        { group: { hover: true } },
        /group: \{ hover \}/,
      ],
      [
        '<a><span data-probe class="text-white in-focus:text-dark">x</span></a>',
        { group: { focus: true } },
        /group: \{ focus \}/,
      ],
      [
        '<a class="card"><span data-probe class="text-white [.card:focus_&]:text-dark">x</span></a>',
        { group: { focus: true } },
        /group: \{ focus \}/,
      ],
    ] as const;
    for (const [html, given, hint] of cases) {
      document.body.innerHTML = `<div class="bg-dark">${html}</div>`;
      const p = document.querySelector("[data-probe]")!;
      expect(() => textColour(p), html).toThrow(hint);
      expect(textColour(p, given), html).toEqual(dark);
      const off = Object.fromEntries(Object.keys(given).map((k) => [k, {}]));
      expect(textColour(p, off), html).toEqual(white);
    }
    // A selector that names no other element's state needs nothing passed.
    expect(
      textColour(el('<div class="bg-dark"><p data-probe class="text-white">x</p></div>')),
    ).toEqual(white);
  });

  it("throws on a pseudo-element that recolours the element's own text", () => {
    for (const cls of [
      "first-line:text-dark",
      "first-letter:text-dark",
      "selection:text-dark",
      "details-content:text-dark",
    ]) {
      const p = el(`<div class="bg-dark"><p data-probe class="text-white ${cls}">x</p></div>`);
      expect(() => textColour(p), cls).toThrow(/does not model ::/);
    }
    // On an ancestor, it reaches the element's text too.
    const inner = el(
      '<div class="bg-dark text-white first-line:text-dark"><span data-probe>x</span></div>',
    );
    expect(() => textColour(inner)).toThrow(/::first-line/);
    // Another box is not this element's text.
    const before = el(
      '<div class="bg-dark"><p data-probe class="text-white before:text-dark">x</p></div>',
    );
    expect(textColour(before)).toEqual(themeColour("white"));
  });

  it("throws on an effect that repaints the colour without a colour class", () => {
    for (const cls of [
      "brightness-0",
      "invert",
      "contrast-200",
      "grayscale",
      "drop-shadow-lg",
      "mix-blend-difference",
      "bg-blend-multiply",
      "backdrop-invert",
      "bg-clip-text",
      "[-webkit-text-fill-color:#232d1b]",
      "[-webkit-text-stroke:2px_black]",
      "mask-[url(/m.svg)]",
      "animate-pulse",
      "hover:brightness-0",
    ]) {
      const p = el(`<div class="bg-dark"><p data-probe class="text-white ${cls}">x</p></div>`);
      const state = cls.startsWith("hover:") ? { hover: true } : {};
      expect(() => textColour(p, state), cls).toThrow(/does not measure through/);
      expect(() => groundOf(p, { state }), cls).toThrow(/does not measure through/);
      expect(() => opacityOf(p, state), cls).toThrow(/does not measure through/);
      expect(() => everyColour(p, "color"), cls).toThrow(/does not measure through/);
    }
    // On an ancestor too.
    const deep = el('<div class="bg-dark invert"><p data-probe class="text-white">x</p></div>');
    expect(() => textColour(deep)).toThrow(/filter/);
    // Neutral values are read as what they are.
    for (const cls of [
      "filter-none",
      "filter",
      "mix-blend-normal",
      "animate-spin",
      "hover:invert",
    ]) {
      const p = el(`<div class="bg-dark"><p data-probe class="text-white ${cls}">x</p></div>`);
      expect(textColour(p), cls).toEqual(themeColour("white"));
    }
  });

  it("refuses a fill painted over the ground by an inset shadow, an outline, or a ::before or ::after, and reads no outer shadow", () => {
    // The sliding fills of a hover state: hovered, the label is white on a
    // white fill (the CtaBanner mutants of review round 5).
    const known: [string, RegExp][] = [
      ["border-white text-white hover:shadow-[inset_20rem_0_0_0_var(--color-white)]", /inset/],
      [
        "relative isolate border-white text-white before:absolute before:inset-0 before:-z-10 hover:before:bg-white",
        /::before/,
      ],
      [
        "relative isolate border-white text-white after:absolute after:inset-0 after:-z-10 hover:after:bg-white",
        /::after/,
      ],
      ["border-white text-white hover:inset-ring-[20rem] hover:inset-ring-white", /inset/],
      // The review's round-6 mutants: a gradient or an image on a ::before, a border on an
      // ::after, and an outline whose negative offset lays it across the label.
      [
        "relative isolate border-white text-white before:absolute before:inset-0 before:-z-10 hover:before:bg-linear-to-r hover:before:from-white hover:before:to-white",
        /::before/,
      ],
      [
        "relative isolate border-white text-white before:absolute before:inset-0 before:-z-10 hover:before:[background-image:linear-gradient(white,white)]",
        /::before/,
      ],
      [
        "relative isolate overflow-hidden border-white text-white after:absolute after:inset-0 after:-z-10 hover:after:border-[20rem] hover:after:border-white",
        /::after/,
      ],
      [
        "border-white text-white hover:outline-[20rem] hover:outline-white hover:-outline-offset-[20rem]",
        /outline/,
      ],
      // A Tailwind ring whose width is 20rem is an inset shadow; the throw names it.
      ["border-white text-white hover:ring-inset hover:ring-[20rem] hover:ring-white", /inset/],
      // Review round 7. A length in a unit this file cannot size throws, rather than reading as
      // zero (vmax, dvh), and a negative offset written as a sum or a min() is read or refused.
      ["border-white text-white hover:shadow-[inset_0_0_0_20vmax_white]", /vmax/],
      ["border-white text-white hover:inset-ring-[20dvh] hover:inset-ring-white", /dvh/],
      [
        "relative isolate border-white text-white before:absolute before:inset-0 before:-z-10 hover:before:shadow-[inset_0_0_0_20vmax_white]",
        /::before/,
      ],
      [
        "border-white text-white hover:outline-[20rem] hover:outline-white hover:outline-offset-[-20vmax]",
        /vmax/,
      ],
      [
        "border-white text-white hover:outline-[20rem] hover:outline-white hover:outline-offset-[calc(0px-20rem)]",
        /outline/,
      ],
      [
        "border-white text-white hover:outline-[20rem] hover:outline-white hover:outline-offset-[min(-20rem,0px)]",
        /cannot read the length "min/,
      ],
      // A ::after whose border-image paints, with a transparent border colour.
      [
        "relative isolate overflow-hidden border-white text-white after:absolute after:inset-0 after:-z-10 hover:after:border-[20rem] hover:after:border-transparent hover:after:[border-image:linear-gradient(white,white)_1]",
        /::after/,
      ],
      // A ::before whose backdrop filter inverts what lies behind the button.
      [
        "relative isolate border-white text-white before:absolute before:inset-0 before:-z-10 hover:before:backdrop-invert",
        /backdrop-filter/,
      ],
    ];
    for (const [cls, why] of known) {
      const p = el(`<div class="bg-dark"><a data-probe class="${cls}">x</a></div>`);
      expect(() => groundOf(p, { state: { hover: true } }), cls).toThrow(why);
      expect(() => groundOf(p, { state: { hover: true } }), cls).toThrow(`class="${cls}"`);
      // Resting, the fill is not painted, so the ground is the band's.
      expect(groundOf(p), cls).toEqual(themeColour("dark"));
    }
    // An outer shadow paints outside the box and is not read.
    const outer = el(
      '<div class="bg-dark"><a data-probe class="text-white hover:shadow-[0_0_0_20rem_var(--color-white)]">x</a></div>',
    );
    expect(groundOf(outer, { state: { hover: true } })).toEqual(themeColour("dark"));
    // A ::before that sets no fill (transparent) is not refused.
    const clear = el(
      '<div class="bg-dark"><a data-probe class="relative text-white before:bg-transparent hover:before:bg-transparent">x</a></div>',
    );
    expect(groundOf(clear, { state: { hover: true } })).toEqual(themeColour("dark"));
  });

  it("reads an inward ring or outline that stops short of the content, refuses one that reaches it, and skips a decoration away from the text", () => {
    // A 2px inward focus ring on a padded link stays inside the padding, so it is measured as
    // no threat (the review round 7 known-good): 2px + 2px reach, 16px of padding.
    const ring = el(
      '<div class="bg-dark"><a data-probe class="px-10 py-4 text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white">x</a></div>',
    );
    expect(groundOf(ring, { state: { focusVisible: true } })).toEqual(themeColour("dark"));
    // A decorative underline below the button, drawn by a border, is not under the label.
    const underline = el(
      '<div class="bg-dark"><a data-probe class="relative border-white text-white hover:bg-white hover:text-dark after:absolute after:inset-x-0 after:-bottom-2 after:border-b-2 after:border-white">x</a></div>',
    );
    // The link's own hover fill is the ground here (white); the underline is not part of it.
    expect(groundOf(underline, { state: { hover: true } })).toEqual(themeColour("white"));
    // A list bullet sits in the item's padding, not over its text.
    const bullet = el(
      '<div class="bg-dark"><li data-probe class="relative pl-4 text-white before:absolute before:left-0 before:top-2 before:size-2 before:rounded-full before:border before:border-gold">x</li></div>',
    );
    expect(groundOf(bullet)).toEqual(themeColour("dark"));
    // A ::before that generates no box (content none, or no content rule at all) paints nothing.
    for (const cls of [
      "relative text-white before:content-none before:bg-white",
      "relative text-white [&::before]:bg-white",
    ]) {
      const p = el(`<div class="bg-dark"><a data-probe class="${cls}">x</a></div>`);
      expect(groundOf(p), cls).toEqual(themeColour("dark"));
    }
  });

  it("reads a fill that paints nothing as unpainted, whatever spelling gives it", () => {
    // Each is a known-good for the fill check: transparent, zero-alpha, zero-width or
    // not-a-box-shadow forms of "no fill" that a designer writes instead of `transparent`.
    const clear = [
      "relative isolate border-white text-white before:absolute before:inset-0 before:-z-10 hover:before:bg-white/0",
      "relative isolate border-white text-white before:absolute before:inset-0 before:-z-10 hover:before:bg-[rgb(0_0_0/0)]",
      "relative isolate border-white text-white before:absolute before:inset-0 before:-z-10 hover:before:shadow-none",
      "border-white text-white hover:inset-shadow-[0_0_0_20rem] hover:inset-shadow-white/0",
      "border-white text-white ring-inset ring-0 ring-white",
      // An outline with no width, or a transparent colour, paints nothing, even inward.
      "border-white text-white hover:-outline-offset-[20rem]",
      "border-white text-white hover:outline-[20rem] hover:outline-transparent hover:-outline-offset-[20rem]",
    ];
    for (const cls of clear) {
      const p = el(`<div class="bg-dark"><a data-probe class="${cls}">x</a></div>`);
      expect(groundOf(p, { state: { hover: true } }), cls).toEqual(themeColour("dark"));
    }
    // A Tailwind shadow on an ancestor is not the child's: `--tw-*` does not inherit, so a
    // focus-ringed link inside `shadow-inner` has no inset layer of its own.
    const inner = el(
      '<div class="shadow-inner"><div class="bg-dark"><a data-probe class="text-white focus-visible:ring-2 focus-visible:ring-gold">x</a></div></div>',
    );
    expect(groundOf(inner, { state: { focusVisible: true } })).toEqual(themeColour("dark"));
    // An outward outline sits outside the box, so it is not read.
    const outward = el(
      '<div class="bg-dark"><a data-probe class="text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">x</a></div>',
    );
    expect(groundOf(outward, { state: { focusVisible: true } })).toEqual(themeColour("dark"));
  });

  it("reads (hover: hover) only for a rule that needs :hover, and never on a device that cannot", () => {
    const p = el(
      '<div class="bg-dark"><p data-probe class="text-dark [@media(hover:hover)]:[&:not(:hover)]:text-white">x</p></div>',
    );
    expect(() => textColour(p)).toThrow(/canHover/);
    expect(textColour(p, { canHover: false })).toEqual(themeColour("dark"));
    expect(textColour(p, { canHover: true })).toEqual(themeColour("white"));
    const h = el(
      '<div class="bg-dark"><p data-probe class="text-white hover:text-dark">x</p></div>',
    );
    expect(() => textColour(h, { hover: true, canHover: false })).toThrow(/cannot hover/);
    expect(textColour(h, { hover: true, canHover: true })).toEqual(themeColour("dark"));
  });

  // The allowlist is exactly what the site uses: every class in its own
  // components and routes compiles to rules this file models.
  it("models every rule the site's own classes compile to", async () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, f.name);
        if (f.isDirectory()) walk(path);
        else if (
          /\.(svelte|ts|js|html)$/.test(f.name) &&
          !/\.test\.ts$/.test(f.name) &&
          !path.includes("test-utils")
        )
          files.push(path);
      }
    };
    walk(join(process.cwd(), "src"));
    const tokens = (f: string) =>
      readFileSync(f, "utf8")
        .split(/[\s"'`{}<>]+/)
        .filter(Boolean);
    // The audit is not vacuous: it read every slice that exists (from the
    // file glob, not a count), and each one that writes a class attribute
    // gives tokens that compile to real rules (FeatureTrio only delegates).
    const slices = Object.keys(import.meta.glob("/src/lib/slices/*/index.svelte"));
    expect(slices.length).toBeGreaterThan(0);
    const scanned = new Set(files.map((f) => "/" + relative(process.cwd(), f)));
    let styled = 0;
    for (const slice of slices) {
      expect(scanned.has(slice), slice).toBe(true);
      const path = join(process.cwd(), slice);
      if (!/\bclass="/.test(readFileSync(path, "utf8"))) continue;
      styled++;
      const { rules } = await audit(tokens(path));
      expect(rules, `${slice} compiles to no rule`).toBeGreaterThan(0);
    }
    expect(styled).toBeGreaterThan(0);
    const classes = new Set(files.flatMap(tokens));
    const site = await audit([...classes]);
    expect(site.rules).toBeGreaterThan(0);
    // The sheet those classes give holds the forms the allowlist was cut to.
    expect(site.unmodelled).toEqual([]);
    // And the audit itself is live: a form outside the allowlist is reported,
    // and junk compiles to nothing.
    expect(
      await unmodelled([
        "invalid:text-dark",
        "supports-[foo:bar]:text-dark",
        "first-line:text-dark",
        "user-invalid:brightness-0",
      ]),
    ).toHaveLength(4);
    expect((await audit(["not-a-class", "<div", "{x}"])).rules).toBe(0);
  });

  it("throws on a colour it cannot read rather than skipping it", () => {
    expect(() => themeColour("hsl(10 20% 30%)")).toThrow(/cannot read/);
    expect(() => themeColour("not-a-token")).toThrow(/not defined/);
  });
});
