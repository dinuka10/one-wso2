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


// Drop-target rules for the agenda board's native HTML5 drag and drop.

import type { DragEvent } from "react";
import type { Session } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { isFullWidthKind } from "@features/marketing-ops/event-platform/utils/agenda";

/** onDragOver handler that marks a target as accepting a move. */
export const allowDrop = (e: DragEvent): void => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
};

export const isFullWidthSession = (s: Pick<Session, "kind">): boolean => isFullWidthKind(s.kind);

// Regular sessions can only live inside a section: the placement handler
// ignores every other drop, so those targets must not show a drop affordance.
export const isNoopDrop = (s: Pick<Session, "kind">, sectionId?: string | null): boolean =>
  !isFullWidthSession(s) && !sectionId;
