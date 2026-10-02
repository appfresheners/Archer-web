import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * App-wide pointer-cursor affordance style check.
 *
 * Reads the shared cursor rules directly from `app/globals.css`, injects them
 * into jsdom, and asserts the computed `cursor` of representative enabled and
 * disabled controls. This pins the rule to the source of truth (the stylesheet
 * itself) so a refactor that drops or alters the selectors fails here.
 */

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

const START = "/* Pointer affordance rules: start */";
const END = "/* Pointer affordance rules: end */";

function extractAffordanceRules(source: string): string {
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  expect(start, "start marker missing from globals.css").toBeGreaterThanOrEqual(0);
  expect(end, "end marker missing from globals.css").toBeGreaterThan(start);
  return source.slice(start, end);
}

const rules = extractAffordanceRules(css);

function setupFixture() {
  document.head.innerHTML = `<style data-cursor-affordance>${rules}</style>`;
  document.body.innerHTML = `
    <a id="link" href="#top">link</a>
    <a id="link-aria-disabled" href="#top" aria-disabled="true">link disabled</a>
    <button id="button-enabled" type="button">enabled</button>
    <button id="button-disabled" type="button" disabled>disabled</button>
    <button id="button-aria-disabled" type="button" aria-disabled="true">aria-disabled</button>
    <select id="select-enabled"><option>opt</option></select>
    <select id="select-disabled" disabled><option>opt</option></select>
    <select id="select-aria-disabled" aria-disabled="true"><option>opt</option></select>
    <input id="checkbox" type="checkbox" />
    <input id="checkbox-aria-disabled" type="checkbox" aria-disabled="true" />
    <input id="radio" type="radio" />
    <input id="range" type="range" />
    <details open><summary id="summary">summary</summary>content</details>
    <div id="role-button" role="button">role button</div>
    <div id="role-button-disabled" role="button" aria-disabled="true">role button disabled</div>
    <input id="text" type="text" />
  `;
}

function cursorOf(id: string): string {
  const el = document.getElementById(id);
  expect(el, `fixture element #${id} missing`).not.toBeNull();
  return window.getComputedStyle(el as HTMLElement).cursor;
}

describe("app-wide pointer-cursor affordance", () => {
  beforeEach(setupFixture);

  it("renders pointer on enabled semantic controls", () => {
    expect(cursorOf("link")).toBe("pointer");
    expect(cursorOf("button-enabled")).toBe("pointer");
    expect(cursorOf("select-enabled")).toBe("pointer");
    expect(cursorOf("checkbox")).toBe("pointer");
    expect(cursorOf("radio")).toBe("pointer");
    expect(cursorOf("range")).toBe("pointer");
    expect(cursorOf("summary")).toBe("pointer");
    expect(cursorOf("role-button")).toBe("pointer");
  });

  it("renders not-allowed on disabled native controls", () => {
    expect(cursorOf("button-disabled")).toBe("not-allowed");
    expect(cursorOf("select-disabled")).toBe("not-allowed");
  });

  it("renders not-allowed on aria-disabled controls", () => {
    expect(cursorOf("button-aria-disabled")).toBe("not-allowed");
    expect(cursorOf("role-button-disabled")).toBe("not-allowed");
    expect(cursorOf("link-aria-disabled")).toBe("not-allowed");
    expect(cursorOf("select-aria-disabled")).toBe("not-allowed");
    expect(cursorOf("checkbox-aria-disabled")).toBe("not-allowed");
  });

  it("leaves text inputs with the default (non-pointer) cursor", () => {
    expect(cursorOf("text")).not.toBe("pointer");
  });

  it("covers every required selector in the shared rule", () => {
    expect(rules).toContain("a[href]");
    expect(rules).toContain("button:not(:disabled):not([aria-disabled=\"true\"])");
    expect(rules).toContain("select:not(:disabled)");
    expect(rules).toContain("[type=\"checkbox\"], [type=\"radio\"]");
    expect(rules).toContain("summary");
    expect(rules).toContain("[role=\"button\"]:not([aria-disabled=\"true\"])");
    expect(rules).toContain(":disabled");
    expect(rules).toContain("[aria-disabled=\"true\"]");
    expect(rules).toContain("cursor: pointer");
    expect(rules).toContain("cursor: not-allowed");
  });
});
