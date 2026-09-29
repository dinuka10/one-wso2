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


import type { DragEvent } from "react";
import { describe, expect, it } from "vitest";
import { allowDrop, isFullWidthSession, isNoopDrop } from "./drag";

describe("drop rules", () => {
  it("treats keynotes, breaks and activities as full width", () => {
    expect(isFullWidthSession({ kind: "keynote" })).toBe(true);
    expect(isFullWidthSession({ kind: "break" })).toBe(true);
    expect(isFullWidthSession({ kind: "activity" })).toBe(true);
    expect(isFullWidthSession({ kind: "session" })).toBe(false);
  });

  it("makes a regular session's drop a no-op outside a section", () => {
    expect(isNoopDrop({ kind: "session" })).toBe(true);
    expect(isNoopDrop({ kind: "session" }, null)).toBe(true);
    expect(isNoopDrop({ kind: "session" }, "sec-1")).toBe(false);
    expect(isNoopDrop({ kind: "break" })).toBe(false);
  });

  it("accepts a drop as a move", () => {
    let prevented = false;
    const event = {
      preventDefault: () => {
        prevented = true;
      },
      dataTransfer: { dropEffect: "none" },
    } as unknown as DragEvent;
    allowDrop(event);
    expect(prevented).toBe(true);
    expect(event.dataTransfer.dropEffect).toBe("move");
  });
});
