import { render } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import MediaText from "./index.svelte";

function makeSlice(variation: "imageRight" | "imageLeft") {
  return {
    slice_type: "media_text",
    variation,
    primary: {
      heading: [{ type: "heading2", text: "Amenities", spans: [] }],
      body: [{ type: "paragraph", text: "A resort-style pool.", spans: [] }],
      media: {
        url: "https://img.example/pool.jpg",
        alt: "Pool",
        dimensions: { width: 800, height: 600 },
      },
    },
    items: [],
  } as unknown as Content.MediaTextSlice;
}

describe("MediaText slice", () => {
  it("renders heading, body, and image with alt", () => {
    const { getByRole } = render(MediaText, {
      props: { slice: makeSlice("imageRight") },
    });
    expect(getByRole("heading", { level: 2 }).textContent).toContain("Amenities");
    expect(getByRole("img").getAttribute("alt")).toBe("Pool");
  });

  it("reverses the image/copy order for imageLeft", () => {
    // the editorial split reverses via grid order: the editor's variation, not
    // the markup, decides which side the media column sits on
    const orderOf = (variation: "imageRight" | "imageLeft") => {
      const { container, unmount } = render(MediaText, { props: { slice: makeSlice(variation) } });
      const media = container.querySelector(".mt-media");
      expect(media, `${variation} renders the media column`).not.toBeNull();
      const order = [...media!.classList].filter((c) => /(^|:)order-/.test(c)).join(" ");
      unmount();
      return order;
    };
    expect(orderOf("imageLeft")).not.toBe(orderOf("imageRight"));

    // And the swap puts the media first: its desktop order sorts before the
    // copy's (a relation; the numbers are free). Unset order is 0.
    const { container } = render(MediaText, { props: { slice: makeSlice("imageLeft") } });
    const lgOrder = (el: Element | null) => {
      const m = /(?:^|\s)lg:order-(\d+|first|last|none)(?:\s|$)/.exec(el?.className ?? "")?.[1];
      if (m === undefined || m === "none") return 0;
      return m === "first" ? -Infinity : m === "last" ? Infinity : Number(m);
    };
    const media = container.querySelector(".mt-media");
    const copy = container.querySelector(".mt-copy");
    expect(copy, "imageLeft renders the copy column").not.toBeNull();
    expect(lgOrder(media)).toBeLessThan(lgOrder(copy));
  });
});
