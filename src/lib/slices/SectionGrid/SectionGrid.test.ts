import { render } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import SectionGrid from "./index.svelte";

const slice = {
  slice_type: "section_grid",
  variation: "default",
  primary: {
    heading: [{ type: "heading2", text: "Features", spans: [] }],
    columns: 3,
  },
  items: [
    {
      item_heading: [{ type: "heading3", text: "Pool", spans: [] }],
      item_body: [{ type: "paragraph", text: "Heated.", spans: [] }],
      item_media: {
        url: "https://img.example/a.jpg",
        alt: "Pool",
        dimensions: { width: 800, height: 600 },
      },
      item_link: { link_type: "Any" },
    },
    {
      item_heading: [{ type: "heading3", text: "Gym", spans: [] }],
      item_body: [{ type: "paragraph", text: "24/7.", spans: [] }],
      item_media: {
        url: "https://img.example/b.jpg",
        alt: "Gym",
        dimensions: { width: 800, height: 600 },
      },
      item_link: { link_type: "Any" },
    },
  ],
} as unknown as Content.SectionGridSlice;

describe("SectionGrid slice", () => {
  it("renders one grid cell per item", () => {
    const { getByRole, getAllByRole } = render(SectionGrid, {
      props: { slice },
    });
    expect(getByRole("heading", { level: 2 }).textContent).toContain("Features");
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("reflects the column count on the grid container", () => {
    const { container } = render(SectionGrid, { props: { slice } });
    const grid = container.querySelector("[data-grid-columns='3']");
    expect(grid).not.toBeNull();
  });
});

describe("SectionGrid links", () => {
  it('renders cards with empty links as plain blocks, never href=""', () => {
    const { container } = render(SectionGrid, { props: { slice } });
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector('[href=""]')).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(2);
    // Block content (the card's h3) is never inside an inline <span>.
    const titles = [...container.querySelectorAll("h3")];
    expect(titles).toHaveLength(2);
    for (const h3 of titles) expect(h3.closest("span")).toBeNull();
  });

  it("links a card whose link resolves", () => {
    const linked = {
      ...slice,
      items: [
        {
          ...slice.items[0],
          item_link: { link_type: "Document", type: "page", uid: "pool", id: "p" },
        },
        slice.items[1],
      ],
    } as unknown as Content.SectionGridSlice;
    const { container } = render(SectionGrid, { props: { slice: linked } });
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/pool"]);
  });
});
