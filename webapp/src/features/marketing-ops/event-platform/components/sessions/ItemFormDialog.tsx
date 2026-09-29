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
  Autocomplete,
  Box,
  Button,
  Chip,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import DatePickerProvider from "@features/marketing-ops/event-platform/components/DatePickerProvider";
import RichTextEditor from "@features/marketing-ops/event-platform/components/RichTextEditor";
import { PICKER_SLOT_PROPS } from "@features/marketing-ops/event-platform/components/pickerSlotProps";
import { useListRooms } from "@features/marketing-ops/event-platform/api/rooms";
import { useListSpeakers } from "@features/marketing-ops/event-platform/api/speakers";
import { useListTrackTopics } from "@features/marketing-ops/event-platform/api/trackTopics";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import type {
  ConferenceDay,
  Session,
  SessionSpeakerRole,
  Speaker,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  ITEM_KIND_LABELS,
  SESSION_ROLE_LABELS,
  defaultRoleForSpeakerType,
  hasPresenterDetail,
  isTimeOnlyKind,
  type ItemKind,
} from "@features/marketing-ops/event-platform/utils/agenda";
import { formatDayLabel, isValidDate, minuteToTime } from "@features/marketing-ops/event-platform/utils/dateTime";
import SpeakerRoleDialog from "./SpeakerRoleDialog";
import { isItemFormValid, itemFormDefaults, type ItemFormValues } from "./itemForm";

const { TimePicker } = DatePickers;

const KINDS = Object.keys(ITEM_KIND_LABELS) as ItemKind[];

type RoleDialogState =
  | { type: "add"; speakerId: string; speakerName: string; role: SessionSpeakerRole }
  | { type: "edit"; speakerId: string; speakerName: string; role: SessionSpeakerRole }
  | null;

