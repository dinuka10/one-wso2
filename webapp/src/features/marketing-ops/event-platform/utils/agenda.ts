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


// Agenda vocabulary and grid maths shared by the session editor, the event tabs
// and the export: colour precedence, labels, item kinds and the slot grid.
// Ported from the source's utils/agenda.ts.

import {
  colorTokenHex,
  colorTokenOf,
  type ColorScheme,
  type ColorToken,
} from "@features/marketing-ops/event-platform/types/colorTokens";
import type {
  ConferenceDay,
  Session,
  SessionKind,
  SessionSpeakerRole,
  SpeakerType,
  Track,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { formatDayLabel, formatTimeInZone } from "@features/marketing-ops/event-platform/utils/dateTime";

/** Minutes per grid slot; slot indices and durations everywhere are in these. */
export const SLOT_MINUTES = 5;
/** Height of one slot on the board, in px. */
export const SLOT_PX = 14;

// ---- colour precedence --------------------------------------------------------

// Mirrors the backend's COALESCE(rooms.color_token, tracks.color_token,
// 'main'): the room owns the colour because it is what an attendee navigates
// by, and the track's own token only covers tracks that have no room yet.
export const trackColorToken = (track: Track): ColorToken =>
  colorTokenOf(track.room?.colorToken ?? track.colorToken);

export const trackColorHex = (track: Track, scheme: ColorScheme = "light"): string =>
  colorTokenHex(trackColorToken(track), scheme);

// Same precedence, but keyed on the section's own room override, which wins
// over its parent track's when set.
export const sectionColorToken = (section: TrackSection, track: Track | null): ColorToken =>
  colorTokenOf(section.room?.colorToken ?? track?.room?.colorToken ?? track?.colorToken);

export const sectionColorHex = (
  section: TrackSection,
  track: Track | null,
  scheme: ColorScheme = "light",
): string => colorTokenHex(sectionColorToken(section, track), scheme);

// The full chain: an item's own resolved room (which already reflects the
// backend's section-override-then-track resolution and any manual pin) wins,
// falling back to the section and then the track for items whose room hasn't
// resolved yet.
export const itemColorToken = (
  item: Session,
  section: TrackSection | null,
  track: Track | null,
): ColorToken =>
  colorTokenOf(
    item.room?.colorToken ?? section?.room?.colorToken ?? track?.room?.colorToken ?? track?.colorToken,
  );

export const itemColorHex = (
  item: Session,
  section: TrackSection | null,
  track: Track | null,
  scheme: ColorScheme = "light",
): string => colorTokenHex(itemColorToken(item, section, track), scheme);

// ---- labels -------------------------------------------------------------------

// Tracks have no name (the backend dropped the column), so they are identified
// by the room they map to, falling back to their board position.
export const trackLabel = (track: Track): string => track.room?.name ?? `Track ${track.position + 1}`;

/** "Day 2", or the day's own label when it has one. */
export const dayName = (day: ConferenceDay, index: number): string => day.label ?? `Day ${index + 1}`;

/** "Day 2 · Sep 30" (or "<label> · Sep 30"), as the source's day tabs and pickers print it. */
export const dayOptionLabel = (day: ConferenceDay, index: number): string =>
  `${dayName(day, index)} · ${formatDayLabel(day.date)}`;

// ---- item kinds ---------------------------------------------------------------

export type ItemKind = SessionKind;

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  session: "Session",
  keynote: "Keynote",
  break: "Break",
  activity: "Activity",
};

// Kinds that occupy the whole day width rather than a single track column, and
// so are never placed in a section. Every layout and drag decision keys off
// this rather than listing kinds inline, which is what let 'break' handling
// drift apart across files in the source.
//
// 'activity' here means an interruption of the whole event (a networking
// event, a reception, a party), printed in the public agenda as a full-width
// time bar. Venue amenities that run alongside the sessions are not sessions
// at all; they are Activity records, edited on their own page.
const FULL_WIDTH_KINDS = new Set<string>(["keynote", "break", "activity"]);

export const isFullWidthKind = (kind: string): boolean => FULL_WIDTH_KINDS.has(kind);

// A bare time bar: a start, an end, and a label. Nothing is presenting and
// there is nothing to say about it beyond when it happens.
const TIME_ONLY_KINDS = new Set<string>(["break"]);

export const isTimeOnlyKind = (kind: string): boolean => TIME_ONLY_KINDS.has(kind);

// Kinds with someone presenting, and therefore with speakers, a room, a topic,
// and artifacts worth recording. An activity sits between this and a bare
// break: nobody is on stage, but it carries a description, which rides in the
// export JSON.
const PRESENTER_KINDS = new Set<string>(["session", "keynote"]);

export const hasPresenterDetail = (kind: string): boolean => PRESENTER_KINDS.has(kind);

// ---- speaker roles ------------------------------------------------------------

export const SESSION_ROLE_LABELS: Record<SessionSpeakerRole, string> = {
  keynote: "Keynote",
  internal: "Internal",
  external: "External",
  moderator: "Moderator",
  leader: "Leader",
};

// A speaker's own type already says how they participate, so assigning them to
// a session defaults to the matching role instead of making the user re-state
// it. The map is explicit so a new speaker type without a same-named role
// can't silently fall through to 'external'.
const SPEAKER_TYPE_TO_ROLE: Record<SpeakerType, SessionSpeakerRole> = {
  internal: "internal",
  external: "external",
  keynote: "keynote",
  moderator: "moderator",
};

export const defaultRoleForSpeakerType = (speakerType: SpeakerType | undefined): SessionSpeakerRole =>
  (speakerType && SPEAKER_TYPE_TO_ROLE[speakerType]) || "external";

// ---- slot grid ----------------------------------------------------------------

/** How many slots a day's grid has. */
export const slotCountOf = (day: Pick<ConferenceDay, "startMinute" | "endMinute">): number =>
  (day.endMinute - day.startMinute) / SLOT_MINUTES;

/** Wall-clock minute of day at the start of `slot` on a day starting at `startMinute`. */
export const slotToMinute = (slot: number, startMinute: number): number => startMinute + slot * SLOT_MINUTES;

/** The slot nearest a wall-clock minute of day, as the source's section dialog rounded it. */
export const minuteToSlot = (minute: number, startMinute: number): number =>
  Math.round((minute - startMinute) / SLOT_MINUTES);

/** Venue wall-clock label for a slot, e.g. "9:05 am". */
export function slotLabel(slot: number, startMinute: number): string {
  const total = slotToMinute(slot, startMinute);
  const hour24 = Math.floor(total / 60) % 24;
  const minute = total % 60;
  const period = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/** "9:00 am – 9:30 am" for a placed item; "" for an unscheduled one. */
export const cardTimeLabel = (
  item: Pick<Session, "slotIndex" | "durationSlots">,
  day: Pick<ConferenceDay, "startMinute">,
): string => {
  if (item.slotIndex === null) return "";
  return `${slotLabel(item.slotIndex, day.startMinute)} – ${slotLabel(
    item.slotIndex + item.durationSlots,
    day.startMinute,
  )}`;
};

// Renders a backend RFC3339 offset instant (ConferenceDay.startTimeOffset /
// endTimeOffset) in the viewer's own zone. For attendee-facing displays only:
// the organiser's grid stays in venue wall-clock time via slotLabel.
export function viewerLocalTimeLabel(isoOffset: string, viewerTz?: string): string {
  return formatTimeInZone(isoOffset, viewerTz);
}
