import { render, within } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import FeatureTrio from "./index.svelte";
import model from "./model.json";

/** The editor's carousel_below options, read from the model. */
const breakpoints = (
  model as unknown as {
    variations: { primary: Record<string, { config: { options?: string[] } }> }[];
  }
).variations[0].primary.carousel_below.config.options!;

const slice = (
  items: { icon: string | null; label: string }[],
  heading: unknown[] = [],
  extra: Record<string, unknown> = {},
) =>
  ({
    slice_type: "feature_trio",
    variation: "default",
    primary: { heading, background: "gold-deep", features: items, ...extra },
    items: [],
  }) as unknown as Content.FeatureTrioSlice;

describe("FeatureTrio slice", () => {
  it("renders the pillars as a list, not as headings", () => {
    const { container } = render(FeatureTrio, {
      props: {
        slice: slice([
          { icon: null, label: "Professionally Designed" },
          { icon: null, label: "Gorgeously Grown" },
          { icon: null, label: "Beautifully Maintained" },
        ]),
      },
    });
    const view = within(container);
    expect(view.getAllByRole("listitem").map((li) => li.textContent?.trim())).toEqual([
      "Professionally Designed",
      "Gorgeously Grown",
      "Beautifully Maintained",
    ]);
    expect(view.queryAllByRole("heading")).toHaveLength(0);
  });

  it("draws a decorative Lucide icon for each keyed item", () => {
    const { container } = render(FeatureTrio, {
      props: {
        slice: slice(
          [
            { icon: "design", label: "Thoughtfully Designed" },
            { icon: "community", label: "For the Community" },
          ],
          [{ type: "heading2", text: "Values", spans: [] }],
        ),
      },
    });
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(within(container).getByRole("heading", { level: 2 }).textContent).toBe("Values");
  });
});

describe("FeatureTrio with nothing to show", () => {
  it.each([
    ["no features", []],
    ["only unlabelled features", [{ icon: "water", label: "" }]],
  ])("renders nothing for %s", (_, items) => {
    const { container } = render(FeatureTrio, {
      props: { slice: slice(items, [{ type: "heading2", text: "Our values", spans: [] }]) },
    });
    expect(container.querySelector("section")).toBeNull();
  });

  const pillars = [
    { icon: null, label: "Professionally Designed" },
    { icon: null, label: "Gorgeously Grown" },
    { icon: null, label: "Beautifully Maintained" },
  ];

  it.each(breakpoints)(
    "at or under the editor's breakpoint (%spx) the items are a carousel; above it, the grid",
    (carousel_below) => {
      const { container } = render(FeatureTrio, {
        props: { slice: slice(pillars, [], { carousel_below, autoplay: null }) },
      });
      const grid = container.querySelector("ul") as HTMLElement;
      const carousel = container.querySelector("[data-carousel-below]") as HTMLElement;
      expect(grid).not.toBeNull();
      expect(carousel).not.toBeNull();
      // Each switches at the selected breakpoint, on opposite sides of it.
      const comparator = (el: HTMLElement) =>
        new RegExp(`(<=|>=|<|>)\\s*${carousel_below}px`).exec(el.className)?.[1];
      expect(comparator(grid), "grid names the breakpoint").toBeDefined();
      expect(comparator(carousel), "carousel names the breakpoint").toBeDefined();
      // Complementary, so exactly one of the two shows at every width: `<=`
      // with `>`, or `<` with `>=`. Two that overlap show every feature twice.
      const complement: Record<string, string> = { "<=": ">", ">": "<=", "<": ">=", ">=": "<" };
      expect(complement[comparator(grid)!], "grid and carousel never both show").toBe(
        comparator(carousel),
      );
      // A container query only matches inside a size container: with none,
      // neither hides and both render at every width.
      expect(grid.parentElement!.closest(".\\@container"), "a @container ancestor").not.toBeNull();
      expect(carousel.closest(".\\@container"), "a @container ancestor").not.toBeNull();
      expect(within(carousel).getByRole("region").getAttribute("aria-roledescription")).toBe(
        "carousel",
      );
      expect(within(carousel).queryByRole("button", { name: /Pause slides/ })).toBeNull();
    },
  );

  it("the values carousel autoplays (and so offers a pause control)", () => {
    const { container } = render(FeatureTrio, {
      props: { slice: slice(pillars, [], { carousel_below: "600", autoplay: 2000 }) },
    });
    expect(within(container).getByRole("button", { name: "Pause slides" })).toBeTruthy();
  });

  for (const carousel_below of [undefined, null, "750"]) {
    it(`with carousel_below ${String(carousel_below)} there is only the grid`, () => {
      const { container } = render(FeatureTrio, {
        props: { slice: slice(pillars, [], { carousel_below }) },
      });
      expect(container.querySelector("[data-carousel-below]")).toBeNull();
      expect(container.querySelector("ul")!.className).not.toMatch(/@container|hidden/);
      expect(container.querySelector(".\\@container")).toBeNull();
    });
  }

  it("the pillars fade over 250ms, the values over 500ms", () => {
    const fadeOf = (carousel_below: string) =>
      render(FeatureTrio, {
        props: { slice: slice(pillars, [], { carousel_below, autoplay: null }) },
      }).container.querySelector("[data-carousel-below]")!.innerHTML;
    expect(fadeOf("900")).toContain("duration-[250ms]");
    expect(fadeOf("900")).not.toContain("duration-500");
    expect(fadeOf("600")).toContain("duration-500");
    expect(fadeOf("600")).not.toContain("duration-[250ms]");
  });

  it("inactive dots are solid #ededed, not translucent white", () => {
    const { container } = render(FeatureTrio, {
      props: { slice: slice(pillars, [], { carousel_below: "900", autoplay: null }) },
    });
    const dot = within(container).getByRole("button", { name: "Go to slide 2" });
    expect(dot.innerHTML).toContain("bg-[#ededed]");
    expect(dot.innerHTML).not.toContain("bg-white/50");
  });

  it("each carousel is named after its own content, so two never share a landmark name", () => {
    const named = (heading: unknown[], items: typeof pillars) =>
      within(
        render(FeatureTrio, {
          props: { slice: slice(items, heading, { carousel_below: "900", autoplay: null }) },
        }).container,
      )
        .getByRole("region")
        .getAttribute("aria-label");
    expect(named([], pillars)).toBe(
      "Professionally Designed, Gorgeously Grown, Beautifully Maintained",
    );
    expect(named([{ type: "heading2", text: "Our Values", spans: [] }], pillars)).toBe(
      "Our Values",
    );
  });
});

describe("FeatureTrio model", () => {
  it("carousel_below has no default, so an empty field stays a grid", async () => {
    const model = (await import("./model.json")).default as {
      variations: { primary: Record<string, { type: string; config: Record<string, unknown> }> }[];
    };
    const field = model.variations[0].primary.carousel_below;
    expect(field.type).toBe("Select");
    expect(field.config.options).toEqual(["900", "600"]);
    expect(field.config.default_value).toBeUndefined();
  });
});
