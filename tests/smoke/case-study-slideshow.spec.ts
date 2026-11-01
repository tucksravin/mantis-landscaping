import { test, expect } from "@playwright/test";

for (const path of ["/projects/edible-gardens", "/projects/water-wise-gardens"])
  for (const width of [1440, 834, 390, 320]) {
    test(`${path}: each case-study photo stays clear of the text and its controls are not clipped at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const cards = await page.evaluate((w) => {
        // A control is clipped when an ancestor that clips its overflow (up to
        // the card) does not wholly contain it.
        const clipped = (el: Element, card: Element) => {
          const r = el.getBoundingClientRect();
          for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (s.overflowX !== "visible" || s.overflowY !== "visible") {
              const c = p.getBoundingClientRect();
              if (
                r.left < c.left - 0.5 ||
                r.right > c.right + 0.5 ||
                r.top < c.top - 0.5 ||
                r.bottom > c.bottom + 0.5
              )
                return true;
            }
            if (p === card) break;
          }
          return false;
        };
        return [...document.querySelectorAll("article")].map((a) => {
          const text = a.lastElementChild!.getBoundingClientRect();
          const img = a.querySelector("img")!.getBoundingClientRect();
          const controls = [
            ...a.querySelectorAll('[aria-label^="Go to slide"], [aria-label$="slide"]'),
          ];
          return {
            hasDots: !!a.querySelector('[aria-label="Go to slide 1"]'),
            overlapsText: w >= 768 && img.right > text.left + 0.5,
            clippedControls: controls
              .filter((c) => clipped(c, a))
              .map((c) => c.getAttribute("aria-label")),
          };
        });
      }, width);
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.some((card) => card.hasDots)).toBe(true);
      for (const { hasDots: _, ...card } of cards)
        expect(card).toEqual({
          overlapsText: false,
          clippedControls: [],
        });
    });
  }
