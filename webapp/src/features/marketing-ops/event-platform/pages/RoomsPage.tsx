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

import { useState } from "react";
import { useParams } from "react-router";
import { useForm } from "react-hook-form";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PencilIcon, PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import ConfirmationDialog, {
  type ConfirmationContent,
} from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useEvent } from "@features/marketing-ops/event-platform/api/event";
import {
  useCreateRoom,
  useDeleteRoom,
  useListRooms,
  useReapplyRooms,
  useUpdateRoom,
} from "@features/marketing-ops/event-platform/api/rooms";
import { useNotifyFailure } from "@features/marketing-ops/event-platform/api/base";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import type { Room } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import RoomMappingTree from "../components/rooms/RoomMappingTree";
import { reapplyResultMessage } from "../components/rooms/roomTree";

interface RoomFormValues {
  name: string;
}

// Mounted fresh for each open (keyed by the room), so its defaults are the
// room being edited rather than whatever the previous open left behind.
function RoomForm({
  initial,
  isPending,
  onSave,
  onClose,
}: {
  initial?: Room;
  isPending: boolean;
  onSave: (values: RoomFormValues) => void;
  onClose: () => void;
}) {
  const { register, handleSubmit, formState } = useForm<RoomFormValues>({
    defaultValues: { name: initial?.name ?? "" },
    mode: "onChange",
  });
  const canSubmit = !isPending && formState.isValid;
  const submit = handleSubmit(({ name }) => onSave({ name: name.trim() }));
  const handleKeyDown = useSubmitShortcut(() => void submit(), canSubmit);

  return (
    <>
      <DialogTitle>{initial ? "Edit room" : "Add room"}</DialogTitle>
      <DialogContent onKeyDown={handleKeyDown} sx={{ pt: "16px !important" }}>
        <TextField
          label="Name"
          required
          autoFocus
          size="small"
          fullWidth
          {...register("name", { validate: (v) => v.trim().length > 0 })}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit} onClick={() => void submit()}>
          {isPending ? <CircularProgress size={16} /> : "Save"}
        </Button>
      </DialogActions>
    </>
  );
}

/** Sessions → Rooms: the event's rooms, and what maps to each. */
export default function RoomsPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const { data: event } = useEvent(eventId);
  const { data: rooms = [], isLoading, isError, error, refetch, isFetching } = useListRooms(eventId);
  const notifyFailure = useNotifyFailure();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  // Optimistic, and raises its own "reverted" toast.
  const deleteRoom = useDeleteRoom();
  const reapplyRooms = useReapplyRooms();

  // `undefined` = closed, `null` = adding, a room = editing it.
  const [editing, setEditing] = useState<Room | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);
  const [reapplyResult, setReapplyResult] = useState<number | null>(null);

  const closeForm = () => setEditing(undefined);

  const handleSave = ({ name }: RoomFormValues) => {
    if (editing) {
      updateRoom.mutate(
        { id: editing.id, name },
        {
          onSuccess: closeForm,
          onError: (err) => notifyFailure("Couldn't save the room.", err),
        },
      );
    } else {
      createRoom.mutate(
        { configId: eventId, name },
        {
          onSuccess: closeForm,
          onError: (err) => notifyFailure("Couldn't add the room.", err),
        },
      );
    }
  };

  const askDelete = (room: Room) =>
    setConfirm({
      title: "Delete room",
      text: `Remove "${room.name}"? Sessions in it fall back to whatever their section, track or the keynote mapping says. This cannot be undone.`,
      confirmLabel: "Delete",
      confirmAction: () => deleteRoom.mutate({ id: room.id, configId: room.configId }),
    });

  const askReapply = () =>
    setConfirm({
      title: "Reapply room mappings",
      text: "Every session without a manually picked room will be reassigned to whatever its section, track or the keynote mapping says. Sessions with a room chosen directly on them are left alone.",
      confirmLabel: "Reapply",
      confirmAction: () =>
        reapplyRooms.mutate(
          { configId: eventId },
          {
            onSuccess: ({ sessionsUpdated }) => setReapplyResult(sessionsUpdated),
            onError: (err) => notifyFailure("Couldn't reapply the room mappings.", err),
          },
        ),
    });

  if (isLoading) {
    return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />;
  }

  if (isError) {
    return (
      <ErrorNotice error={error} onRetry={() => void refetch()} retrying={isFetching}>
        Couldn&apos;t load the rooms.
      </ErrorNotice>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Rooms
        </Typography>
        <Button variant="contained" disableElevation startIcon={<PlusIcon size={16} />} onClick={() => setEditing(null)}>
          Add room
        </Button>
      </Box>

      {rooms.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", my: 6 }}>
          No rooms yet.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell>{room.name}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(room)} aria-label={`Edit ${room.name}`}>
                      <PencilIcon size={16} />
                    </IconButton>
                    <IconButton size="small" onClick={() => askDelete(room)} aria-label={`Delete ${room.name}`}>
                      <Trash2Icon size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {event && (
        <Box sx={{ mt: 5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Room mappings
            </Typography>
            <Button variant="outlined" disabled={reapplyRooms.isPending} onClick={askReapply}>
              {reapplyRooms.isPending ? <CircularProgress size={16} /> : "Reapply to all sessions"}
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sessions take their room from these mappings, so changing one here moves every session it covers. A
            room picked directly on a session stays put.
          </Typography>

          {reapplyResult !== null && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setReapplyResult(null)}>
              {reapplyResultMessage(reapplyResult)}
            </Alert>
          )}

          {rooms.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Add a room first — there is nothing to map to yet.
            </Typography>
          ) : (
            <RoomMappingTree eventId={event.id} days={event.days} rooms={rooms} />
          )}
        </Box>
      )}

      <Dialog open={editing !== undefined} onClose={closeForm} maxWidth="xs" fullWidth>
        {editing !== undefined && (
          <RoomForm
            key={editing?.id ?? "new"}
            initial={editing ?? undefined}
            isPending={createRoom.isPending || updateRoom.isPending}
            onSave={handleSave}
            onClose={closeForm}
          />
        )}
      </Dialog>

      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}
