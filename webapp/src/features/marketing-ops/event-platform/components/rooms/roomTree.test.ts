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
  Room,
  Track,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  buildRoomTree,
  reapplyResultMessage,
  roomNameOf,
  roomOverrideToken,
  roomTreeDayHeading,
  sectionInheritLabel,
} from "./roomTree";

const day = (id: string, dayIndex: number, label: string | null = null): ConferenceDay => ({
  id,
  configId: "evt-7",
  dayIndex,
  date: `2026-09-${29 + dayIndex}`,
  startMinute: 480,
  endMinute: 1020,
  label,
  startTimeOffset: "",
  endTimeOffset: "",
});

const room: Room = { id: "room-1", configId: "evt-7", name: "Room One", colorToken: "blue" };

const track = (id: string, dayId: string, position: number, withRoom = false): Track => ({
  id,
  dayId,
  colorToken: "red",
  position,
  roomId: withRoom ? room.id : null,
  room: withRoom ? room : null,
});

const section = (id: string, trackId: string, position: number, startSlot = 0): TrackSection => ({
  id,
  trackId,
  dayId: null,
  kind: "track",
  label: `Section ${id}`,
  startSlot,
  durationSlots: 6,
  position,
  roomId: null,
  room: null,
  topicId: null,
});

describe("buildRoomTree", () => {
  it("orders days, tracks and sections, and numbers tracks per day", () => {
    const tree = buildRoomTree(
      [day("d2", 1), day("d1", 0)],
      [track("t-b", "d1", 1), track("t-a", "d1", 0), track("t-c", "d2", 4)],
      [section("s2", "t-a", 1), section("s1", "t-a", 0), section("s3", "t-c", 0)],
    );
    expect(tree.map((d) => d.day.id)).toEqual(["d1", "d2"]);
    expect(tree[0].tracks.map((t) => [t.track.id, t.index])).toEqual([
      ["t-a", 0],
      ["t-b", 1],
    ]);
    expect(tree[0].tracks[0].sections.map((s) => s.id)).toEqual(["s1", "s2"]);
    // Numbering restarts on each day, whatever the stored position.
    expect(tree[1].tracks[0].index).toBe(0);
  });

  it("drops other events' tracks and sections", () => {
    const tree = buildRoomTree(
      [day("d1", 0)],
      [track("t-a", "d1", 0), track("t-other", "other-day", 0)],
      [section("s1", "t-other", 0)],
    );
    expect(tree[0].tracks.map((t) => t.track.id)).toEqual(["t-a"]);
    expect(tree[0].tracks[0].sections).toEqual([]);
  });

  it("breaks position ties by start slot", () => {
    const tree = buildRoomTree(
      [day("d1", 0)],
      [track("t-a", "d1", 0)],
      [section("late", "t-a", 0, 12), section("early", "t-a", 0, 2)],
    );
    expect(tree[0].tracks[0].sections.map((s) => s.id)).toEqual(["early", "late"]);
  });
});

describe("labels", () => {
  it("heads a day with its label or its number", () => {
    expect(roomTreeDayHeading(day("d1", 0))).toBe("Day 1 · 2026-09-29");
    expect(roomTreeDayHeading(day("d1", 1, "Workshops"))).toBe("Workshops · 2026-09-30");
    // An empty label is no label.
    expect(roomTreeDayHeading(day("d1", 0, ""))).toBe("Day 1 · 2026-09-29");
  });

  it("names a room by id, or null", () => {
    expect(roomNameOf([room], "room-1")).toBe("Room One");
    expect(roomNameOf([room], "missing")).toBeNull();
    expect(roomNameOf([room], null)).toBeNull();
  });

  it("reads the override colour from the track's own room", () => {
    expect(roomOverrideToken(track("t", "d1", 0, true))).toBe("blue");
    expect(roomOverrideToken(track("t", "d1", 0))).toBeNull();
  });

  it("says what an unset section inherits", () => {
    expect(sectionInheritLabel("Room One")).toBe("Inherit from track (Room One)");
    expect(sectionInheritLabel(null)).toBe("Inherit from track (no room)");
  });

  it("reports the reapply count", () => {
    expect(reapplyResultMessage(0)).toBe("Every session already matched its mapping.");
    expect(reapplyResultMessage(1)).toBe("Reassigned 1 session.");
    expect(reapplyResultMessage(3)).toBe("Reassigned 3 sessions.");
  });
});
