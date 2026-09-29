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

// The pure half of the event Settings form: the event → form values mapping,
// the form values → upsert payload mapping, day-count changes and validation.

import type { UpsertEventPayload } from "@features/marketing-ops/event-platform/api/event";
import type { ConferenceConfig } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  browserTimeZone,
  parseDateOnly,
  parseInstant,
  toDateOnlyString,
  toInstant,
} from "@features/marketing-ops/event-platform/utils/dateTime";

// The source's cap. An event stored with more days (made some other way) still
// offers its own count, so opening Settings never silently shortens it.
export const MAX_DAYS = 3;
// 08:00–17:00, for a first day when there is no previous day to copy.
export const DEFAULT_START_MINUTE = 480;
export const DEFAULT_END_MINUTE = 1020;

export interface SettingsDay {
  startMinute: number;
  endMinute: number;
  // "" = no label of its own; the board then calls it "Day N".
  label: string;
}

export interface EventSettingsFormValues {
  name: string;
  // Dates for the pickers; the payload carries strings.
  startDate: Date | null;
  days: SettingsDay[];
  timezone: string;
  venueName: string;
  venueAddress: string;
  // Objects, not strings: react-hook-form's field arrays key rows by object.
  artifactLabels: { value: string }[];
  defaultInternalLogoUrl: string;
  shopClosingTime: Date | null;
  articleLinksEnabled: boolean;
  videoLinksEnabled: boolean;
}

export function toSettingsFormValues(
  event: ConferenceConfig,
  fallbackTimeZone: string = browserTimeZone(),
): EventSettingsFormValues {
  return {
    name: event.name,
    startDate: parseDateOnly(event.startDate),
    days: [...event.days]
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .map((d) => ({ startMinute: d.startMinute, endMinute: d.endMinute, label: d.label ?? "" })),
    timezone: event.timezone || fallbackTimeZone,
    venueName: event.venueName ?? "",
    venueAddress: event.venueAddress ?? "",
    artifactLabels: (event.artifactLabels ?? []).map((value) => ({ value })),
    defaultInternalLogoUrl: event.defaultInternalLogoUrl ?? "",
    shopClosingTime: parseInstant(event.shopClosingTime),
    articleLinksEnabled: event.articleLinksEnabled,
    videoLinksEnabled: event.videoLinksEnabled,
  };
}

const orNull = (value: string) => value.trim() || null;

/**
 * The whole-event PUT. `keynoteRoomId` is not on the form — it belongs to the
 * Rooms screen — but the upsert writes every column, so the event's current
 * value is passed through or the save would clear it.
 */
export function toUpsertPayload(values: EventSettingsFormValues, event: ConferenceConfig): UpsertEventPayload {
  return {
    name: values.name.trim(),
    startDate: toDateOnlyString(values.startDate) ?? event.startDate,
    days: values.days.map(({ startMinute, endMinute, label }) => ({
      startMinute,
      endMinute,
      label: orNull(label),
    })),
    articleLinksEnabled: values.articleLinksEnabled,
    videoLinksEnabled: values.videoLinksEnabled,
    artifactLabels: values.artifactLabels.map((l) => l.value.trim()),
    defaultInternalLogoUrl: orNull(values.defaultInternalLogoUrl),
    timezone: values.timezone,
    venueName: orNull(values.venueName),
    venueAddress: orNull(values.venueAddress),
    shopClosingTime: toInstant(values.shopClosingTime),
    keynoteRoomId: event.keynoteRoomId ?? null,
  };
}

/** The day counts on offer: 1 to MAX_DAYS, or to the event's own count when that is more. */
export function dayCountOptions(current: number): number[] {
  return Array.from({ length: Math.max(MAX_DAYS, current) }, (_, i) => i + 1);
}

/**
 * The day list at `count` days. Shortening drops trailing days; lengthening
 * copies the last day's hours (not its label, which named that day alone).
 */
export function resizeDays(days: readonly SettingsDay[], count: number): SettingsDay[] {
  if (count <= days.length) return days.slice(0, count);
  const last = days[days.length - 1];
  const template: SettingsDay = {
    startMinute: last?.startMinute ?? DEFAULT_START_MINUTE,
    endMinute: last?.endMinute ?? DEFAULT_END_MINUTE,
    label: "",
  };
  return [...days, ...Array.from({ length: count - days.length }, () => ({ ...template }))];
}

export function dayEndsBeforeStart(day: SettingsDay): boolean {
  return day.endMinute <= day.startMinute;
}

export function canSaveSettings(values: EventSettingsFormValues): boolean {
  return (
    values.name.trim().length > 0 &&
    values.startDate !== null &&
    toDateOnlyString(values.startDate) !== null &&
    values.timezone.trim().length > 0 &&
    values.days.length > 0 &&
    values.days.every((d) => !dayEndsBeforeStart(d)) &&
    values.artifactLabels.every((l) => l.value.trim().length > 0)
  );
}

/**
 * How many stored days a save would delete. The upsert matches days by
 * position, so a shorter list deletes the trailing days and unschedules their
 * sessions — worth a confirmation, which the source never asked for.
 */
export function droppedDayCount(event: ConferenceConfig, values: EventSettingsFormValues): number {
  return Math.max(0, event.days.length - values.days.length);
}
