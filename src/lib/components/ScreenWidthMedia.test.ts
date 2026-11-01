import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import ScreenWidthMedia from "./ScreenWidthMedia.svelte";

class MockPlayer {
  static instances: MockPlayer[] = [];
  handlers = new Map<string, () => void>();
  destroyed = false;
  resolveQuality!: () => void;
  private qualityPromise: Promise<string>;
  constructor(public el: HTMLIFrameElement) {
    MockPlayer.instances.push(this);
    this.qualityPromise = new Promise((resolve) => {
      this.resolveQuality = () => resolve("1080p");
    });
  }
  on(event: string, callback: () => void) {
    this.handlers.set(event, callback);
  }
  ready() {
    return Promise.resolve();
  }
  setQuality() {
    return this.qualityPromise;
  }
  destroy() {
    this.destroyed = true;
    return Promise.resolve();
  }
}

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

const props = {
  src: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
  altText: "poster",
  vimeoId: "76979871",
};

/** Advance past the 1200ms setTimeout defer fallback (no rIC in jsdom). */
async function advancePastDefer() {
  vi.advanceTimersByTime(1200);
  await tick();
}

beforeEach(() => {
  MockPlayer.instances = [];
  mockMatchMedia(false);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete window.Vimeo;
});

describe("ScreenWidthMedia video deferral", () => {
  it("paints the poster immediately and defers the iframe until idle", async () => {
    const { container } = render(ScreenWidthMedia, props);
    expect(container.querySelector("img")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();

    await advancePastDefer();
    const iframe = container.querySelector("iframe")!;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toContain("player.vimeo.com/video/76979871");
  });

  // Asserted here rather than on the a11y fixtures page: the iframe only
  // renders with a live player.vimeo.com src (+ SDK script), so the fixture
  // route can't exercise it without network.
  it("hides the decorative background iframe from keyboard and AT users", async () => {
    const { container } = render(ScreenWidthMedia, props);
    await advancePastDefer();
    const iframe = container.querySelector("iframe")!;
    expect(iframe.getAttribute("tabindex")).toBe("-1");
    expect(iframe.getAttribute("aria-hidden")).toBe("true");
  });

  it("prefers requestIdleCallback and cancels it on destroy", () => {
    const ric = vi.fn(() => 42);
    const cancel = vi.fn();
    Object.defineProperty(window, "requestIdleCallback", {
      value: ric,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      value: cancel,
      configurable: true,
      writable: true,
    });
    try {
      const { unmount } = render(ScreenWidthMedia, props);
      expect(ric).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 2000,
      });
      unmount();
      expect(cancel).toHaveBeenCalledWith(42);
    } finally {
      // @ts-expect-error — removing the test shim
      delete window.requestIdleCallback;
      // @ts-expect-error — removing the test shim
      delete window.cancelIdleCallback;
    }
  });

  it("cancels the setTimeout fallback on destroy", () => {
    const { unmount } = render(ScreenWidthMedia, props);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("renders the poster only — no iframe, ever — under prefers-reduced-motion", async () => {
    mockMatchMedia(true);
    const { container } = render(ScreenWidthMedia, props);
    vi.advanceTimersByTime(10000);
    await tick();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")).toBeTruthy();
  });

  it("does not defer anything when there is no vimeoId", () => {
    render(ScreenWidthMedia, { ...props, vimeoId: "" });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("ScreenWidthMedia quality reveal", () => {
  beforeEach(() => {
    window.Vimeo = { Player: MockPlayer };
  });

  /** Render and advance until the iframe exists and the player is created. */
  async function renderWithPlayer() {
    const utils = render(ScreenWidthMedia, props);
    await advancePastDefer();
    const iframe = utils.container.querySelector("iframe")!;
    expect(MockPlayer.instances).toHaveLength(1);
    return { ...utils, iframe, player: MockPlayer.instances[0] };
  }

  it("keeps the iframe transparent until 1080p has buffered, then reveals", async () => {
    const { iframe, player } = await renderWithPlayer();
    expect(iframe.className).toContain("opacity-0");

    player.resolveQuality();
    await Promise.resolve(); // flush the setQuality .then()
    await tick();
    expect(iframe.className).toContain("opacity-0"); // accepted but not buffered

    player.handlers.get("bufferend")!();
    await tick();
    expect(iframe.className).toContain("opacity-100");
  });

  it("hard cap: eventually reveals even if setQuality never settles", async () => {
    const { iframe } = await renderWithPlayer();
    // A generous bound, not the cap's value: the cap may be retuned.
    vi.advanceTimersByTime(60_000);
    await tick();
    expect(iframe.className).toContain("opacity-100");
  });

  it("falls back to the poster and destroys the player on error", async () => {
    const { container, player } = await renderWithPlayer();
    player.handlers.get("error")!();
    await tick();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")).toBeTruthy();
    expect(player.destroyed).toBe(true);
  });

  it("destroys the player and clears all timers on unmount", async () => {
    const { unmount, player } = await renderWithPlayer();
    unmount();
    expect(player.destroyed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
