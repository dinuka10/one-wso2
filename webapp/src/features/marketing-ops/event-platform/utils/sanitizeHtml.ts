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
const RICH_TAGS = [...BLOCK_TAGS, ...INLINE_TAGS];
const ALLOWED_ATTR = ["href", "class", "style"];
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:)/i;

// Quill 2 keeps every list as <ol> and says which kind on each item. It is let
// through DOMPurify only so toSemanticLists can read it; it is never kept.
const QUILL_LIST_ATTR = "data-list";

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
function normalizeFontWeight(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[style], [class]").forEach((el) => {
    const legacy = [...el.classList].find((c) => LEGACY_WEIGHT_CLASS.test(c));
    if (legacy) el.classList.remove(legacy);
    if (el.classList.length === 0) el.removeAttribute("class");

    const weight = legacy?.slice("ql-fw-".length) ?? el.style.fontWeight;
    el.removeAttribute("style");
    if (FONT_WEIGHTS.includes(weight)) el.setAttribute("style", weightStyle(weight));
  });
}

// Quill's <ol><li data-list="bullet"> renders as a numbered list anywhere
// Quill's stylesheet isn't loaded (the public agenda, the export), so each run
// of items becomes a real <ul> or <ol>. Quill's empty ql-ui marker goes too.
function toSemanticLists(root: ParentNode): void {
  root.querySelectorAll("span.ql-ui").forEach((el) => el.remove());
  root.querySelectorAll("ol").forEach((list) => {
    if (!list.querySelector(`:scope > li[${QUILL_LIST_ATTR}]`)) return;
    const runs: Element[] = [];
    [...list.childNodes].forEach((item) => {
      const tag =
        item instanceof Element && item.getAttribute(QUILL_LIST_ATTR) === "bullet" ? "ul" : "ol";
      let run = runs.at(-1);
      if (!run || (item instanceof Element && run.localName !== tag)) {
        run = list.ownerDocument.createElement(tag);
        runs.push(run);
      }
      run.append(item);
    });
    list.replaceWith(...runs);
  });
  root.querySelectorAll(`[${QUILL_LIST_ATTR}]`).forEach((el) => el.removeAttribute(QUILL_LIST_ATTR));
}

// Every step after DOMPurify works on its DOM, never on a serialised string,
// and serialize() is always last. A string rewrite of sanitised markup can
// match inside an attribute value (serialisers needn't escape "<" there) and
// turn it into live markup, which is exactly what DOMPurify just removed.
function sanitizeToFragment(html: string, allowedTags: string[]): DocumentFragment {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: [...ALLOWED_ATTR, QUILL_LIST_ATTR],
    ALLOWED_URI_REGEXP,
    RETURN_DOM_FRAGMENT: true,
  });
  toSemanticLists(fragment);
  normalizeFontWeight(fragment);
  fragment.querySelectorAll("a").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
  return fragment;
}

function serialize(nodes: DocumentFragment | Node[]): string {
  const holder = document.createElement("div");
  holder.append(...(nodes instanceof DocumentFragment ? [nodes] : nodes));
  return holder.innerHTML;
}

/** Block-level rich text (descriptions): paragraphs, lists, quotes, inline marks, links. */
export function sanitizeRichText(html: string): string {
  return serialize(sanitizeToFragment(html, RICH_TAGS));
}

// Titles are rendered inside someone else's heading, where a <p> picks up the
// host site's paragraph styling and is invalid markup besides. Quill models
// every line as its own block, so unwrapping keeps each boundary as the <br>
// the host expects; drop it and the lines run together.
function flattenBlocks(root: ParentNode): void {
  root.querySelectorAll(BLOCK_TAGS.join(",")).forEach((block) => {
    const parts: Node[] = [...block.childNodes];
    // A <ul> contributes no break of its own: its items already do, and
    // counting both would double the gap after the list.
    const endsLine = LINE_TAGS.includes(block.localName) && block.nextSibling;
    if (endsLine) parts.push(block.ownerDocument.createElement("br"));
    block.replaceWith(...parts);
  });
}

/** Inline rich text (titles): the same marks with blocks flattened to <br>-separated lines. */
export function sanitizeInlineRichText(html: string): string {
  const fragment = sanitizeToFragment(html, RICH_TAGS);
  flattenBlocks(fragment);
  return serialize(fragment);
}

// Splits a node at every <br> inside it, however deep, cloning the elements
// the break sits in so each piece keeps its formatting. null marks a break.
function splitAtBreaks(node: Node): (Node | null)[] {
  if (node.nodeName === "BR") return [null];
  if (!(node instanceof Element) || !node.querySelector("br")) return [node];
  const pieces: (Node | null)[] = [];
  let current = node.cloneNode(false);
  [...node.childNodes].forEach((child) => {
    splitAtBreaks(child).forEach((part) => {
      if (part) {
        current.appendChild(part);
        return;
      }
      pieces.push(current, null);
      current = node.cloneNode(false);
    });
  });
  pieces.push(current);
  return pieces;
}

// The inverse, for loading a stored inline value back into the editor: Quill
// drops a <br> that sits between text, so each line has to become a block again.
export function toEditorBlocks(html: string): string {
  const fragment = sanitizeToFragment(html, RICH_TAGS);
  flattenBlocks(fragment);
  const lines = [document.createElement("p")];
  [...fragment.childNodes].flatMap(splitAtBreaks).forEach((part) => {
    if (part) lines[lines.length - 1].append(part);
    else lines.push(document.createElement("p"));
  });
  return serialize(lines);
}

// The inverse of toSemanticLists, for loading a stored description into the
// editor: seeded straight into Quill's DOM, a <ul> is not a list Quill knows,
// and an item without data-list loses its kind.
export function toEditorRichText(html: string): string {
  const fragment = sanitizeToFragment(html, RICH_TAGS);
  fragment.querySelectorAll("ul, ol").forEach((list) => {
    const kind = list.localName === "ul" ? "bullet" : "ordered";
    const quillList = list.ownerDocument.createElement("ol");
    [...list.childNodes].forEach((item) => {
      if (item instanceof Element && item.localName === "li") item.setAttribute(QUILL_LIST_ATTR, kind);
      quillList.append(item);
    });
    list.replaceWith(quillList);
  });
  return serialize(fragment);
}

/** Visible text only, for places that can't show markup (a confirmation message, an aria-label). */
// Read back as textContent rather than a string, unlike the source, so
// "&amp;" arrives as "&" and React doesn't print the entity literally.
export function stripHtmlTags(html: string): string {
  const fragment = DOMPurify.sanitize(html, { ALLOWED_TAGS: [], RETURN_DOM_FRAGMENT: true });
  return (fragment.textContent ?? "").trim();
}
