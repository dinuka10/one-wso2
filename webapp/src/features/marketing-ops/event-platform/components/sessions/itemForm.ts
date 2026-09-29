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

// The session form's values and what a save turns them into: the fields the
// create and update bodies share, the duration, and where the item lands on
// the grid. Pure, so the rules the source kept inline in useAgendaEditor are
// testable without a dialog or a QueryClient.

import type { SessionFields, SpeakerAssignment } from "@features/marketing-ops/event-platform/api/sessions";
import {
  UNPLACED,
  type Placement,
} from "@features/marketing-ops/event-platform/api/cacheUpdates";
import {
  clampStartSlot,
  resolveDrop,
  splitSessions,
  type DropOutcome,
} from "@features/marketing-ops/event-platform/hooks/agendaPlacement";
import type {
  ConferenceDay,
  Session,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  SLOT_MINUTES,
  isFullWidthKind,
  minuteToSlot,
  slotCountOf,
  slotToMinute,
  type ItemKind,
} from "@features/marketing-ops/event-platform/utils/agenda";
import { minuteToTime, timeToMinute } from "@features/marketing-ops/event-platform/utils/dateTime";

export interface ItemFormValues {
  kind: ItemKind;
  // Sanitised HTML from the rich-text editor.
  title: string;
  description: string;
  // "" means unscheduled.
  dayId: string;
  // Venue wall-clock times on a picker Date; only hours and minutes are read.
  startTime: Date | null;
  endTime: Date | null;
  speakerAssignments: SpeakerAssignment[];
  // "" means no room.
  roomId: string;
  articleUrl: string;
  articleLabel: string;
  videoUrl: string;
  videoLabel: string;
  topicId: string | null;
  topicIsManual: boolean;
}

// What a new session is created as when its times are left blank: 30 minutes.
export const DEFAULT_DURATION_SLOTS = 6;

/** The form's starting values: blank for a new item, the item's own for an edit. */
export function itemFormDefaults(
  days: readonly ConferenceDay[],
  initialItem?: Session,
  base: Date = new Date(),
): ItemFormValues {
  const initDay = initialItem?.dayId ? (days.find((d) => d.id === initialItem.dayId) ?? null) : null;
  const initSlot = initialItem?.slotIndex ?? null;
  const startMinute =
    initDay && initSlot !== null ? slotToMinute(initSlot, initDay.startMinute) : null;
  const startTime = startMinute !== null ? minuteToTime(startMinute, base) : null;
  const endTime =
    startMinute !== null && initialItem
      ? minuteToTime(startMinute + initialItem.durationSlots * SLOT_MINUTES, base)
      : null;

  return {
    kind: initialItem?.kind ?? "session",
    title: initialItem?.title ?? "",
    description: initialItem?.description ?? "",
    dayId: initialItem?.dayId ?? "",
    startTime,
    endTime,
    speakerAssignments:
      initialItem?.speakers.map((ss) => ({ speakerId: ss.speaker.id, role: ss.role })) ?? [],
    roomId: initialItem?.roomId ?? "",
    articleUrl: initialItem?.articleUrl ?? "",
    articleLabel: initialItem?.articleLabel ?? "",
    videoUrl: initialItem?.videoUrl ?? "",
    videoLabel: initialItem?.videoLabel ?? "",
    topicId: initialItem?.topicId ?? null,
    topicIsManual: initialItem?.topicIsManual ?? false,
  };
}

// Links are opened from the board, the preview and the public agenda, so only
// http(s) ones are kept; anything else is refused on save and not rendered.
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

/** Whether a link field is blank or an http(s) URL. */
export const isLinkValid = (value: string): boolean => !value.trim() || isHttpUrl(value);

/** False only when both times are set and the end is not after the start. */
export function endsAfterStart(form: Pick<ItemFormValues, "startTime" | "endTime">): boolean {
  if (!form.startTime || !form.endTime) return true;
  return timeToMinute(form.endTime) > timeToMinute(form.startTime);
}

// A title is required (the editor emits "" for an empty one), the end must
// come after the start, and a link must be http(s).
export function isItemFormValid(
  form: Pick<ItemFormValues, "title" | "startTime" | "endTime" | "articleUrl" | "videoUrl">,
): boolean {
  return (
    form.title.trim().length > 0 &&
    endsAfterStart(form) &&
    isLinkValid(form.articleUrl) &&
    isLinkValid(form.videoUrl)
  );
}

// Every editable field, always: the PATCH is not partial (the backend requires
// the title on every update), so leaving a field out would clear it. Empty
// strings become null, which is how the backend stores "not set".
export function sessionFieldsOf(form: ItemFormValues, durationSlots: number): SessionFields {
  return {
    kind: form.kind,
    title: form.title.trim(),
    description: form.description.trim(),
    durationSlots,
    speakerAssignments: form.speakerAssignments,
    roomId: form.roomId || null,
    articleUrl: form.articleUrl.trim() || null,
    articleLabel: form.articleLabel || null,
    videoUrl: form.videoUrl.trim() || null,
    videoLabel: form.videoLabel || null,
    topicId: form.topicId,
    topicIsManual: form.topicIsManual,
  };
}

