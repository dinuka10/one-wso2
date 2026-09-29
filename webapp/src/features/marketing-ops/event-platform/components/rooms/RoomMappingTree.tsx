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

import { useQueryClient } from "@tanstack/react-query";
import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from "@wso2/oxygen-ui";
import { useAllTracks, useUpdateTrack } from "@features/marketing-ops/event-platform/api/tracks";
import {
  useListAllTrackSections,
  useUpdateTrackSection,
} from "@features/marketing-ops/event-platform/api/trackSections";
import {
  useRoomMappings,
  useUpdateRoom,
  useUpdateRoomMappings,
} from "@features/marketing-ops/event-platform/api/rooms";
import { useNotifyFailure } from "@features/marketing-ops/event-platform/api/base";
import { eventPlatformKeys as keys } from "@features/marketing-ops/event-platform/api/queryKeys";
import {
  COLOR_TOKENS,
  colorTokenHex,
  colorTokenLabel,
  isColorToken,
  type ColorToken,
} from "@features/marketing-ops/event-platform/types/colorTokens";
import type {
  ConferenceDay,
  Room,
  Track,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  buildRoomTree,
  roomNameOf,
  roomOverrideToken,
  roomTreeDayHeading,
  sectionInheritLabel,
} from "./roomTree";

// The empty option of every picker here: "no room", "inherit from track" or
// "no colour", depending on the picker.
const NONE = "";

// A token's swatch in whichever scheme is showing. applyStyles rather than
// palette.mode, which does not follow the CSS-variables scheme switch.
function Swatch({ token }: { token: ColorToken | null }) {
  return (
    <Box
      sx={(theme) => ({
        width: 14,
        height: 14,
        borderRadius: "50%",
        flexShrink: 0,
        border: 1,
        borderColor: "divider",
        bgcolor: colorTokenHex(token, "light"),
        ...theme.applyStyles("dark", { bgcolor: colorTokenHex(token, "dark") }),
      })}
    />
  );
}

