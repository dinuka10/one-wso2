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
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  Box,
  Button,
  CircularProgress,
  DatePickers,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import DatePickerProvider from "@features/marketing-ops/event-platform/components/DatePickerProvider";
import { PICKER_SLOT_PROPS } from "@features/marketing-ops/event-platform/components/pickerSlotProps";
import { useNotifyFailure } from "@features/marketing-ops/event-platform/api/base";
import { useListRooms } from "@features/marketing-ops/event-platform/api/rooms";
import {
  useCreateTrackTopic,
  useListTrackTopics,
} from "@features/marketing-ops/event-platform/api/trackTopics";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import type {
  ConferenceDay,
  Session,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { SLOT_MINUTES, slotToMinute } from "@features/marketing-ops/event-platform/utils/agenda";
import { isValidDate, minuteToTime } from "@features/marketing-ops/event-platform/utils/dateTime";
import {
  isSpanInDay,
  overlapsSibling,
  sectionSpan,
  slugify,
  strandedSessions,
  suggestTopicId,
} from "./trackSectionForm";

const { TimePicker } = DatePickers;

// A Select value that is not a topic id: picking it opens the inline create.
const CREATE_TOPIC = "__create__";

interface SectionFormValues {
  label: string;
  // "" inherits the track's room.
  roomId: string;
  // "" means no topic.
  topicId: string;
  startTime: Date | null;
  endTime: Date | null;
}

export interface TrackSectionDialogInput {
  label: string;
  startSlot: number;
  durationSlots: number;
  roomId: string | null;
  topicId: string | null;
}

// Adds or edits a track section (trackId set) or a keynote section (trackId
// null). Times snap to 15 minutes, and a span that overlaps a sibling or runs
// off the day can't be saved. An edit that would leave sessions outside the
// section says so.
export default function TrackSectionDialog({
  title,
  activeDay,
  trackId,
  configId,
  existingSections,
  initialSection,
  sectionSessions = [],
  isPending,
  onConfirm,
  onCancel,
}: {
  title: string;
  activeDay: ConferenceDay;
  trackId: string | null;
  configId: string;
  existingSections: TrackSection[];
  initialSection?: TrackSection;
  // The sessions already in the section being edited.
  sectionSessions?: Session[];
  isPending?: boolean;
  onConfirm: (input: TrackSectionDialogInput) => void;
  onCancel: () => void;
}) {
  const { control, setValue, handleSubmit } = useForm<SectionFormValues>({
    defaultValues: {
      label: initialSection?.label ?? "",
      roomId: initialSection?.roomId ?? "",
      topicId: initialSection?.topicId ?? "",
      startTime: initialSection
        ? minuteToTime(slotToMinute(initialSection.startSlot, activeDay.startMinute))
        : null,
      endTime: initialSection
        ? minuteToTime(
            slotToMinute(initialSection.startSlot + initialSection.durationSlots, activeDay.startMinute),
          )
        : null,
    },
  });
  const [label, startTime, endTime] = useWatch({ control, name: ["label", "startTime", "endTime"] });

  // Once the organiser picks a topic themselves (including clearing it), the
  // label-driven suggestion stops overwriting it.
  const [topicTouched, setTopicTouched] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const { data: rooms = [] } = useListRooms(configId);
  const { data: topics = [] } = useListTrackTopics(configId);
  const createTopic = useCreateTrackTopic();
  const notifyFailure = useNotifyFailure();
  // Keynote sections have no track to inherit from; their room comes from the
  // event's keynote room mapping instead.
  const showRoom = trackId !== null;

  const minTime = minuteToTime(activeDay.startMinute);
  const maxTime = minuteToTime(activeDay.endMinute);

  const span = sectionSpan(activeDay, startTime, endTime);
  const { startSlot, endSlot, durationSlots } = span;
  const hasOverlap = overlapsSibling(span, existingSections, initialSection?.id);
  const inDay = isSpanInDay(span, activeDay);
  const stranded = strandedSessions(span, sectionSessions).length;

  const canSubmit =
    !!label.trim() &&
    startSlot !== null &&
    endSlot !== null &&
    durationSlots > 0 &&
    !hasOverlap &&
    inDay &&
    !isPending;

  const submit = handleSubmit((values) => {
    if (!canSubmit) return;
    onConfirm({
      label: values.label.trim(),
      startSlot: startSlot!,
      durationSlots,
      roomId: showRoom ? values.roomId || null : null,
      topicId: values.topicId || null,
    });
  });
  const handleKeyDown = useSubmitShortcut(() => void submit(), canSubmit);

  const confirmNewTopic = async () => {
    const name = newTopicName.trim();
    if (!name) return;
    try {
      const created = await createTopic.mutateAsync({
        configId,
        name,
        slug: slugify(name),
        position: topics.length,
      });
      setValue("topicId", created.id);
      setTopicTouched(true);
      setCreatingTopic(false);
      setNewTopicName("");
    } catch (err) {
      // The source left this rejection unhandled; a duplicate slug is a 409.
      notifyFailure("Couldn't create the topic.", err);
    }
  };

  return (
    <DatePickerProvider>
      <Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent
          onKeyDown={handleKeyDown}
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}
        >
          <Controller
            control={control}
            name="label"
            render={({ field }) => (
              <TextField
                autoFocus
                fullWidth
                size="small"
                label="Section label"
                value={field.value}
                onBlur={field.onBlur}
                onChange={(e) => {
                  field.onChange(e.target.value);
                  if (!topicTouched) {
                    const suggested = suggestTopicId(e.target.value, topics);
                    if (suggested) setValue("topicId", suggested);
                  }
                }}
              />
            )}
          />
          {creatingTopic ? (
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                autoFocus
                fullWidth
                size="small"
                label="New topic name"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                // Keeps Cmd/Ctrl+Enter here from saving the whole section.
                onKeyDown={(e) => e.stopPropagation()}
              />
              <Button
                variant="contained"
                disabled={!newTopicName.trim() || createTopic.isPending}
                onClick={() => void confirmNewTopic()}
              >
                Add
              </Button>
              <Button
                onClick={() => {
                  setCreatingTopic(false);
                  setNewTopicName("");
                }}
              >
                Cancel
              </Button>
            </Box>
          ) : (
            <Controller
              control={control}
              name="topicId"
              render={({ field }) => (
                <FormControl size="small" fullWidth>
                  <InputLabel id="section-topic-label">Topic</InputLabel>
                  <Select
                    labelId="section-topic-label"
                    label="Topic"
                    value={field.value}
                    onChange={(e) => {
                      const value = String(e.target.value);
                      if (value === CREATE_TOPIC) {
                        setCreatingTopic(true);
                        return;
                      }
                      setTopicTouched(true);
                      field.onChange(value);
                    }}
                  >
                    <MenuItem value="">No topic</MenuItem>
                    {topics.map((topic) => (
                      <MenuItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </MenuItem>
                    ))}
                    <MenuItem value={CREATE_TOPIC}>+ Create topic</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          )}
          <Box sx={{ display: "flex", gap: 2 }}>
            {(["startTime", "endTime"] as const).map((name) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <TimePicker
                    label={name === "startTime" ? "Start time" : "End time"}
                    value={field.value}
                    // Mid-typing the picker emits Invalid Date; keep the last good value.
                    onChange={(v) => {
                      if (v === null || isValidDate(v)) field.onChange(v);
                    }}
                    minutesStep={15}
                    minTime={minTime}
                    maxTime={maxTime}
                    slotProps={PICKER_SLOT_PROPS}
                  />
                )}
              />
            ))}
          </Box>
          {showRoom && (
            <Controller
              control={control}
              name="roomId"
              render={({ field }) => (
                <FormControl size="small" fullWidth>
                  <InputLabel id="section-room-label">Room</InputLabel>
                  <Select labelId="section-room-label" label="Room" {...field}>
                    <MenuItem value="">Inherit from track</MenuItem>
                    {rooms.map((room) => (
                      <MenuItem key={room.id} value={room.id}>
                        {room.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          )}
          {durationSlots > 0 && (
            <Typography variant="caption" color="text.secondary">
              {durationSlots} slots · {durationSlots * SLOT_MINUTES} min
            </Typography>
          )}
          {hasOverlap && (
            <Typography variant="caption" color="error">
              Overlaps with an existing section
            </Typography>
          )}
          {!inDay && (
            <Typography variant="caption" color="error">
              Must fall within the day&apos;s hours
            </Typography>
          )}
          {stranded > 0 && (
            <Typography variant="caption" color="warning.main">
              {stranded} session{stranded === 1 ? "" : "s"} would fall outside this section and be
              hidden. Move {stranded === 1 ? "it" : "them"} first.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="contained" disabled={!canSubmit} onClick={() => void submit()}>
            {isPending ? <CircularProgress size={16} /> : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </DatePickerProvider>
  );
}
