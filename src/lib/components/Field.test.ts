import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import Field from "./Field.svelte";
import {
  cascadeWinner,
  colourOf,
  contrast,
  everyColour,
  groundOf,
} from "../../test-utils/theme-colors";

afterEach(() => cleanup());

describe("Field", () => {
  it("renders a label associated with the input", () => {
    const { getByLabelText } = render(Field, { name: "email", label: "Email" });
    const input = getByLabelText("Email") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.tagName).toBe("INPUT");
    expect(input.name).toBe("email");
  });

  it("marks required fields with aria + visible indicator", () => {
    const { getByLabelText, getByText } = render(Field, {
      name: "email",
      label: "Email",
      required: true,
    });
    const input = getByLabelText(/Email/) as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(getByText("(required)")).toBeTruthy();
  });

  it("links description via aria-describedby", () => {
    const { getByLabelText, getByText } = render(Field, {
      name: "email",
      label: "Email",
      description: "We never share it.",
    });
    const input = getByLabelText("Email") as HTMLInputElement;
    const description = getByText("We never share it.");
    expect(input.getAttribute("aria-describedby")).toContain(description.id);
  });

  it("links error via aria-describedby and sets aria-invalid", () => {
    const { getByLabelText, getByRole } = render(Field, {
      name: "email",
      label: "Email",
      error: "Required",
    });
    const input = getByLabelText("Email") as HTMLInputElement;
    const alert = getByRole("alert");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
    expect(alert.textContent).toBe("Required");
  });

  it("renders a textarea when type=textarea", () => {
    const { getByLabelText } = render(Field, {
      name: "msg",
      label: "Message",
      type: "textarea",
    });
    const textarea = getByLabelText("Message") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
  });
});

// The control's skin, which had two defects a class list cannot show you.
describe("Field styling", () => {
  // The input and the textarea once carried two copy-pasted class lists, which
  // is exactly how a fix lands on one control and not the other, so every check
  // below runs against both.
  const controls = [
    { type: "text", label: "A" },
    { type: "textarea", label: "B" },
  ] as const;

  it("gives the input and the textarea the SAME classes", () => {
    // Parity, not a value: a fix that lands on one control and not the other
    // (the textarea losing its focus ring, say) is caught here whatever the
    // class list happens to be.
    const input = render(Field, { name: "a", label: "A" });
    const inputClass = input.getByLabelText("A").getAttribute("class");
    input.unmount();

    const area = render(Field, { name: "b", label: "B", type: "textarea" });
    expect(area.getByLabelText("B").getAttribute("class")).toBe(inputClass);
  });

  it.each(controls)(
    "every border colour it can take (resting, hover, focus) clears 3:1 on the page ($type)",
    ({ type, label }) => {
      // A hover border of --color-light measured 1.09:1 on white: the box
      // vanished under the pointer. Every state's border is a control boundary.
      // Read from the compiled stylesheet: Tailwind's own palette, alpha,
      // arbitrary values and every variant (hover, focus, aria-invalid,
      // breakpoints) count, and a colour the helper cannot read throws.
      const { getByLabelText } = render(Field, { name: "a", label, type });
      const control = getByLabelText(label);
      const page = groundOf(control.parentElement!);
      const borders = everyColour(control, "border-color");
      expect(borders.length, "the control draws a border").toBeGreaterThan(0);
      for (const border of borders)
        expect(
          contrast(border, page),
          `border rgb(${border.r} ${border.g} ${border.b})`,
        ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(controls)(
    "draws a resting border that clears the 3:1 non-text minimum ($type)",
    ({ type, label }) => {
      // --color-light (#e5e7eb then) was 1.20:1 against the white card, so the
      // fields read as invisible boxes and a visitor has to hunt for where to
      // type. WCAG 1.4.11 wants 3:1 for a control's boundary.
      const { getByLabelText } = render(Field, { name: "a", label, type });
      const control = getByLabelText(label);
      const border = colourOf(control, "border-color");
      expect(border, "the control draws a border").toBeDefined();
      expect(contrast(border!, groundOf(control.parentElement!))).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(controls)(
    "keeps the forced-colors outline fallback on focus (Tailwind v4, $type)",
    ({ type, label }) => {
      // In Tailwind v4 `outline-none` resolves to `outline-style: none` and takes
      // the forced-colors fallback with it. Under forced colours the ring is
      // dropped by the engine, so that outline is the only focus affordance left.
      // Measured through the cascade, so `focus:outline-none`, `outline-0`
      // and an arbitrary `focus:[outline:none]` all fail alike.
      const { getByLabelText } = render(Field, { name: "a", label, type });
      const control = getByLabelText(label);
      for (const state of [
        { focus: true, forcedColors: true },
        { focusVisible: true, forcedColors: true },
      ]) {
        const style = cascadeWinner(control, ["outline", "outline-style"], state);
        const width = cascadeWinner(control, ["outline", "outline-width"], state);
        expect(style, "an outline is set under forced colours").toBeDefined();
        expect(style!.value, "outline style").not.toMatch(/(^|\s)(none|hidden)(\s|$)/);
        expect(width!.value, "outline width").not.toMatch(/(^|\s)0(px)?(\s|$)/);
      }
    },
  );
});

// Modal.svelte finds its initial-focus target by `[autofocus]`; with none, the
// native dialog-focusing steps land on the first focusable child, which is the
// ✕ — the exit. Opt-in, and off by default so no page ever grabs focus on load
// by accident.
describe("Field autofocus", () => {
  it("carries no autofocus attribute unless asked", () => {
    const { getByLabelText } = render(Field, { name: "email", label: "Email" });
    expect((getByLabelText("Email") as HTMLInputElement).hasAttribute("autofocus")).toBe(false);
  });

  it("marks the control as the dialog's focus target when autofocus is set", () => {
    const { getByLabelText } = render(Field, {
      name: "name",
      label: "Name",
      autofocus: true,
    });
    expect((getByLabelText("Name") as HTMLInputElement).hasAttribute("autofocus")).toBe(true);
  });

  it("applies to the textarea as well as the input", () => {
    // The two controls are a standing source of one-sided fixes in this
    // component (see "gives the input and the textarea the SAME classes").
    const { getByLabelText } = render(Field, {
      name: "msg",
      label: "Message",
      type: "textarea",
      autofocus: true,
    });
    expect((getByLabelText("Message") as HTMLTextAreaElement).hasAttribute("autofocus")).toBe(true);
  });
});
