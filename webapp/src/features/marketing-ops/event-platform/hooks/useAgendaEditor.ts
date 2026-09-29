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

// Everything the session editor reads and writes for one event: its days, the
// active day's tracks, sections and footnotes, the event's sessions split into
// palette and board, and the actions behind a drop or a form save.
//
// The optimistic cache work (a drop landing at once, a track delete unplacing
// its sessions) lives in the api/ hooks; this hook only decides what to send.

import { useState } from "react";
import { useEvent } from "@features/marketing-ops/event-platform/api/event";
import {
  useCreateSession,
  useDeleteSession,
  useListSessions,
  useUpdateArtifacts,
  useUpdatePlacement,
  useUpdateSession,
} from "@features/marketing-ops/event-platform/api/sessions";
import {
  useCreateTrack,
  useDeleteTrack,
  useListTracks,
  useUpdateTrack,
} from "@features/marketing-ops/event-platform/api/tracks";
import {
  useCreateKeynoteSection,
  useCreateTrackSection,
  useDeleteTrackSection,
  useListAllTrackSections,
  useListKeynoteSections,
  useUpdateTrackSection,
} from "@features/marketing-ops/event-platform/api/trackSections";
import {
  useCreateFootnote,
  useDeleteFootnote,
  useListFootnotes,
  useUpdateFootnote,
} from "@features/marketing-ops/event-platform/api/footnotes";
import { UNPLACED } from "@features/marketing-ops/event-platform/api/cacheUpdates";
import { useNotifyFailure } from "@features/marketing-ops/event-platform/api/base";
import type { SessionArtifact } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { slotCountOf } from "@features/marketing-ops/event-platform/utils/agenda";
import {
  durationSlotsOf,
  editPlacement,
  formPlacement,
  sessionFieldsOf,
  type ItemFormValues,
} from "@features/marketing-ops/event-platform/components/sessions/itemForm";
import {
  resolveDrop,
  splitSessions,
} from "@features/marketing-ops/event-platform/hooks/agendaPlacement";

