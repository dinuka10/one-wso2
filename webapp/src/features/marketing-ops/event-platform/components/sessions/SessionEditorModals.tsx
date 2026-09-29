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

import { Box, Button, Popover, Typography } from "@wso2/oxygen-ui";
import ConfirmationDialog, {
  type ConfirmationContent,
} from "@components/confirmation-dialog/ConfirmationDialog";
import { useNotifyFailure } from "@features/marketing-ops/event-platform/api/base";
import TrackNameDialog from "@features/marketing-ops/event-platform/components/tracks/TrackNameDialog";
import TrackSectionDialog from "@features/marketing-ops/event-platform/components/tracks/TrackSectionDialog";
import type { AgendaEditor } from "@features/marketing-ops/event-platform/hooks/useAgendaEditor";
import type { ModalStateApi } from "@features/marketing-ops/event-platform/hooks/useModalState";
import { trackLabel } from "@features/marketing-ops/event-platform/utils/agenda";
import { stripHtmlTags } from "@features/marketing-ops/event-platform/utils/sanitizeHtml";
import ArtifactEditDialog from "./ArtifactEditDialog";
import ItemFormDialog from "./ItemFormDialog";
import SessionCsvImportDialog from "./SessionCsvImportDialog";
import SessionPreviewDrawer from "./SessionPreviewDrawer";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Every dialog, drawer and popover the session editor opens, driven by the
// modal state. Each one mounts only while open, so its form starts from the
// entity as it is at that moment.
export default function SessionEditorModals({
  editor,
  modalState,
}: {
  editor: AgendaEditor;
  modalState: ModalStateApi;
}) {
  const notifyFailure = useNotifyFailure();
  const { event, days, activeDay, sections, keynoteSections } = editor;
  const {
    modal,
    closeModal,
    editItem,
    editTrack,
    deleteTrack,
    deleteTrackCount,
    deleteSession,
    editSection,
    editSectionSiblings,
    deleteSection,
    deleteSectionSessions,
    removePopover,
  } = modalState;
  const configId = event?.id ?? "";
  const linkConfig = {
    articleLinksEnabled: event?.articleLinksEnabled ?? false,
    videoLinksEnabled: event?.videoLinksEnabled ?? false,
  };

  // The three deletes share one confirmation. ConfirmationDialog closes on
  // confirm; the deletes are optimistic, so the board has already changed.
  let confirmation: ConfirmationContent | null = null;
  if (modal?.kind === "delete-track" && deleteTrack) {
    confirmation = {
      title: "Delete track",
      text: deleteTrackCount
        ? `Delete "${trackLabel(deleteTrack)}"? Its ${plural(deleteTrackCount, "scheduled session")} will return to Unscheduled.`
        : `Delete "${trackLabel(deleteTrack)}"? It has no scheduled sessions.`,
      confirmLabel: "Delete",
      confirmAction: () => editor.handleDeleteTrack(deleteTrack.id),
    };
  } else if (modal?.kind === "delete-session" && deleteSession) {
    confirmation = {
      title: "Delete session",
      text: `Delete "${stripHtmlTags(deleteSession.title)}"?`,
      confirmLabel: "Delete",
      confirmAction: () => editor.deleteSession.mutate(deleteSession.id),
    };
  } else if (modal?.kind === "delete-section" && deleteSection) {
    confirmation = {
      title: "Delete section",
      text: deleteSectionSessions.length
        ? `Delete "${deleteSection.label}"? Its ${plural(deleteSectionSessions.length, "session")} will return to Unscheduled.`
        : `Delete "${deleteSection.label}"?`,
      confirmLabel: "Delete",
      confirmAction: () =>
        editor.deleteSection.mutate({
          id: deleteSection.id,
          trackId: deleteSection.trackId,
          dayId: deleteSection.dayId,
          sessionIds: deleteSectionSessions.map((s) => s.id),
        }),
    };
  }

  return (
    <>
      {modal?.kind === "add-item" && (
        <ItemFormDialog
          days={days}
          configId={configId}
          config={linkConfig}
          isPending={editor.createSession.isPending}
          onSave={(form) => editor.handleAddItem(form, closeModal)}
          onCancel={closeModal}
        />
      )}
      {modal?.kind === "edit-item" && editItem && (
        <ItemFormDialog
          days={days}
          initialItem={editItem}
          configId={configId}
          config={linkConfig}
          isPending={editor.updateSession.isPending}
          onSave={(form) => editor.handleEditItem(editItem.id, form, closeModal)}
          onCancel={closeModal}
        />
      )}
      {modal?.kind === "add-track" && (
        <TrackNameDialog
          title="Add track"
          configId={configId}
          confirmLabel="Add"
          isPending={editor.createTrack.isPending}
          onConfirm={(colorToken, roomId) => {
            if (!activeDay) return;
            // The create hook raises its own failure toast.
            editor.createTrack.mutate({ dayId: activeDay.id, colorToken, roomId }, { onSuccess: closeModal });
          }}
          onCancel={closeModal}
        />
      )}
      {modal?.kind === "edit-track" && editTrack && (
        <TrackNameDialog
          title="Edit track"
          configId={configId}
          initialColorToken={editTrack.colorToken}
          initialRoomId={editTrack.roomId}
          confirmLabel="Save"
          isPending={editor.updateTrack.isPending}
          onConfirm={(colorToken, roomId) => {
            if (!activeDay) return;
            editor.updateTrack.mutate(
              { id: editTrack.id, dayId: activeDay.id, colorToken, roomId },
              {
                onSuccess: closeModal,
                onError: (err) => notifyFailure("Couldn't save the track.", err),
              },
            );
          }}
          onCancel={closeModal}
        />
      )}
      {modal?.kind === "add-section" && activeDay && modal.sectionKind === "track" && (
        <TrackSectionDialog
          title="Add Track Section"
          activeDay={activeDay}
          trackId={modal.trackId}
          configId={configId}
          existingSections={sections.filter((s) => s.trackId === modal.trackId)}
          isPending={editor.createSection.isPending}
          onConfirm={(input) =>
            editor.createSection.mutate({ ...input, trackId: modal.trackId }, { onSuccess: closeModal })
          }
          onCancel={closeModal}
        />
      )}
      {modal?.kind === "add-section" && activeDay && modal.sectionKind === "keynote" && (
        <TrackSectionDialog
          title="Add Keynote Section"
          activeDay={activeDay}
          trackId={null}
          configId={configId}
          existingSections={keynoteSections}
          isPending={editor.createKeynoteSection.isPending}
          onConfirm={(input) =>
            editor.createKeynoteSection.mutate({ ...input, dayId: activeDay.id }, { onSuccess: closeModal })
          }
          onCancel={closeModal}
        />
      )}
      {modal?.kind === "edit-section" && activeDay && editSection && (
        <TrackSectionDialog
          title={editSection.kind === "keynote" ? "Edit Keynote Section" : "Edit Track Section"}
          activeDay={activeDay}
          trackId={editSection.trackId}
          configId={configId}
          existingSections={editSectionSiblings}
          initialSection={editSection}
          isPending={editor.updateSection.isPending}
          onConfirm={(input) =>
            editor.updateSection.mutate(
              { id: editSection.id, trackId: editSection.trackId, dayId: editSection.dayId, ...input },
              { onSuccess: closeModal },
            )
          }
          onCancel={closeModal}
        />
      )}
      <ConfirmationDialog content={confirmation} onClose={closeModal} />

      <Popover
        open={Boolean(removePopover)}
        anchorEl={removePopover?.anchorEl ?? null}
        onClose={modalState.closeRemovePopover}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { mt: 0.5 } } }}
      >
        <Box sx={{ p: 2, maxWidth: 200 }}>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Move back to Unscheduled?
          </Typography>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button size="small" onClick={modalState.closeRemovePopover}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                if (removePopover) editor.unplace(removePopover.sessionId);
                modalState.closeRemovePopover();
              }}
            >
              Remove
            </Button>
          </Box>
        </Box>
      </Popover>

      {modalState.sessionCsvOpen && event && (
        <SessionCsvImportDialog configId={event.id} open onClose={modalState.closeSessionCsv} />
      )}
      <SessionPreviewDrawer
        session={modalState.previewSession}
        activeDay={activeDay}
        onClose={modalState.closePreview}
        onEdit={modalState.editFromPreview}
        onEditArtifacts={modalState.artifactsFromPreview}
      />
      <ArtifactEditDialog
        key={modalState.artifactSession?.id ?? "closed"}
        open={modalState.artifactSession !== undefined}
        session={modalState.artifactSession ?? null}
        artifactLabels={event?.artifactLabels ?? []}
        isPending={editor.updateArtifacts.isPending}
        onSave={(artifacts) => {
          const session = modalState.artifactSession;
          if (session) editor.handleSaveArtifacts(session.id, artifacts, modalState.closeArtifactEdit);
        }}
        onClose={modalState.closeArtifactEdit}
      />
    </>
  );
}
