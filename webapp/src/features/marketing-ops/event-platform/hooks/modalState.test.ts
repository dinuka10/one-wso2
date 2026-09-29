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
  Session,
  Track,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  INITIAL_MODALS_STATE,
  editorModalsReducer,
  modalTargets,
  type EditorModalsState,
  type ModalData,
} from "./modalState";

const session = (id: string, over: Partial<Session> = {}) =>
  ({
    id,
    kind: "session",
    trackId: "t1",
    slotIndex: 0,
    sectionId: null,
    dayId: "d1",
    ...over,
  }) as Session;
const track = (id: string) => ({ id }) as Track;
const section = (id: string, over: Partial<TrackSection> = {}) =>
  ({ id, kind: "track", trackId: "t1", dayId: "d1", startSlot: 0, durationSlots: 6, ...over }) as TrackSection;

const data: ModalData = {
  sessions: [
    session("s1"),
    session("s2", { sectionId: "sec-1" }),
    session("s3", { slotIndex: null }),
    session("s4", { kind: "keynote" }),
  ],
  tracks: [track("t1"), track("t2")],
  sections: [section("sec-1"), section("sec-2"), section("sec-3", { trackId: "t2" })],
  keynoteSections: [section("key-1", { kind: "keynote", trackId: null })],
  placed: [session("s1"), session("s2", { sectionId: "sec-1" })],
};

const open = (modal: NonNullable<EditorModalsState["modal"]>) =>
  editorModalsReducer(INITIAL_MODALS_STATE, { type: "open", modal });

describe("editorModalsReducer", () => {
  it("opens one dialog at a time and closes it", () => {
    const state = editorModalsReducer(open({ kind: "add-item" }), {
      type: "open",
      modal: { kind: "add-track" },
    });
    expect(state.modal).toEqual({ kind: "add-track" });
    expect(editorModalsReducer(state, { type: "close" }).modal).toBeNull();
  });

  it("anchors and clears the remove popover", () => {
    const anchorEl = {} as HTMLElement;
    const state = editorModalsReducer(INITIAL_MODALS_STATE, {
      type: "openRemovePopover",
      anchorEl,
      sessionId: "s1",
    });
    expect(state.removePopover).toEqual({ anchorEl, sessionId: "s1" });
    expect(editorModalsReducer(state, { type: "closeRemovePopover" }).removePopover).toBeNull();
  });

  it("toggles the CSV import", () => {
    const state = editorModalsReducer(INITIAL_MODALS_STATE, { type: "setSessionCsvOpen", open: true });
    expect(state.sessionCsvOpen).toBe(true);
  });

  it("hands the preview over to the edit dialog", () => {
    const previewing = editorModalsReducer(INITIAL_MODALS_STATE, { type: "openPreview", sessionId: "s1" });
    const state = editorModalsReducer(previewing, { type: "editFromPreview" });
    expect(state.previewSessionId).toBeNull();
    expect(state.modal).toEqual({ kind: "edit-item", itemId: "s1" });
  });

  it("hands the preview over to the artifact editor", () => {
    const previewing = editorModalsReducer(INITIAL_MODALS_STATE, { type: "openPreview", sessionId: "s1" });
    const state = editorModalsReducer(previewing, { type: "artifactsFromPreview" });
    expect(state.previewSessionId).toBeNull();
    expect(state.artifactSessionId).toBe("s1");
    expect(editorModalsReducer(state, { type: "closeArtifactEdit" }).artifactSessionId).toBeNull();
  });

  it("does nothing on a hand-off with no preview open", () => {
    expect(editorModalsReducer(INITIAL_MODALS_STATE, { type: "editFromPreview" })).toBe(
      INITIAL_MODALS_STATE,
    );
  });
});

describe("modalTargets", () => {
  it("finds nothing while no dialog is open", () => {
    const targets = modalTargets(INITIAL_MODALS_STATE, data);
    expect(targets.editItem).toBeUndefined();
    expect(targets.deleteTrackCount).toBe(0);
    expect(targets.editSectionSiblings).toEqual([]);
    expect(targets.editSectionSessions).toEqual([]);
    expect(targets.deleteSectionSessions).toEqual([]);
  });

  it("looks the edited session up by id", () => {
    expect(modalTargets(open({ kind: "edit-item", itemId: "s2" }), data).editItem?.id).toBe("s2");
    expect(modalTargets(open({ kind: "edit-item", itemId: "gone" }), data).editItem).toBeUndefined();
  });

  it("counts every scheduled item a track delete unschedules, whatever its kind", () => {
    const targets = modalTargets(open({ kind: "delete-track", trackId: "t1" }), data);
    expect(targets.deleteTrack?.id).toBe("t1");
    // s1, s2 and the keynote s4 carry t1; s3 has no slot.
    expect(targets.deleteTrackCount).toBe(3);
  });

  it("checks a track section against its own track's sections and the keynote sections", () => {
    const targets = modalTargets(open({ kind: "edit-section", sectionId: "sec-1" }), data);
    expect(targets.editSection?.id).toBe("sec-1");
    expect(targets.editSectionSiblings.map((s) => s.id)).toEqual(["sec-1", "sec-2", "key-1"]);
    expect(targets.editSectionSessions.map((s) => s.id)).toEqual(["s2"]);
  });

  it("checks a keynote section against every section of the day", () => {
    const targets = modalTargets(open({ kind: "edit-section", sectionId: "key-1" }), data);
    expect(targets.editSectionSiblings.map((s) => s.id)).toEqual(["key-1", "sec-1", "sec-2", "sec-3"]);
  });

  it("lists the placed sessions a section delete unschedules", () => {
    const targets = modalTargets(open({ kind: "delete-section", sectionId: "sec-1" }), data);
    expect(targets.deleteSection?.id).toBe("sec-1");
    expect(targets.deleteSectionSessions.map((s) => s.id)).toEqual(["s2"]);
  });

  it("resolves the preview and artifact sessions", () => {
    const state = { ...INITIAL_MODALS_STATE, previewSessionId: "s1", artifactSessionId: "s4" };
    const targets = modalTargets(state, data);
    expect(targets.previewSession?.id).toBe("s1");
    expect(targets.artifactSession?.id).toBe("s4");
  });
});
