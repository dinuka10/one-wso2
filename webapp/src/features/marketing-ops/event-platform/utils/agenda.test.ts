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
import type { ColorToken } from "@features/marketing-ops/event-platform/types/colorTokens";
import { colorTokenHex } from "@features/marketing-ops/event-platform/types/colorTokens";
import type {
  ConferenceDay,
  Room,
  Session,
  Track,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  cardTimeLabel,
  dayName,
  dayOptionLabel,
  defaultRoleForSpeakerType,
  hasPresenterDetail,
  isFullWidthKind,
  isTimeOnlyKind,
  itemColorHex,
  itemColorToken,
  minuteToSlot,
  sectionColorToken,
  slotCountOf,
  slotLabel,
  slotToMinute,
  trackColorHex,
  trackColorToken,
  trackLabel,
  viewerLocalTimeLabel,
} from "./agenda";

const room = (id: string, colorToken: ColorToken | null): Room => ({
  id,
  configId: "evt-7",
  name: `Room ${id}`,
  colorToken,
});

const track = (over: Partial<Track> = {}): Track => ({
  id: "trk-1",
  dayId: "day-1",
  colorToken: null,
  position: 0,
  roomId: null,
  room: null,
  ...over,
});

const section = (over: Partial<TrackSection> = {}): TrackSection => ({
  id: "sec-1",
  trackId: "trk-1",
  dayId: "day-1",
  kind: "track",
  label: "Section",
  startSlot: 0,
  durationSlots: 6,
  position: 0,
  roomId: null,
  room: null,
  topicId: null,
  ...over,
});

const session = (over: Partial<Session> = {}): Session => ({
  id: "ses-1",
  configId: "evt-7",
  kind: "session",
  title: "A talk",
  description: "",
  durationSlots: 6,
  dayId: "day-1",
  trackId: "trk-1",
  slotIndex: 0,
  sectionId: "sec-1",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
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
});

const day = (over: Partial<ConferenceDay> = {}): ConferenceDay => ({
  id: "day-1",
  configId: "evt-7",
  dayIndex: 0,
  date: "2026-09-29",
  startMinute: 480,
  endMinute: 1020,
  label: null,
  startTimeOffset: "2026-09-29T08:00:00-07:00",
  endTimeOffset: "2026-09-29T17:00:00-07:00",
  ...over,
});

describe("colour precedence", () => {
  it("prefers the track's room over the track's own token, then main", () => {
    expect(trackColorToken(track({ colorToken: "green", room: room("r1", "blue") }))).toBe("blue");
    expect(trackColorToken(track({ colorToken: "green", room: room("r1", null) }))).toBe("green");
    expect(trackColorToken(track())).toBe("main");
  });

  it("lets a section's room override its track", () => {
    const t = track({ colorToken: "green", room: room("r1", "blue") });
    expect(sectionColorToken(section({ room: room("r2", "red") }), t)).toBe("red");
    expect(sectionColorToken(section(), t)).toBe("blue");
    expect(sectionColorToken(section(), null)).toBe("main");
  });

  it("lets an item's own room win over section and track", () => {
    const t = track({ colorToken: "green" });
    const s = section({ room: room("r2", "red") });
    expect(itemColorToken(session({ room: room("r3", "purple") }), s, t)).toBe("purple");
    expect(itemColorToken(session(), s, t)).toBe("red");
    expect(itemColorToken(session(), null, t)).toBe("green");
    expect(itemColorToken(session(), null, null)).toBe("main");
  });

  it("resolves hexes per colour scheme", () => {
    const t = track({ colorToken: "dark-blue" });
    expect(trackColorHex(t)).toBe(colorTokenHex("dark-blue", "light"));
    expect(trackColorHex(t, "dark")).toBe(colorTokenHex("dark-blue", "dark"));
    expect(itemColorHex(session(), null, t, "dark")).toBe(colorTokenHex("dark-blue", "dark"));
  });
});

describe("labels", () => {
  it("names a track by its room, else its position", () => {
    expect(trackLabel(track({ room: room("r1", null) }))).toBe("Room r1");
    expect(trackLabel(track({ position: 2 }))).toBe("Track 3");
  });

  it("names a day by its label, else its index, with its date", () => {
    expect(dayName(day(), 1)).toBe("Day 2");
    expect(dayName(day({ label: "Workshops" }), 1)).toBe("Workshops");
    expect(dayOptionLabel(day(), 0)).toBe("Day 1 · Sep 29");
  });
});

describe("item kinds", () => {
  it("classifies each kind", () => {
    expect(["session", "keynote", "break", "activity"].map(isFullWidthKind)).toEqual([false, true, true, true]);
    expect(["session", "keynote", "break", "activity"].map(isTimeOnlyKind)).toEqual([false, false, true, false]);
    expect(["session", "keynote", "break", "activity"].map(hasPresenterDetail)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("defaults a speaker's session role from their type", () => {
    expect(defaultRoleForSpeakerType("keynote")).toBe("keynote");
    expect(defaultRoleForSpeakerType("moderator")).toBe("moderator");
    expect(defaultRoleForSpeakerType(undefined)).toBe("external");
  });
});

describe("slot grid", () => {
  it("counts a day's slots", () => {
    expect(slotCountOf(day())).toBe(108);
  });

  it("converts between slots and minutes", () => {
    expect(slotToMinute(6, 480)).toBe(510);
    expect(minuteToSlot(510, 480)).toBe(6);
    expect(minuteToSlot(512, 480)).toBe(6);
    expect(minuteToSlot(513, 480)).toBe(7);
  });

  it("labels slots in venue wall-clock time", () => {
    expect(slotLabel(0, 480)).toBe("8:00 am");
    expect(slotLabel(49, 480)).toBe("12:05 pm");
    expect(slotLabel(0, 0)).toBe("12:00 am");
    expect(slotLabel(0, 1435)).toBe("11:55 pm");
  });

  it("labels a placed item's span and leaves an unscheduled one blank", () => {
    expect(cardTimeLabel(session({ slotIndex: 12, durationSlots: 6 }), day())).toBe("9:00 am – 9:30 am");
    expect(cardTimeLabel(session({ slotIndex: null }), day())).toBe("");
  });

  it("shows a day offset in the viewer's zone", () => {
    expect(viewerLocalTimeLabel(day().startTimeOffset, "America/New_York")).toBe("11:00 AM EDT");
  });
});
