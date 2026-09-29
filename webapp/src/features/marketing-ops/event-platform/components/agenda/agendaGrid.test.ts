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
import type { Track } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { SLOT_PX } from "@features/marketing-ops/event-platform/utils/agenda";
import {
  boardGridTemplate,
  freeCardLayout,
  pointerSlot,
  sectionCardBox,
  sectionDropSlot,
  timeLabelSlots,
} from "./agendaGrid";

const track = (id: string, position: number): Track => ({
  id,
  dayId: "d1",
  colorToken: null,
  position,
  roomId: null,
  room: null,
});
const tracks = [track("t1", 0), track("t2", 1), track("t3", 2)];
const section = { startSlot: 10, durationSlots: 12 };

describe("boardGridTemplate", () => {
  it("draws a time column, one column per track and one row per slot", () => {
    expect(boardGridTemplate(3, 96)).toEqual({
      gridTemplateColumns: "90px repeat(3, minmax(180px, 1fr))",
      gridTemplateRows: `auto repeat(96, ${SLOT_PX}px)`,
    });
  });
});

describe("timeLabelSlots", () => {
  it("labels every half hour", () => {
    expect(timeLabelSlots(20)).toEqual([0, 6, 12, 18]);
  });
});

describe("pointerSlot", () => {
  it("reads the slot under the pointer, kept inside the section", () => {
    expect(pointerSlot(section, 0)).toBe(10);
    expect(pointerSlot(section, SLOT_PX * 3 + 1)).toBe(13);
    expect(pointerSlot(section, SLOT_PX * 50)).toBe(21);
    expect(pointerSlot(section, -5)).toBe(10);
  });
});

describe("sectionDropSlot", () => {
  it("pulls a drop back so the item ends inside the section", () => {
    expect(sectionDropSlot(section, SLOT_PX * 3, 4)).toBe(13);
    expect(sectionDropSlot(section, SLOT_PX * 11, 4)).toBe(18);
  });

  it("starts an item longer than the section at its start", () => {
    expect(sectionDropSlot(section, SLOT_PX * 5, 30)).toBe(10);
  });
});

describe("sectionCardBox", () => {
  it("offsets a card from the section's start and clips it to the section", () => {
    expect(sectionCardBox({ slotIndex: 12, durationSlots: 40 }, section)).toEqual({
      topPx: 2 * SLOT_PX,
      heightPx: 12 * SLOT_PX,
      isCompact: false,
    });
  });

  it("marks a one-slot card compact", () => {
    expect(sectionCardBox({ slotIndex: null, durationSlots: 1 }, section)).toEqual({
      topPx: 0,
      heightPx: SLOT_PX,
      isCompact: true,
    });
  });
});

describe("freeCardLayout", () => {
  it("spans every track for a full-width item", () => {
    expect(
      freeCardLayout({ kind: "break", slotIndex: 6, trackId: null, durationSlots: 3 }, tracks, 96),
    ).toMatchObject({
      isFullWidth: true,
      track: null,
      gridColumn: "2 / span 3",
      gridRow: "8 / span 3",
      isCompact: false,
    });
  });

  it("puts a track item in its track's column, clipped to the day", () => {
    expect(
      freeCardLayout({ kind: "session", slotIndex: 95, trackId: "t2", durationSlots: 6 }, tracks, 96),
    ).toMatchObject({ track: tracks[1], gridColumn: "3", gridRow: "97 / span 1", isCompact: true });
  });

  it("skips an item with no slot, or whose track is not on the board", () => {
    expect(freeCardLayout({ kind: "keynote", slotIndex: null, trackId: null, durationSlots: 3 }, tracks, 96)).toBeNull();
    expect(freeCardLayout({ kind: "session", slotIndex: 1, trackId: "gone", durationSlots: 3 }, tracks, 96)).toBeNull();
  });
});
