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

import { useParams } from "react-router";
import { Box, Button, CircularProgress } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import AgendaBoard from "../components/agenda/AgendaBoard";
import SessionEditorModals from "../components/sessions/SessionEditorModals";
import UnscheduledPanel from "../components/sessions/UnscheduledPanel";
import { useAgendaEditor } from "../hooks/useAgendaEditor";
import { useDragDrop } from "../hooks/useDragDrop";
import { useModalState } from "../hooks/useModalState";
import { dayOptionLabel } from "../utils/agenda";

// Sessions → Agenda: the drag-and-drop agenda editor for one event. A day
// picker and "+ Track" above; the unscheduled palette and the day's board
// side by side below, each scrolling on its own.
export default function SessionEditorPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const { showWarning } = useNotifications();
  const editor = useAgendaEditor(eventId);
  const drag = useDragDrop(editor.sessions, editor.slotCount);
  const modalState = useModalState({
    sessions: editor.sessions,
    tracks: editor.tracks,
    sections: editor.sections,
    keynoteSections: editor.keynoteSections,
    placed: editor.placed,
  });

  if (editor.eventLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  // The shell's "All events" link is the way back, so only a retry here.
  if (editor.eventError && !editor.event) {
    return (
      <ErrorNotice
        error={editor.eventLoadError}
        onRetry={() => void editor.refetchEvent()}
        retrying={editor.eventRefetching}
      >
        Couldn&apos;t load this event.
      </ErrorNotice>
    );
  }

  const { event, days, activeDay } = editor;
  const paletteIds = new Set(editor.palette.map((s) => s.id));

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        // The board scrolls inside a fixed frame so its sticky track headers
        // and time column hold while it scrolls; the frame fills what the
        // shell's header and tab rows leave of the viewport.
        height: "calc(100dvh - 280px)",
        minHeight: 480,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          pb: 2,
        }}
      >
        <Box role="group" aria-label="Day" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
          {days.map((day, i) => (
            <Button
              key={day.id}
              size="small"
              variant={day.id === activeDay?.id ? "contained" : "outlined"}
              aria-pressed={day.id === activeDay?.id}
              disableElevation
              onClick={() => editor.setActiveId(day.id)}
            >
              {dayOptionLabel(day, i)}
            </Button>
          ))}
        </Box>
        {activeDay && (
          <Button size="small" variant="outlined" onClick={modalState.openAddTrack}>
            + Track
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: "flex", gap: 2.5, alignItems: "stretch", overflow: "hidden" }}>
        <UnscheduledPanel
          palette={editor.palette}
          onAdd={modalState.openAddItem}
          onImportCsv={modalState.openSessionCsv}
          onDragStart={drag.onDragStart}
          onDragEnd={drag.clearOver}
          // A palette card dropped back on the palette is already unscheduled;
          // the source sent a placement PUT for it anyway.
          onUnplace={(id) => {
            if (id && !paletteIds.has(id)) editor.unplace(id);
          }}
          onEdit={modalState.openEditItem}
          onDelete={modalState.openDeleteSession}
          onClearOverCell={() => drag.setOverCell(null)}
          wasDragging={drag.wasDragging}
        />
        <AgendaBoard
          tracks={editor.tracks}
          tracksLoading={editor.tracksLoading}
          slots={editor.slots}
          slotCount={editor.slotCount}
          sessions={editor.sessions}
          placed={editor.placed}
          activeDay={activeDay}
          overCell={drag.overCell}
          isCellHighlighted={drag.isCellHighlighted}
          onDragStart={drag.onDragStart}
          onDragEnd={drag.clearOver}
          setOverCell={drag.setOverCell}
          place={(id, trackId, slot, sectionId) => {
            if (editor.place(id, trackId, slot, sectionId)) {
              showWarning("Sessions overlap — move it back to Unscheduled first.");
            }
          }}
          onEdit={modalState.openPreview}
          onRemove={modalState.openRemovePopover}
          onEditTrack={modalState.openEditTrack}
          onDeleteTrack={modalState.openDeleteTrack}
          sections={editor.sections}
          keynoteSections={editor.keynoteSections}
          onAddSection={modalState.openAddSection}
          onEditSection={modalState.openEditSection}
          onDeleteSection={modalState.openDeleteSection}
          sessionsLoading={editor.sessionsLoading}
          isBusy={editor.isBusy}
          articleLinksEnabled={event?.articleLinksEnabled ?? false}
          videoLinksEnabled={event?.videoLinksEnabled ?? false}
          wasDragging={drag.wasDragging}
          footnotes={editor.footnotes}
          onAddFootnote={editor.addFootnote}
          onEditFootnote={editor.editFootnote}
          onDeleteFootnote={editor.removeFootnote}
          footnotesPending={editor.footnotesPending}
        />
      </Box>

      <SessionEditorModals editor={editor} modalState={modalState} />
    </Box>
  );
}
