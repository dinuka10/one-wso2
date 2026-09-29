// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.


import { describe, expect, it } from "vitest";
import {
  sanitizeInlineRichText,
  sanitizeRichText,
  stripHtmlTags,
  toEditorBlocks,
  toEditorRichText,
} from "./sanitizeHtml";

describe("sanitizeRichText", () => {
  it("strips scripts and event-handler attributes", () => {
    const out = sanitizeRichText('<p onclick="x()">Hi<script>alert(1)</script><img src=x onerror="y()"></p>');
    expect(out).toBe("<p>Hi</p>");
  });

  it("keeps the tags the editor can produce", () => {
    const html =
      "<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s><br></p><ul><li>one</li></ul><ol><li>two</li></ol><blockquote>q</blockquote>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("drops tags the editor cannot produce but keeps their text", () => {
    expect(sanitizeRichText("<h1>Title</h1><div>body</div>")).toBe("Titlebody");
  });

  it("allows only http(s) and mailto links, opened safely in a new tab", () => {
    expect(sanitizeRichText('<a href="https://example.com/a">x</a>')).toBe(
      '<a href="https://example.com/a" target="_blank" rel="noopener noreferrer">x</a>',
    );
    expect(sanitizeRichText('<a href="mailto:someone@example.com">m</a>')).toContain(
      'href="mailto:someone@example.com"',
    );
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
  });

  it("keeps only an allowed font weight, as an !important declaration", () => {
    expect(sanitizeRichText('<span style="font-weight: 700; color: red">b</span>')).toBe(
      '<span style="font-weight:700!important;">b</span>',
    );
    expect(sanitizeRichText('<span style="font-weight: 900">b</span>')).toBe("<span>b</span>");
    expect(sanitizeRichText('<span style="color: red">c</span>')).toBe("<span>c</span>");
  });

  it("upgrades the legacy weight class to the inline style", () => {
    expect(sanitizeRichText('<span class="ql-fw-300 other">t</span>')).toBe(
      '<span class="other" style="font-weight:300!important;">t</span>',
    );
  });
});

// Hostile markup that smuggles "<a " or "<br>" inside an attribute value.
// jsdom, like browsers before the 2025 spec change, leaves "<" unescaped there,
// so any string rewrite of the sanitised output would match it.
const SMUGGLED = [
  '<p><span class="<a  onmouseover=alert(1)// ">hover me</span></p>',
  '<p><a href="https://example.com/?q=<a  onmouseover=alert(1)// ">x</a></p>',
  '<p><span class="x<br>&quot; onmouseover=alert(1)">y</span></p>',
  '<p><a href="https://example.com/<br><img src=x onerror=alert(1)>">z</a></p>',
];

// Reparses the output as a consumer (dangerouslySetInnerHTML, Quill) would.
function parsed(html: string): Element[] {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  return [...holder.querySelectorAll("*")];
}

describe("sanitiser output reparsed", () => {
  it.each(SMUGGLED)("carries no handler or new element for %s", (input) => {
    for (const out of [sanitizeRichText(input), sanitizeInlineRichText(input), toEditorBlocks(input), toEditorRichText(input)]) {
      const elements = parsed(out);
      elements.forEach((el) => {
        expect(el.getAttributeNames().filter((name) => !["href", "class", "style", "target", "rel", "data-list"].includes(name))).toEqual([]);
      });
      expect(elements.map((el) => el.localName).filter((tag) => !["p", "span", "a"].includes(tag))).toEqual([]);
    }
  });

  it("keeps the smuggled text inside the attribute", () => {
    const out = sanitizeRichText(SMUGGLED[0]);
    expect(parsed(out)[1].getAttribute("class")).toBe("<a  onmouseover=alert(1)//");
    const link = parsed(sanitizeRichText(SMUGGLED[1])).find((el) => el.localName === "a");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("Quill lists", () => {
  it("turns Quill's bullet items into a real <ul>, splitting mixed runs", () => {
    const quill =
      '<ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>a</li>' +
      '<li data-list="bullet">b</li><li data-list="ordered">c</li></ol>';
    expect(sanitizeRichText(quill)).toBe("<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>");
  });

  it("never keeps data-list on its own", () => {
    expect(sanitizeRichText('<p data-list="bullet">x</p>')).toBe("<p>x</p>");
  });

  it("loads semantic lists back in Quill's form, and round-trips", () => {
    const stored = "<ul><li>a</li></ul><ol><li>b</li></ol>";
    const editor = toEditorRichText(stored);
    expect(editor).toBe('<ol><li data-list="bullet">a</li></ol><ol><li data-list="ordered">b</li></ol>');
    expect(sanitizeRichText(editor)).toBe(stored);
  });
});

describe("sanitizeInlineRichText", () => {
  it("flattens lines to <br>-separated text without a trailing break", () => {
    expect(sanitizeInlineRichText("<p>One</p><p><em>Two</em></p>")).toBe("One<br><em>Two</em>");
  });

  it("does not double the break around a list", () => {
    expect(sanitizeInlineRichText("<ul><li>a</li><li>b</li></ul><p>c</p>")).toBe("a<br>b<br>c");
  });

  it("round-trips through the editor's block form", () => {
    const blocks = toEditorBlocks("One<br><strong>Two</strong>");
    expect(blocks).toBe("<p>One</p><p><strong>Two</strong></p>");
    expect(sanitizeInlineRichText(blocks)).toBe("One<br><strong>Two</strong>");
  });

  it("splits a break nested inside a mark without losing the mark", () => {
    expect(toEditorBlocks("<strong>a<br>b</strong>c")).toBe("<p><strong>a</strong></p><p><strong>b</strong>c</p>");
  });
});

describe("stripHtmlTags", () => {
  it("returns the visible text with entities decoded", () => {
    expect(stripHtmlTags("<p>Speaker <strong>One</strong> &amp; Two</p><script>x</script>")).toBe(
      "Speaker One & Two",
    );
    expect(stripHtmlTags("  ")).toBe("");
  });
});
