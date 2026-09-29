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

// The session editor's open dialogs, over the reducer in ./modalState. The
// named openers are what the board, the palette and the modals call.

import { useReducer, type MouseEvent } from "react";
import {
  INITIAL_MODALS_STATE,
  editorModalsReducer,
  modalTargets,
  type ModalData,
  type SectionKind,
} from "@features/marketing-ops/event-platform/hooks/modalState";

export function useModalState(data: ModalData) {
  const [state, dispatch] = useReducer(editorModalsReducer, INITIAL_MODALS_STATE);

  return {
    modal: state.modal,
    removePopover: state.removePopover,
    sessionCsvOpen: state.sessionCsvOpen,
    ...modalTargets(state, data),

    closeModal: () => dispatch({ type: "close" }),
    openAddItem: () => dispatch({ type: "open", modal: { kind: "add-item" } }),
    openEditItem: (itemId: string) => dispatch({ type: "open", modal: { kind: "edit-item", itemId } }),
    openAddTrack: () => dispatch({ type: "open", modal: { kind: "add-track" } }),
    openEditTrack: (trackId: string) =>
      dispatch({ type: "open", modal: { kind: "edit-track", trackId } }),
    openDeleteTrack: (trackId: string) =>
      dispatch({ type: "open", modal: { kind: "delete-track", trackId } }),
    openDeleteSession: (sessionId: string) =>
      dispatch({ type: "open", modal: { kind: "delete-session", sessionId } }),
    openAddSection: (trackId: string, sectionKind: SectionKind) =>
      dispatch({ type: "open", modal: { kind: "add-section", trackId, sectionKind } }),
    openEditSection: (sectionId: string) =>
      dispatch({ type: "open", modal: { kind: "edit-section", sectionId } }),
    openDeleteSection: (sectionId: string) =>
      dispatch({ type: "open", modal: { kind: "delete-section", sectionId } }),

    openRemovePopover: (e: MouseEvent<HTMLButtonElement>, sessionId: string) =>
      dispatch({ type: "openRemovePopover", anchorEl: e.currentTarget, sessionId }),
    closeRemovePopover: () => dispatch({ type: "closeRemovePopover" }),

    openSessionCsv: () => dispatch({ type: "setSessionCsvOpen", open: true }),
    closeSessionCsv: () => dispatch({ type: "setSessionCsvOpen", open: false }),

    openPreview: (sessionId: string) => dispatch({ type: "openPreview", sessionId }),
    closePreview: () => dispatch({ type: "closePreview" }),
    editFromPreview: () => dispatch({ type: "editFromPreview" }),
    artifactsFromPreview: () => dispatch({ type: "artifactsFromPreview" }),
    closeArtifactEdit: () => dispatch({ type: "closeArtifactEdit" }),
  };
}

export type ModalStateApi = ReturnType<typeof useModalState>;
