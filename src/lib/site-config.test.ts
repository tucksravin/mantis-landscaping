import { describe, it, expect } from "vitest";
import { loadSiteConfig, footerColumns, type SiteConfig } from "./site-config";

describe("loadSiteConfig", () => {
  it("returns a well-formed config from the checked-in stub", () => {
    const config = loadSiteConfig();
    // The starter ships an empty stub; the shape must always be safe to spread
    // into <Nav items> / <Footer socials> without guards at the call site.
    expect(Array.isArray(config.nav.items)).toBe(true);
    expect(Array.isArray(config.footer.socials)).toBe(true);
  });
});

describe("footerColumns", () => {
  const chromeCols = [{ items: [{ text: "Call us: (555) 123-4567", href: "tel:5551234567" }] }];
  const configWithColumns: SiteConfig = {
    nav: { items: [] },
    footer: { socials: [], columns: chromeCols },
  };

  it("prefers the per-route page-data columns when a route supplies them", () => {
    const pageCols = [{ items: [{ text: "from page data" }] }];
    expect(footerColumns(pageCols, configWithColumns)).toBe(pageCols);
  });

  it("falls back to the site-config chrome columns when page data has none", () => {
    // The regression this guards: a site whose footer is configured in
    // site-config.json, not page data — a layout reading only
    // page.data.footerColumns would drop it.
    expect(footerColumns(undefined, configWithColumns)).toBe(chromeCols);
  });

  it("returns undefined when neither supplies columns (fresh site → Footer placeholder)", () => {
    const bare = { ...loadSiteConfig(), footer: { socials: [] } };
    expect(footerColumns(undefined, bare)).toBeUndefined();
  });

  it("gives this site's footer its columns from site-config", () => {
    expect(footerColumns(undefined, loadSiteConfig())?.length).toBeGreaterThan(0);
  });
});
