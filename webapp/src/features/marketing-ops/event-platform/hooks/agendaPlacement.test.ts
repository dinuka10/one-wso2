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
import type { Session } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { clampStartSlot, isCellHighlighted, resolveDrop, splitSessions } from "./agendaPlacement";

function session(over: Partial<Session> = {}): Session {
  return {
    id: "s1",
    configId: "evt-7",
    kind: "session",
    title: "Talk",
    description: "",
    durationSlots: 6,
    dayId: "d1",
    trackId: "t1",
    slotIndex: 0,
    sectionId: "sec-1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    speakers: [],
    roomId: null,
    room: null,
    roomIsManual: false,
    topicId: null,
    topicIsManual: false,
    articleUrl: null,
    articleLabel: null,
    videoUrl: null,
    videoLabel: null,
    ...over,
  };
}

describe("splitSessions", () => {
  it("puts dayless sessions in the palette and the day's placed ones on the board", () => {
    const sessions = [
      session({ id: "a", dayId: null, trackId: null, slotIndex: null, sectionId: null }),
      session({ id: "b" }),
      session({ id: "c", dayId: "d2" }),
      // A day but neither slot nor section: on neither.
      session({ id: "d", slotIndex: null, sectionId: null }),
    ];
    const { palette, placed } = splitSessions(sessions, "d1");
    expect(palette.map((s) => s.id)).toEqual(["a"]);
    expect(placed.map((s) => s.id)).toEqual(["b"]);
  });
});

describe("clampStartSlot", () => {
  it("keeps an item inside the day", () => {
    expect(clampStartSlot(-3, 6, 96)).toBe(0);
    expect(clampStartSlot(94, 6, 96)).toBe(90);
    expect(clampStartSlot(10, 6, 96)).toBe(10);
  });
});

describe("resolveDrop", () => {
  const base = { dayId: "d1", slotCount: 96 };

  it("ignores a drop with no day or no session", () => {
    expect(
      resolveDrop({ ...base, dayId: undefined, session: session(), placed: [], trackId: "t1", rawSlot: 0, sectionId: "sec-1" }),
    ).toEqual({ kind: "ignored" });
    expect(
      resolveDrop({ ...base, session: undefined, placed: [], trackId: "t1", rawSlot: 0 }),
    ).toEqual({ kind: "ignored" });
  });

  it("ignores a regular session dropped outside a section", () => {
    expect(
      resolveDrop({ ...base, session: session(), placed: [], trackId: "t1", rawSlot: 4 }),
    ).toEqual({ kind: "ignored" });
  });

  it("places a session in a section, clamped to the day", () => {
    expect(
      resolveDrop({ ...base, session: session(), placed: [], trackId: "t1", rawSlot: 95, sectionId: "sec-1" }),
    ).toEqual({
      kind: "place",
      placement: { dayId: "d1", trackId: "t1", slotIndex: 90, sectionId: "sec-1" },
    });
  });

  it("places a full-width item outside any section", () => {
    const keynote = session({ id: "k", kind: "keynote", trackId: null, sectionId: null });
    expect(
      resolveDrop({ ...base, session: keynote, placed: [], trackId: null, rawSlot: 12 }),
    ).toEqual({
      kind: "place",
      placement: { dayId: "d1", trackId: null, slotIndex: 12, sectionId: null },
    });
  });

  it("files a full-width item dropped on a track cell under no track", () => {
    const brk = session({ id: "b", kind: "break", trackId: null, sectionId: null, slotIndex: null });
    expect(resolveDrop({ ...base, session: brk, placed: [], trackId: "t2", rawSlot: 12 })).toEqual({
      kind: "place",
      placement: { dayId: "d1", trackId: null, slotIndex: 12, sectionId: null },
    });
    // Inside a track section it keeps that section's track.
    expect(
      resolveDrop({ ...base, session: brk, placed: [], trackId: "t2", rawSlot: 12, sectionId: "sec-2" }),
    ).toEqual({ kind: "place", placement: { dayId: "d1", trackId: "t2", slotIndex: 12, sectionId: "sec-2" } });
  });

  it("refuses an overlap in the same track, not in another", () => {
    const other = session({ id: "o", slotIndex: 10, durationSlots: 6 });
    const moving = session({ id: "m" });
    expect(
      resolveDrop({ ...base, session: moving, placed: [other], trackId: "t1", rawSlot: 12, sectionId: "sec-1" }),
    ).toEqual({ kind: "overlap" });
    expect(
      resolveDrop({ ...base, session: moving, placed: [other], trackId: "t2", rawSlot: 12, sectionId: "sec-2" })
        .kind,
    ).toBe("place");
  });

  it("refuses anything under a full-width item, and a full-width item over anything", () => {
    const brk = session({ id: "b", kind: "break", trackId: null, sectionId: null, slotIndex: 10 });
    expect(
      resolveDrop({ ...base, session: session({ id: "m" }), placed: [brk], trackId: "t2", rawSlot: 12, sectionId: "sec-2" }),
    ).toEqual({ kind: "overlap" });
    const keynote = session({ id: "k", kind: "keynote", trackId: null, sectionId: null });
    const talk = session({ id: "t", trackId: "t3", slotIndex: 20 });
    expect(
      resolveDrop({ ...base, session: keynote, placed: [talk], trackId: null, rawSlot: 18 }),
    ).toEqual({ kind: "overlap" });
  });

  it("does not collide a session with itself when moved", () => {
    const moving = session({ id: "m", slotIndex: 10 });
    expect(
      resolveDrop({ ...base, session: moving, placed: [moving], trackId: "t1", rawSlot: 12, sectionId: "sec-1" })
        .kind,
    ).toBe("place");
  });
});

describe("isCellHighlighted", () => {
  it("lights nothing while no cell is under the drag", () => {
    expect(isCellHighlighted(null, session(), "t1", 0, 96)).toBe(false);
  });

  it("lights the dragged session's span in its track", () => {
    const over = { trackId: "t1", slot: 10, sectionId: "sec-1" };
    const dragging = session({ durationSlots: 3 });
    expect(isCellHighlighted(over, dragging, "t1", 10, 96)).toBe(true);
    expect(isCellHighlighted(over, dragging, "t1", 12, 96)).toBe(true);
    expect(isCellHighlighted(over, dragging, "t1", 13, 96)).toBe(false);
    expect(isCellHighlighted(over, dragging, "t2", 10, 96)).toBe(false);
  });

  it("does not advertise a drop that would be ignored", () => {
    expect(isCellHighlighted({ trackId: "t1", slot: 10 }, session(), "t1", 10, 96)).toBe(false);
  });

  it("lights a full-width item across every track", () => {
    const keynote = session({ kind: "keynote", durationSlots: 2 });
    expect(isCellHighlighted({ trackId: "t1", slot: 10 }, keynote, "t9", 11, 96)).toBe(true);
  });
});
