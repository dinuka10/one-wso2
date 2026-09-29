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
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { UNPLACED } from "@features/marketing-ops/event-platform/api/cacheUpdates";
import {
  DEFAULT_DURATION_SLOTS,
  durationSlotsOf,
  editPlacement,
  formPlacement,
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
  it("requires a title", () => {
    expect(isItemFormValid({ title: "" })).toBe(false);
    expect(isItemFormValid({ title: "  " })).toBe(false);
    expect(isItemFormValid({ title: "Talk" })).toBe(true);
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

  it("counts the slots between the times, at least one", () => {
    expect(durationSlotsOf({ startTime: at(9), endTime: at(9, 45) })).toBe(9);
    expect(durationSlotsOf({ startTime: at(10), endTime: at(9) })).toBe(1);
  });

  it("ignores the pickers' calendar day", () => {
    expect(
      durationSlotsOf({ startTime: new Date(2026, 0, 1, 9), endTime: new Date(2026, 5, 5, 9, 30) }),
    ).toBe(6);
  });
});

describe("formPlacement", () => {
  it("places a full-width item from its day and start time", () => {
    expect(formPlacement({ kind: "keynote", dayId: "d1", startTime: at(9, 30) }, [day], 6)).toEqual({
      dayId: "d1",
      trackId: null,
      slotIndex: 6,
    });
  });

  it("pulls an item back so it ends inside the day", () => {
    expect(formPlacement({ kind: "break", dayId: "d1", startTime: at(16, 50) }, [day], 6)?.slotIndex).toBe(
      90,
    );
  });

  it("never places a regular session, or one without a day or time", () => {
    expect(formPlacement({ kind: "session", dayId: "d1", startTime: at(10) }, [day], 6)).toBeNull();
    expect(formPlacement({ kind: "keynote", dayId: "", startTime: at(10) }, [day], 6)).toBeNull();
    expect(formPlacement({ kind: "keynote", dayId: "d1", startTime: null }, [day], 6)).toBeNull();
  });
});

describe("editPlacement", () => {
  it("unschedules a full-width item whose day or time was cleared", () => {
    expect(
      editPlacement(session({ kind: "keynote" }), { kind: "keynote", dayId: "", startTime: null }, [day], 6),
    ).toEqual(UNPLACED);
  });

  it("keeps a full-width item's section", () => {
    expect(
      editPlacement(
        session({ kind: "keynote", sectionId: "sec-1" }),
        { kind: "keynote", dayId: "d1", startTime: at(10) },
        [day],
        6,
      ),
    ).toEqual({ dayId: "d1", trackId: null, slotIndex: 12, sectionId: "sec-1" });
  });

  it("re-slots a session inside its section without moving it elsewhere", () => {
    const existing = session({ dayId: "d1", trackId: "t1", slotIndex: 0, sectionId: "sec-1" });
    expect(editPlacement(existing, { kind: "session", dayId: "d1", startTime: at(10) }, [day], 6)).toEqual({
      dayId: "d1",
      trackId: "t1",
      slotIndex: 12,
      sectionId: "sec-1",
    });
  });

  it("leaves a session outside a section alone", () => {
    expect(
      editPlacement(session(), { kind: "session", dayId: "d1", startTime: at(10) }, [day], 6),
    ).toBeNull();
  });
});
