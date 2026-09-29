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

// The pure half of the room mapping screen: how the day → track → section
// tree is assembled, and the sentences it prints. Kept out of the component so
// the ordering and the inheritance wording are tested without a QueryClient.

import type { ColorToken } from "@features/marketing-ops/event-platform/types/colorTokens";
import type {
  ConferenceDay,
  Room,
  Track,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";

export interface RoomTreeTrack {
  track: Track;
  // The track's place on its day, 0-based. Tracks have no name, so "Track 2"
  // (with its swatch) is how they read on the board.
  index: number;
  sections: TrackSection[];
}

export interface RoomTreeDay {
  day: ConferenceDay;
  tracks: RoomTreeTrack[];
}

/**
 * The event's days in order, each with its tracks by board position and each
 * track with its sections by position. `tracks` and `sections` may hold every
 * event's rows (the track list endpoint is unscoped); anything not on one of
 * `days` is dropped.
 */
export function buildRoomTree(
  days: readonly ConferenceDay[],
  tracks: readonly Track[],
  sections: readonly TrackSection[],
): RoomTreeDay[] {
  return [...days]
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((day) => ({
      day,
      tracks: tracks
        .filter((t) => t.dayId === day.id)
        .sort((a, b) => a.position - b.position)
        .map((track, index) => ({
          track,
          index,
          sections: sections
            .filter((s) => s.trackId === track.id)
            .sort((a, b) => a.position - b.position || a.startSlot - b.startSlot),
        })),
    }));
}

/** "Day 2 · 2026-09-30", or the day's own label in place of "Day 2". */
export function roomTreeDayHeading(day: ConferenceDay): string {
  return `${day.label || `Day ${day.dayIndex + 1}`} · ${day.date}`;
}

export function roomNameOf(rooms: readonly Room[], id: string | null | undefined): string | null {
  if (!id) return null;
  return rooms.find((r) => r.id === id)?.name ?? null;
}

/**
 * The colour a track's mapped room imposes on it, if any. Read from
 * `track.room` (what the board resolves through) rather than the rooms list,
 * so the two cannot disagree after a raced or failed room-colour write.
 */
export function roomOverrideToken(track: Track): ColorToken | null {
  return track.room?.colorToken ?? null;
}

/**
 * What an unset section room shows: the room it falls through to, so nobody
 * has to trace the inheritance by hand.
 */
export function sectionInheritLabel(trackRoomName: string | null): string {
  return trackRoomName ? `Inherit from track (${trackRoomName})` : "Inherit from track (no room)";
}

/** The outcome line after "Reapply to all sessions". */
export function reapplyResultMessage(sessionsUpdated: number): string {
  if (sessionsUpdated === 0) return "Every session already matched its mapping.";
  return `Reassigned ${sessionsUpdated} session${sessionsUpdated === 1 ? "" : "s"}.`;
}
