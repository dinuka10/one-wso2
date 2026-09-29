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
import type {
  ConferenceDay,
  Session,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { UNPLACED } from "@features/marketing-ops/event-platform/api/cacheUpdates";
import {
  DEFAULT_DURATION_SLOTS,
  durationSlotsOf,
  editPlacement,
  endsAfterStart,
  formPlacement,
  isHttpUrl,
  isItemFormValid,
  itemFormDefaults,
  sessionFieldsOf,
  type ItemFormValues,
} from "./itemForm";

// 09:00–17:00: 96 five-minute slots.
const day: ConferenceDay = {
  id: "d1",
  configId: "evt-7",
  dayIndex: 0,
  date: "2026-09-29",
  startMinute: 540,
  endMinute: 1020,
  label: null,
  startTimeOffset: "2026-09-29T09:00:00Z",
  endTimeOffset: "2026-09-29T17:00:00Z",
};

function session(over: Partial<Session> = {}): Session {
  return {
    id: "s1",
    configId: "evt-7",
    kind: "session",
    title: "<strong>Opening</strong>",
    description: "",
    durationSlots: 6,
    dayId: null,
    trackId: null,
    slotIndex: null,
    sectionId: null,
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

const base = new Date(2026, 8, 29);
const at = (h: number, m = 0) => new Date(2026, 8, 29, h, m);

function form(over: Partial<ItemFormValues> = {}): ItemFormValues {
  return { ...itemFormDefaults([day], undefined, base), title: "Talk", ...over };
}

describe("itemFormDefaults", () => {
  it("starts a new item blank and unscheduled", () => {
    const values = itemFormDefaults([day], undefined, base);
    expect(values.kind).toBe("session");
    expect(values.dayId).toBe("");
    expect(values.startTime).toBeNull();
    expect(values.endTime).toBeNull();
    expect(values.speakerAssignments).toEqual([]);
  });

  it("reads a placed item's times off its slot and duration", () => {
    const values = itemFormDefaults(
      [day],
      session({ dayId: "d1", slotIndex: 12, durationSlots: 9 }),
      base,
    );
    expect(values.startTime?.getHours()).toBe(10);
    expect(values.startTime?.getMinutes()).toBe(0);
    expect(values.endTime?.getHours()).toBe(10);
    expect(values.endTime?.getMinutes()).toBe(45);
  });

  it("maps the embedded speakers to assignments", () => {
    const values = itemFormDefaults(
      [day],
      session({
        speakers: [
          {
            role: "moderator",
            speaker: {
              id: "42",
              name: "Speaker One",
              title: "",
              bio: "",
              photoUrl: null,
              createdAt: "",
              updatedAt: "",
              speakerType: "external",
              company: null,
              companyLogoUrl: null,
              companyLogoSize: null,
              modalCompanyLogoSize: null,
              linkedinUrl: null,
              visible: true,
            },
          },
        ],
      }),
      base,
    );
    expect(values.speakerAssignments).toEqual([{ speakerId: "42", role: "moderator" }]);
  });
});

describe("isItemFormValid", () => {
  const valid = { title: "Talk", startTime: null, endTime: null, articleUrl: "", videoUrl: "" };

  it("requires a title", () => {
    expect(isItemFormValid({ ...valid, title: "" })).toBe(false);
    expect(isItemFormValid({ ...valid, title: "  " })).toBe(false);
    expect(isItemFormValid(valid)).toBe(true);
  });

  it("refuses an end time that is not after the start", () => {
    expect(isItemFormValid({ ...valid, startTime: at(10), endTime: at(9) })).toBe(false);
    expect(isItemFormValid({ ...valid, startTime: at(10), endTime: at(10) })).toBe(false);
    expect(isItemFormValid({ ...valid, startTime: at(10), endTime: at(11) })).toBe(true);
    expect(endsAfterStart({ startTime: at(10), endTime: null })).toBe(true);
  });

  it("refuses a link that isn't http(s)", () => {
    expect(isItemFormValid({ ...valid, articleUrl: "javascript:alert(1)" })).toBe(false);
    expect(isItemFormValid({ ...valid, videoUrl: "data:text/html,x" })).toBe(false);
    expect(isItemFormValid({ ...valid, articleUrl: "https://blog.example.com/post" })).toBe(true);
  });
});

describe("isHttpUrl", () => {
  it("accepts http and https only", () => {
    expect(isHttpUrl("https://video.example.com/watch")).toBe(true);
    expect(isHttpUrl(" http://example.com ")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("mailto:someone@example.com")).toBe(false);
    expect(isHttpUrl("example.com")).toBe(false);
  });
});

describe("sessionFieldsOf", () => {
  it("sends every editable field, with blanks as null", () => {
    const fields = sessionFieldsOf(form({ title: " Talk ", description: " x ", articleUrl: "" }), 6);
    expect(fields).toEqual({
      kind: "session",
      title: "Talk",
      description: "x",
      durationSlots: 6,
      speakerAssignments: [],
      roomId: null,
      articleUrl: null,
      articleLabel: null,
      videoUrl: null,
      videoLabel: null,
      topicId: null,
      topicIsManual: false,
    });
  });
});

describe("durationSlotsOf", () => {
  it("defaults to half an hour when a time is blank", () => {
    expect(durationSlotsOf({ startTime: null, endTime: at(10) })).toBe(DEFAULT_DURATION_SLOTS);
  });

  it("keeps the item's own length when a time is blank", () => {
    expect(durationSlotsOf({ startTime: null, endTime: null }, 9)).toBe(9);
  });

  it("counts the slots between the times", () => {
    expect(durationSlotsOf({ startTime: at(9), endTime: at(9, 45) })).toBe(9);
  });

  it("ignores the pickers' calendar day", () => {
    expect(
      durationSlotsOf({ startTime: new Date(2026, 0, 1, 9), endTime: new Date(2026, 5, 5, 9, 30) }),
    ).toBe(6);
  });
});

function track(id: string, over: Partial<TrackSection> = {}): TrackSection {
  return {
    id,
    trackId: "t1",
    dayId: "d1",
    kind: "track",
    label: "Section",
    startSlot: 12,
    durationSlots: 24,
    position: 0,
    roomId: null,
    room: null,
    topicId: null,
    ...over,
  };
}

const placed = (id: string, over: Partial<Session> = {}) =>
  session({ id, dayId: "d1", trackId: "t1", slotIndex: 0, sectionId: "sec-1", ...over });

describe("formPlacement", () => {
  it("places a full-width item from its day and start time", () => {
    expect(formPlacement({ kind: "keynote", dayId: "d1", startTime: at(9, 30) }, [day], 6, [])).toEqual({
      kind: "place",
      placement: { dayId: "d1", trackId: null, slotIndex: 6, sectionId: null },
    });
  });

  it("pulls an item back so it ends inside the day", () => {
    const outcome = formPlacement({ kind: "break", dayId: "d1", startTime: at(16, 50) }, [day], 6, []);
    expect(outcome.kind === "place" && outcome.placement.slotIndex).toBe(90);
  });

  it("refuses a time that lands on a scheduled item, as a drop would", () => {
    const talk = placed("talk", { slotIndex: 12, trackId: "t3" });
    expect(formPlacement({ kind: "keynote", dayId: "d1", startTime: at(10) }, [day], 6, [talk])).toEqual({
      kind: "overlap",
    });
  });

  it("never places a regular session, or one without a day or time", () => {
    const ignored = { kind: "ignored" };
    expect(formPlacement({ kind: "session", dayId: "d1", startTime: at(10) }, [day], 6, [])).toEqual(ignored);
    expect(formPlacement({ kind: "keynote", dayId: "", startTime: at(10) }, [day], 6, [])).toEqual(ignored);
    expect(formPlacement({ kind: "keynote", dayId: "d1", startTime: null }, [day], 6, [])).toEqual(ignored);
  });
});

describe("editPlacement", () => {
  const sec = track("sec-1");
  const keySec = track("key-1", { kind: "keynote", trackId: null });
  const board = (sessions: Session[] = []) => ({ sessions, sections: [sec, keySec] });
  const place = (placement: object) => ({ kind: "place", placement });

  it("unschedules a full-width item whose day or time was cleared", () => {
    const keynote = placed("k", { kind: "keynote", trackId: null, sectionId: null, slotIndex: 12 });
    expect(
      editPlacement(keynote, { kind: "keynote", dayId: "", startTime: null }, [day], 6, board([keynote])),
    ).toEqual(place(UNPLACED));
    expect(
      editPlacement(keynote, { kind: "keynote", dayId: "d1", startTime: null }, [day], 6, board([keynote])),
    ).toEqual(place(UNPLACED));
  });

  it("sends nothing when the item is not moved", () => {
    const keynote = placed("k", { kind: "keynote", trackId: null, sectionId: null, slotIndex: 12 });
    // Even with something already under it: a title fix must not be refused.
    const under = placed("u", { trackId: "t2", slotIndex: 14 });
    expect(
      editPlacement(keynote, { kind: "keynote", dayId: "d1", startTime: at(10) }, [day], 6, board([keynote, under])),
    ).toEqual({ kind: "ignored" });
    expect(
      editPlacement(session({ kind: "keynote" }), { kind: "keynote", dayId: "", startTime: null }, [day], 6, board()),
    ).toEqual({ kind: "ignored" });
  });

  it("keeps a full-width item in its keynote section while its start is inside it", () => {
    const keynote = placed("k", { kind: "keynote", trackId: null, sectionId: "key-1", slotIndex: 12 });
    expect(
      editPlacement(keynote, { kind: "keynote", dayId: "d1", startTime: at(10, 30) }, [day], 6, board([keynote])),
    ).toEqual(place({ dayId: "d1", trackId: null, slotIndex: 18, sectionId: "key-1" }));
  });

  it("takes a full-width item out of its section when its start leaves it", () => {
    const keynote = placed("k", { kind: "keynote", trackId: null, sectionId: "key-1", slotIndex: 12 });
    // 13:00 is past the section's 10:00–12:00.
    expect(
      editPlacement(keynote, { kind: "keynote", dayId: "d1", startTime: at(13) }, [day], 6, board([keynote])),
    ).toEqual(place({ dayId: "d1", trackId: null, slotIndex: 48, sectionId: null }));
  });

  it("drops the section when a full-width item moves to another day", () => {
    const day2: ConferenceDay = { ...day, id: "d2", dayIndex: 1 };
    const keynote = placed("k", { kind: "keynote", trackId: null, sectionId: "key-1", slotIndex: 12 });
    expect(
      editPlacement(keynote, { kind: "keynote", dayId: "d2", startTime: at(10) }, [day, day2], 6, board([keynote])),
    ).toEqual(place({ dayId: "d2", trackId: null, slotIndex: 12, sectionId: null }));
  });

  it("re-slots a session inside its section, clamped to the section", () => {
    const existing = placed("s1", { slotIndex: 12 });
    expect(
      editPlacement(existing, { kind: "session", dayId: "d1", startTime: at(10, 30) }, [day], 6, board([existing])),
    ).toEqual(place({ dayId: "d1", trackId: "t1", slotIndex: 18, sectionId: "sec-1" }));
    // 09:00 is before the section; 11:55 would run past its end.
    expect(
      editPlacement(existing, { kind: "session", dayId: "d1", startTime: at(9) }, [day], 8, board([existing])),
    ).toEqual(place({ dayId: "d1", trackId: "t1", slotIndex: 12, sectionId: "sec-1" }));
    expect(
      editPlacement(existing, { kind: "session", dayId: "d1", startTime: at(11, 55) }, [day], 6, board([existing])),
    ).toEqual(place({ dayId: "d1", trackId: "t1", slotIndex: 30, sectionId: "sec-1" }));
  });

  it("refuses a re-slot onto another session in the same track", () => {
    const existing = placed("s1", { slotIndex: 12 });
    const other = placed("s2", { slotIndex: 24 });
    expect(
      editPlacement(existing, { kind: "session", dayId: "d1", startTime: at(11) }, [day], 6, board([existing, other])),
    ).toEqual({ kind: "overlap" });
  });

  it("gives a session turned keynote its section's track, not none", () => {
    const existing = placed("s1", { slotIndex: 12 });
    expect(
      editPlacement(existing, { kind: "keynote", dayId: "d1", startTime: at(10, 30) }, [day], 6, board([existing])),
    ).toEqual(place({ dayId: "d1", trackId: "t1", slotIndex: 18, sectionId: "sec-1" }));
  });

  it("unschedules a session that can no longer be drawn", () => {
    const day2: ConferenceDay = { ...day, id: "d2", dayIndex: 1 };
    const inSection = placed("s1", { slotIndex: 12 });
    // Moved to another day, where it has no section.
    expect(
      editPlacement(inSection, { kind: "session", dayId: "d2", startTime: at(10) }, [day, day2], 6, board()),
    ).toEqual(place(UNPLACED));
    // A free keynote turned into a session.
    const keynote = placed("k", { kind: "keynote", trackId: null, sectionId: null, slotIndex: 12 });
    expect(
      editPlacement(keynote, { kind: "session", dayId: "d1", startTime: at(10) }, [day], 6, board()),
    ).toEqual(place(UNPLACED));
  });

  it("leaves an unscheduled session, and one whose section isn't loaded, alone", () => {
    expect(
      editPlacement(session(), { kind: "session", dayId: "d1", startTime: at(10) }, [day], 6, board()),
    ).toEqual({ kind: "ignored" });
    const elsewhere = placed("s1", { sectionId: "sec-gone" });
    expect(
      editPlacement(elsewhere, { kind: "session", dayId: "d1", startTime: at(10) }, [day], 6, board()),
    ).toEqual({ kind: "ignored" });
  });
});
