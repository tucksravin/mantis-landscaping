import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import CtaBanner from "./index.svelte";
import model from "./model.json";
import { colourOf, contrast, groundOf, textColour } from "../../../test-utils/theme-colors";

afterEach(() => cleanup());

const heading = [{ type: "heading2", text: "Ready to start your project?", spans: [] }];
const link = { link_type: "Web", url: "https://example.com" };

const makeSlice = (primary: Record<string, unknown> = {}) =>
  ({
    slice_type: "cta_banner",
    variation: "default",
    primary: {
      heading,
      buttonLabel: "Talk with us",
      buttonLink: link,
      background: "light",
      ...primary,
    },
    items: [],
  }) as never;

describe("CtaBanner slice", () => {
  it("renders the heading and the CTA as an anchor", () => {
    const { container, getByRole } = render(CtaBanner, {
      props: { slice: makeSlice() },
    });

    expect(getByRole("heading", { level: 2 }).textContent).toContain(
      "Ready to start your project?",
    );
    const cta = getByRole("link", { name: "Talk with us" });
    expect(cta.tagName).toBe("A");
    expect(cta.getAttribute("href")).toBe("https://example.com");
    // A navigating CTA is an <a>, never a <button> nested inside one.
    expect(cta.querySelector("button")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector('[data-slice-type="cta_banner"]')).not.toBeNull();
  });

  const backgrounds = (
    model as unknown as {
      variations: { primary: { background: { config: { options: string[] } } } }[];
    }
  ).variations[0].primary.background.config.options;

  it("honours the editor's dark ground: it differs from the light one", () => {
    const ground = (background: string) => {
      const { container, unmount } = render(CtaBanner, {
        props: { slice: makeSlice({ background }) },
      });
      const g = groundOf(container.querySelector("h2")!);
      unmount();
      return g;
    };
    expect(ground("dark")).not.toEqual(ground("light"));
  });

  // Measured on every ground the editor can pick, at rest, under the pointer,
  // under keyboard focus and once followed: the headline at 4.5:1, the CTA's label at 4.5:1 on its own fill,
  // and its outline at 3:1 against the band (WCAG 1.4.11). A "dark" band that
  // paints white leaves the inverse button white on white, and this fails.
  it.each(backgrounds)("the headline and the CTA read on the %s ground", (background) => {
    const { container } = render(CtaBanner, { props: { slice: makeSlice({ background }) } });
    const h2 = container.querySelector("h2")!;
    expect(contrast(textColour(h2), groundOf(h2)), "headline").toBeGreaterThanOrEqual(4.5);
    const cta = container.querySelector("a")!;
    const band = groundOf(cta.parentElement!);
    for (const state of [{}, { hover: true }, { focusVisible: true }, { visited: true }]) {
      const label = contrast(textColour(cta, state), groundOf(cta, { state }));
      expect(label, `CTA label ${JSON.stringify(state)}`).toBeGreaterThanOrEqual(4.5);
      const border = colourOf(cta, "border-color", state);
      expect(border, "the CTA draws an outline").toBeDefined();
      expect(
        contrast(border!, band),
        `CTA outline ${JSON.stringify(state)}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("omits the CTA when the link or the label is missing", () => {
    const { container: noLabel } = render(CtaBanner, {
      props: { slice: makeSlice({ buttonLabel: "" }) },
    });
    expect(noLabel.querySelector("a")).toBeNull();
    cleanup();

    const { container: noLink } = render(CtaBanner, {
      props: { slice: makeSlice({ buttonLink: null }) },
    });
    expect(noLink.querySelector("a")).toBeNull();
  });
});

describe("CtaBanner with a link that resolves to nothing", () => {
  it.each([
    ["an empty link", { link_type: "Any" }],
    [
      "a document of a type with no route",
      { link_type: "Document", type: "form_replies", id: "f" },
    ],
  ])("renders no button for %s", (_, buttonLink) => {
    const { container } = render(CtaBanner, { props: { slice: makeSlice({ buttonLink }) } });
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector('[href=""]')).toBeNull();
    expect(container.textContent).not.toContain("Talk with us");
  });

  it("resolves a page link locally", () => {
    const { getByRole } = render(CtaBanner, {
      props: {
        slice: makeSlice({
          buttonLink: { link_type: "Document", type: "page", uid: "contact-us", id: "c" },
        }),
      },
    });
    expect(getByRole("link", { name: "Talk with us" }).getAttribute("href")).toBe("/contact-us");
  });
});
