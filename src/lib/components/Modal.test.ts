import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/svelte";
import { createRawSnippet, tick } from "svelte";
import Modal from "./Modal.svelte";

afterEach(() => {
  cleanup();
  // Belt and braces: if a scroll lock ever DID leak, every later test in this
  // file would inherit it and the leak would look like someone else's bug.
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

const body = () =>
  createRawSnippet(() => ({
    render: () => "<p>Modal body</p>",
  }));

/** A body whose first focusable child is NOT the autofocus target, so "focus
 *  went to the right place" cannot pass by accident. */
const formBody = () =>
  createRawSnippet(() => ({
    render: () => `<div><button type="button">Decoy</button><input autofocus name="first" /></div>`,
  }));

beforeEach(() => {
  // jsdom < v26 polyfill: ensure showModal/close exist
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
});

describe("Modal", () => {
  it("renders children when open", () => {
    const { getByText } = render(Modal, { open: true, children: body() });
    expect(getByText("Modal body")).toBeTruthy();
  });

  it("calls onclose when close button is clicked", async () => {
    const onclose = vi.fn();
    const { getByLabelText } = render(Modal, {
      open: true,
      onclose,
      children: body(),
    });

    await fireEvent.click(getByLabelText("Close"));
    expect(onclose).toHaveBeenCalled();
  });

  it("closes on backdrop click (click on dialog itself, not children)", async () => {
    const onclose = vi.fn();
    const { container } = render(Modal, {
      open: true,
      onclose,
      children: body(),
    });

    const dialog = container.querySelector("dialog")!;
    await fireEvent.click(dialog);
    expect(onclose).toHaveBeenCalled();
  });

  it("does not close when clicking the inner content", async () => {
    const onclose = vi.fn();
    const { getByText } = render(Modal, {
      open: true,
      onclose,
      children: body(),
    });

    await fireEvent.click(getByText("Modal body"));
    expect(onclose).not.toHaveBeenCalled();
  });

  // Children arrive as an opaque snippet, so the component cannot derive a
  // name for the dialog itself — callers supply one (#123).
  it("forwards `label` to the dialog as aria-label", () => {
    const { container } = render(Modal, {
      open: true,
      label: "Request a quote",
      children: body(),
    });

    const dialog = container.querySelector("dialog")!;
    expect(dialog.getAttribute("aria-label")).toBe("Request a quote");
  });

  it("forwards `labelledby` to the dialog as aria-labelledby", () => {
    const { container } = render(Modal, {
      open: true,
      labelledby: "quote-heading",
      children: body(),
    });

    const dialog = container.querySelector("dialog")!;
    expect(dialog.getAttribute("aria-labelledby")).toBe("quote-heading");
  });

  it("sets no name attributes when the caller supplies none", () => {
    const { container } = render(Modal, { open: true, children: body() });

    const dialog = container.querySelector("dialog")!;
    expect(dialog.hasAttribute("aria-label")).toBe(false);
    expect(dialog.hasAttribute("aria-labelledby")).toBe(false);
  });

  // WCAG 2.5.8: the 20px glyph alone is under the 24px minimum. Tailwind
  // preflight zeroes button padding, so the hit target has to come from the
  // class list. jsdom does no layout, so read the sizing utilities: each axis
  // needs a min-*/size-*/h-*/w-* step of at least 24px (Tailwind's 4px scale).
  it("gives the close button at least a 24px hit target (WCAG 2.5.8)", () => {
    const { getByLabelText } = render(Modal, { open: true, children: body() });

    const classes = [...getByLabelText("Close").classList].filter((c) => !c.includes(":"));
    const px = (axis: "h" | "w") =>
      Math.max(
        0,
        ...classes.map((c) => {
          const m = new RegExp(`^(?:min-${axis}|${axis}|size)-(\\d+(?:\\.\\d+)?)$`).exec(c);
          const arb = new RegExp(`^(?:min-${axis}|${axis}|size)-\\[(\\d+)px\\]$`).exec(c);
          return m ? Number(m[1]) * 4 : arb ? Number(arb[1]) : 0;
        }),
      );
    expect(px("h"), "close button height").toBeGreaterThanOrEqual(24);
    expect(px("w"), "close button width").toBeGreaterThanOrEqual(24);
  });
});

// The modal opened with focus on its own ✕: Close is first in the DOM, so the
// spec's dialog-focusing steps (first `[autofocus]`, else the first focusable
// descendant) had nothing else to choose. On a booking or quote flow that means
// the keyboard path into the form starts on the exit.
describe("Modal initial focus", () => {
  it("opens onto the [autofocus] control, not the ✕ and not the first button", async () => {
    const { container } = render(Modal, { open: true, children: formBody() });
    await tick();
    await tick();

    const input = container.querySelector('input[name="first"]');
    expect(document.activeElement).toBe(input);
    expect(document.activeElement).not.toBe(container.querySelector('button[aria-label="Close"]'));
  });

  it("leaves focus alone when the content names no target", async () => {
    // No [autofocus] anywhere: the native behaviour stands rather than the
    // component inventing a target of its own and yanking focus on open.
    const before = document.activeElement;
    render(Modal, { open: true, children: body() });
    await tick();
    await tick();
    expect(document.activeElement).toBe(before);
  });
});

// `showModal()` puts the dialog in the top layer but does NOT stop the document
// behind it scrolling. On a phone that reads as the modal having closed, because
// the page slides past behind the form.
//
// The lock is `overflow: hidden` on <body> — not `position: fixed`, which loses
// the scroll position and changes the containing block for absolute descendants.
describe("Modal scroll lock", () => {
  it("locks the document while open", () => {
    render(Modal, { open: true, children: body() });
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("does not lock while closed", () => {
    render(Modal, { open: false, children: body() });
    expect(document.body.style.overflow).toBe("");
  });

  for (const path of ["close button", "backdrop", "Escape"] as const) {
    it(`releases the lock on ${path}`, async () => {
      const { container, getByLabelText } = render(Modal, {
        open: true,
        children: body(),
      });
      const dialog = container.querySelector("dialog")!;
      expect(document.body.style.overflow).toBe("hidden");

      if (path === "close button") await fireEvent.click(getByLabelText("Close"));
      else if (path === "backdrop") await fireEvent.click(dialog);
      else {
        const cancel = new Event("cancel", { cancelable: true });
        dialog.dispatchEvent(cancel);
        if (!cancel.defaultPrevented) await act(() => dialog.close());
      }

      // Every close path routes through `open = false`, which is what the
      // effect's teardown is keyed on. A lock that survives ANY of these leaves
      // the page permanently unscrollable — worse than the bug it fixes.
      expect(document.body.style.overflow).toBe("");
      expect(document.body.style.paddingRight).toBe("");
    });
  }

  it("releases the lock if it is unmounted while still open", () => {
    const { unmount } = render(Modal, { open: true, children: body() });
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("restores whatever was on <body> rather than clearing it", () => {
    // A page that legitimately owns body.overflow must get its value back, not
    // an empty string.
    document.body.style.overflow = "clip";
    const { unmount } = render(Modal, { open: true, children: body() });
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("clip");
    document.body.style.overflow = "";
  });
});
