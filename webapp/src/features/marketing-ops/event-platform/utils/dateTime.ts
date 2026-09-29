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

// Every date and time helper the Event Platform needs, on native Date and Intl.
// Replaces the source's dayjs (and its utc/timezone plugins), so no date
// library is added for one app.
//
// Three kinds of value travel through here, and mixing them up is the bug to
// avoid:
// - Calendar dates ("YYYY-MM-DD": ConferenceConfig.startDate, ConferenceDay.date)
//   have no zone. They are parsed from their digits, never with `new Date(s)`,
//   which reads a date-only string as UTC midnight and so shows the previous
//   day anywhere west of UTC.
// - Wall-clock minutes from midnight (ConferenceDay.startMinute, ActivityHours)
//   are venue-local and also zone-free. The pickers want a Date, so they get a
//   local Date carrying those hours and minutes, and only the hours and minutes
//   are ever read back.
// - Instants (shopClosingTime, ConferenceDay.startTimeOffset) are real points in
//   time with an offset, and are the only values that go through `new Date(s)`.

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;

// The calendar parts of a "YYYY-MM-DD" string (or the date portion of an ISO
// date-time), or null when it is not a real calendar date.
function dateOnlyParts(value: string | null | undefined): [number, number, number] | null {
  const match = value ? DATE_ONLY_RE.exec(value.trim()) : null;
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return [y, m, d];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** True for a Date that holds a real time (pickers emit Invalid Date mid-typing). */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

// ---- wall-clock minutes (time pickers) --------------------------------------

/**
 * A local Date on `base`'s calendar day showing `minute` minutes past midnight,
 * for a TimePicker's value/minTime/maxTime. Built from fields, not by adding
 * milliseconds, so 480 is 08:00 even on a DST changeover day.
 */
export function minuteToTime(minute: number, base: Date = new Date()): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, minute);
}

/** Minutes past midnight shown on a picker's Date (its calendar day is ignored). */
export function timeToMinute(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// ---- time zones --------------------------------------------------------------

export interface TimeZoneOption {
  label: string;
  value: string;
}

/** Every IANA zone the browser knows, sorted by label; just UTC where Intl can't list them. */
export const TIMEZONE_OPTIONS: ReadonlyArray<TimeZoneOption> = (() => {
  try {
    return Intl.supportedValuesOf("timeZone")
      .map((tz) => ({ label: tz.replace(/_/g, " "), value: tz }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [{ label: "UTC", value: "UTC" }];
  }
})();

/** The viewer's own IANA zone, the default for a new event. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// ---- calendar dates (date pickers, day labels) ------------------------------

/** "YYYY-MM-DD" → local-midnight Date for a DatePicker; null when not a real date. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  const parts = dateOnlyParts(value);
  if (!parts) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

/** A DatePicker's Date → "YYYY-MM-DD" from its local calendar parts; null when empty or invalid. */
export function toDateOnlyString(date: Date | null | undefined): string | null {
  if (!isValidDate(date)) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today's local calendar date as "YYYY-MM-DD". */
export function todayDateOnly(now: Date = new Date()): string {
  return toDateOnlyString(now) as string;
}

/** `days` calendar days after "YYYY-MM-DD" (negative goes back); the input unchanged if unparseable. */
export function addDaysToDateOnly(value: string, days: number): string {
  const parts = dateOnlyParts(value);
  if (!parts) return value;
  const [y, m, d] = parts;
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Calendar dates are formatted as UTC midnight in UTC, which is the one
// pairing that cannot move them to a neighbouring day.
function formatDateOnly(value: string, options: Intl.DateTimeFormatOptions): string | null {
  const parts = dateOnlyParts(value);
  if (!parts) return null;
  const [y, m, d] = parts;
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "2026-09-29" → "Sep 29" (the source's `format("MMM D")`); the input unchanged if unparseable. */
export function formatDayLabel(value: string): string {
  return formatDateOnly(value, { month: "short", day: "numeric" }) ?? value;
}

/** "2026-09-29" → "Sep 29, 2026"; the input unchanged if unparseable. */
export function formatFullDate(value: string): string {
  return formatDateOnly(value, { month: "short", day: "numeric", year: "numeric" }) ?? value;
}

/**
 * An event's span from its start date and day count, as the source dashboard
 * printed it: "Sep 29, 2026", "Sep 29–30, 2026", "Sep 30 – Oct 2, 2026".
 */
export function formatDateRange(startDate: string, dayCount: number): string {
  if (!dateOnlyParts(startDate)) return startDate;
  if (dayCount <= 1) return formatFullDate(startDate);
  const endDate = addDaysToDateOnly(startDate, dayCount - 1);
  const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
  if (sameMonth) {
    return `${formatDayLabel(startDate)}–${Number(endDate.slice(8, 10))}, ${endDate.slice(0, 4)}`;
  }
  return `${formatDayLabel(startDate)} – ${formatFullDate(endDate)}`;
}

// ---- instants (shop closing time, day offsets) ------------------------------

/** An ISO/RFC3339 instant → Date for a DateTimePicker; null when absent or unparseable. */
export function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isValidDate(date) ? date : null;
}

/** A DateTimePicker's Date → ISO instant (UTC, "Z"); null when empty or invalid. */
export function toInstant(date: Date | null | undefined): string | null {
  return isValidDate(date) ? date.toISOString() : null;
}

/**
 * Whether `now` is strictly before the instant — e.g. "is the shop still open".
 * False for an unparseable instant, as the source's `dayjs().isBefore(...)` was.
 */
export function isNowBefore(value: string, now: Date = new Date()): boolean {
  const instant = parseInstant(value);
  return instant !== null && now.getTime() < instant.getTime();
}

/**
 * An RFC3339 offset instant shown in `timeZone` as "9:00 AM PDT" (the source's
 * dayjs `format("h:mm A z")`). Zones without a common abbreviation get Intl's
 * "GMT+5:30" form, as dayjs gave. Assembled from parts so the separator is a
 * plain space whatever the ICU version (newer ones put U+202F before "AM").
 * Returns "" for an unparseable instant.
 */
export function formatTimeInZone(value: string, timeZone: string = browserTimeZone()): string {
  const instant = parseInstant(value);
  if (!instant) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
    timeZoneName: "short",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")} ${part("dayPeriod").toUpperCase()} ${part("timeZoneName")}`;
}
