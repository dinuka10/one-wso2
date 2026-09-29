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

// The agenda editor's drop rules, out of the hooks so they can be tested: which
// sessions are on the board, whether a drop may land, and which cells light up
// while dragging. Ported from the source's useAgendaEditor and useDragDrop.

import type { Placement } from "@features/marketing-ops/event-platform/api/cacheUpdates";
import type { Session } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { isFullWidthKind } from "@features/marketing-ops/event-platform/utils/agenda";
import { isFullWidthSession, isNoopDrop } from "@features/marketing-ops/event-platform/utils/drag";

/** The cell a drag is over: a track column and a slot, and the section when over one. */
export type OverCell = { trackId: string; slot: number; sectionId?: string } | null;

// The unscheduled palette and the active day's board, from the event's one
// session list. "On the board" means placed on that day, in a slot or a
// section — a session whose day is set but whose slot and section were cleared
// (a deleted track mid-fan-out) is on neither.
export function splitSessions(
  sessions: readonly Session[],
  activeDayId: string | undefined,
): { palette: Session[]; placed: Session[] } {
  return {
    palette: sessions.filter((s) => s.dayId === null),
    placed: sessions.filter(
      (s) => s.dayId === activeDayId && (s.slotIndex !== null || s.sectionId !== null),
    ),
  };
}

/** A start slot pulled back so `len` slots still fit in a day of `slotCount`. */
export function clampStartSlot(rawSlot: number, len: number, slotCount: number): number {
  return Math.max(0, Math.min(rawSlot, slotCount - len));
}

export type DropOutcome =
  | { kind: "ignored" }
  | { kind: "overlap" }
  | { kind: "place"; placement: Placement };

// What dropping `session` at (trackId, rawSlot, sectionId) on the active day
// does. A regular session outside a section is ignored (the placement handler
// would reject it). A drop that overlaps a placed item is refused: a full-width
// item clashes with anything in its slots; a track item only with items in its
// own track, or with a full-width one.
export function resolveDrop({
  session,
  placed,
  dayId,
  slotCount,
  trackId,
  rawSlot,
  sectionId,
}: {
  session: Session | undefined;
  placed: readonly Session[];
  dayId: string | undefined;
  slotCount: number;
  trackId: string | null;
  rawSlot: number;
  sectionId?: string | null;
}): DropOutcome {
  if (!dayId || !session) return { kind: "ignored" };
  const len = Math.min(session.durationSlots, slotCount);
  const slot = clampStartSlot(rawSlot, len, slotCount);

  if (isNoopDrop(session, sectionId)) return { kind: "ignored" };

  const isFullWidth = isFullWidthSession(session);
  const conflict = placed.some((other) => {
    if (other.id === session.id || other.slotIndex === null) return false;
    const overlaps = slot < other.slotIndex + other.durationSlots && other.slotIndex < slot + len;
    if (!overlaps) return false;
    return isFullWidth || isFullWidthKind(other.kind) || other.trackId === trackId;
  });
  if (conflict) return { kind: "overlap" };

  return {
    kind: "place",
    placement: { dayId, trackId, slotIndex: slot, sectionId: sectionId ?? null },
  };
}

// Whether (trackId, slot) lights up as a drop target. Same predicate the drop
// uses: a drop that would be ignored does not advertise itself. A full-width
// item lights its slots across every track.
export function isCellHighlighted(
  overCell: OverCell,
  dragging: Session | null | undefined,
  trackId: string,
  slot: number,
  slotCount: number,
): boolean {
  if (!overCell) return false;
  if (dragging && isNoopDrop(dragging, overCell.sectionId)) return false;
  const len = dragging ? Math.min(dragging.durationSlots, slotCount - overCell.slot) : 1;
  const inSpan = slot >= overCell.slot && slot < overCell.slot + len;
  if (dragging && isFullWidthSession(dragging)) return inSpan;
  return trackId === overCell.trackId && inSpan;
}