// Slots between the two times, at least one. When either is blank the item
// keeps `fallback`: its own length on an edit (an unscheduled item opens with
// both pickers blank), half an hour for a new one.
export function durationSlotsOf(
  form: Pick<ItemFormValues, "startTime" | "endTime">,
  fallback: number = DEFAULT_DURATION_SLOTS,
): number {
  if (!form.startTime || !form.endTime) return fallback;
  const minutes = timeToMinute(form.endTime) - timeToMinute(form.startTime);
  return Math.max(1, Math.round(minutes / SLOT_MINUTES));
}

const IGNORED: DropOutcome = { kind: "ignored" };

// Sends a form placement through the same overlap check a drop gets, against
// the target day's board as it is now.
function checkPlacement(
  item: Pick<Session, "id" | "kind" | "durationSlots">,
  target: Placement & { dayId: string; slotIndex: number },
  day: ConferenceDay,
  sessions: readonly Session[],
): DropOutcome {
  return resolveDrop({
    session: item,
    placed: splitSessions(sessions, target.dayId).placed,
    dayId: target.dayId,
    slotCount: slotCountOf(day),
    trackId: target.trackId,
    rawSlot: target.slotIndex,
    sectionId: target.sectionId,
  });
}

const formSlot = (form: Pick<ItemFormValues, "startTime">, day: ConferenceDay): number | null =>
  form.startTime ? minuteToSlot(timeToMinute(form.startTime), day.startMinute) : null;

// Where a new item lands. A full-width item (keynote, break, activity) needs
// no track, so a day and a start time place it, if nothing is there already.
// A regular session is only ever placed by dropping it into a section, so a
// new one is always created unscheduled ("ignored").
export function formPlacement(
  form: Pick<ItemFormValues, "kind" | "dayId" | "startTime">,
  days: readonly ConferenceDay[],
  durationSlots: number,
  sessions: readonly Session[],
): DropOutcome {
  const day = days.find((d) => d.id === form.dayId);
  const slot = day ? formSlot(form, day) : null;
  if (!day || slot === null || !isFullWidthKind(form.kind)) return IGNORED;
  return checkPlacement(
    { id: "", kind: form.kind, durationSlots },
    { dayId: day.id, trackId: null, slotIndex: slot, sectionId: null },
    day,
    sessions,
  );
}

// What an edit does to the item's placement: "ignored" leaves it where it is,
// "overlap" refuses the save, "place" sends that placement (UNPLACED included).
//
// - An item in a section stays in it while the form keeps it on the same day,
//   and its start time is pulled inside the section, as a drop is. A
//   full-width item leaves the section instead when its start falls outside
//   it, or its time is cleared; a regular session keeps its slot then.
// - A full-width item outside a section follows the form: placed where its
//   day and time say, or unscheduled when either is blank.
// - A regular session can only be on the board inside a section, so moving
//   it to another day, or turning a free full-width item into one, sends it
//   back to Unscheduled.
//
// `sections` are those of the item's current day: its section is looked up
// there, and one that can't be found leaves the item alone rather than guess.
export function editPlacement(
  existing: Session | undefined,
  form: Pick<ItemFormValues, "kind" | "dayId" | "startTime">,
  days: readonly ConferenceDay[],
  durationSlots: number,
  board: { sessions: readonly Session[]; sections: readonly TrackSection[] },
): DropOutcome {
  if (!existing) return IGNORED;
  const fullWidth = isFullWidthKind(form.kind);
  const day = days.find((d) => d.id === form.dayId);
  const slot = day ? formSlot(form, day) : null;
  const unplace: DropOutcome = { kind: "place", placement: UNPLACED };

  let target: (Placement & { dayId: string; slotIndex: number }) | null = null;
  const staysOnDay = existing.dayId !== null && existing.dayId === form.dayId;
  if (staysOnDay && existing.sectionId) {
    const section = board.sections.find((s) => s.id === existing.sectionId);
    if (!section || !day) return IGNORED;
    const sectionEnd = section.startSlot + section.durationSlots;
    const inSection = slot !== null && slot >= section.startSlot && slot < sectionEnd;
    if (!fullWidth || inSection) {
      const len = Math.min(durationSlots, section.durationSlots);
      const wanted = slot ?? existing.slotIndex ?? section.startSlot;
      target = {
        dayId: day.id,
        trackId: section.trackId,
        slotIndex: Math.max(section.startSlot, Math.min(wanted, sectionEnd - len)),
        sectionId: section.id,
      };
    }
  }
  if (!target) {
    if (!fullWidth) return existing.dayId !== null ? unplace : IGNORED;
    if (!day || slot === null) return existing.dayId !== null ? unplace : IGNORED;
    const len = Math.min(durationSlots, slotCountOf(day));
    target = {
      dayId: day.id,
      trackId: null,
      slotIndex: clampStartSlot(slot, len, slotCountOf(day)),
      sectionId: null,
    };
  }

  // Nothing moved, grew or widened: no PUT, and no overlap check that could
  // refuse a title fix on an item that already sits where it is.
  const unchanged =
    fullWidth === isFullWidthKind(existing.kind) &&
    target.dayId === existing.dayId &&
    target.trackId === existing.trackId &&
    target.slotIndex === existing.slotIndex &&
    target.sectionId === existing.sectionId;
  if (!day || (unchanged && durationSlots <= existing.durationSlots)) return IGNORED;

  return checkPlacement({ id: existing.id, kind: form.kind, durationSlots }, target, day, board.sessions);
}
