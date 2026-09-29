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

// Native HTML5 drag and drop for the agenda board: what is being dragged, the
// cell it is over, and whether a click that ends a drag should open the card.

import { useRef, useState, type DragEvent } from "react";
import type { Session } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  isCellHighlighted as cellHighlighted,
  type OverCell,
} from "@features/marketing-ops/event-platform/hooks/agendaPlacement";

export type { OverCell };

export function useDragDrop(sessions: readonly Session[], slotCount: number) {
  const [overCell, setOverCell] = useState<OverCell>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // A drag ends with a click on the card it started from; this ref lets that
  // click be told apart from a real one, which opens the card. A ref, not
  // state: it is read in the click handler of the same event turn.
  const wasDragging = useRef(false);

  const onDragStart = (e: DragEvent, id: string) => {
    wasDragging.current = true;
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };

  const clearOver = () => {
    setOverCell(null);
    setDraggingId(null);
    // Cleared after the click that follows dragend has been dispatched.
    setTimeout(() => {
      wasDragging.current = false;
    }, 0);
  };

  const dragging = draggingId ? sessions.find((s) => s.id === draggingId) : null;
  const isCellHighlighted = (trackId: string, slot: number): boolean =>
    cellHighlighted(overCell, dragging, trackId, slot, slotCount);

  return {
    overCell,
    draggingId,
    wasDragging,
    onDragStart,
    clearOver,
    setOverCell,
    isCellHighlighted,
  };
}
