import { test, expect } from "@playwright/test";

for (const width of [1440, 1024, 834, 390]) {
  test(`the first section is not hidden under the nav at load at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const atLoad = await page.evaluate(() => {
      const nav = document.querySelector("nav")!.getBoundingClientRect();
      const first = document.querySelector("main section")!.getBoundingClientRect();
      return { navBottom: nav.bottom, firstTop: first.top };
    });
    expect(atLoad.firstTop).toBeGreaterThanOrEqual(atLoad.navBottom);
  });

  test(`the nav sticks to the top after scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect
      .poll(() => page.evaluate(() => document.querySelector("nav")!.getBoundingClientRect().top))
      .toBe(0);
  });

  test(`the html element reserves no scrollbar gutter at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter),
    ).toBe("auto");
  });

  test(`nothing paints over the sticky nav while scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const covered = await page.evaluate(async () => {
      document.documentElement.style.scrollBehavior = "auto";
      const nav = document.querySelector("nav")!;
      const hits: number[] = [];
      const end = document.documentElement.scrollHeight - innerHeight;
      for (let y = 0; y <= end; y += 150) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        for (const x of [innerWidth * 0.25, innerWidth * 0.5, innerWidth * 0.75]) {
          const el = document.elementFromPoint(x, 35);
          if (!el || !nav.contains(el)) hits.push(y);
        }
      }
      return hits;
    });
    expect(covered).toEqual([]);
  });

  test(`the logo sits at the 1280px container edge at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const left = await page.evaluate(
      () => document.querySelector('nav img[src="/logo.png"]')!.getBoundingClientRect().left,
    );
    const padded = width * 0.04;
    const expected = Math.max(padded, (width - 1280) / 2);
    expect(Math.abs(left - expected)).toBeLessThanOrEqual(1);
  });
}

test("focusing a nav control does not scroll the page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const after = await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    const frames = () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    window.scrollTo(0, 1500);
    await frames();
    (document.querySelector('nav a[href="/"]') as HTMLElement).focus();
    await frames();
    return scrollY;
  });
  expect(after).toBe(1500);
});

test("opening and closing the mobile menu does not scroll the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 1500);
  });
  const close = page.getByRole("button", { name: "Close menu" });
  await expect(async () => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(close).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
  await close.click();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        new Promise<number>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r(scrollY))),
        ),
    ),
  ).toBe(1500);
});

for (const [width, cols] of [
  [600, 1],
  [601, 2],
] as const) {
  test(`the footer has ${cols} column(s) at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const n = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector("footer > div")!).gridTemplateColumns.split(" ")
          .length,
    );
    expect(n).toBe(cols);
  });
}

test("the footer Instagram link is at least a 24px target (WCAG 2.5.8)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const box = await page.evaluate(() => {
    const r = document.querySelector('footer a[aria-label="Instagram"]')!.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
});

for (const width of [1440, 390]) {
  test(`the skip link lands main below the sticky nav at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 600);
    });
    await page.keyboard.press("Tab");
    await expect(page.locator('a[href="#main-content"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.round(
            document.querySelector("main")!.getBoundingClientRect().top -
              document.querySelector("nav")!.getBoundingClientRect().bottom,
          ),
        ),
      )
      .toBeGreaterThanOrEqual(0);
  });
}

test("an in-page anchor lands below the sticky nav", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => {
    const target = document.querySelectorAll("main section")[3] as HTMLElement;
    target.id = "probe-anchor";
    document.documentElement.style.scrollBehavior = "auto";
    location.hash = "#probe-anchor";
  });
  const measure = () =>
    page.evaluate(() => {
      const target = document.getElementById("probe-anchor")!;
      return {
        gap: Math.round(
          target.getBoundingClientRect().top -
            document.querySelector("nav")!.getBoundingClientRect().bottom,
        ),
        room: document.documentElement.scrollHeight - innerHeight - scrollY,
      };
    });
  // The real signal: the hash navigation has scrolled the page.
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  const gap = await measure();
  expect(gap.room).toBeGreaterThan(0);
  expect(gap.gap).toBeGreaterThanOrEqual(0);
});

const style = (sel: string) =>
  `(() => { const s = getComputedStyle(document.querySelector(${JSON.stringify(sel)})); return [s.fontWeight, s.fontSize, s.lineHeight, s.color, s.paddingTop, s.backgroundColor].join(" "); })()`;

test("nav links are Nunito 300 16px/normal with 10px padding", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  expect(await page.evaluate(style('nav a[href="/projects"]'))).toBe(
    "300 16px normal rgb(46, 30, 21) 10px rgba(0, 0, 0, 0)",
  );
});

test("the footer is #ededed with 40px 4% padding and a 1280px inner width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const f = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector("footer")!);
    const inner = document.querySelector("footer > div")!.getBoundingClientRect().width;
    return [
      s.backgroundColor,
      s.paddingTop,
      Math.round(parseFloat(s.paddingLeft) * 10) / 10,
      inner,
    ].join(" ");
  });
  expect(f).toBe("rgb(237, 237, 237) 40px 57.6 1280");
});

test("footer links are 600 16px #444d33 with 10px padding", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  expect(await page.evaluate(style('footer a[href="/contact-us"]'))).toBe(
    "600 16px normal rgb(68, 77, 51) 10px rgba(0, 0, 0, 0)",
  );
});
