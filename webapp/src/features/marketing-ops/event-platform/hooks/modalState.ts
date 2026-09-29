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

// Which of the session editor's dialogs, drawers and popovers is open, as a
// reducer, and what each one is about, as a selector. The source kept six
// useStates in useModalState; one reducer makes the hand-offs (preview → edit,
// preview → artifacts) single transitions that can be tested.
//
// Sessions, tracks and sections are held by id and looked up on read, so a
// dialog always shows the cached entity as it is now, and one whose entity has
// gone (deleted elsewhere, or by an optimistic write) simply closes.

import type {
  Session,
  Track,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";

export type SectionKind = TrackSection["kind"];

export type ModalState =
  | { kind: "add-item" }
  | { kind: "edit-item"; itemId: string }
  | { kind: "add-track" }
  | { kind: "edit-track"; trackId: string }
  | { kind: "delete-track"; trackId: string }
  | { kind: "delete-session"; sessionId: string }
  | { kind: "add-section"; trackId: string; sectionKind: SectionKind }
  | { kind: "edit-section"; sectionId: string }
  | { kind: "delete-section"; sectionId: string }
  | null;

export interface EditorModalsState {
  // At most one dialog at a time.
  modal: ModalState;
  // "Move back to Unscheduled?" — anchored to the card's remove button.
  removePopover: { anchorEl: HTMLElement; sessionId: string } | null;
  sessionCsvOpen: boolean;
  previewSessionId: string | null;
  artifactSessionId: string | null;
}

export const INITIAL_MODALS_STATE: EditorModalsState = {
  modal: null,
  removePopover: null,
  sessionCsvOpen: false,
  previewSessionId: null,
  artifactSessionId: null,
};

export type EditorModalsAction =
  | { type: "open"; modal: NonNullable<ModalState> }
  | { type: "close" }
  | { type: "openRemovePopover"; anchorEl: HTMLElement; sessionId: string }
  | { type: "closeRemovePopover" }
  | { type: "setSessionCsvOpen"; open: boolean }
  | { type: "openPreview"; sessionId: string }
  | { type: "closePreview" }
  | { type: "editFromPreview" }
  | { type: "artifactsFromPreview" }
  | { type: "closeArtifactEdit" };

export function editorModalsReducer(
  state: EditorModalsState,
  action: EditorModalsAction,
): EditorModalsState {
  switch (action.type) {
    case "open":
      return { ...state, modal: action.modal };
    case "close":
      return { ...state, modal: null };
    case "openRemovePopover":
      return { ...state, removePopover: { anchorEl: action.anchorEl, sessionId: action.sessionId } };
    case "closeRemovePopover":
      return { ...state, removePopover: null };
    case "setSessionCsvOpen":
      return { ...state, sessionCsvOpen: action.open };
    case "openPreview":
      return { ...state, previewSessionId: action.sessionId };
    case "closePreview":
      return { ...state, previewSessionId: null };
    // The drawer's two buttons swap it for a dialog about the same session.
    case "editFromPreview":
      return state.previewSessionId
        ? { ...state, previewSessionId: null, modal: { kind: "edit-item", itemId: state.previewSessionId } }
        : state;
    case "artifactsFromPreview":
      return state.previewSessionId
        ? { ...state, previewSessionId: null, artifactSessionId: state.previewSessionId }
        : state;
    case "closeArtifactEdit":
      return { ...state, artifactSessionId: null };
  }
}

export interface ModalData {
  sessions: readonly Session[];
  tracks: readonly Track[];
  sections: readonly TrackSection[];
  keynoteSections: readonly TrackSection[];
  // The active day's board (splitSessions).
  placed: readonly Session[];
}

export interface ModalTargets {
  editItem?: Session;
  editTrack?: Track;
  deleteTrack?: Track;
  // The scheduled sessions a track delete sends back to the palette, for the
  // confirmation's wording.
  deleteTrackCount: number;
  deleteSession?: Session;
  editSection?: TrackSection;
  // The sections an edited one must not overlap: its siblings in the same
  // track, or the day's other keynote sections.
  editSectionSiblings: TrackSection[];
  deleteSection?: TrackSection;
  deleteSectionSessions: Session[];
  previewSession?: Session;
  artifactSession?: Session;
}

export function modalTargets(state: EditorModalsState, data: ModalData): ModalTargets {
  const { modal } = state;
  const sessionById = (id: string | null) =>
    id ? data.sessions.find((s) => s.id === id) : undefined;
  const allSections = [...data.sections, ...data.keynoteSections];

  const editSection =
    modal?.kind === "edit-section" ? allSections.find((s) => s.id === modal.sectionId) : undefined;
  const deleteSection =
    modal?.kind === "delete-section" ? allSections.find((s) => s.id === modal.sectionId) : undefined;

  return {
    editItem: modal?.kind === "edit-item" ? sessionById(modal.itemId) : undefined,
    editTrack: modal?.kind === "edit-track" ? data.tracks.find((t) => t.id === modal.trackId) : undefined,
    deleteTrack:
      modal?.kind === "delete-track" ? data.tracks.find((t) => t.id === modal.trackId) : undefined,
    deleteTrackCount:
      modal?.kind === "delete-track"
        ? data.sessions.filter(
            (s) => s.kind === "session" && s.trackId === modal.trackId && s.slotIndex !== null,
          ).length
        : 0,
    deleteSession: modal?.kind === "delete-session" ? sessionById(modal.sessionId) : undefined,
    editSection,
    editSectionSiblings: editSection
      ? editSection.kind === "keynote"
        ? [...data.keynoteSections]
        : data.sections.filter((s) => s.trackId === editSection.trackId)
      : [],
    deleteSection,
    deleteSectionSessions: deleteSection
      ? data.placed.filter((s) => s.sectionId === deleteSection.id)
      : [],
    previewSession: sessionById(state.previewSessionId),
    artifactSession: sessionById(state.artifactSessionId),
  };
}
