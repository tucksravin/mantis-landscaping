import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import { contrast, shownText } from "../../test-utils/theme-colors";

// `use:enhance` needs no behaviour here — these cases are about what the page
// renders and where focus lands, not about submission.
const appState = vi.hoisted(() => ({
  page: { url: new URL("https://mantislandscaping.com/contact-us") },
}));
vi.mock("$app/state", () => appState);
// The submit callback each form hands to `use:enhance`, so a case can start a
// submission without running one.
const enhanced = vi.hoisted(() => new Map<HTMLFormElement, () => unknown>());
vi.mock("$app/forms", () => ({
  enhance: (form: HTMLFormElement, submit: () => unknown) => {
    enhanced.set(form, submit);
    return { destroy() {} };
  },
}));
// No sitekey → TurnstileWidget renders nothing, as in dev and in CI.
vi.mock("$app/env/public", () => ({ PUBLIC_TURNSTILE_SITE_KEY: undefined }));

const { default: ContactPage } = await import("./+page.svelte");

const props = (form: unknown = null) =>
  ({ data: { formTs: 1_700_000_000_000, page: null, context: {} }, form }) as never;

afterEach(() => cleanup());

describe("the contact page's submit button", () => {
  it("signals the wait with aria-busy while sending", async () => {
    // aria-busy so the state change reaches a screen reader instead of only
    // the accessible name silently mutating to "Sending…".
    const { container } = render(ContactPage, props());
    const form = container.querySelector('form[aria-label="Send us a message"]') as HTMLFormElement;
    const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.getAttribute("aria-busy")).toBe("false");
    enhanced.get(form)!();
    await tick();
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  // A dimmed Send composited its "Sending…" label at about 2.4:1, the least
  // readable state on the page during the only wait it has. Measured, not
  // pinned: whatever opacity applies while sending is composited onto the page.
  it("keeps its 'Sending…' label at 4.5:1 while sending", async () => {
    const { container } = render(ContactPage, props());
    const form = container.querySelector('form[aria-label="Send us a message"]') as HTMLFormElement;
    const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    enhanced.get(form)!();
    await tick();
    expect(button.disabled, "the button is disabled while sending").toBe(true);
    // Measured in the state the DOM is now in (disabled, aria-busy), through
    // the compiled stylesheet, so a `disabled:` or `aria-busy:` colour or
    // opacity counts, and the faded button is composited onto the page.
    for (const state of [{}, { hover: true }]) {
      const { ink, ground } = shownText(button, state);
      expect(contrast(ink, ground), `Sending… ${JSON.stringify(state)}`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

describe("the contact page's confirmation", () => {
  // On success the form unmounts, which leaves focus on a submit button that no
  // longer exists — focus falls to <body> and a keyboard or screen-reader user
  // is dropped at the top of the document with no idea it went through.
  it("takes focus when it replaces the form", async () => {
    const { container } = render(ContactPage, props({ success: true, form: "contact" }));
    const status = container.querySelector('[role="status"]') as HTMLElement;
    expect(status).not.toBeNull();
    expect(status.getAttribute("tabindex")).toBe("-1");
    await vi.waitFor(() => expect(document.activeElement).toBe(status));
  });

  it("takes focus when the signup confirmation replaces the signup form", async () => {
    const { container } = render(ContactPage, props({ success: true, form: "subscribe" }));
    const status = container.querySelector('#newsletter [role="status"]') as HTMLElement;
    expect(status).not.toBeNull();
    expect(status.getAttribute("tabindex")).toBe("-1");
    await vi.waitFor(() => expect(document.activeElement).toBe(status));
  });
});
