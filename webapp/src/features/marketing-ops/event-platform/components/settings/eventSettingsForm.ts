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
import type {
  ConferenceConfig,
  RoomMappings,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  browserTimeZone,
  isValidDate,
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
  // The closing time as the event's own wall clock (`timezone`), held in a
  // browser-local Date because that is all the picker's adapter can show.
  shopClosingTime: Date | null;
  articleLinksEnabled: boolean;
  videoLinksEnabled: boolean;
}

// The zone's offset from UTC at `instantMs`, in ms. Throws on a zone Intl
// doesn't know.
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instantMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * An instant → a browser-local Date showing that instant's wall clock in
 * `timeZone`, for a picker that only knows the browser's zone. An unknown
 * zone leaves the instant as it is.
 */
export function instantToZonedWallClock(instant: Date | null, timeZone: string): Date | null {
  if (!isValidDate(instant)) return null;
  try {
    const wall = new Date(instant.getTime() + zoneOffsetMs(instant.getTime(), timeZone));
    return new Date(
      wall.getUTCFullYear(),
      wall.getUTCMonth(),
      wall.getUTCDate(),
      wall.getUTCHours(),
      wall.getUTCMinutes(),
      wall.getUTCSeconds(),
    );
  } catch {
    return instant;
  }
}

/** The inverse: a picker's browser-local wall clock, read as `timeZone`'s, → the instant. */
export function zonedWallClockToInstant(wall: Date | null, timeZone: string): Date | null {
  if (!isValidDate(wall)) return null;
  const asUtc = Date.UTC(
    wall.getFullYear(),
    wall.getMonth(),
    wall.getDate(),
    wall.getHours(),
    wall.getMinutes(),
    wall.getSeconds(),
  );
  try {
    // The offset at the guess can differ from the one at the answer across a
    // DST change, so take it again from the first answer.
    const first = asUtc - zoneOffsetMs(asUtc, timeZone);
    return new Date(asUtc - zoneOffsetMs(first, timeZone));
  } catch {
    return wall;
  }
}

/** Empty (no logo) or an absolute http(s) URL. Anything else would reach every internal speaker's card. */
export function isValidLogoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const { protocol } = new URL(trimmed);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function toSettingsFormValues(
  event: ConferenceConfig,
  fallbackTimeZone: string = browserTimeZone(),
): EventSettingsFormValues {
  const timezone = event.timezone || fallbackTimeZone;
  return {
    name: event.name,
    startDate: parseDateOnly(event.startDate),
    days: [...event.days]
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .map((d) => ({ startMinute: d.startMinute, endMinute: d.endMinute, label: d.label ?? "" })),
    timezone,
    venueName: event.venueName ?? "",
    venueAddress: event.venueAddress ?? "",
    artifactLabels: (event.artifactLabels ?? []).map((value) => ({ value })),
    defaultInternalLogoUrl: event.defaultInternalLogoUrl ?? "",
    shopClosingTime: instantToZonedWallClock(parseInstant(event.shopClosingTime), timezone),
    articleLinksEnabled: event.articleLinksEnabled,
    videoLinksEnabled: event.videoLinksEnabled,
  };
}

const orNull = (value: string) => value.trim() || null;

/**
 * The whole-event PUT. `keynoteRoomId` is not on the form — it belongs to the
 * Rooms screen — but the upsert writes every column, so the current value is
 * passed through or the save would clear it. `mappings` is the Rooms screen's
 * cache, read at submit time: it is fresher than `event` after a keynote
 * change or a room delete there. Without it, the event's own value is used.
 */
export function toUpsertPayload(
  values: EventSettingsFormValues,
  event: ConferenceConfig,
  mappings?: RoomMappings,
): UpsertEventPayload {
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
    // Read in the zone being saved, so changing the zone keeps the time the
    // organiser sees rather than the instant.
    shopClosingTime: toInstant(zonedWallClockToInstant(values.shopClosingTime, values.timezone)),
    keynoteRoomId: mappings ? mappings.keynoteRoomId : (event.keynoteRoomId ?? null),
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
    values.artifactLabels.every((l) => l.value.trim().length > 0) &&
    isValidLogoUrl(values.defaultInternalLogoUrl)
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
