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


import DOMPurify from "dompurify";

// The one sanitiser for Event Platform rich text (session titles and
// descriptions, footnotes). Matches what RichTextEditor's toolbars can
// produce, and has to stay in step with the backend's own sanitiser and the
// public agenda's renderer, which receive the same markup.
//
// A line tag ends a visual line; a list tag only wraps them. The distinction
// matters when flattening (see flattenBlocks).
const LINE_TAGS = ["p", "li", "blockquote"];
const LIST_TAGS = ["ul", "ol"];
const BLOCK_TAGS = [...LINE_TAGS, ...LIST_TAGS];
const INLINE_TAGS = ["br", "strong", "em", "u", "s", "a", "span"];
const ALLOWED_ATTR = ["href", "class", "style"];
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:)/i;

/** The font weights the editor offers; any other weight is dropped on sanitise. */
export const FONT_WEIGHTS = ["300", "400", "700"];

const LEGACY_WEIGHT_CLASS = /^ql-fw-(300|400|700)$/;

function weightStyle(weight: string): string {
  return `font-weight:${weight}!important;`;
}

// Font weight is the one format that has to survive outside this app: titles
// and descriptions are rendered inside the marketing site's own headings,
// which carry site-wide font-weight rules. A class can't win against those
// (the site ships no stylesheet for ours), so the weight travels as an inline
// !important declaration and nothing else in a style attribute is kept.
// Values authored before that switch carry Quill's ql-fw-* class, so they are
// upgraded here; every read path goes through this, including the editor's.
function normalizeFontWeight(html: string): string {
  const holder = document.createElement("div");
  holder.innerHTML = html;

  holder.querySelectorAll<HTMLElement>("[style], [class]").forEach((el) => {
    const legacy = [...el.classList].find((c) => LEGACY_WEIGHT_CLASS.test(c));
    if (legacy) el.classList.remove(legacy);
    if (el.classList.length === 0) el.removeAttribute("class");

    const weight = legacy?.slice("ql-fw-".length) ?? el.style.fontWeight;
    el.removeAttribute("style");
    if (FONT_WEIGHTS.includes(weight)) el.setAttribute("style", weightStyle(weight));
  });

  return holder.innerHTML;
}

function sanitize(html: string, allowedTags: string[]): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
  });
  return normalizeFontWeight(clean).replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

/** Block-level rich text (descriptions): paragraphs, lists, quotes, inline marks, links. */
export function sanitizeRichText(html: string): string {
  return sanitize(html, [...BLOCK_TAGS, ...INLINE_TAGS]);
}

// Titles are rendered inside someone else's heading, where a <p> picks up the
// host site's paragraph styling and is invalid markup besides. Quill models
// every line as its own block, so unwrapping keeps each boundary as the <br>
// the host expects; drop it and the lines run together.
function flattenBlocks(html: string): string {
  const holder = document.createElement("div");
  holder.innerHTML = html;

  holder.querySelectorAll(BLOCK_TAGS.join(",")).forEach((block) => {
    const parts: Node[] = [...block.childNodes];
    // A <ul> contributes no break of its own: its items already do, and
    // counting both would double the gap after the list.
    const endsLine = LINE_TAGS.includes(block.localName) && block.nextSibling;
    if (endsLine) parts.push(document.createElement("br"));
    block.replaceWith(...parts);
  });

  return holder.innerHTML;
}

/** Inline rich text (titles): the same marks with blocks flattened to <br>-separated lines. */
export function sanitizeInlineRichText(html: string): string {
  return flattenBlocks(sanitizeRichText(html));
}

// The inverse, for loading a stored inline value back into the editor: Quill
// drops a <br> that sits between text, so each line has to become a block again.
export function toEditorBlocks(html: string): string {
  return sanitizeInlineRichText(html)
    .split(/<br\s*\/?>/)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

/** Visible text only, for places that can't show markup (a confirmation message, an aria-label). */
// Read back as textContent rather than a string, unlike the source, so
// "&amp;" arrives as "&" and React doesn't print the entity literally.
export function stripHtmlTags(html: string): string {
  const fragment = DOMPurify.sanitize(html, { ALLOWED_TAGS: [], RETURN_DOM_FRAGMENT: true });
  return (fragment.textContent ?? "").trim();
}
