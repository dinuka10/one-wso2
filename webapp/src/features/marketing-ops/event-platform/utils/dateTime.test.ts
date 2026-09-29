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


import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDaysToDateOnly,
  browserTimeZone,
  formatDateRange,
  formatDayLabel,
  formatFullDate,
  formatTimeInZone,
  isNowBefore,
  isValidDate,
  minuteToTime,
  parseDateOnly,
  parseInstant,
  TIMEZONE_OPTIONS,
  timeToMinute,
  toDateOnlyString,
  toInstant,
  todayDateOnly,
} from "./dateTime";

// The suite runs in America/Los_Angeles (src/test/setup.ts): west of UTC, so a
// date-only string read as UTC shows the day before, and with DST changeovers
// on 2026-03-08 and 2026-11-01.

describe("wall-clock minutes", () => {
  it("round-trips a minute of day through a picker Date", () => {
    for (const minute of [0, 1, 480, 725, 1020, 1439]) {
      expect(timeToMinute(minuteToTime(minute))).toBe(minute);
    }
  });

  it("lands on the base date's calendar day", () => {
    const time = minuteToTime(510, new Date(2026, 8, 29, 23, 59));
    expect([time.getFullYear(), time.getMonth(), time.getDate()]).toEqual([2026, 8, 29]);
    expect([time.getHours(), time.getMinutes()]).toEqual([8, 30]);
  });

  // dayjs().startOf("day").add(480, "minute") adds elapsed time, so on a
  // spring-forward day it lands on 09:00. Building from fields does not.
  it("keeps the wall-clock time on DST changeover days", () => {
    const springForward = minuteToTime(480, new Date(2026, 2, 8));
    expect(timeToMinute(springForward)).toBe(480);
    const fallBack = minuteToTime(1020, new Date(2026, 10, 1));
    expect(timeToMinute(fallBack)).toBe(1020);
  });
});

describe("time zones", () => {
  it("lists zones sorted by a space-separated label", () => {
    expect(TIMEZONE_OPTIONS.length).toBeGreaterThan(0);
    const labels = TIMEZONE_OPTIONS.map((o) => o.label);
    expect([...labels].sort((a, b) => a.localeCompare(b))).toEqual(labels);
    const la = TIMEZONE_OPTIONS.find((o) => o.value === "America/Los_Angeles");
    expect(la?.label).toBe("America/Los Angeles");
  });

  it("reports the runner's zone as the browser zone", () => {
    expect(browserTimeZone()).toBe("America/Los_Angeles");
  });
});

describe("calendar dates", () => {
  it("parses a date-only string to local midnight on the same day", () => {
    const date = parseDateOnly("2026-09-29");
    expect(date).not.toBeNull();
    expect([date!.getFullYear(), date!.getMonth(), date!.getDate(), date!.getHours()]).toEqual([
      2026, 8, 29, 0,
    ]);
  });

  it("takes the date portion of an ISO date-time without shifting it", () => {
    expect(toDateOnlyString(parseDateOnly("2026-09-29T00:00:00Z"))).toBe("2026-09-29");
  });

  it("rejects what is not a real calendar date", () => {
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("29/09/2026")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
  });

  it("formats a picker Date from its local parts, late in the evening too", () => {
    // 23:30 in Los Angeles is already the next day in UTC.
    expect(toDateOnlyString(new Date(2026, 8, 29, 23, 30))).toBe("2026-09-29");
    expect(toDateOnlyString(new Date(Number.NaN))).toBeNull();
    expect(toDateOnlyString(null)).toBeNull();
  });

  it("gives today's local date, not the UTC one", () => {
    expect(todayDateOnly(new Date(2026, 8, 29, 23, 30))).toBe("2026-09-29");
  });

  it("adds days across month, year and DST boundaries", () => {
    expect(addDaysToDateOnly("2026-09-29", 2)).toBe("2026-10-01");
    expect(addDaysToDateOnly("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateOnly("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDaysToDateOnly("2026-11-01", -1)).toBe("2026-10-31");
    expect(addDaysToDateOnly("not a date", 1)).toBe("not a date");
  });

  it("labels a day without shifting it", () => {
    expect(formatDayLabel("2026-09-29")).toBe("Sep 29");
    expect(formatDayLabel("2026-01-01")).toBe("Jan 1");
    expect(formatDayLabel("2026-03-08")).toBe("Mar 8");
    expect(formatFullDate("2026-09-29")).toBe("Sep 29, 2026");
    expect(formatDayLabel("bad")).toBe("bad");
  });

  it("formats an event's date range as the source dashboard did", () => {
    expect(formatDateRange("2026-09-29", 1)).toBe("Sep 29, 2026");
    expect(formatDateRange("2026-09-28", 3)).toBe("Sep 28–30, 2026");
    expect(formatDateRange("2026-09-30", 3)).toBe("Sep 30 – Oct 2, 2026");
  });
});

describe("instants", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a picker Date through an ISO instant", () => {
    const iso = "2026-09-29T17:00:00.000Z";
    expect(toInstant(parseInstant(iso))).toBe(iso);
    expect(toInstant(parseInstant("2026-09-29T10:00:00-07:00"))).toBe(iso);
  });

  it("treats absent or unparseable values as no date", () => {
    expect(parseInstant(null)).toBeNull();
    expect(parseInstant("")).toBeNull();
    expect(parseInstant("soon")).toBeNull();
    expect(toInstant(new Date(Number.NaN))).toBeNull();
    expect(toInstant(null)).toBeNull();
    expect(isValidDate(new Date(Number.NaN))).toBe(false);
    expect(isValidDate("2026-09-29")).toBe(false);
  });

  it("compares now against an instant", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    expect(isNowBefore("2026-09-29T12:00:01Z", now)).toBe(true);
    expect(isNowBefore("2026-09-29T12:00:00Z", now)).toBe(false);
    expect(isNowBefore("2026-09-29T05:00:00-07:00", now)).toBe(false);
    expect(isNowBefore("garbage", now)).toBe(false);
  });

  it("defaults now to the clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
    expect(isNowBefore("2026-09-29T13:00:00Z")).toBe(true);
  });

  it("formats an offset instant in the viewer's zone with its abbreviation", () => {
    const venue = "2026-09-29T09:00:00-07:00";
    expect(formatTimeInZone(venue, "America/Los_Angeles")).toBe("9:00 AM PDT");
    expect(formatTimeInZone(venue, "America/New_York")).toBe("12:00 PM EDT");
    expect(formatTimeInZone(venue, "UTC")).toBe("4:00 PM UTC");
    expect(formatTimeInZone(venue, "Asia/Colombo")).toBe("9:30 PM GMT+5:30");
  });

  it("follows DST in the viewer's zone", () => {
    expect(formatTimeInZone("2026-11-02T17:00:00Z", "America/Los_Angeles")).toBe("9:00 AM PST");
    expect(formatTimeInZone("2026-03-09T16:00:00Z", "America/Los_Angeles")).toBe("9:00 AM PDT");
  });

  it("defaults to the browser's zone and tolerates a bad instant", () => {
    expect(formatTimeInZone("2026-09-29T16:05:00Z")).toBe("9:05 AM PDT");
    expect(formatTimeInZone("nope")).toBe("");
  });
});
