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

// The pure half of the Activities screen: the form's opening-hour rows, their
// validation, what a save has to send, and the labels the table prints.

import { HttpError } from "@api/http";
import type { ActivityHoursInput } from "@features/marketing-ops/event-platform/api/activities";
import { describeEventPlatformError } from "@features/marketing-ops/event-platform/api/responses";
import { dayOptionLabel } from "@features/marketing-ops/event-platform/utils/agenda";
import type {
  Activity,
  ConferenceDay,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";

export interface ActivityFormValues {
  name: string;
  description: string;
  hours: ActivityHoursInput[];
}

type ActivityDetails = Pick<Activity, "name" | "description" | "hours">;

export function toActivityFormValues(activity: ActivityDetails | undefined): ActivityFormValues {
  return {
    name: activity?.name ?? "",
    description: activity?.description ?? "",
    hours: (activity?.hours ?? []).map(({ dayId, startMinute, endMinute }) => ({
      dayId,
      startMinute,
      endMinute,
    })),
  };
}

/**
 * The row "Add a day" appends: the first day that has no window yet (or the
 * first day, when all have one), open for that day's agenda hours. Null when
 * the event has no days to offer.
 */
export function newHoursRow(
  days: readonly ConferenceDay[],
  rows: readonly ActivityHoursInput[],
): ActivityHoursInput | null {
  const used = new Set(rows.map((r) => r.dayId));
  const day = days.find((d) => !used.has(d.id)) ?? days[0];
  if (!day) return null;
  return { dayId: day.id, startMinute: day.startMinute, endMinute: day.endMinute };
}

/** A window must close after it opens. The table has the same CHECK, which would otherwise answer with a bare 400. */
export function closesBeforeOpening(row: ActivityHoursInput): boolean {
  return row.endMinute <= row.startMinute;
}

/** Whether a row can be saved: it names one of the event's days and closes after it opens. */
export function isValidHoursRow(row: ActivityHoursInput, days: readonly ConferenceDay[]): boolean {
  return days.some((d) => d.id === row.dayId) && !closesBeforeOpening(row);
}

export function canSaveActivity(values: ActivityFormValues, days: readonly ConferenceDay[]): boolean {
  return values.name.trim().length > 0 && values.hours.every((r) => isValidHoursRow(r, days));
}

const sameHours = (a: readonly ActivityHoursInput[], b: readonly ActivityHoursInput[]) =>
  a.length === b.length &&
  a.every(
    (r, i) => r.dayId === b[i].dayId && r.startMinute === b[i].startMinute && r.endMinute === b[i].endMinute,
  );

export interface ActivitySavePlan {
  // Create the activity, update its name and description, or leave them.
  details: "create" | "update" | "none";
  // Whether the schedule needs its replace PUT. The schedule is a table of its
  // own, so it is a second call after the details.
  hours: boolean;
  name: string;
  description: string;
}

/**
 * What saving `values` over `existing` (undefined for a new activity) has to
 * send. Unchanged parts are skipped, so an edit that only moves an opening
 * time is one call, and a new activity with no hours is one call.
 */
export function planActivitySave(
  existing: ActivityDetails | undefined,
  values: ActivityFormValues,
): ActivitySavePlan {
  const name = values.name.trim();
  const description = values.description.trim();
  const before = existing ? toActivityFormValues(existing).hours : [];
  let details: ActivitySavePlan["details"] = "none";
  if (!existing) details = "create";
  else if (existing.name !== name || existing.description !== description) details = "update";
  return { details, hours: !sameHours(before, values.hours), name, description };
}

/** The position a new activity takes: after the last one, whatever gaps deletes left. */
export function nextActivityPosition(activities: readonly Pick<Activity, "position">[]): number {
  return activities.reduce((max, a) => Math.max(max, a.position + 1), 0);
}

/** 540 → "9:00 am", the source's `h:mm a`. */
export function minuteLabel(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "Day 1 · Sep 29 · 9:00 am – 5:00 pm", for one window's chip in the table. */
export function hoursChipLabel(hours: ActivityHoursInput, days: readonly ConferenceDay[]): string {
  const index = days.findIndex((d) => d.id === hours.dayId);
  const day = index >= 0 ? dayOptionLabel(days[index], index) : "Unknown day";
  return `${day} · ${minuteLabel(hours.startMinute)} – ${minuteLabel(hours.endMinute)}`;
}

/**
 * The toast for a failed save. `createdOnly` is the half-failure: the activity
 * now exists but its hours did not save, so a second Save updates it rather
 * than creating a duplicate.
 */
export function activitySaveErrorMessage(err: unknown, name: string, createdOnly: boolean): string {
  if (err instanceof HttpError && err.status === 409) {
    return `An activity called "${name.trim()}" already exists for this event.`;
  }
  const cause = describeEventPlatformError(err);
  if (createdOnly) return `The activity was added, but its opening hours weren't saved. ${cause}`;
  return `Couldn't save the activity. ${cause}`;
}
