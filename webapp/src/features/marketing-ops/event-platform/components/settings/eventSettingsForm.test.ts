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
  ConferenceConfig,
  ConferenceDay,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  DEFAULT_END_MINUTE,
  DEFAULT_START_MINUTE,
  canSaveSettings,
  dayCountOptions,
  droppedDayCount,
  instantToZonedWallClock,
  isValidLogoUrl,
  resizeDays,
  toSettingsFormValues,
  toUpsertPayload,
  zonedWallClockToInstant,
} from "./eventSettingsForm";

const day = (dayIndex: number, label: string | null = null): ConferenceDay => ({
  id: `day-${dayIndex}`,
  configId: "evt-7",
  dayIndex,
  date: `2026-09-${29 + dayIndex}`,
  startMinute: 540,
  endMinute: 1020,
  label,
  startTimeOffset: "",
  endTimeOffset: "",
});

const event: ConferenceConfig = {
  id: "evt-7",
  name: "Example Conference",
  startDate: "2026-09-29",
  createdAt: "",
  updatedAt: "",
  articleLinksEnabled: true,
  videoLinksEnabled: false,
  artifactLabels: ["View Slides"],
  defaultInternalLogoUrl: null,
  timezone: "Asia/Colombo",
  venueName: "Example Hall",
  venueAddress: null,
  shopClosingTime: "2026-09-30T12:00:00Z",
  keynoteRoomId: "room-1",
  // Out of order on purpose: the form lists them by dayIndex.
  days: [day(1), day(0, "Workshops")],
};

describe("toSettingsFormValues", () => {
  it("maps the event onto the form", () => {
    const values = toSettingsFormValues(event, "UTC");
    expect(values.name).toBe("Example Conference");
    expect(values.startDate).toEqual(new Date(2026, 8, 29));
    expect(values.days).toEqual([
      { startMinute: 540, endMinute: 1020, label: "Workshops" },
      { startMinute: 540, endMinute: 1020, label: "" },
    ]);
    expect(values.artifactLabels).toEqual([{ value: "View Slides" }]);
    expect(values.venueAddress).toBe("");
    // 12:00Z is 5:30 pm in Colombo, whatever zone the suite runs in.
    expect(values.shopClosingTime).toEqual(new Date(2026, 8, 30, 17, 30));
    expect(values.timezone).toBe("Asia/Colombo");
  });

  it("falls back to the given zone when the event has none", () => {
    expect(toSettingsFormValues({ ...event, timezone: "" }, "Europe/London").timezone).toBe("Europe/London");
  });
});

describe("shop closing time zone", () => {
  it("shows and saves the time in the event's zone, not the browser's", () => {
    const wall = new Date(2026, 8, 30, 18, 0);
    expect(zonedWallClockToInstant(wall, "Asia/Colombo")?.toISOString()).toBe("2026-09-30T12:30:00.000Z");
    expect(zonedWallClockToInstant(wall, "UTC")?.toISOString()).toBe("2026-09-30T18:00:00.000Z");
    expect(instantToZonedWallClock(new Date("2026-09-30T12:30:00Z"), "Asia/Colombo")).toEqual(wall);
  });

  it("takes the offset in force on the day, across a DST change", () => {
    // New York is UTC-4 in summer and UTC-5 after the first Sunday of November.
    expect(zonedWallClockToInstant(new Date(2026, 6, 1, 18, 0), "America/New_York")?.toISOString()).toBe(
      "2026-07-01T22:00:00.000Z",
    );
    expect(zonedWallClockToInstant(new Date(2026, 11, 1, 18, 0), "America/New_York")?.toISOString()).toBe(
      "2026-12-01T23:00:00.000Z",
    );
  });

  it("keeps the time shown, not the instant, when the zone is changed", () => {
    const values = { ...toSettingsFormValues(event, "UTC"), timezone: "UTC" };
    expect(toUpsertPayload(values, event).shopClosingTime).toBe("2026-09-30T17:30:00.000Z");
  });

  it("passes empty and unknown zones through", () => {
    expect(instantToZonedWallClock(null, "Asia/Colombo")).toBeNull();
    expect(zonedWallClockToInstant(null, "Asia/Colombo")).toBeNull();
    const instant = new Date("2026-09-30T12:30:00Z");
    expect(instantToZonedWallClock(instant, "Not/AZone")).toEqual(instant);
  });
});

