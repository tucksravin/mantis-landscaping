import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import VimeoBanner from "./VimeoBanner.svelte";

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
  trigger(isIntersecting: boolean) {
    this.callback(
      [
        {
          isIntersecting,
          target: this.observed[0],
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
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
  vimeoId: "76979871",
  poster: {
    img: { src: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", w: 3, h: 2 },
    sources: {},
  },
  alt: "Background reel",
};

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  // @ts-expect-error — replacing global for test
  window.IntersectionObserver = FakeIntersectionObserver;
  mockMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Engage (first input) + scroll near viewport — the two mount conditions. */
async function engageAndIntersect() {
  FakeIntersectionObserver.instances[0].trigger(true);
  window.dispatchEvent(new Event("pointermove"));
  await tick();
}

/**
 * A heartbeat as the component's own iframe would post it. The component
 * checks `e.source` against its iframe's contentWindow (same-origin sibling
 * embeds must not feed its watchdog), so a passing beat must carry the real
 * source — tests override `origin`/`source` to probe each rejection path.
 */
function vimeoMessage(
  event: string,
  {
    source,
    origin = "https://player.vimeo.com",
  }: { source: MessageEventSource | null; origin?: string },
) {
  return new MessageEvent("message", {
    origin,
    source,
    data: JSON.stringify({ event }),
  });
}

/** The component iframe's contentWindow, typed for MessageEvent init. */
function sourceOf(container: HTMLElement): MessageEventSource {
  return container.querySelector("iframe")!.contentWindow as unknown as MessageEventSource;
}

describe("VimeoBanner", () => {
  it("renders the poster with no iframe until the visitor engages AND the banner is near the viewport", async () => {
    const { container } = render(VimeoBanner, props);
    expect(container.querySelector("img")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();

    // Intersection alone is not enough (a Lighthouse audit scrolls but never inputs).
    FakeIntersectionObserver.instances[0].trigger(true);
    await tick();
    expect(container.querySelector("iframe")).toBeNull();

    window.dispatchEvent(new Event("pointermove"));
    await tick();
    const iframe = container.querySelector("iframe")!;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toContain("player.vimeo.com/video/76979871");
    expect(iframe.getAttribute("tabindex")).toBe("-1");
  });

  it("never creates the iframe under prefers-reduced-motion", async () => {
    mockMatchMedia(true);
    const { container } = render(VimeoBanner, props);
    // No observer is even created — the effect bails before IO setup.
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    window.dispatchEvent(new Event("pointermove"));
    await tick();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")).toBeTruthy();
  });

  it("keeps the iframe hidden until a heartbeat arrives from its own player iframe", async () => {
    const { container } = render(VimeoBanner, props);
    await engageAndIntersect();
    const wrapper = container.querySelector("iframe")!.parentElement!;
    expect(wrapper.className).toContain("opacity-0");

    window.dispatchEvent(vimeoMessage("playProgress", { source: sourceOf(container) }));
    await tick();
    expect(wrapper.className).toContain("opacity-100");
  });

  it("ignores heartbeat messages from other origins", async () => {
    const { container } = render(VimeoBanner, props);
    await engageAndIntersect();
    const wrapper = container.querySelector("iframe")!.parentElement!;

    // Correct source on both, so origin is the check under test.
    const source = sourceOf(container);
    window.dispatchEvent(
      vimeoMessage("playProgress", {
        source,
        origin: "https://evil.example.com",
      }),
    );
    // Lookalike suffix host — must not pass a strict-equality check.
    window.dispatchEvent(
      vimeoMessage("playProgress", {
        source,
        origin: "https://notplayer.vimeo.com",
      }),
    );
    await tick();
    expect(wrapper.className).toContain("opacity-0");
  });

  it("ignores heartbeats from a sibling player.vimeo.com iframe (wrong source)", async () => {
    const { container } = render(VimeoBanner, props);
    await engageAndIntersect();
    const wrapper = container.querySelector("iframe")!.parentElement!;

    // Same origin as a genuine beat, but posted by a DIFFERENT embed on the
    // page (e.g. a ScreenWidthMedia background video) — must not reveal.
    const sibling = document.createElement("iframe");
    document.body.appendChild(sibling);
    try {
      window.dispatchEvent(
        vimeoMessage("playProgress", {
          source: sibling.contentWindow as unknown as MessageEventSource,
        }),
      );
      window.dispatchEvent(vimeoMessage("playProgress", { source: null }));
      await tick();
      expect(wrapper.className).toContain("opacity-0");
    } finally {
      sibling.remove();
    }
  });

  it("survives opaque origins and junk payloads without throwing", async () => {
    const { container } = render(VimeoBanner, props);
    await engageAndIntersect();
    const wrapper = container.querySelector("iframe")!.parentElement!;
    // Junk payloads carry the correct source so the parse guards (not the
    // source check) are what these messages exercise.
    const source = sourceOf(container);

    // `new URL("null")` throws — a sandboxed-iframe message must not crash the handler.
    window.dispatchEvent(new MessageEvent("message", { origin: "null", source, data: "{}" }));
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://player.vimeo.com",
        source,
        data: "not json",
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://player.vimeo.com",
        source,
        data: "null", // parses to null — must not TypeError on .event
      }),
    );
    await tick();
    expect(wrapper.className).toContain("opacity-0");
  });

  it("falls back to the poster when heartbeats stop (iOS autoplay suspension)", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"],
    });
    const { container } = render(VimeoBanner, props);
    await engageAndIntersect();
    const wrapper = container.querySelector("iframe")!.parentElement!;

    window.dispatchEvent(vimeoMessage("playProgress", { source: sourceOf(container) }));
    await tick();
    expect(wrapper.className).toContain("opacity-100");

    // A generous bound, not the watchdog's value: it may be retuned.
    vi.advanceTimersByTime(60_000);
    await tick();
    expect(wrapper.className).toContain("opacity-0");
  });
});
