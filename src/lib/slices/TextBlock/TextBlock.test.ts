import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, within } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import TextBlock from "./index.svelte";
import { groundOf } from "../../../test-utils/theme-colors";

const slice = (primary: Record<string, unknown>, buttons: unknown[] = []) =>
  ({
    slice_type: "text_block",
    variation: "default",
    primary: {
      heading: [{ type: "heading2", text: "our Mission", spans: [] }],
      heading_style: "eyebrow",
      body: [{ type: "paragraph", text: "Our mission is simple.", spans: [] }],
      size: "body",
      align: "center",
      background: "dark",
      background_image: {},
      buttons,
      ...primary,
    },
    items: [],
  }) as unknown as Content.TextBlockSlice;

describe("TextBlock slice", () => {
  it("renders the heading, copy and every filled button", () => {
    const { container } = render(TextBlock, {
      props: {
        slice: slice({}, [
          { button_label: "Contact Us", button_link: { link_type: "Web", url: "/contact-us" } },
          {
            button_label: "Join Newsletter",
            button_link: { link_type: "Web", url: "/contact-us#newsletter" },
          },
          { button_label: "", button_link: { link_type: "Any" } },
        ]),
      },
    });
    const view = within(container);
    expect(view.getByRole("heading", { level: 2 }).textContent).toBe("our Mission");
    expect(view.getAllByRole("link").map((a) => a.textContent?.trim())).toEqual([
      "Contact Us +",
      "Join Newsletter +",
    ]);
  });

  it("treats a background photo as decoration behind the copy", () => {
    const { container } = render(TextBlock, {
      props: {
        slice: slice({
          background: "image",
          background_image: {
            url: "https://images.prismic.io/x/mint.jpg",
            alt: "Mint",
            dimensions: { width: 2000, height: 1300 },
          },
        }),
      },
    });
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("renders a display heading at h2 for a page title band", () => {
    const { container } = render(TextBlock, {
      props: {
        slice: slice({
          heading: [{ type: "heading2", text: "Contact Us", spans: [] }],
          heading_style: "display",
          body: [],
          background: "gold-deep",
        }),
      },
    });
    expect(within(container).getByRole("heading", { level: 2 }).textContent).toBe("Contact Us");
    expect(container.querySelector("h1")).toBeNull();
  });

  it("honours a gold-deep band: its ground differs from the dark default's", () => {
    // Distinctness, no colour pinned. (The image option shares dark's ground
    // under its photo on purpose, so only gold-deep is compared.)
    const band = (background: string) => {
      const { container, unmount } = render(TextBlock, {
        props: { slice: slice({ background }) },
      });
      const ground = groundOf(container.querySelector("h2")!);
      unmount();
      return ground;
    };
    expect(band("gold-deep")).not.toEqual(band("dark"));
  });

  it("the heading offers no h1", () => {
    const model = JSON.parse(
      readFileSync(resolve(process.cwd(), "src/lib/slices/TextBlock/model.json"), "utf8"),
    );
    for (const variation of model.variations) {
      const config = variation.primary.heading.config;
      const offered = String(config.single ?? config.multi).split(",");
      expect(offered).not.toContain("heading1");
      expect(offered.length).toBeGreaterThan(0);
    }
  });
});
