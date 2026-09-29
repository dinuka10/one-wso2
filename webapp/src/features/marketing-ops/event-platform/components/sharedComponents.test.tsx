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


import { render, screen } from "@testing-library/react";
import { DatePickers } from "@wso2/oxygen-ui";
import { Quill } from "react-quill-new";
import { describe, expect, it, vi } from "vitest";
import DatePickerProvider from "./DatePickerProvider";
import { PICKER_SLOT_PROPS } from "./pickerSlotProps";
import RichText from "./RichText";
import RichTextEditor from "./RichTextEditor";
import { minuteToTime, parseDateOnly, parseInstant } from "../utils/dateTime";

const { DatePicker, DateTimePicker, TimePicker } = DatePickers;

describe("RichText", () => {
  it("renders sanitised markup", () => {
    const { container } = render(<RichText html={'<p>Hello <strong>there</strong><script>x</script></p>'} />);
    expect(container.innerHTML).toContain("<strong>there</strong>");
    expect(container.querySelector("script")).toBeNull();
  });

  it("flattens an inline value", () => {
    const { container } = render(<RichText variant="inline" component="span" html="<p>One</p><p>Two</p>" />);
    expect(container.querySelector("span")?.innerHTML).toBe("One<br>Two");
  });
});

describe("RichTextEditor", () => {
  it("seeds the editor with the sanitised value, weight intact, without reporting a change", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor
        variant="full"
        placeholder="Description"
        value={'<p><span style="font-weight:700!important;">Bold</span> text<img src=x onerror="y()"></p>'}
        onChange={onChange}
      />,
    );
    const root = container.querySelector(".ql-editor");
    expect(root?.textContent).toBe("Bold text");
    expect(root?.querySelector("img")).toBeNull();
    expect((root?.querySelector("span") as HTMLElement | null)?.style.getPropertyValue("font-weight")).toBe(
      "700",
    );
    expect(root?.querySelector("strong")).toBeNull();
    expect(root?.getAttribute("aria-label")).toBe("Description");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports user edits sanitised, and an emptied editor as blank", () => {
    const onChange = vi.fn();
    const { container } = render(<RichTextEditor variant="inline" value="Title" onChange={onChange} />);
    const quill = Quill.find(container.querySelector(".ql-container") as HTMLElement) as Quill;
    quill.insertText(0, "New ", "user");
    expect(onChange).toHaveBeenLastCalledWith("New Title");
    quill.deleteText(0, quill.getLength(), "user");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("ignores Enter in an inline editor but not in a full one", () => {
    // jsdom has no layout; Quill scrolls the caret into view after Enter.
    Range.prototype.getBoundingClientRect ??= () => new DOMRect();
    const lines = (variant: "inline" | "full") => {
      const { container, unmount } = render(<RichTextEditor variant={variant} value="Title" onChange={() => {}} />);
      const quill = Quill.find(container.querySelector(".ql-container") as HTMLElement) as Quill;
      quill.setSelection(5, 0);
      quill.root.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, which: 13, bubbles: true }));
      const count = quill.getLines().length;
      unmount();
      return count;
    };
    expect(lines("inline")).toBe(1);
    expect(lines("full")).toBe(2);
  });

  it("shows an inline value as one block per line", () => {
    const { container } = render(<RichTextEditor variant="inline" value="One<br>Two" onChange={() => {}} />);
    expect(container.querySelectorAll(".ql-editor p")).toHaveLength(2);
  });
});

describe("DatePickerProvider", () => {
  it("hosts every picker kind with the shared slot props", () => {
    render(
      <DatePickerProvider>
        <DatePicker label="Start date" value={parseDateOnly("2026-09-29")} slotProps={PICKER_SLOT_PROPS} />
        <TimePicker label="Starts at" value={minuteToTime(480)} slotProps={PICKER_SLOT_PROPS} />
        <DateTimePicker
          label="Shop closes"
          value={parseInstant("2026-09-29T17:00:00Z")}
          slotProps={PICKER_SLOT_PROPS}
        />
      </DatePickerProvider>,
    );
    expect(screen.getAllByLabelText("Start date").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Starts at").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Shop closes").length).toBeGreaterThan(0);
  });
});
