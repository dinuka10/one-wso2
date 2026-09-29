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
      '<a target="_blank" rel="noopener noreferrer" href="https://example.com/a">x</a>',
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
});

describe("stripHtmlTags", () => {
  it("returns the visible text with entities decoded", () => {
    expect(stripHtmlTags("<p>Speaker <strong>One</strong> &amp; Two</p><script>x</script>")).toBe(
      "Speaker One & Two",
    );
    expect(stripHtmlTags("  ")).toBe("");
  });
});
