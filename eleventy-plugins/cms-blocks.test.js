import test from "node:test";
import assert from "node:assert/strict";
import markdownIt from "markdown-it";
import registerCmsBlocks from "./cms-blocks.js";

const md = markdownIt({ html: true, linkify: true, typographer: true });
registerCmsBlocks(md);
const render = (opener, fence = ":::") => md.render(`${opener}\nBody\n${fence}\n`);
const wrapped = (open, tag) => `${open}\n<p>Body</p>\n</${tag}>\n`;
const callout = (kind) => wrapped(`<aside class="callout" data-kind="${kind}">`, "aside");

for (const [opener, kind] of [
  [":::callout{.warning}", "warning"],
  [":::callout{.note}", "note"],
  ["::: callout {.tip}", "tip"],
  [":::callout {.tip}", "tip"],
  ["::: callout", "note"],
  [":::callout", "note"],
]) {
  test(`${opener} renders a ${kind} callout`, () => {
    assert.equal(render(opener), callout(kind));
  });
}

for (const [name, tag, className] of [
  ["pullquote", "blockquote", "pullquote"],
  ["stat", "div", "stat-callout"],
  ["resource", "div", "resource-card"],
]) {
  for (const opener of [`:::${name}`, `::: ${name}`, `:::${name}{.a}`, `::: ${name} {.a}`]) {
    test(`${opener} renders .${className}`, () => {
      assert.equal(render(opener), wrapped(`<${tag} class="${className}">`, tag));
    });
  }
}

for (const name of ["callout", "pullquote", "stat", "resource"]) {
  test(`:::${name}x matches no renderer`, () => {
    assert.equal(render(`:::${name}x`), `<p>:::${name}x\nBody\n:::</p>\n`);
  });
}

test("a longer outer fence nests another block", () => {
  assert.equal(
    render("::::callout{.tip}\n:::stat\n42%\n:::", "::::"),
    '<aside class="callout" data-kind="tip">\n<div class="stat-callout">\n<p>42%</p>\n</div>\n<p>Body</p>\n</aside>\n',
  );
});
