import { render, within } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import Steps from "./index.svelte";
import model from "./model.json";
import { contrast, groundOf, textColour } from "../../../test-utils/theme-colors";

const steps = [
  {
    image: {
      url: "https://images.prismic.io/x/soil.jpg",
      alt: "Compost held in two hands",
      dimensions: { width: 1200, height: 1200 },
    },
    icon: "visit",
    title: "Garden Visit",
    body: [{ type: "paragraph", text: "Schedule a quick garden visit.", spans: [] }],
  },
  { image: {}, icon: "plan", title: "Custom Plan", body: [] },
];

const slice = (heading: unknown[], background = "gold-deep") =>
  ({
    slice_type: "steps",
    variation: "default",
    primary: {
      heading,
      background,
      cta_label: "Contact Us",
      cta_link: { link_type: "Web", url: "/contact-us" },
      steps,
    },
    items: [],
  }) as unknown as Content.StepsSlice;

const howItWorks = [{ type: "heading2", text: "How it Works", spans: [] }];

describe("Steps slice", () => {
  it("renders an ordered list of h3 steps under the h2", () => {
    const { container } = render(Steps, { props: { slice: slice(howItWorks) } });
    const view = within(container);
    expect(view.getByRole("heading", { level: 2 }).textContent).toBe("How it Works");
    expect(view.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Garden Visit",
      "Custom Plan",
    ]);
    expect(container.querySelector("ol")?.children).toHaveLength(2);
  });

  it("promotes the step titles to h2 when the band has no heading", () => {
    const { container } = render(Steps, { props: { slice: slice([]) } });
    expect(within(container).getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });

  it("shows the photo when there is one and the icon otherwise", () => {
    const { container } = render(Steps, { props: { slice: slice(howItWorks) } });
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Compost held in two hands");
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("keeps the bright Blux gold only under dark type", () => {
    const { container } = render(Steps, { props: { slice: slice(howItWorks, "gold") } });
    const section = container.querySelector("section")!;
    // Every element that carries text of its own: headings, each step's body,
    // the call to action.
    const texts = [...section.querySelectorAll("*")].filter((n) =>
      [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim()),
    );
    expect(
      texts.some((n) => n.closest("li") && !n.matches("h2, h3")),
      "a step's body is measured",
    ).toBe(true);
    for (const n of texts)
      expect(contrast(textColour(n), groundOf(n)), n.textContent!).toBeGreaterThanOrEqual(4.5);
  });

  it("every background the editor can pick paints a distinct ground", () => {
    const options = (
      model as unknown as {
        variations: { primary: { background: { config: { options: string[] } } } }[];
      }
    ).variations[0].primary.background.config.options;
    const grounds = options.map((background) => {
      const { container, unmount } = render(Steps, {
        props: { slice: slice(howItWorks, background) },
      });
      const ground = groundOf(container.querySelector("section")!);
      unmount();
      return JSON.stringify(ground);
    });
    expect(new Set(grounds).size, `${options} -> ${grounds}`).toBe(options.length);
  });
});

describe("Steps with nothing to show", () => {
  it.each([
    ["no steps", []],
    ["only untitled steps", [{ image: {}, icon: "plan", title: null, body: [] }]],
  ])("renders nothing for %s", (_, group) => {
    const empty = slice([{ type: "heading2", text: "How it works", spans: [] }]) as unknown as {
      primary: Record<string, unknown>;
    };
    const { container } = render(Steps, {
      props: { slice: { ...empty, primary: { ...empty.primary, steps: group } } as never },
    });
    expect(container.querySelector("section")).toBeNull();
  });
});
