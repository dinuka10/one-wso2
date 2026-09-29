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
  descriptionRichHtml,
  escapeHtml,
  inlineRichHtml,
  safeClassName,
  safeDomId,
  safeImageUrl,
  safeLinkUrl,
  safeLogoStyle,
  safePaletteClass,
} from "./html";

describe("escapeHtml", () => {
  it("escapes markup and both quote kinds", () => {
    expect(escapeHtml(`<b a="1" b='2'>&</b>`)).toBe("&lt;b a=&quot;1&quot; b=&#39;2&#39;&gt;&amp;&lt;/b&gt;");
  });

  it("prints nothing for null and undefined, and stringifies the rest", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("safeLinkUrl", () => {
  it.each([
    ["https://www.example.com/talk", "https://www.example.com/talk"],
    ["http://example.com", "http://example.com/"],
    ["mailto:someone@example.com", "mailto:someone@example.com"],
    ["  https://example.com/a  ", "https://example.com/a"],
  ])("keeps %s", (input, expected) => {
    expect(safeLinkUrl(input)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "/relative/path",
    "example.com",
    "",
    null,
    42,
  ])("rejects %s", (input) => {
    expect(safeLinkUrl(input)).toBeNull();
  });
});

describe("safeImageUrl", () => {
  it("takes http(s) only", () => {
    expect(safeImageUrl("https://cdn.example.com/p.png")).toBe("https://cdn.example.com/p.png");
    expect(safeImageUrl("mailto:someone@example.com")).toBeNull();
    expect(safeImageUrl("data:image/svg+xml,<svg onload=alert(1)>")).toBeNull();
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("safeLogoStyle", () => {
  it("keeps sizing declarations and normalises their spacing", () => {
    expect(safeLogoStyle("max-width:90px")).toBe("max-width: 90px");
    expect(safeLogoStyle("width: 120px !important; margin-top: 4px")).toBe(
      "width: 120px !important; margin-top: 4px",
    );
    expect(safeLogoStyle("MAX-HEIGHT: 2.5rem;")).toBe("max-height: 2.5rem");
    expect(safeLogoStyle("margin: 0 auto")).toBe("margin: 0 auto");
  });

  it("drops anything that is not a plain length on a sizing property", () => {
    expect(safeLogoStyle("position: fixed; inset: 0; width: 100vw")).toBe("width: 100vw");
    expect(safeLogoStyle("background: url(https://tracker.example.com/p.gif)")).toBe("");
    expect(safeLogoStyle("width: expression(alert(1))")).toBe("");
    expect(safeLogoStyle('width: 10px" onload="alert(1)')).toBe("");
    expect(safeLogoStyle("width: calc(100% - 1px)")).toBe("");
    expect(safeLogoStyle(null)).toBe("");
  });
});

describe("safeClassName, safeDomId, safePaletteClass", () => {
  it("passes a slug and refuses anything that could leave the attribute", () => {
    expect(safeClassName("ai-track")).toBe("ai-track");
    expect(safeClassName('x" onclick="alert(1)')).toBeNull();
    expect(safeClassName("two words")).toBeNull();
    expect(safeClassName(null)).toBeNull();
  });

  it("squashes an id into selector-safe characters", () => {
    expect(safeDomId("evt-7_a")).toBe("evt-7_a");
    expect(safeDomId('a"><img src=x>')).toBe("a---img-src-x-");
  });

  it("knows every colour token, orange included, and falls back to main", () => {
    expect(safePaletteClass("palette-orange")).toBe("palette-orange");
    expect(safePaletteClass("palette-dark-blue")).toBe("palette-dark-blue");
    expect(safePaletteClass("palette-pink")).toBe("palette-main");
    expect(safePaletteClass('palette-red" style="x')).toBe("palette-main");
  });
});

describe("rich text", () => {
  it("strips script and handlers from titles and flattens blocks to <br>", () => {
    const html = inlineRichHtml('<p>Line <strong>one</strong><img src=x onerror="alert(1)"></p><p>two</p>');
    expect(html).toBe("Line <strong>one</strong><br>two");
  });

  it("drops a javascript: link but keeps an https one, opening in a new tab", () => {
    const html = descriptionRichHtml(
      '<p><a href="javascript:alert(1)">bad</a> <a href="https://example.com">good</a></p>',
    );
    expect(html).not.toContain("javascript:");
    expect(html).toContain('<a target="_blank" rel="noopener noreferrer" href="https://example.com">good</a>');
  });

  it("turns a plain-text description into escaped paragraphs", () => {
    expect(descriptionRichHtml("First & one\n\nx < y")).toBe("<p>First &amp; one</p><p>x &lt; y</p>");
  });

  it("prints nothing for an empty or non-string value", () => {
    expect(descriptionRichHtml("   ")).toBe("");
    expect(inlineRichHtml(undefined)).toBe("");
  });
});
