import { expect, test, type Page } from "@playwright/test";

// THE MODAL WAS NEVER CENTRED AND NEVER LOCKED THE PAGE BEHIND IT.
//
// Tailwind preflight's `*{margin:0}` beats the UA's `dialog{margin:auto}`, and
// with the UA's `inset:0` still in force that pins the dialog to the top-left
// corner — `mx-4` restored the horizontal 16px and nothing else. And
// `showModal()` puts the dialog in the top layer but does NOT stop the document
// behind it scrolling, which on a phone reads as the modal having closed.
//
// Both are GEOMETRY, and jsdom performs no layout — Modal.test.ts can only pin
// the mechanism (which classes are on the element). This file is the actual
// measurement, which is why it exists at all.
const FIXTURES = "/dev/a11y-fixtures";

/** Retrying click: a single click can land on markup that has not hydrated yet,
 *  where it does nothing at all and is never retried. Re-issued until the
 *  Svelte-state dialog actually opens. (Same pattern, and the same reason, as
 *  tests/smoke/landscape.spec.ts.) */
async function openModal(page: Page) {
  const trigger = page.getByRole("button", { name: "Open modal" });
  const dialog = page.locator("dialog[open]");
  await expect(async () => {
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
  return dialog;
}

/** The containing block a `position: fixed` element is laid out in, measured
 *  with a probe rather than inferred.
 *
 *  Neither `page.viewportSize()` nor `document.documentElement.clientWidth` is
 *  that box, and this assertion failed a CORRECT implementation twice before
 *  the browser was asked. Both report 1280 here while the dialog is centred in
 *  1265: `body` is the scroll container (app.css gives it `overflow-y: auto`),
 *  so its 15px classic scrollbar never shows up in `html`'s clientWidth, but it
 *  does shrink the viewport a fixed element is centred in. Measuring the
 *  right-hand gap against 1280 makes a dead-centre dialog look 15px off.
 *
 *  A probe at `position: fixed; inset: 0` IS that containing block, by
 *  definition — no scrollbar arithmetic, and no dependence on whether the
 *  scroll lock has taken the scrollbar away yet. */
async function fixedViewport(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;inset:0;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    const r = probe.getBoundingClientRect();
    probe.remove();
    return { width: r.width, height: r.height };
  });
}

test("the dialog is centred on both axes, not pinned to the corner", async ({ page }) => {
  await page.goto(FIXTURES, { waitUntil: "domcontentloaded" });

  const dialog = await openModal(page);
  const box = (await dialog.boundingBox())!;
  const layout = await fixedViewport(page);

  // The defect measured {x: 16, y: 0} — the 16px being `mx-4` and nothing else.
  // Both of these assertions fail against it, the vertical one hardest.
  const leftGap = box.x;
  const rightGap = layout.width - (box.x + box.width);
  const topGap = box.y;
  const bottomGap = layout.height - (box.y + box.height);

  expect(Math.abs(leftGap - rightGap), `horizontal gaps ${leftGap} / ${rightGap}`).toBeLessThan(2);
  expect(Math.abs(topGap - bottomGap), `vertical gaps ${topGap} / ${bottomGap}`).toBeLessThan(2);
  expect(topGap, "a dialog flush to the top edge is the pinned-corner bug").toBeGreaterThan(8);
});

test("it stays inside the viewport instead of overflowing on a narrow screen", async ({ page }) => {
  // `w-full mx-4` overflows below 544px: the width is resolved against the
  // containing block and the margins are then added on top of it.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(FIXTURES, { waitUntil: "domcontentloaded" });
  const dialog = await openModal(page);
  const box = (await dialog.boundingBox())!;
  const layoutWidth = (await fixedViewport(page)).width;
  expect(box.x, "left edge inside the viewport").toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, "right edge inside the viewport").toBeLessThanOrEqual(layoutWidth);
});

test("the page behind the open modal does not scroll", async ({ page }) => {
  await page.goto(FIXTURES, { waitUntil: "domcontentloaded" });

  // The fixtures page is far taller than the viewport, so a wheel over it moves
  // the document — that is the control for this measurement.
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => page.evaluate(() => window.scrollY), {
      message: "control: the page scrolls at all before the modal is opened",
    })
    .toBeGreaterThan(0);

  await page.evaluate(() => window.scrollTo(0, 0));
  const dialog = await openModal(page);
  await expect(dialog).toBeVisible();

  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.scrollY);

  expect(after, `document scrolled ${before} → ${after} behind the open modal`).toBe(before);
});
