import { fireEvent, render, within } from "@testing-library/svelte";
import { SINGLE_PHOTO_SIZES } from "./sizes";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import type { ProjectDocument } from "../../../prismicio-types";
import CaseStudies from "./index.svelte";
import { contrast, groundOf, themeColour } from "../../../test-utils/theme-colors";

const slice = {
  slice_type: "case_studies",
  variation: "default",
  primary: { heading: [] },
  items: [],
} as unknown as Content.CaseStudiesSlice;

const photo = (n: number, alt: string | null) => ({
  photo: {
    url: `https://images.prismic.io/mantis-landscaping/${n}.jpg?auto=format`,
    alt,
    copyright: null,
    dimensions: { width: 1600, height: 1200 },
    id: `p${n}`,
    edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
  },
});

const project = (photos: ReturnType<typeof photo>[]) =>
  ({
    uid: "water-wise-gardens",
    type: "project",
    data: {
      case_studies: [
        {
          label: "Residential",
          title: "Roof Top Oasis",
          body: [{ type: "paragraph", text: "Once a hot roof.", spans: [] }],
          photos,
        },
      ],
    },
  }) as unknown as ProjectDocument;

describe("CaseStudies slice", () => {
  it("renders every case-study photo with the alt text written in Prismic", () => {
    const alts = ["Succulents in stucco planters on a roof deck", "A granite outdoor fireplace"];
    const { container } = render(CaseStudies, {
      props: { slice, context: { project: project(alts.map((alt, i) => photo(i, alt))) } },
    });
    const imgs = [...container.querySelectorAll("img")];
    expect(imgs).toHaveLength(2);
    expect(imgs.map((img) => img.getAttribute("alt"))).toEqual(alts);
    for (const img of imgs) expect(img.getAttribute("alt")?.trim()).not.toBe("");
  });

  it("titles each study and names its photo carousel for assistive tech", () => {
    const { container } = render(CaseStudies, {
      props: {
        slice,
        context: { project: project([photo(1, "Roof garden"), photo(2, "Fireplace")]) },
      },
    });
    const { getByRole } = within(container);
    expect(getByRole("heading", { level: 2, name: "Roof Top Oasis" })).toBeTruthy();
    const carousel = getByRole("region", { name: "Roof Top Oasis photos" });
    expect(carousel.getAttribute("aria-roledescription")).toBe("carousel");
  });

  it("keeps an alt attribute on a photo whose alt was left blank", () => {
    const { container } = render(CaseStudies, {
      props: { slice, context: { project: project([photo(1, null), photo(2, "A roof deck")]) } },
    });
    const imgs = [...container.querySelectorAll("img")];
    expect(imgs.map((img) => img.getAttribute("alt"))).toEqual(["", "A roof deck"]);
  });

  it("a study with no photos renders no empty photo region", () => {
    const { container } = render(CaseStudies, {
      props: { slice, context: { project: project([]) } },
    });
    expect(container.querySelector("article")).not.toBeNull();
    expect(container.querySelector('[role="region"]')).toBeNull();
    // With no photo column the text takes the whole card, not the 2/5 it
    // shares with photos: its span equals the article's column count.
    const article = container.querySelector("article") as HTMLElement;
    const text = article.querySelector(":scope > div") as HTMLElement;
    const cols = /(?:^|\s)md:grid-cols-(\d+)(?:\s|$)/.exec(article.className)?.[1];
    expect(cols, "the card is a multi-column grid on desktop").toBeDefined();
    expect(text.className).toMatch(new RegExp(`(^|\\s)md:col-span-(${cols}|full)(\\s|$)`));
  });

  it("renders nothing outside a project", () => {
    const { container } = render(CaseStudies, { props: { slice } });
    expect(container.querySelector("section")).toBeNull();
  });
});

const two = () => project([photo(1, "Roof garden"), photo(2, "Fireplace")]);

describe("CaseStudies photos", () => {
  it("a single photo is a plain image with no carousel controls", () => {
    const { container } = render(CaseStudies, {
      props: { slice, context: { project: project([photo(1, "Roof garden")]) } },
    });
    const view = within(container);
    expect(view.getByRole("region", { name: "Roof Top Oasis photos" })).toBeTruthy();
    expect(container.querySelector('[aria-roledescription="carousel"]')).toBeNull();
    expect(view.queryByRole("button")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("sizes")).toBe(SINGLE_PHOTO_SIZES);
  });

  it("several photos are a carousel showing one photo at a time", () => {
    const { container } = render(CaseStudies, { props: { slice, context: { project: two() } } });
    const carousel = container.querySelector('[aria-roledescription="carousel"]') as HTMLElement;
    expect(carousel).not.toBeNull();
    const slides = [...carousel.querySelectorAll('[aria-roledescription="slide"]')];
    expect(slides).toHaveLength(2);
    expect(slides.map((el) => el.getAttribute("aria-hidden"))).toEqual([null, "true"]);
  });

  it("every carousel photo describes the full column in sizes", () => {
    const { container } = render(CaseStudies, { props: { slice, context: { project: two() } } });
    const imgs = [...container.querySelectorAll("img")];
    expect(imgs).toHaveLength(2);
    for (const img of imgs) expect(img.getAttribute("sizes")).toBe(SINGLE_PHOTO_SIZES);
  });

  it("the arrows and dots change the photo, and nothing autoplays", async () => {
    const { container } = render(CaseStudies, { props: { slice, context: { project: two() } } });
    const view = within(container);
    expect(view.queryByRole("button", { name: /Pause slides/ })).toBeNull();
    const shown = () =>
      [...container.querySelectorAll('[aria-roledescription="slide"]')].findIndex(
        (el) => el.getAttribute("aria-hidden") === null,
      );
    await fireEvent.click(view.getByRole("button", { name: "Next slide" }));
    expect(shown()).toBe(1);
    await fireEvent.click(view.getByRole("button", { name: "Go to slide 1" }));
    expect(shown()).toBe(0);
  });

  it("the inactive slide dots read on their pill over a light or a dark photo", () => {
    const { container } = render(CaseStudies, { props: { slice, context: { project: two() } } });
    const view = within(container);
    const pill = view.getByRole("button", { name: "Go to slide 1" }).parentElement!;
    const dot = view.getByRole("button", { name: "Go to slide 2" }).querySelector("span")!;
    for (const photo of ["white", "black"]) {
      for (const state of [{}, { hover: true }]) {
        const under = themeColour(photo);
        const ground = groundOf(pill, { within: pill, under, state });
        const shown = groundOf(dot, { within: pill, under, state });
        expect(
          contrast(shown, ground),
          `dot on pill over ${photo} ${JSON.stringify(state)}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
