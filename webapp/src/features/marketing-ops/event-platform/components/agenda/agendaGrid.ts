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

// The agenda board's layout maths: the CSS grid it is drawn on, where each card
// sits, and which slot a pointer is over inside a section. The source inlined
// all of it in AgendaBoard; it lives here so it can be tested.
//
// The grid: column 1 is the time labels, then one column per track. Row 1 is
// the track headers, then one row per slot — so slot N is grid row N + 2.

import type {
  Session,
  Track,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { SLOT_PX, isFullWidthKind } from "@features/marketing-ops/event-platform/utils/agenda";

/** A time label every half hour: six 5-minute slots. */
export const TIME_LABEL_EVERY = 6;

/** Width of the time-label column, px. */
export const TIME_COLUMN_PX = 90;

/** Grid row of a slot (row 1 holds the headers). */
export const slotRow = (slot: number): number => slot + 2;

/** Grid column of the track at `index` (column 1 holds the times). */
export const trackColumn = (index: number): number => index + 2;

/** The grid template for `trackCount` tracks over `slotCount` slots. */
export function boardGridTemplate(trackCount: number, slotCount: number) {
  return {
    gridTemplateColumns: `${TIME_COLUMN_PX}px repeat(${trackCount}, minmax(180px, 1fr))`,
    gridTemplateRows: `auto repeat(${slotCount}, ${SLOT_PX}px)`,
  };
}

/** The slots that carry a time label. */
export const timeLabelSlots = (slotCount: number): number[] =>
  Array.from({ length: slotCount }, (_, i) => i).filter((slot) => slot % TIME_LABEL_EVERY === 0);

type SectionSpan = Pick<TrackSection, "startSlot" | "durationSlots">;

// The slot under a pointer `offsetY` px below a section's top edge, kept inside
// the section — for the hover highlight.
export function pointerSlot(section: SectionSpan, offsetY: number): number {
  const rawSlot = section.startSlot + Math.floor(offsetY / SLOT_PX);
  return Math.max(section.startSlot, Math.min(rawSlot, section.startSlot + section.durationSlots - 1));
}

// Where an item `len` slots long lands when dropped `offsetY` px into a
// section: at the slot under the pointer, pulled back so it ends inside the
// section. An item longer than the section starts at the section's start.
export function sectionDropSlot(section: SectionSpan, offsetY: number, len: number): number {
  const rawSlot = section.startSlot + Math.floor(offsetY / SLOT_PX);
  return Math.max(section.startSlot, Math.min(rawSlot, section.startSlot + section.durationSlots - len));
}

// A card inside a section is absolutely positioned in the section's body, and
// clipped to the section's length. Under two slots it is too short for text,
// so it shows only its remove control and puts the rest in a tooltip.
export function sectionCardBox(
  item: Pick<Session, "slotIndex" | "durationSlots">,
  section: SectionSpan,
): { topPx: number; heightPx: number; isCompact: boolean } {
  return {
    topPx: ((item.slotIndex ?? section.startSlot) - section.startSlot) * SLOT_PX,
    heightPx: Math.min(item.durationSlots, section.durationSlots) * SLOT_PX,
    isCompact: item.durationSlots < 2,
  };
}

export interface FreeCardLayout {
  isFullWidth: boolean;
  // Null for a full-width item, which belongs to no track.
  track: Track | null;
  slotStart: number;
  gridColumn: string;
  gridRow: string;
  isCompact: boolean;
}

// Where an item outside any section sits: a direct grid child spanning its
// slots (clipped to the day), across every track when full-width, else in its
// track's column. Null when it can't be drawn: no slot, or its track isn't on
// this day's board.
export function freeCardLayout(
  item: Pick<Session, "kind" | "slotIndex" | "trackId" | "durationSlots">,
  tracks: readonly Track[],
  slotCount: number,
): FreeCardLayout | null {
  if (item.slotIndex === null) return null;
  const isFullWidth = isFullWidthKind(item.kind);
  const trackIndex = isFullWidth ? -1 : tracks.findIndex((t) => t.id === item.trackId);
  if (!isFullWidth && trackIndex < 0) return null;

  const slotStart = item.slotIndex;
  const visualSpan = Math.min(item.durationSlots, slotCount - slotStart);
  return {
    isFullWidth,
    track: isFullWidth ? null : tracks[trackIndex],
    slotStart,
    gridColumn: isFullWidth ? `2 / span ${tracks.length}` : String(trackColumn(trackIndex)),
    gridRow: `${slotRow(slotStart)} / span ${visualSpan}`,
    isCompact: visualSpan < 2,
  };
}
