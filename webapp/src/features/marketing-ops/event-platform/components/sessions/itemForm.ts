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
import type {
  ConferenceDay,
  Session,
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

/** A title is required; the editor emits "" for an empty one. */
export function isItemFormValid(form: Pick<ItemFormValues, "title">): boolean {
  return form.title.trim().length > 0;
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
    articleUrl: form.articleUrl || null,
    articleLabel: form.articleLabel || null,
    videoUrl: form.videoUrl || null,
    videoLabel: form.videoLabel || null,
    topicId: form.topicId,
    topicIsManual: form.topicIsManual,
  };
}

/** Slots between the two times, at least one; the default when either is blank. */
export function durationSlotsOf(form: Pick<ItemFormValues, "startTime" | "endTime">): number {
  if (!form.startTime || !form.endTime) return DEFAULT_DURATION_SLOTS;
  const minutes = timeToMinute(form.endTime) - timeToMinute(form.startTime);
  return Math.max(1, Math.round(minutes / SLOT_MINUTES));
}

// The start slot a form time maps to on `day`, pulled back so an item of
// `durationSlots` still ends inside the day.
function clampedStartSlot(startTime: Date, day: ConferenceDay, durationSlots: number): number {
  const daySlotCount = slotCountOf(day);
  const rawSlot = minuteToSlot(timeToMinute(startTime), day.startMinute);
  const len = Math.min(durationSlots, daySlotCount);
  return Math.max(0, Math.min(rawSlot, daySlotCount - len));
}

// Where a full-width item (keynote, break, activity) goes straight from the
// form: they need no track, so a day and a start time are enough to place
// them. A regular session is only ever placed by dropping it into a section,
// so the form never places one.
export function formPlacement(
  form: Pick<ItemFormValues, "kind" | "dayId" | "startTime">,
  days: readonly ConferenceDay[],
  durationSlots: number,
): { dayId: string; trackId: null; slotIndex: number } | null {
  const targetDay = days.find((d) => d.id === form.dayId);
  if (!targetDay || !form.startTime) return null;
  if (!isFullWidthKind(form.kind)) return null;
  return {
    dayId: targetDay.id,
    trackId: null,
    slotIndex: clampedStartSlot(form.startTime, targetDay, durationSlots),
  };
}

// The placement PUT an edit sends alongside its PATCH, or null for none.
//
// - A full-width item follows the form: placed where its day and time say,
//   or unscheduled when either is blank. It keeps its section (a keynote in a
//   keynote section).
// - A session already inside a section can still be moved within it from the
//   form, by its start time. Its day, track and section stay as they are; the
//   form's day only supplies the slot grid, as in the source.
// - Anything else is left where it is.
export function editPlacement(
  existing: Session | undefined,
  form: Pick<ItemFormValues, "kind" | "dayId" | "startTime">,
  days: readonly ConferenceDay[],
  durationSlots: number,
): Placement | null {
  if (isFullWidthKind(form.kind)) {
    const placement = formPlacement(form, days, durationSlots);
    return placement ? { ...placement, sectionId: existing?.sectionId ?? null } : UNPLACED;
  }
  if (existing?.sectionId && existing.trackId && existing.dayId && form.startTime && form.dayId) {
    const targetDay = days.find((d) => d.id === form.dayId);
    if (!targetDay) return null;
    return {
      dayId: existing.dayId,
      trackId: existing.trackId,
      slotIndex: clampedStartSlot(form.startTime, targetDay, durationSlots),
      sectionId: existing.sectionId,
    };
  }
  return null;
}