function ColorTokenSelect({
  value,
  disabled,
  onChange,
}: {
  value: ColorToken | null;
  disabled?: boolean;
  onChange: (token: ColorToken | null) => void;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 180 }} disabled={disabled}>
      <InputLabel>Colour</InputLabel>
      <Select
        label="Colour"
        value={value ?? NONE}
        onChange={(e) => onChange(isColorToken(e.target.value) ? e.target.value : null)}
        renderValue={(v) =>
          isColorToken(v) ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Swatch token={v} />
              {colorTokenLabel(v)}
            </Box>
          ) : (
            "No colour"
          )
        }
      >
        <MenuItem value={NONE}>No colour</MenuItem>
        {COLOR_TOKENS.map((c) => (
          <MenuItem key={c.token} value={c.token}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Swatch token={c.token} />
              {c.label}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function RoomSelect({
  label,
  value,
  rooms,
  emptyLabel,
  emptyValueLabel,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  rooms: readonly Room[];
  emptyLabel: string;
  // What the closed picker says when nothing is chosen, when that should say
  // more than the menu option does (a section shows what it inherits).
  emptyValueLabel?: string;
  disabled?: boolean;
  onChange: (roomId: string | null) => void;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 220 }} disabled={disabled}>
      <InputLabel shrink>{label}</InputLabel>
      <Select
        label={label}
        notched
        displayEmpty
        value={value ?? NONE}
        onChange={(e) => onChange(e.target.value || null)}
        renderValue={(v) => (v ? roomNameOf(rooms, v) ?? "" : emptyValueLabel ?? emptyLabel)}
      >
        <MenuItem value={NONE}>{emptyLabel}</MenuItem>
        {rooms.map((room) => (
          <MenuItem key={room.id} value={room.id}>
            {room.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/**
 * The source's RoomMappingTree: room colours, the keynote room, and each
 * day's tracks and sections with the room they map to.
 *
 * `days` comes from the event itself rather than the unscoped days list the
 * source fetched and filtered — the event already carries exactly its own.
 */
export default function RoomMappingTree({
  eventId,
  days,
  rooms,
}: {
  eventId: string;
  days: readonly ConferenceDay[];
  rooms: readonly Room[];
}) {
  const notifyFailure = useNotifyFailure();
  const qc = useQueryClient();
  const { data: tracks = [] } = useAllTracks();
  const { data: mappings } = useRoomMappings(eventId);
  // Only this event's tracks: the list is every event's, and each track here
  // opens its own sections query.
  const dayIds = new Set(days.map((d) => d.id));
  const eventTracks = tracks.filter((t) => dayIds.has(t.dayId));
  const sections = useListAllTrackSections(eventTracks);

  const updateMappings = useUpdateRoomMappings();
  const updateTrack = useUpdateTrack();
  const updateRoom = useUpdateRoom();
  // Raises its own failure toast.
  const updateSection = useUpdateTrackSection();

  const tree = buildRoomTree(days, eventTracks, sections);

  // The source let these three fail silently; the hooks carry no toast of
  // their own, so the screen adds one.
  const setKeynoteRoom = (roomId: string | null) =>
    updateMappings.mutate(
      { configId: eventId, keynoteRoomId: roomId },
      { onError: (err) => notifyFailure("Couldn't change the keynote room.", err) },
    );

  // A track PATCH writes both fields, so the one not being changed is sent as
  // is — which is why the track pickers are shut while one is in flight: a
  // second PATCH from the old snapshot would undo the first.
  const patchTrack = (track: Track, change: { colorToken?: ColorToken | null; roomId?: string | null }) =>
    updateTrack.mutate(
      {
        id: track.id,
        dayId: track.dayId,
        colorToken: track.colorToken,
        roomId: track.roomId,
        ...change,
      },
      {
        onSuccess: () => {
          // A track's room is its sessions' room; the hook leaves sessions be.
          if ("roomId" in change) void qc.invalidateQueries({ queryKey: keys.sessionsRoot });
        },
        onError: (err) => notifyFailure("Couldn't update the track.", err),
      },
    );

  const setRoomColor = (roomId: string, colorToken: ColorToken | null) =>
    updateRoom.mutate(
      { id: roomId, colorToken },
      { onError: (err) => notifyFailure("Couldn't change the room colour.", err) },
    );

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Room colours
      </Typography>
      {rooms.map((room) => (
        <Box key={room.id} sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
          <Typography variant="body2" noWrap sx={{ minWidth: 140 }}>
            {room.name}
          </Typography>
          <ColorTokenSelect
            value={room.colorToken}
            disabled={updateRoom.isPending}
            onChange={(token) => setRoomColor(room.id, token)}
          />
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, mb: 3 }}>
        A room&apos;s colour wins over the colour of any track mapped to it. Clients get the name, not the
        shade, and pick their own value for it.
      </Typography>

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Keynotes
      </Typography>
      <RoomSelect
        label="Keynote room"
        value={mappings?.keynoteRoomId ?? null}
        rooms={rooms}
        emptyLabel="No room"
        onChange={setKeynoteRoom}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, mb: 3 }}>
        Every keynote in this event is assigned this room automatically.
      </Typography>

      {tree.map(({ day, tracks: dayTracks }) => (
        <Box key={day.id} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {roomTreeDayHeading(day)}
          </Typography>

          {dayTracks.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
              No tracks on this day.
            </Typography>
          ) : (
            dayTracks.map(({ track, index, sections: trackSections }) => {
              // The track's own colour is dead weight once its room has one, so
              // say so rather than leave two pickers that disagree with the board.
              const override = roomOverrideToken(track);
              const trackRoomName = roomNameOf(rooms, track.roomId);
              return (
                <Box key={track.id} sx={{ pl: 2, mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                      <Swatch token={override ?? track.colorToken} />
                      <Typography variant="body2" noWrap>
                        Track {index + 1}
                      </Typography>
                    </Box>
                    <RoomSelect
                      label="Room"
                      value={track.roomId}
                      rooms={rooms}
                      emptyLabel="No room"
                      disabled={updateTrack.isPending}
                      onChange={(roomId) => patchTrack(track, { roomId })}
                    />
                    <ColorTokenSelect
                      value={track.colorToken}
                      disabled={updateTrack.isPending}
                      onChange={(colorToken) => patchTrack(track, { colorToken })}
                    />
                    {override && (
                      <Typography variant="caption" color="text.secondary">
                        Showing {colorTokenLabel(override)} from {trackRoomName ?? "its room"}
                      </Typography>
                    )}
                  </Box>

                  {trackSections.map((section) => (
                    <Box
                      key={section.id}
                      sx={{ display: "flex", alignItems: "center", gap: 2, pl: 4, mt: 1, flexWrap: "wrap" }}
                    >
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 120 }}>
                        {section.label}
                      </Typography>
                      <RoomSelect
                        label="Room"
                        value={section.roomId}
                        rooms={rooms}
                        emptyLabel="Inherit from track"
                        emptyValueLabel={sectionInheritLabel(trackRoomName)}
                        onChange={(roomId) =>
                          updateSection.mutate({ id: section.id, trackId: track.id, roomId })
                        }
                      />
                    </Box>
                  ))}
                </Box>
              );
            })
          )}
        </Box>
      ))}
    </Box>
  );
}
