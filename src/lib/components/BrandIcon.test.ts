import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import BrandIcon from "./BrandIcon.svelte";

afterEach(() => cleanup());

describe("BrandIcon", () => {
  it.each(["facebook", "x", "reddit", "instagram", "linkedin"])(
    "renders a glyph path for %s",
    (platform) => {
      const { container } = render(BrandIcon, { platform });
      const path = container.querySelector("svg path");
      expect(path).not.toBeNull();
      expect(path?.getAttribute("d")).toMatch(/^M/);
    },
  );

  it("aliases twitter to the x glyph", () => {
    const twitter = render(BrandIcon, { platform: "twitter" });
    const x = render(BrandIcon, { platform: "x" });
    const twitterD = twitter.container.querySelector("svg path")?.getAttribute("d");
    const xD = x.container.querySelector("svg path")?.getAttribute("d");
    expect(twitterD).toBeTruthy();
    expect(twitterD).toBe(xD);
  });

  it("renders nothing for an unknown platform", () => {
    const { container } = render(BrandIcon, { platform: "myspace" });
    expect(container.querySelector("svg")).toBeNull();
  });

  it("is decorative and inherits the surrounding text colour", () => {
    const { container } = render(BrandIcon, { platform: "facebook" });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
  });

  it("accepts a caller's class in place of the default", () => {
    const custom = render(BrandIcon, { platform: "x", class: "h-6 w-6" });
    expect(custom.container.querySelector("svg")?.getAttribute("class")).toBe("h-6 w-6");
  });
});
it("renders nothing for prototype-chain member names fed from content", () => {
  for (const platform of ["constructor", "toString", "valueOf", "__proto__"]) {
    const { container, unmount } = render(BrandIcon, { platform });
    expect(container.querySelector("svg")).toBeNull();
    unmount();
  }
});
