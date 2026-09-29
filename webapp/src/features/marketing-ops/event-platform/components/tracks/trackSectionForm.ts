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

// The section dialog's rules: its slot span from two picker times, the overlap
// check against its siblings, and the topic it suggests from its label.

import type {
  ConferenceDay,
  Session,
  TrackSection,
  TrackTopic,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { minuteToSlot, slotCountOf } from "@features/marketing-ops/event-platform/utils/agenda";
import { timeToMinute } from "@features/marketing-ops/event-platform/utils/dateTime";

/** The slug the backend would derive, used when a topic is created inline. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A section labelled "AI Labs" should suggest the "AI" topic, so a trailing
// "Lab(s)" is stripped before matching on slug or name.
export function suggestTopicId(
  label: string,
  topics: readonly Pick<TrackTopic, "id" | "slug" | "name">[],
): string | null {
  const stripped = label
    .trim()
    .replace(/\s+Labs?$/i, "")
    .trim();
  if (!stripped) return null;
  const slug = slugify(stripped);
  return (
    topics.find((t) => t.slug === slug || t.name.toLowerCase() === stripped.toLowerCase())?.id ?? null
  );
}

export interface SectionSpan {
  startSlot: number | null;
  endSlot: number | null;
  // 0 until both times are set, and when the end is not after the start.
  durationSlots: number;
}

/** The span two picker times cover on `day`'s slot grid. */
export function sectionSpan(
  day: Pick<ConferenceDay, "startMinute">,
  startTime: Date | null,
  endTime: Date | null,
): SectionSpan {
  const startSlot = startTime ? minuteToSlot(timeToMinute(startTime), day.startMinute) : null;
  const endSlot = endTime ? minuteToSlot(timeToMinute(endTime), day.startMinute) : null;
  const durationSlots = startSlot !== null && endSlot !== null ? endSlot - startSlot : 0;
  return { startSlot, endSlot, durationSlots };
}

/** Whether the span overlaps any sibling other than the section being edited. */
export function overlapsSibling(
  span: SectionSpan,
  siblings: readonly Pick<TrackSection, "id" | "startSlot" | "durationSlots">[],
  editingId?: string,
): boolean {
  const { startSlot, endSlot, durationSlots } = span;
  if (startSlot === null || endSlot === null || durationSlots <= 0) return false;
  return siblings.some(
    (s) => s.id !== editingId && startSlot < s.startSlot + s.durationSlots && s.startSlot < endSlot,
  );
}

// Whether the span lies inside `day`'s grid. The pickers' min and max times
// only flag a typed value outside the day; they still emit it.
export function isSpanInDay(
  span: SectionSpan,
  day: Pick<ConferenceDay, "startMinute" | "endMinute">,
): boolean {
  const { startSlot, endSlot } = span;
  if (startSlot === null || endSlot === null) return true;
  return startSlot >= 0 && endSlot <= slotCountOf(day);
}

// The section's sessions whose start the span no longer covers. A section's
// body clips its cards, so these would be placed but drawn nowhere.
export function strandedSessions<T extends Pick<Session, "slotIndex">>(
  span: SectionSpan,
  sessions: readonly T[],
): T[] {
  const { startSlot, endSlot, durationSlots } = span;
  if (startSlot === null || endSlot === null || durationSlots <= 0) return [];
  return sessions.filter(
    (s) => s.slotIndex !== null && (s.slotIndex < startSlot || s.slotIndex >= endSlot),
  );
}