describe("toUpsertPayload", () => {
  it("round-trips an untouched form to the event's own values", () => {
    const payload = toUpsertPayload(toSettingsFormValues(event, "UTC"), event);
    expect(payload).toEqual({
      name: "Example Conference",
      startDate: "2026-09-29",
      days: [
        { startMinute: 540, endMinute: 1020, label: "Workshops" },
        { startMinute: 540, endMinute: 1020, label: null },
      ],
      articleLinksEnabled: true,
      videoLinksEnabled: false,
      artifactLabels: ["View Slides"],
      defaultInternalLogoUrl: null,
      timezone: "Asia/Colombo",
      venueName: "Example Hall",
      venueAddress: null,
      shopClosingTime: "2026-09-30T12:00:00.000Z",
      keynoteRoomId: "room-1",
    });
  });

  it("passes the keynote room through, null when unset", () => {
    const values = toSettingsFormValues(event, "UTC");
    expect(toUpsertPayload(values, { ...event, keynoteRoomId: undefined }).keynoteRoomId).toBeNull();
  });

  it("sends the keynote room from the room mappings over the event's, including a cleared one", () => {
    const values = toSettingsFormValues(event, "UTC");
    expect(toUpsertPayload(values, event, { configId: "evt-7", keynoteRoomId: "room-2" }).keynoteRoomId).toBe(
      "room-2",
    );
    expect(toUpsertPayload(values, event, { configId: "evt-7", keynoteRoomId: null }).keynoteRoomId).toBeNull();
  });

  it("trims text and turns blanks into null", () => {
    const values = {
      ...toSettingsFormValues(event, "UTC"),
      name: "  Renamed  ",
      venueName: "   ",
      artifactLabels: [{ value: " View Video " }],
      shopClosingTime: null,
    };
    const payload = toUpsertPayload(values, event);
    expect(payload.name).toBe("Renamed");
    expect(payload.venueName).toBeNull();
    expect(payload.artifactLabels).toEqual(["View Video"]);
    expect(payload.shopClosingTime).toBeNull();
  });
});

describe("days", () => {
  const two = [
    { startMinute: 540, endMinute: 1020, label: "Workshops" },
    { startMinute: 600, endMinute: 900, label: "Main" },
  ];

  it("shortens from the end", () => {
    expect(resizeDays(two, 1)).toEqual([two[0]]);
  });

  it("lengthens with the last day's hours but no label", () => {
    expect(resizeDays(two, 3)[2]).toEqual({ startMinute: 600, endMinute: 900, label: "" });
    expect(resizeDays([], 1)).toEqual([
      { startMinute: DEFAULT_START_MINUTE, endMinute: DEFAULT_END_MINUTE, label: "" },
    ]);
  });

  it("offers the event's own count when it is over the cap", () => {
    expect(dayCountOptions(2)).toEqual([1, 2, 3]);
    expect(dayCountOptions(5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("counts the stored days a save would delete", () => {
    const values = toSettingsFormValues(event, "UTC");
    expect(droppedDayCount(event, values)).toBe(0);
    expect(droppedDayCount(event, { ...values, days: resizeDays(values.days, 1) })).toBe(1);
    expect(droppedDayCount(event, { ...values, days: resizeDays(values.days, 3) })).toBe(0);
  });
});

describe("canSaveSettings", () => {
  const values = toSettingsFormValues(event, "UTC");

  it("accepts the event as stored", () => {
    expect(canSaveSettings(values)).toBe(true);
  });

  it("refuses a blank name, a missing date, a backwards day or a blank label", () => {
    expect(canSaveSettings({ ...values, name: " " })).toBe(false);
    expect(canSaveSettings({ ...values, startDate: null })).toBe(false);
    expect(canSaveSettings({ ...values, startDate: new Date(Number.NaN) })).toBe(false);
    expect(canSaveSettings({ ...values, days: [{ startMinute: 600, endMinute: 600, label: "" }] })).toBe(false);
    expect(canSaveSettings({ ...values, artifactLabels: [{ value: "  " }] })).toBe(false);
  });

  it("refuses a default logo that isn't an http(s) URL", () => {
    expect(canSaveSettings({ ...values, defaultInternalLogoUrl: "https://example.com/logo.png" })).toBe(true);
    expect(canSaveSettings({ ...values, defaultInternalLogoUrl: "logo.png" })).toBe(false);
    expect(canSaveSettings({ ...values, defaultInternalLogoUrl: "javascript:alert(1)" })).toBe(false);
  });
});

describe("isValidLogoUrl", () => {
  it("accepts blank and http(s) URLs only", () => {
    expect(isValidLogoUrl("")).toBe(true);
    expect(isValidLogoUrl("  ")).toBe(true);
    expect(isValidLogoUrl("http://example.com/logo.png")).toBe(true);
    expect(isValidLogoUrl(" https://example.com/logo.png ")).toBe(true);
    expect(isValidLogoUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isValidLogoUrl("example.com/logo.png")).toBe(false);
  });
});
