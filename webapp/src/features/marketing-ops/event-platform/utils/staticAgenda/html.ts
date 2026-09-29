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

// Output hygiene for the static agenda and speaker pages. Those pages are
// published to the public conference site, so every value from the export
// goes through exactly one of these on its way into markup: rich text through
// the shared DOMPurify sanitiser, URLs through a scheme check, and every other
// string through escapeHtml. The backend sanitises on write too; that is not
// relied on here.

import { COLOR_TOKEN_NAMES, DEFAULT_COLOR_TOKEN } from "@features/marketing-ops/event-platform/types/colorTokens";
import {
  sanitizeInlineRichText,
  sanitizeRichText,
} from "@features/marketing-ops/event-platform/utils/sanitizeHtml";

/** Text and attribute values. Safe inside a quoted attribute as well as element content. */
export function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only absolute URLs: the page is opened from the public site or from disk,
// so a relative one would resolve against wherever that happens to be — and
// against this app while building.
function parseAbsolute(value: unknown): URL | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

const LINK_PROTOCOLS = ["https:", "http:", "mailto:"];
const IMAGE_PROTOCOLS = ["https:", "http:"];

/**
 * A link target whose scheme cannot run script, normalised; `null` otherwise.
 * escapeHtml does not help here: `javascript:` survives it untouched.
 */
export function safeLinkUrl(value: unknown): string | null {
  const url = parseAbsolute(value);
  return url && LINK_PROTOCOLS.includes(url.protocol) ? url.href : null;
}

/**
 * An image source. Not in the source, which escaped image URLs but never
 * checked their scheme; http(s) only, so no `data:` or `javascript:` payloads.
 */
export function safeImageUrl(value: unknown): string | null {
  const url = parseAbsolute(value);
  return url && IMAGE_PROTOCOLS.includes(url.protocol) ? url.href : null;
}

// A speaker's logo size is free CSS typed in the speaker form ("max-width:
// 90px", "width: 120px !important"). The source escaped it into a style
// attribute, which stops it closing the attribute but lets through any
// declaration at all: a fixed-position overlay across the page, or a
// background image fetched from anywhere. Only sizing and spacing survive.
const LOGO_STYLE_PROPERTIES = new Set([
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
]);
const CSS_LENGTH = String.raw`(?:auto|0|-?\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh))`;
const LOGO_STYLE_VALUE = new RegExp(String.raw`^${CSS_LENGTH}(?:\s+${CSS_LENGTH}){0,3}(?:\s*!important)?$`, "i");

/** The sizing declarations of a logo size, re-serialised; "" when none survive. */
export function safeLogoStyle(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .split(";")
    .map((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon < 0) return null;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const cssValue = declaration.slice(colon + 1).trim();
      if (!LOGO_STYLE_PROPERTIES.has(property) || !LOGO_STYLE_VALUE.test(cssValue)) return null;
      return `${property}: ${cssValue}`;
    })
    .filter((declaration): declaration is string => declaration !== null)
    .join("; ");
}

/**
 * One class name from the export (a track-topic slug). The source put these
 * into class="…" unescaped, so a slug with a quote could add attributes.
 */
export function safeClassName(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z_][\w-]*$/.test(value) ? value : null;
}

/** A DOM id and `#…` target from an export id or anchor; anything else becomes "-". */
export function safeDomId(value: unknown): string {
  return String(value ?? "").replace(/[^a-z0-9_-]/gi, "-");
}

const PALETTE_CLASSES = new Set(COLOR_TOKEN_NAMES.map((token) => `palette-${token}`));

/**
 * A track's palette slot class. The source's allow-list had drifted from the
 * token vocabulary and left out orange, so orange tracks rendered as the
 * neutral slot; it now reads the vocabulary itself.
 */
export function safePaletteClass(value: unknown): string {
  return typeof value === "string" && PALETTE_CLASSES.has(value) ? value : `palette-${DEFAULT_COLOR_TOKEN}`;
}

// The shared sanitiser keeps `class` for the editor's own use, but the editor
// emits none (font weight travels as an inline style), and this page loads
// Bootstrap: a span classed "position-fixed top-0 start-0 w-100 h-100" would
// be the same full-page overlay safeLogoStyle stops, by another attribute.
// `unlink` unwraps links into their text, for a title inside a card that is
// itself an <a>: nested anchors make the parser split the card apart.
function publishable(html: string, unlink = false): string {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  holder.querySelectorAll("[class]").forEach((el) => el.removeAttribute("class"));
  if (unlink) holder.querySelectorAll("a").forEach((a) => a.replaceWith(...a.childNodes));
  return holder.innerHTML;
}

/**
 * Titles: inline marks only, block boundaries kept as <br>. `unlink` for a
 * title rendered inside a link.
 */
export function inlineRichHtml(value: unknown, { unlink = false }: { unlink?: boolean } = {}): string {
  return typeof value === "string" ? publishable(sanitizeInlineRichText(value), unlink) : "";
}

// Descriptions written before the editor shipped are plain text with
// blank-line paragraph breaks; as HTML they would run together, so they are
// escaped and split into paragraphs first. Editor output always has a tag.
/** Descriptions: paragraphs, lists, quotes, inline marks and links. */
export function descriptionRichHtml(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  if (/<[a-z][\s\S]*>/i.test(value)) return publishable(sanitizeRichText(value));
  return sanitizeRichText(
    value
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join(""),
  );
}