// Adds or edits one agenda item: a session, keynote, break or activity. Which
// fields show depends on the kind — a break is a bare time bar, an activity
// adds a description, sessions and keynotes add speakers, a room, a topic and
// links. Speakers come from the global library; each is added with a role.
export default function ItemFormDialog({
  days,
  initialItem,
  config,
  configId,
  isPending,
  onSave,
  onCancel,
}: {
  days: ConferenceDay[];
  initialItem?: Session;
  config: { articleLinksEnabled: boolean; videoLinksEnabled: boolean };
  configId: string;
  isPending?: boolean;
  onSave: (form: ItemFormValues) => void;
  onCancel: () => void;
}) {
  const { control, setValue, getValues } = useForm<ItemFormValues>({
    defaultValues: itemFormDefaults(days, initialItem),
  });
  const [kind, title, dayId, topicIsManual, speakerAssignments] = useWatch({
    control,
    name: ["kind", "title", "dayId", "topicIsManual", "speakerAssignments"],
  });
  const [roleDialog, setRoleDialog] = useState<RoleDialogState>(null);

  const { data: speakers = [] } = useListSpeakers();
  const { data: rooms = [] } = useListRooms(configId);
  const { data: topics = [] } = useListTrackTopics(configId);

  const selectedDay = dayId ? (days.find((d) => d.id === dayId) ?? null) : null;
  const minTime = selectedDay ? minuteToTime(selectedDay.startMinute) : undefined;
  const maxTime = selectedDay ? minuteToTime(selectedDay.endMinute) : undefined;

  const presenter = hasPresenterDetail(kind);
  const isValid = isItemFormValid({ title });
  const isEdit = !!initialItem;

  // Values are read whole rather than through handleSubmit: validity is the
  // title alone, and the rich-text fields report through setValue.
  const submit = () => {
    if (isValid && !isPending) onSave(getValues());
  };
  const handleKeyDown = useSubmitShortcut(submit, isValid && !isPending);

  // Asks for the role of a speaker being added, defaulting to the one their
  // speaker type implies. The inline "create a new speaker" flow (phase 3's
  // SpeakerFormDialog) should call this with the speaker it just created.
  const openAddRole = (speaker: Speaker) =>
    setRoleDialog({
      type: "add",
      speakerId: speaker.id,
      speakerName: speaker.name,
      role: defaultRoleForSpeakerType(speaker.speakerType),
    });

  return (
    <DatePickerProvider>
      <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
        <DialogTitle>{isEdit ? "Edit item" : "Add item"}</DialogTitle>
        <DialogContent
          onKeyDown={handleKeyDown}
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}
        >
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <ToggleButtonGroup
                value={field.value}
                exclusive
                onChange={(_, v) => {
                  if (v) field.onChange(v as ItemKind);
                }}
                size="small"
                aria-label="Item kind"
              >
                {KINDS.map((k) => (
                  <ToggleButton key={k} value={k}>
                    {ITEM_KIND_LABELS[k]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          />

          {/* Uncontrolled: seeded once from the default value. */}
          <RichTextEditor
            variant="inline"
            value={getValues("title")}
            onChange={(html) => setValue("title", html)}
            placeholder="Title"
            autoFocus
          />

          <Controller
            control={control}
            name="dayId"
            render={({ field }) => (
              <FormControl size="small" fullWidth>
                <InputLabel id="item-day-label">Day</InputLabel>
                <Select labelId="item-day-label" label="Day" {...field}>
                  <MenuItem value="">Unscheduled</MenuItem>
                  {days.map((d, i) => (
                    <MenuItem key={d.id} value={d.id}>
                      {formatDayLabel(d.date)} · Day {i + 1}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />

          {presenter && (
            <Controller
              control={control}
              name="roomId"
              render={({ field }) => (
                <FormControl size="small" fullWidth>
                  <InputLabel id="item-room-label">Room</InputLabel>
                  <Select labelId="item-room-label" label="Room" {...field}>
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
          )}

          {/* The topic follows the section a session sits in unless overridden
              here; clearing the override goes back to inheriting. */}
          {presenter &&
            (topicIsManual ? (
              <Controller
                control={control}
                name="topicId"
                render={({ field }) => (
                  <FormControl size="small" fullWidth>
                    <InputLabel id="item-topic-label">Topic</InputLabel>
                    <Select
                      labelId="item-topic-label"
                      label="Topic"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const value = String(e.target.value);
                        if (!value) {
                          setValue("topicIsManual", false);
                          field.onChange(null);
                        } else {
                          field.onChange(value);
                        }
                      }}
                    >
                      <MenuItem value="">Inherit from section</MenuItem>
                      {topics.map((t) => (
                        <MenuItem key={t.id} value={t.id}>
                          {t.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Topic: inherited from section
                </Typography>
                <Button size="small" onClick={() => setValue("topicIsManual", true)}>
                  Override
                </Button>
              </Box>
            ))}

          <Box sx={{ display: "flex", gap: 1.5 }}>
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
                    minutesStep={5}
                    minTime={minTime}
                    maxTime={maxTime}
                    slotProps={PICKER_SLOT_PROPS}
                  />
                )}
              />
            ))}
          </Box>

          {!isTimeOnlyKind(kind) && (
            <RichTextEditor
              variant="full"
              value={getValues("description")}
              onChange={(html) => setValue("description", html)}
              placeholder="Description"
            />
          )}

          {presenter && config.articleLinksEnabled && (
            <LinkFields control={control} urlName="articleUrl" labelName="articleLabel" what="Article" />
          )}
          {presenter && config.videoLinksEnabled && (
            <LinkFields control={control} urlName="videoUrl" labelName="videoLabel" what="Video" />
          )}

          {presenter && (
            <Autocomplete
              options={speakers.filter((s) => !speakerAssignments.some((a) => a.speakerId === s.id))}
              getOptionLabel={(s) => `${s.name} · ${s.title}`}
              value={null}
              onChange={(_, s) => {
                if (s) openAddRole(s);
              }}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              renderInput={(params) => <TextField {...params} label="Add speaker" size="small" />}
              noOptionsText="No speakers yet"
              size="small"
              blurOnSelect
            />
          )}

          {presenter && speakerAssignments.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: -0.5 }}>
              {speakerAssignments.map(({ speakerId, role }) => {
                const speaker = speakers.find((s) => s.id === speakerId);
                if (!speaker) return null;
                return (
                  <Chip
                    key={speakerId}
                    label={`${speaker.name} · ${SESSION_ROLE_LABELS[role]}`}
                    size="small"
                    onClick={() => setRoleDialog({ type: "edit", speakerId, speakerName: speaker.name, role })}
                    onDelete={() =>
                      setValue(
                        "speakerAssignments",
                        speakerAssignments.filter((a) => a.speakerId !== speakerId),
                      )
                    }
                  />
                );
              })}
            </Box>
          )}

          {roleDialog && (
            <SpeakerRoleDialog
              key={roleDialog.speakerId}
              speakerName={roleDialog.speakerName}
              initialRole={roleDialog.role}
              onConfirm={(role) => {
                const current = getValues("speakerAssignments");
                setValue(
                  "speakerAssignments",
                  roleDialog.type === "add"
                    ? [...current, { speakerId: roleDialog.speakerId, role }]
                    : current.map((a) => (a.speakerId === roleDialog.speakerId ? { ...a, role } : a)),
                );
                setRoleDialog(null);
              }}
              onCancel={() => setRoleDialog(null)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="contained" disabled={!isValid || isPending} onClick={submit}>
            {isPending ? <CircularProgress size={16} /> : isEdit ? "Save" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </DatePickerProvider>
  );
}

// A link's URL and its button label, side by side.
function LinkFields({
  control,
  urlName,
  labelName,
  what,
}: {
  control: ReturnType<typeof useForm<ItemFormValues>>["control"];
  urlName: "articleUrl" | "videoUrl";
  labelName: "articleLabel" | "videoLabel";
  what: string;
}) {
  return (
    <Box sx={{ display: "flex", gap: 1.5 }}>
      <Controller
        control={control}
        name={urlName}
        render={({ field }) => <TextField label={`${what} URL`} size="small" fullWidth {...field} />}
      />
      <Controller
        control={control}
        name={labelName}
        render={({ field }) => (
          <TextField label={`${what} button label`} placeholder={what} size="small" fullWidth {...field} />
        )}
      />
    </Box>
  );
}
