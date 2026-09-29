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
import {
  isSpanInDay,
  overlapsSibling,
  sectionSpan,
  slugify,
  strandedSessions,
  suggestTopicId,
} from "./trackSectionForm";

const topics = [
  { id: "tp-1", slug: "ai", name: "AI" },
  { id: "tp-2", slug: "cloud-native", name: "Cloud Native" },
];
const day = { startMinute: 540 };
const at = (h: number, m = 0) => new Date(2026, 8, 29, h, m);

describe("slugify", () => {
  it("lower-cases and hyphenates", () => {
    expect(slugify("  Cloud  Native! ")).toBe("cloud-native");
    expect(slugify("--AI--")).toBe("ai");
  });
});

describe("suggestTopicId", () => {
  it("matches on slug or name, dropping a trailing Lab(s)", () => {
    expect(suggestTopicId("AI Labs", topics)).toBe("tp-1");
    expect(suggestTopicId("ai lab", topics)).toBe("tp-1");
    expect(suggestTopicId("Cloud Native", topics)).toBe("tp-2");
  });

  it("suggests nothing for an empty or unknown label", () => {
    expect(suggestTopicId("  ", topics)).toBeNull();
    expect(suggestTopicId("Labs", topics)).toBeNull();
    expect(suggestTopicId("Security", topics)).toBeNull();
  });
});

describe("sectionSpan", () => {
  it("maps two times onto the day's slots", () => {
    expect(sectionSpan(day, at(9, 30), at(10, 30))).toEqual({ startSlot: 6, endSlot: 18, durationSlots: 12 });
  });

  it("has no length until both times are set", () => {
    expect(sectionSpan(day, at(9), null)).toEqual({ startSlot: 0, endSlot: null, durationSlots: 0 });
  });
});

describe("overlapsSibling", () => {
  const siblings = [
    { id: "sec-1", startSlot: 0, durationSlots: 12 },
    { id: "sec-2", startSlot: 24, durationSlots: 12 },
  ];

  it("flags a span that runs into a sibling", () => {
    expect(overlapsSibling({ startSlot: 10, endSlot: 14, durationSlots: 4 }, siblings)).toBe(true);
  });

  it("allows a span that only touches a sibling", () => {
    expect(overlapsSibling({ startSlot: 12, endSlot: 24, durationSlots: 12 }, siblings)).toBe(false);
  });

  it("ignores the section being edited, and spans with no length", () => {
    expect(overlapsSibling({ startSlot: 2, endSlot: 8, durationSlots: 6 }, siblings, "sec-1")).toBe(false);
    expect(overlapsSibling({ startSlot: 8, endSlot: 4, durationSlots: -4 }, siblings)).toBe(false);
  });
});

describe("isSpanInDay", () => {
  // 09:00–17:00: 96 slots.
  const fullDay = { startMinute: 540, endMinute: 1020 };

  it("accepts a span inside the day, and one not yet complete", () => {
    expect(isSpanInDay(sectionSpan(fullDay, at(9), at(17)), fullDay)).toBe(true);
    expect(isSpanInDay(sectionSpan(fullDay, at(8), null), fullDay)).toBe(true);
  });

  it("refuses a span that starts before the day or ends after it", () => {
    expect(isSpanInDay(sectionSpan(fullDay, at(8, 30), at(10)), fullDay)).toBe(false);
    expect(isSpanInDay(sectionSpan(fullDay, at(16), at(17, 15)), fullDay)).toBe(false);
  });
});

describe("strandedSessions", () => {
  const sessions = [
    { id: "a", slotIndex: 0 },
    { id: "b", slotIndex: 12 },
    { id: "c", slotIndex: 23 },
    { id: "d", slotIndex: null },
  ];

  it("lists the sessions whose start falls outside the span", () => {
    const span = { startSlot: 6, endSlot: 18, durationSlots: 12 };
    expect(strandedSessions(span, sessions).map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("strands nothing while the span is incomplete", () => {
    expect(strandedSessions({ startSlot: 6, endSlot: null, durationSlots: 0 }, sessions)).toEqual([]);
  });
});
