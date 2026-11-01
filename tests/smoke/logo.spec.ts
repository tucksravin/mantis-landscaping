import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`every logo renders at its file's aspect ratio at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/contact-us");
    const boxes = await page.locator('img[src="/logo.png"]').evaluateAll((imgs) =>
      Promise.all(
        (imgs as HTMLImageElement[]).map(async (img) => {
          // naturalWidth is 0 until the file has decoded.
          await img.decode().catch(() => {});
          const { width: w, height: h } = img.getBoundingClientRect();
          return { w, h, ratio: img.naturalWidth / img.naturalHeight };
        }),
      ),
    );
    expect(boxes.length).toBeGreaterThan(0);
    // The header and the footer each carry the logo.
    for (const landmark of ["nav", "footer"])
      await expect(page.locator(`${landmark} img[src="/logo.png"]`).first()).toBeVisible();
    for (const { w, h, ratio } of boxes) expect(Math.abs(w / h - ratio) / ratio).toBeLessThan(0.01);
  });
}

test("the nav logo is 260px wide, the footer logo 280px, per the Blux capture", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/contact-us");
  const widths = await page
    .locator('img[src="/logo.png"]')
    .evaluateAll((imgs) => imgs.map((img) => Math.round(img.getBoundingClientRect().width)));
  expect(widths).toEqual([260, 280]);
});

test("at 320px the nav fits: the logo shrinks rather than pushing the menu button off-screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const button = await page.getByRole("button", { name: "Open menu" }).boundingBox();
  const logo = await page.locator('nav img[src="/logo.png"]').boundingBox();
  expect(button!.x + button!.width).toBeLessThanOrEqual(320);
  expect(logo!.x + logo!.width).toBeLessThanOrEqual(button!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
