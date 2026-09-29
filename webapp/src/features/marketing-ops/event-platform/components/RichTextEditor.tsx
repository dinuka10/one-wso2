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


import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useEffect, useRef, useState } from "react";
import { Box } from "@wso2/oxygen-ui";
import type { SxProps, Theme } from "@wso2/oxygen-ui";
import {
  FONT_WEIGHTS,
  sanitizeInlineRichText,
  sanitizeRichText,
  toEditorBlocks,
} from "@features/marketing-ops/event-platform/utils/sanitizeHtml";

// Ported from the source's Quill 2 editor onto react-quill-new (the React 19
// fork of react-quill the webapp already uses; see ParRichTextField).
//
// Uncontrolled on purpose: `value` seeds the editor once, and every edit goes
// out through `onChange` already sanitised. Feeding the sanitised HTML back in
// as a controlled value would re-parse it on each keystroke, which is what
// makes Quill's caret jump. To load a different value (a form reset, another
// record), remount it with a new `key`.

const Parchment = Quill.import("parchment");

// Parchment's StyleAttributor assigns through node.style, which can't express
// !important, and !important is the whole point here (see normalizeFontWeight
// in utils/sanitizeHtml). setProperty is the only DOM API that can set it.
class ImportantStyleAttributor extends Parchment.StyleAttributor {
  add(node: HTMLElement, value: string): boolean {
    if (!this.canAdd(node, value)) return false;
    node.style.setProperty(this.keyName, value, "important");
    return true;
  }
}

Quill.register(
  new ImportantStyleAttributor("fontWeight", "font-weight", {
    scope: Parchment.Scope.INLINE,
    whitelist: FONT_WEIGHTS,
  }),
  true,
);

// Module-level so their identity never changes: react-quill-new tears the
// editor down and rebuilds it whenever `modules` or `formats` differ.
const INLINE_MODULES = {
  toolbar: [[{ fontWeight: ["700", "400", "300"] }, "italic", "link"]],
  // Titles are one logical line; Enter does nothing rather than add a block.
  // Keyed "Enter", not the source's 13: Quill 2 runs bindings for evt.key
  // before evt.which, so a 13 binding sits behind its own Enter handler and
  // never fires.
  keyboard: { bindings: { enter: { key: "Enter", handler: () => false } } },
};

