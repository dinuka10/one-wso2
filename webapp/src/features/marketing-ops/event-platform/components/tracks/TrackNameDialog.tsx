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

import { Controller, useForm, useWatch } from "react-hook-form";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@wso2/oxygen-ui";
import { useListRooms } from "@features/marketing-ops/event-platform/api/rooms";
import { useColorSchemeMode } from "@features/marketing-ops/event-platform/hooks/useColorSchemeMode";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import {
  COLOR_TOKENS,
  colorTokenLabel,
  type ColorToken,
} from "@features/marketing-ops/event-platform/types/colorTokens";

interface TrackFormValues {
  colorToken: ColorToken | null;
  // "" means no room.
  roomId: string;
}

// Adds or edits a track. Tracks have no name of their own: they are known by
// the room they map to, and coloured by that room when it has a colour —
// the track's own colour is only the fallback, which the hint says.
export default function TrackNameDialog({
  title,
  configId,
  initialColorToken,
  initialRoomId,
  confirmLabel,
  isPending,
  onConfirm,
  onCancel,
}: {
  title: string;
  configId: string;
  initialColorToken?: ColorToken | null;
  initialRoomId?: string | null;
  confirmLabel: string;
  isPending?: boolean;
  onConfirm: (colorToken: ColorToken | null, roomId: string | null) => void;
  onCancel: () => void;
}) {
  const scheme = useColorSchemeMode();
  const { control, handleSubmit } = useForm<TrackFormValues>({
    defaultValues: { colorToken: initialColorToken ?? null, roomId: initialRoomId ?? "" },
  });
  const roomId = useWatch({ control, name: "roomId" });
  const { data: rooms = [] } = useListRooms(configId);
  const canSubmit = !isPending;

  const submit = handleSubmit((values) => onConfirm(values.colorToken, values.roomId || null));
  const handleKeyDown = useSubmitShortcut(() => void submit(), canSubmit);

  const mappedRoom = rooms.find((r) => r.id === roomId);

  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth onKeyDown={handleKeyDown}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        <Box>
          <Typography id="track-colour-label" variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
            Colour
          </Typography>
          <Controller
            control={control}
            name="colorToken"
            render={({ field }) => (
              <Box
                role="radiogroup"
                aria-labelledby="track-colour-label"
                sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}
              >
                {COLOR_TOKENS.map((c) => {
                  const hex = c[scheme];
                  const selected = field.value === c.token;
                  return (
                    <Box
                      key={c.token}
                      role="radio"
                      tabIndex={0}
                      title={c.label}
                      aria-label={c.label}
                      aria-checked={selected}
                      onClick={() => field.onChange(c.token)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          field.onChange(c.token);
                        }
                      }}
                      sx={(theme) => ({
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        bgcolor: hex,
                        cursor: "pointer",
                        // The gap ring is the dialog's own surface, so it reads
                        // as a gap in either scheme.
                        boxShadow: selected
                          ? `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${hex}`
                          : "none",
                        transition: "box-shadow 0.12s",
                      })}
                    />
                  );
                })}
              </Box>
            )}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
            {mappedRoom?.colorToken
              ? `${mappedRoom.name} is set to ${colorTokenLabel(mappedRoom.colorToken)} and overrides this.`
              : "Used only while this track has no room with a colour of its own."}
          </Typography>
        </Box>
        <Controller
          control={control}
          name="roomId"
          render={({ field }) => (
            <FormControl size="small" fullWidth>
              <InputLabel id="track-room-label">Room</InputLabel>
              <Select labelId="track-room-label" label="Room" {...field}>
                <MenuItem value="">No room</MenuItem>
                {rooms.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit} onClick={() => void submit()}>
          {isPending ? <CircularProgress size={16} /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