export function useAgendaEditor(eventId: string) {
  const {
    data: event,
    isLoading: eventLoading,
    isError: eventError,
    error: eventLoadError,
    isRefetching: eventRefetching,
    refetch: refetchEvent,
  } = useEvent(eventId);
  // One list for the whole event, split below into palette and board. The
  // source listed every event's sessions here (see SessionFilters).
  const { data: sessions = [], isFetching: sessionsLoading } = useListSessions({ configId: eventId });
  const [activeId, setActiveId] = useState<string>("");

  const notifyFailure = useNotifyFailure();
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const updateArtifacts = useUpdateArtifacts();
  const deleteSession = useDeleteSession();
  const updatePlacement = useUpdatePlacement();
  const createTrack = useCreateTrack();
  const updateTrack = useUpdateTrack();
  const deleteTrack = useDeleteTrack();

  const days = event?.days ?? [];
  const activeDay = days.find((d) => d.id === activeId) ?? days[0];
  const { data: tracks = [], isLoading: tracksLoading } = useListTracks(activeDay?.id);
  const sections = useListAllTrackSections(tracks);
  const { data: keynoteSections = [] } = useListKeynoteSections(activeDay?.id);
  const createSection = useCreateTrackSection();
  const createKeynoteSection = useCreateKeynoteSection();
  const updateSection = useUpdateTrackSection();
  const deleteSection = useDeleteTrackSection();
  const { data: footnotes = [] } = useListFootnotes(activeDay?.id ?? null);
  const createFootnote = useCreateFootnote(activeDay?.id ?? "");
  const updateFootnote = useUpdateFootnote(activeDay?.id ?? "");
  const deleteFootnote = useDeleteFootnote(activeDay?.id ?? "");

  const slotCount = activeDay ? slotCountOf(activeDay) : 0;
  const slots = Array.from({ length: slotCount }, (_, i) => i);
  const { palette, placed } = splitSessions(sessions, activeDay?.id);

  // Returns true when the drop was refused for overlapping, so the page can
  // say so; an ignored drop (a session outside a section) returns false.
  const place = (
    id: string,
    trackId: string | null,
    rawSlot: number,
    sectionId?: string | null,
  ): boolean => {
    const outcome = resolveDrop({
      session: sessions.find((s) => s.id === id),
      placed,
      dayId: activeDay?.id,
      slotCount,
      trackId,
      rawSlot,
      sectionId,
    });
    if (outcome.kind === "place") updatePlacement.mutate({ id, ...outcome.placement });
    return outcome.kind === "overlap";
  };

  const unplace = (id: string) => updatePlacement.mutate({ id, ...UNPLACED });

  // The create and update hooks raise no toast of their own (the source left
  // failures to a global 403-only handler), so the dialog's save says why it
  // stayed open.
  const handleAddItem = (form: ItemFormValues, onSuccess: () => void) => {
    if (!event) return;
    const durationSlots = durationSlotsOf(form);
    const placement = formPlacement(form, days, durationSlots);
    createSession.mutate(
      {
        configId: event.id,
        ...sessionFieldsOf(form, durationSlots),
        ...(placement ?? { dayId: null, trackId: null, slotIndex: null }),
      },
      {
        onSuccess,
        onError: (err) => notifyFailure("Couldn't add the item.", err),
      },
    );
  };

  // The PATCH and the placement PUT go out together, as in the source: the
  // PUT is optimistic and reverts on its own if it fails.
  const handleEditItem = (itemId: string, form: ItemFormValues, onSuccess: () => void) => {
    const durationSlots = durationSlotsOf(form);
    updateSession.mutate(
      { id: itemId, ...sessionFieldsOf(form, durationSlots) },
      {
        onSuccess,
        onError: (err) => notifyFailure("Couldn't save the item.", err),
      },
    );
    const existing = sessions.find((s) => s.id === itemId);
    const placement = editPlacement(existing, form, days, durationSlots);
    if (placement) updatePlacement.mutate({ id: itemId, ...placement });
  };

  const handleDeleteTrack = (trackId: string) => {
    if (!activeDay) return;
    deleteTrack.mutate({ id: trackId, dayId: activeDay.id });
  };

  const handleSaveArtifacts = (id: string, artifacts: SessionArtifact[], onSuccess: () => void) => {
    updateArtifacts.mutate(
      { id, artifacts },
      {
        onSuccess,
        onError: (err) => notifyFailure("Couldn't save the artifacts.", err),
      },
    );
  };

  const addFootnote = (slotIndex: number, text: string) => {
    if (!activeDay) return;
    createFootnote.mutate({ slotIndex, text });
  };

  const editFootnote = (id: string, text: string) => {
    if (!activeDay) return;
    updateFootnote.mutate({ id, text });
  };

  const removeFootnote = (id: string) => {
    if (!activeDay) return;
    deleteFootnote.mutate({ id });
  };

  const footnotesPending = createFootnote.isPending || updateFootnote.isPending;

  // While anything is in flight the grid stops taking drops, so a second drop
  // can't be resolved against a board the first one is still changing.
  const isBusy =
    sessionsLoading ||
    tracksLoading ||
    createTrack.isPending ||
    updateTrack.isPending ||
    deleteTrack.isPending ||
    updatePlacement.isPending ||
    createSession.isPending ||
    updateSession.isPending ||
    deleteSession.isPending ||
    createSection.isPending ||
    createKeynoteSection.isPending ||
    updateSection.isPending ||
    deleteSection.isPending;

  return {
    event,
    eventLoading,
    eventError,
    eventLoadError,
    eventRefetching,
    refetchEvent,
    sessions,
    sessionsLoading,
    days,
    activeDay,
    setActiveId,
    tracks,
    tracksLoading,
    sections,
    keynoteSections,
    slotCount,
    slots,
    palette,
    placed,
    place,
    unplace,
    handleAddItem,
    handleEditItem,
    handleDeleteTrack,
    handleSaveArtifacts,
    createSession,
    updateSession,
    deleteSession,
    updatePlacement,
    updateArtifacts,
    createTrack,
    updateTrack,
    deleteTrack,
    createSection,
    createKeynoteSection,
    updateSection,
    deleteSection,
    footnotes,
    addFootnote,
    editFootnote,
    removeFootnote,
    footnotesPending,
    isBusy,
  };
}

export type AgendaEditor = ReturnType<typeof useAgendaEditor>;