const FULL_MODULES = {
  toolbar: [
    [{ fontWeight: ["700", "400", "300"] }, "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "link"],
    ["clean"],
  ],
};

type QuillInstance = ReturnType<ReactQuill["getEditor"]>;

// Pasted content takes the editor's own styling rather than the source
// document's. A Node.ELEMENT_NODE clipboard matcher can't do it: Quill applies
// its tag-based matchers (bold for <b>, list for <li>, ...) after the element
// matchers for the same node, so the outermost pasted element keeps its
// formatting. Overriding `convert` runs once, after every matcher, so nothing
// is missed. Typed text and toolbar formatting never go through `convert`.
// Returns the undo, so an effect can restore the original.
function stripClipboardFormatting(quill: QuillInstance, flattenNewlines: boolean): () => void {
  const clipboard = quill.clipboard;
  const original = clipboard.convert;
  const convert = original.bind(clipboard);
  clipboard.convert = (...args: Parameters<typeof convert>) => {
    const delta = convert(...args);
    delta.ops.forEach((op) => {
      if (typeof op.insert === "string" && flattenNewlines) {
        op.insert = op.insert.replace(/\n/g, " ");
      }
      delete op.attributes;
    });
    return delta;
  };
  return () => {
    clipboard.convert = original;
  };
}

// Label for each weight in the picker; Quill's snow theme shows only the raw
// value otherwise.
const WEIGHT_LABELS: Record<string, string> = { "700": "Bold", "400": "Regular", "300": "Thin" };

function weightPickerSx(): Record<string, object> {
  const sx: Record<string, object> = {
    "& .ql-picker.ql-fontWeight": { width: 86 },
    "& .ql-picker.ql-fontWeight .ql-picker-label::before, & .ql-picker.ql-fontWeight .ql-picker-item::before":
      { content: '"Normal"' },
  };
  for (const [weight, label] of Object.entries(WEIGHT_LABELS)) {
    sx[`& .ql-picker.ql-fontWeight .ql-picker-label[data-value='${weight}']::before`] = {
      content: `"${label}"`,
    };
    sx[`& .ql-picker.ql-fontWeight .ql-picker-item[data-value='${weight}']::before`] = {
      content: `"${label}"`,
      fontWeight: Number(weight),
    };
  }
  return sx;
}

// The snow theme hard-codes a light palette (#444 icons, #ccc borders, white
// menus). Everything it colours is re-pointed at theme tokens so the editor
// follows the light/dark switch; `theme.vars` holds the CSS variables that do.
const editorSx: SxProps<Theme> = (theme) => {
  const palette = (theme.vars ?? theme).palette;
  return {
    "& .ql-toolbar.ql-snow": {
      borderColor: palette.divider,
      borderRadius: "4px 4px 0 0",
      fontFamily: "inherit",
    },
    "& .ql-container.ql-snow": {
      borderColor: palette.divider,
      borderRadius: "0 0 4px 4px",
      fontSize: 14,
      fontFamily: "inherit",
      color: palette.text.primary,
    },
    "& .ql-editor.ql-blank::before": { color: palette.text.disabled },
    "& .ql-snow .ql-stroke": { stroke: palette.text.secondary },
    "& .ql-snow .ql-fill, & .ql-snow .ql-stroke.ql-fill": { fill: palette.text.secondary },
    "& .ql-snow .ql-picker": { color: palette.text.secondary },
    "& .ql-snow button:hover .ql-stroke, & .ql-snow button.ql-active .ql-stroke, & .ql-snow .ql-picker-label:hover .ql-stroke, & .ql-snow .ql-picker-label.ql-active .ql-stroke":
      { stroke: palette.primary.main },
    "& .ql-snow button:hover .ql-fill, & .ql-snow button.ql-active .ql-fill": { fill: palette.primary.main },
    "& .ql-snow .ql-picker-label:hover, & .ql-snow .ql-picker-label.ql-active, & .ql-snow .ql-picker-item:hover, & .ql-snow .ql-picker-item.ql-selected":
      { color: palette.primary.main },
    "& .ql-snow .ql-picker-options": {
      backgroundColor: palette.background.paper,
      borderColor: palette.divider,
    },
    "& .ql-snow.ql-toolbar .ql-picker.ql-expanded .ql-picker-label": { borderColor: palette.divider },
    "& .ql-snow .ql-tooltip": {
      backgroundColor: palette.background.paper,
      borderColor: palette.divider,
      color: palette.text.primary,
      boxShadow: theme.shadows[2],
      zIndex: 1,
    },
    "& .ql-snow .ql-tooltip input[type=text]": {
      backgroundColor: palette.background.default,
      borderColor: palette.divider,
      color: palette.text.primary,
    },
    "& .ql-snow a": { color: palette.primary.main },
    ...weightPickerSx(),
  };
};

export default function RichTextEditor({
  value,
  onChange,
  variant,
  placeholder,
  autoFocus,
}: {
  // Seeds the editor on mount only; see the note at the top.
  value: string;
  // Sanitised HTML, or "" when the editor holds no visible text.
  onChange: (html: string) => void;
  // `inline` for titles (one line, weight/italic/link), `full` for descriptions.
  variant: "inline" | "full";
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const quillRef = useRef<ReactQuill>(null);
  const isInline = variant === "inline";
  // Captured once, so a parent re-render with the sanitised value it just
  // received never reaches the editor.
  const [initialValue] = useState(() => (isInline ? toEditorBlocks(value) : sanitizeRichText(value)));
  const [shouldFocus] = useState(Boolean(autoFocus));

  // Seeded straight into the DOM, as the source did, rather than through
  // `defaultValue`: react-quill-new would load that through the clipboard
  // matchers, which turn a 700 weight into a <strong> the toolbar has no
  // button to remove. "silent" keeps the load out of onChange and the undo
  // history.
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    quill.root.innerHTML = initialValue;
    quill.update("silent");
    quill.history.clear();
  }, [initialValue]);

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    return stripClipboardFormatting(quill, isInline);
  }, [isInline]);

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    if (placeholder) quill.root.setAttribute("aria-label", placeholder);
  }, [placeholder]);

  useEffect(() => {
    if (shouldFocus) quillRef.current?.focus();
  }, [shouldFocus]);

  return (
    <Box sx={editorSx}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        placeholder={placeholder}
        modules={isInline ? INLINE_MODULES : FULL_MODULES}
        onChange={(_html, _delta, source, editor) => {
          // Only edits count, not anything the component does to the editor.
          if (source !== "user") return;
          if (editor.getText().trim().length === 0) {
            onChange("");
            return;
          }
          // root.innerHTML rather than the semantic HTML react-quill-new passes
          // in, which turns every space into &nbsp;. The sanitiser round trip
          // also canonicalises the weight style, since the browser serialises
          // setProperty's !important with its own spacing.
          const html = editor.getHTML();
          onChange(isInline ? sanitizeInlineRichText(html) : sanitizeRichText(html));
        }}
      />
    </Box>
  );
}
