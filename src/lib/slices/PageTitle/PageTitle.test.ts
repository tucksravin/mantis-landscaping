import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, within } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import PageTitle from "./index.svelte";

const slice = (primary: Record<string, unknown>) =>
  ({
    slice_type: "page_title",
    variation: "default",
    primary: {
      heading: [{ type: "heading1", text: "Projects", spans: [] }],
      heading_style: "eyebrow",
      body: [],
      background: "white",
      ...primary,
    },
    items: [],
  }) as unknown as Content.PageTitleSlice;

describe("PageTitle slice", () => {
  it("renders the heading as the page's only h1", () => {
    const { container } = render(PageTitle, { props: { slice: slice({}) } });
    const view = within(container);
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe("Projects");
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("h2, h3, h4, h5, h6")).toHaveLength(0);
  });

  it("renders a display title with its statement on a gold-deep ground", () => {
    const { container } = render(PageTitle, {
      props: {
        slice: slice({
          heading: [{ type: "heading1", text: "Contact Us", spans: [] }],
          heading_style: "display",
          body: [{ type: "paragraph", text: "Let's talk.", spans: [] }],
          background: "gold-deep",
        }),
      },
    });
    expect(container.querySelector("section")?.className).toContain("bg-gold-deep");
    expect(container.querySelector(".statement")?.textContent).toContain("Let's talk.");
  });

  it("renders nothing without a heading", () => {
    const { container } = render(PageTitle, { props: { slice: slice({ heading: [] }) } });
    expect(container.querySelector("section")).toBeNull();
  });

  it("the model offers h1 only", () => {
    const model = JSON.parse(
      readFileSync(resolve(process.cwd(), "src/lib/slices/PageTitle/model.json"), "utf8"),
    );
    for (const variation of model.variations)
      expect(variation.primary.heading.config.single).toBe("heading1");
  });
});

describe("PageTitle contrast", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app.css"), "utf8");
  const tokens = Object.fromEntries(
    [...css.matchAll(/--color-([a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
  const rgb = (token: string) => {
    const named: Record<string, string> = { white: "#ffffff", black: "#000000" };
    const value = named[tokens[token]] ?? tokens[token];
    if (!/^#[0-9a-f]{6}$/i.test(value ?? "")) throw new Error(`unparsed --color-${token}`);
    return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  };
  const luminance = (token: string) => {
    const [r, g, b] = rgb(token).map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const last = (el: Element | null | undefined, prefix: string) =>
    [...(el?.classList ?? [])]
      .filter((c) => c.startsWith(prefix))
      .map((c) => c.slice(prefix.length))
      .filter((name) => name in tokens)
      .pop();

  it.each(
    ["white", "light", "gold-deep", "dark"].flatMap((background) =>
      ["eyebrow", "display"].map((style) => [background, style]),
    ),
  )("the heading meets 4.5:1 on a %s ground as %s", (background, style) => {
    const { container } = render(PageTitle, {
      props: { slice: slice({ background, heading_style: style }) },
    });
    const section = container.querySelector("section");
    const wrapper = container.querySelector("h1")?.parentElement;
    const ground = last(section, "bg-");
    const text = last(wrapper, "text-") ?? last(section, "text-");
    expect(ground, "no bg-* token on the section").toBeTruthy();
    expect(text, "no text-* colour token on the heading").toBeTruthy();
    const [hi, lo] = [luminance(ground!), luminance(text!)].sort((a, b) => b - a);
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
