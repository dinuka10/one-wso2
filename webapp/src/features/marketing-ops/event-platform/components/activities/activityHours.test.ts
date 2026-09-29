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
import { HttpError } from "@api/http";
import type {
  Activity,
  ConferenceDay,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  activitySaveErrorMessage,
  canSaveActivity,
  closesBeforeOpening,
  hoursChipLabel,
  isValidHoursRow,
  minuteLabel,
  newHoursRow,
  nextActivityPosition,
  planActivitySave,
  toActivityFormValues,
} from "./activityHours";

const day = (id: string, dayIndex: number, startMinute = 480, endMinute = 1020): ConferenceDay => ({
  id,
  configId: "evt-7",
  dayIndex,
  date: `2026-09-${29 + dayIndex}`,
  startMinute,
  endMinute,
  label: null,
  startTimeOffset: "",
  endTimeOffset: "",
});

const days = [day("d1", 0), day("d2", 1, 540, 960)];

const activity: Activity = {
  id: "act-1",
  configId: "evt-7",
  name: "Coffee Bar",
  description: "Open all day",
  position: 0,
  hours: [{ id: "h1", activityId: "act-1", dayId: "d1", startMinute: 540, endMinute: 600 }],
  createdAt: "",
  updatedAt: "",
};

describe("form values", () => {
  it("strips the server's row ids from the hours", () => {
    expect(toActivityFormValues(activity)).toEqual({
      name: "Coffee Bar",
      description: "Open all day",
      hours: [{ dayId: "d1", startMinute: 540, endMinute: 600 }],
    });
    expect(toActivityFormValues(undefined)).toEqual({ name: "", description: "", hours: [] });
  });
});

describe("newHoursRow", () => {
  it("picks the first day without a window, at that day's hours", () => {
    expect(newHoursRow(days, [])).toEqual({ dayId: "d1", startMinute: 480, endMinute: 1020 });
    expect(newHoursRow(days, [{ dayId: "d1", startMinute: 0, endMinute: 60 }])).toEqual({
      dayId: "d2",
      startMinute: 540,
      endMinute: 960,
    });
  });

  it("falls back to the first day, or nothing without days", () => {
    const full = days.map((d) => ({ dayId: d.id, startMinute: 0, endMinute: 60 }));
    expect(newHoursRow(days, full)?.dayId).toBe("d1");
    expect(newHoursRow([], [])).toBeNull();
  });
});

describe("validation", () => {
  it("wants a window to close after it opens", () => {
    expect(closesBeforeOpening({ dayId: "d1", startMinute: 600, endMinute: 600 })).toBe(true);
    expect(closesBeforeOpening({ dayId: "d1", startMinute: 600, endMinute: 660 })).toBe(false);
  });

  it("wants a row on one of the event's days", () => {
    expect(isValidHoursRow({ dayId: "d2", startMinute: 0, endMinute: 60 }, days)).toBe(true);
    expect(isValidHoursRow({ dayId: "gone", startMinute: 0, endMinute: 60 }, days)).toBe(false);
  });

  it("wants a name and valid rows before saving", () => {
    const ok = { name: "Bar", description: "", hours: [{ dayId: "d1", startMinute: 0, endMinute: 60 }] };
    expect(canSaveActivity(ok, days)).toBe(true);
    expect(canSaveActivity({ ...ok, name: "  " }, days)).toBe(false);
    expect(canSaveActivity({ ...ok, hours: [{ dayId: "d1", startMinute: 60, endMinute: 0 }] }, days)).toBe(false);
  });
});

describe("planActivitySave", () => {
  it("creates a new activity, and PUTs hours only when there are some", () => {
    const values = { name: " Bar ", description: "", hours: [] };
    expect(planActivitySave(undefined, values)).toEqual({
      details: "create",
      hours: false,
      name: "Bar",
      description: "",
    });
    const withHours = { ...values, hours: [{ dayId: "d1", startMinute: 0, endMinute: 60 }] };
    expect(planActivitySave(undefined, withHours).hours).toBe(true);
  });

  it("sends nothing for an unchanged edit", () => {
    expect(planActivitySave(activity, toActivityFormValues(activity))).toMatchObject({
      details: "none",
      hours: false,
    });
  });

  it("updates only what changed", () => {
    const values = toActivityFormValues(activity);
    expect(planActivitySave(activity, { ...values, description: "Closes early" })).toMatchObject({
      details: "update",
      hours: false,
    });
    expect(
      planActivitySave(activity, { ...values, hours: [{ dayId: "d1", startMinute: 540, endMinute: 660 }] }),
    ).toMatchObject({ details: "none", hours: true });
    // Dropping every window is a change: the PUT with an empty list clears them.
    expect(planActivitySave(activity, { ...values, hours: [] }).hours).toBe(true);
  });
});

describe("labels", () => {
  it("prints wall-clock minutes the source's way", () => {
    expect(minuteLabel(0)).toBe("12:00 am");
    expect(minuteLabel(540)).toBe("9:00 am");
    expect(minuteLabel(725)).toBe("12:05 pm");
    expect(minuteLabel(1020)).toBe("5:00 pm");
  });

  it("labels a window with its day", () => {
    expect(hoursChipLabel({ dayId: "d2", startMinute: 540, endMinute: 600 }, days)).toBe(
      "Day 2 · Sep 30 · 9:00 am – 10:00 am",
    );
    expect(hoursChipLabel({ dayId: "gone", startMinute: 540, endMinute: 600 }, days)).toBe(
      "Unknown day · 9:00 am – 10:00 am",
    );
  });

  it("places a new activity after the last", () => {
    expect(nextActivityPosition([])).toBe(0);
    expect(nextActivityPosition([{ position: 0 }, { position: 4 }])).toBe(5);
  });
});

describe("activitySaveErrorMessage", () => {
  const url = "https://api.example.com/api/events/evt-7/activities";

  it("names a duplicate", () => {
    expect(activitySaveErrorMessage(new HttpError(url, 409, ""), " Bar ", false)).toBe(
      'An activity called "Bar" already exists for this event.',
    );
  });

  it("tells a half-saved activity apart from a failed one", () => {
    const err = new HttpError(url, 400, JSON.stringify({ error: "endMinute must be after startMinute" }));
    expect(activitySaveErrorMessage(err, "Bar", false)).toBe(
      "Couldn't save the activity. EndMinute must be after startMinute.",
    );
    expect(activitySaveErrorMessage(err, "Bar", true)).toMatch(/^The activity was added, but its opening hours/);
  });
});
