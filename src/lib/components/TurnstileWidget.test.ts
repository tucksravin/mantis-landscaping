import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import TurnstileWidget from "./TurnstileWidget.svelte";
import type { TurnstileApi } from "$lib/turnstile";

afterEach(() => cleanup());

// Mutable so each test can set/clear the sitekey before mounting; the component
// reads the env at instance init, not module load, so this works per-render.
const mockEnv = vi.hoisted(() => ({
  env: {} as { PUBLIC_TURNSTILE_SITE_KEY?: string },
}));
// A getter, so the live binding re-reads the mutable value on every render.
vi.mock("$app/env/public", () => ({
  get PUBLIC_TURNSTILE_SITE_KEY() {
    return mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY;
  },
}));

// With `window.turnstile` already present, $lib/turnstile's loadTurnstile
// resolves it directly — no <script> injection, so jsdom never hits the network.
function stubTurnstile() {
  const api = {
    render: vi.fn<TurnstileApi["render"]>(() => "widget-1"),
    remove: vi.fn<TurnstileApi["remove"]>(),
    reset: vi.fn<TurnstileApi["reset"]>(),
  };
  window.turnstile = api;
  return api;
}

describe("TurnstileWidget", () => {
  beforeEach(() => {
    delete mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY;
    delete window.turnstile;
  });

  it("renders nothing when PUBLIC_TURNSTILE_SITE_KEY is unset", async () => {
    const api = stubTurnstile();
    const { container } = render(TurnstileWidget);

    // Flush the microtask the effect's loadTurnstile().then() would run on.
    await Promise.resolve();
    await Promise.resolve();

    expect(container.querySelector(".cf-turnstile")).toBeNull();
    expect(api.render).not.toHaveBeenCalled();
  });

  it("stays dark when the sitekey is whitespace-only", async () => {
    mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY = "   ";
    const api = stubTurnstile();
    const { container } = render(TurnstileWidget);

    await Promise.resolve();
    await Promise.resolve();

    expect(container.querySelector(".cf-turnstile")).toBeNull();
    expect(api.render).not.toHaveBeenCalled();
  });

  it("an inactive widget keeps its box and renders nothing until activated", async () => {
    mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    const api = stubTurnstile();
    const { container, rerender } = render(TurnstileWidget, { active: false });

    await Promise.resolve();
    await Promise.resolve();
    expect(container.querySelector(".cf-turnstile")).not.toBeNull();
    expect(api.render).not.toHaveBeenCalled();

    await rerender({ active: true });
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
  });

  it("renders the mount point and forwards tokens via onToken", async () => {
    mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY = " site-key ";
    const api = stubTurnstile();
    const onToken = vi.fn();
    const { container } = render(TurnstileWidget, { onToken });

    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));

    const el = container.querySelector(".cf-turnstile");
    expect(el).not.toBeNull();
    const [renderedEl, opts] = api.render.mock.calls[0];
    expect(renderedEl).toBe(el);
    // Trimmed: a stray-whitespace sitekey value must not reach Cloudflare.
    expect(opts.sitekey).toBe("site-key");

    opts.callback?.("tok-123");
    expect(onToken).toHaveBeenCalledWith("tok-123");
  });

  it("resets the token and removes the widget on unmount", async () => {
    mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    const api = stubTurnstile();
    const onToken = vi.fn();
    const { unmount } = render(TurnstileWidget, { onToken });

    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    onToken.mockClear();

    unmount();

    // A stale token must not outlive the widget in parent state.
    expect(onToken).toHaveBeenCalledWith("");
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });

  it("does not render into a container unmounted while api.js was loading", async () => {
    mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    // No window.turnstile yet, so loadTurnstile takes the <script>-injection
    // path — and jsdom never fetches the src, so the load stays pending until
    // we dispatch the event ourselves, after unmount.
    const api = {
      render: vi.fn<TurnstileApi["render"]>(() => "widget-1"),
      remove: vi.fn<TurnstileApi["remove"]>(),
      reset: vi.fn<TurnstileApi["reset"]>(),
    };

    const { unmount } = render(TurnstileWidget);
    const tag = await vi.waitFor(() => {
      const el = document.head.querySelector<HTMLScriptElement>(
        'script[src*="challenges.cloudflare.com"]',
      );
      expect(el).not.toBeNull();
      return el as HTMLScriptElement;
    });

    unmount();
    window.turnstile = api;
    tag.dispatchEvent(new Event("load"));
    // Let the now-resolved loader's .then settle after unmount.
    await new Promise((r) => setTimeout(r, 0));

    expect(api.render).not.toHaveBeenCalled();
    tag.remove();
  });

  it("reserves the widget's box BEFORE the iframe arrives", async () => {
    // The effect injects a ~65px iframe whenever api.js resolves — a moment
    // nobody controls. With no reserved box the form jumps at that instant:
    // everything below the widget, the submit button included, drops ~65px out
    // from under the cursor.
    mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    const api = stubTurnstile();
    const { container } = render(TurnstileWidget);

    // Synchronously after mount, before the effect's loadTurnstile().then has
    // had a microtask to run: the box must already be in the DOM and still
    // empty. (Deliberately NOT the <script>-injection path — $lib/turnstile
    // memoises its loader module-wide, so consuming that path here would
    // starve the "unmounted while api.js was loading" case below.)
    const mount = container.querySelector(".cf-turnstile") as HTMLElement;
    expect(mount).not.toBeNull();
    expect(api.render).not.toHaveBeenCalled();
    expect(mount.children.length).toBe(0);
    // jsdom resolves no Tailwind, so a reserved min-height class is the
    // assertable form here; its exact value tracks Cloudflare's iframe height.
    expect(mount.className).toMatch(/min-h-\[\d+px\]/);

    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
  });
});
