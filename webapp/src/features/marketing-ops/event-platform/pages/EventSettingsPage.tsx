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

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate, useParams } from "react-router";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  DatePickers,
  FormControlLabel,
  IconButton,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import ConfirmationDialog, {
  type ConfirmationContent,
} from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useDeleteEvent, useEvent, useUpsertEvent } from "@features/marketing-ops/event-platform/api/event";
import { useNotifyFailure } from "@features/marketing-ops/event-platform/api/base";
import { eventPlatformKeys as keys } from "@features/marketing-ops/event-platform/api/queryKeys";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import { eventPlatformPath, topLevelTab } from "@features/marketing-ops/event-platform/eventPlatformTabs";
import type {
  ConferenceConfig,
  RoomMappings,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  addDaysToDateOnly,
  formatDayLabel,
  isValidDate,
  minuteToTime,
  timeToMinute,
  toDateOnlyString,
  TIMEZONE_OPTIONS,
} from "@features/marketing-ops/event-platform/utils/dateTime";
import DatePickerProvider from "../components/DatePickerProvider";
import { PICKER_SLOT_PROPS } from "../components/pickerSlotProps";
import TrackTopicsDialog from "../components/trackTopics/TrackTopicsDialog";
import {
  canSaveSettings,
  dayCountOptions,
  dayEndsBeforeStart,
  droppedDayCount,
  isValidLogoUrl,
  resizeDays,
  toSettingsFormValues,
  toUpsertPayload,
  type EventSettingsFormValues,
} from "../components/settings/eventSettingsForm";

const { DatePicker, DateTimePicker, TimePicker } = DatePickers;

const EVENTS_LIST_PATH = eventPlatformPath(topLevelTab("events")!);

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: hint ? 0.5 : 1.25 }}>
        {title}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: 12 }}>
          {hint}
        </Typography>
      )}
      {children}
    </Box>
  );
}

function SettingsForm({ event }: { event: ConferenceConfig }) {
  const upsertEvent = useUpsertEvent(event.id);
  const qc = useQueryClient();
  const { showSuccess } = useNotifications();
  const notifyFailure = useNotifyFailure();
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);

  const { control, register, handleSubmit, reset, formState } = useForm<EventSettingsFormValues>({
    defaultValues: toSettingsFormValues(event),
  });
  const days = useFieldArray({ control, name: "days" });
  const labels = useFieldArray({ control, name: "artifactLabels" });
  const values = useWatch({ control }) as EventSettingsFormValues;
  const startDate = toDateOnlyString(values.startDate);
  const logoInvalid = !isValidLogoUrl(values.defaultInternalLogoUrl ?? "");

  const canSubmit = !upsertEvent.isPending && canSaveSettings(values);

  const save = (next: EventSettingsFormValues) => {
    const dropsDays = droppedDayCount(event, next) > 0;
    const mappings = qc.getQueryData<RoomMappings>(keys.roomMappings(event.id));
    upsertEvent.mutate(toUpsertPayload(next, event, mappings), {
      onSuccess: (updated) => {
        // Dropped days take their activity windows with them server side.
        if (dropsDays) void qc.invalidateQueries({ queryKey: keys.activities(event.id) });
        // The saved event becomes the new baseline, so Cancel returns to it.
        reset(toSettingsFormValues(updated));
        showSuccess("Settings saved.");
      },
      onError: (err) => notifyFailure("Couldn't save the settings.", err),
    });
  };

  const submit = handleSubmit((next) => {
    const dropped = droppedDayCount(event, next);
    if (dropped === 0) {
      save(next);
      return;
    }
    setConfirm({
      title: dropped === 1 ? "Remove a day" : `Remove ${dropped} days`,
      text: `Saving deletes the last ${dropped === 1 ? "day" : `${dropped} days`} of this event, with their tracks, and unschedules their sessions. The sessions themselves are kept.`,
      confirmLabel: "Save and remove",
      confirmAction: () => save(next),
    });
  });
  const handleKeyDown = useSubmitShortcut(() => void submit(), canSubmit);

  return (
    <DatePickerProvider>
      <Box onKeyDown={handleKeyDown} sx={{ display: "flex", flexDirection: "column", gap: 2.75 }}>
        <TextField label="Event name" size="small" fullWidth required {...register("name")} />

        <Controller
          control={control}
          name="startDate"
          render={({ field }) => (
            <DatePicker
              label="Start date"
              value={field.value}
              onChange={(v) => field.onChange(isValidDate(v) ? v : null)}
              slotProps={PICKER_SLOT_PROPS}
            />
          )}
        />

        <Section title="Number of days">
          <Box sx={{ display: "flex", gap: 1 }}>
            {dayCountOptions(event.days.length).map((n) => (
              <Button
                key={n}
                variant={days.fields.length === n ? "contained" : "outlined"}
                size="small"
                disableElevation
                sx={{ minWidth: 44 }}
                aria-pressed={days.fields.length === n}
                onClick={() => days.replace(resizeDays(values.days ?? [], n))}
              >
                {n}
              </Button>
            ))}
          </Box>
        </Section>

        <Section title="Daily hours">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {days.fields.map((field, i) => {
              const day = values.days?.[i];
              const backwards = day ? dayEndsBeforeStart(day) : false;
              return (
                <Box
                  key={field.id}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.25,
                    p: 1.5,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <TextField
                      size="small"
                      placeholder={`Day ${i + 1}`}
                      sx={{ flex: 1 }}
                      slotProps={{ htmlInput: { "aria-label": `Day ${i + 1} label` } }}
                      {...register(`days.${i}.label`)}
                    />
                    {startDate && (
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                        {formatDayLabel(addDaysToDateOnly(startDate, i))}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                    <Controller
                      control={control}
                      name={`days.${i}.startMinute`}
                      render={({ field: start }) => (
                        <TimePicker
                          label="Start"
                          value={minuteToTime(start.value)}
                          onChange={(v) => {
                            if (isValidDate(v)) start.onChange(timeToMinute(v));
                          }}
                          minutesStep={15}
                          slotProps={PICKER_SLOT_PROPS}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`days.${i}.endMinute`}
                      render={({ field: end }) => (
                        <TimePicker
                          label="End"
                          value={minuteToTime(end.value)}
                          onChange={(v) => {
                            if (isValidDate(v)) end.onChange(timeToMinute(v));
                          }}
                          minutesStep={15}
                          slotProps={{
                            ...PICKER_SLOT_PROPS,
                            textField: {
                              ...PICKER_SLOT_PROPS.textField,
                              error: backwards,
                              helperText: backwards ? "Must be after the start" : undefined,
                            },
                          }}
                        />
                      )}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Section>

        <Section title="Venue">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            <TextField label="Venue name" size="small" fullWidth {...register("venueName")} />
            <TextField label="Venue address" size="small" fullWidth {...register("venueAddress")} />
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <Autocomplete
                  options={TIMEZONE_OPTIONS}
                  // A zone this browser does not list still shows as itself.
                  value={
                    TIMEZONE_OPTIONS.find((o) => o.value === field.value) ?? { label: field.value, value: field.value }
                  }
                  onChange={(_, v) => field.onChange(v?.value ?? "UTC")}
                  disableClearable
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, v) => option.value === v.value}
                  renderInput={(params) => <TextField {...params} label="Time zone" size="small" />}
                  size="small"
                />
              )}
            />
          </Box>
        </Section>

        <Section
          title="Session links"
          hint="Whether session cards show the article and video links set on each session."
        >
          <Stack>
            <Controller
              control={control}
              name="articleLinksEnabled"
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Article links"
                />
              )}
            />
            <Controller
              control={control}
              name="videoLinksEnabled"
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Video links"
                />
              )}
            />
          </Stack>
        </Section>

        <Section
          title="Artifact labels"
          hint={'The labels offered when adding artifacts to sessions, e.g. "View Video" or "View Slides".'}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {labels.fields.map((field, i) => (
              <Box key={field.id} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <TextField
                  size="small"
                  placeholder="Label name"
                  fullWidth
                  error={(values.artifactLabels?.[i]?.value ?? "").trim().length === 0}
                  slotProps={{ htmlInput: { "aria-label": `Artifact label ${i + 1}` } }}
                  {...register(`artifactLabels.${i}.value`)}
                />
                <IconButton size="small" onClick={() => labels.remove(i)} aria-label="Remove label">
                  <XIcon size={16} />
                </IconButton>
              </Box>
            ))}
            <Button
              size="small"
              variant="outlined"
              startIcon={<PlusIcon size={14} />}
              sx={{ alignSelf: "flex-start", mt: 0.5 }}
              onClick={() => labels.append({ value: "" })}
            >
              Add label
            </Button>
          </Box>
        </Section>

        <Section
          title="Default internal speaker logo"
          hint="Company logo URL applied to internal speakers who don't have one set on their profile."
        >
          <TextField
            size="small"
            fullWidth
            placeholder="https://example.com/logo.png"
            error={logoInvalid}
            helperText={logoInvalid ? "Must be an http:// or https:// URL" : undefined}
            slotProps={{ htmlInput: { "aria-label": "Default internal speaker logo URL" } }}
            {...register("defaultInternalLogoUrl")}
          />
        </Section>

        <Section
          title="Shop closing time"
          hint={`When the event shop locks and stops taking orders, in the event's time zone (${values.timezone}). Leave empty to keep it open.`}
        >
          <Controller
            control={control}
            name="shopClosingTime"
            render={({ field }) => (
              <DateTimePicker
                label="Shop closing time"
                value={field.value}
                onChange={(v) => field.onChange(isValidDate(v) ? v : null)}
                slotProps={{ ...PICKER_SLOT_PROPS, field: { clearable: true } }}
              />
            )}
          />
        </Section>

        <Box sx={{ display: "flex", gap: 1.25, justifyContent: "flex-end", pt: 0.5 }}>
          <Button disabled={!formState.isDirty || upsertEvent.isPending} onClick={() => reset()}>
            Discard changes
          </Button>
          <Button variant="contained" disableElevation disabled={!canSubmit} onClick={() => void submit()}>
            {upsertEvent.isPending ? <CircularProgress size={16} /> : "Save settings"}
          </Button>
        </Box>
      </Box>
      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
    </DatePickerProvider>
  );
}

// Deleting an event takes its sessions, tracks and shop with it, so the button
// stays shut until the event's name is typed — the source's guard — and then
// asks once more.
function DangerZone({ event }: { event: ConferenceConfig }) {
  const navigate = useNavigate();
  const deleteEvent = useDeleteEvent();
  const { showSuccess } = useNotifications();
  const notifyFailure = useNotifyFailure();
  const [typedName, setTypedName] = useState("");
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);

  const askDelete = () =>
    setConfirm({
      title: "Delete event",
      text: `Permanently delete "${event.name}" and all its sessions, tracks, rooms, activities and shop data? This cannot be undone.`,
      confirmLabel: "Delete event",
      confirmAction: () =>
        deleteEvent.mutate(event.id, {
          onSuccess: () => {
            showSuccess(`Deleted "${event.name}".`);
            navigate(EVENTS_LIST_PATH, { replace: true });
          },
          onError: (err) => notifyFailure("Couldn't delete the event.", err),
        }),
    });

  return (
    <Box sx={{ p: 2.5, border: 1, borderColor: "error.main", borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "error.main", mb: 0.75 }}>
        Danger zone
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Permanently delete this event and all its sessions, tracks and data. This cannot be undone.
      </Typography>
      <TextField
        size="small"
        fullWidth
        value={typedName}
        onChange={(e) => setTypedName(e.target.value)}
        placeholder={`Type "${event.name}" to confirm`}
        slotProps={{ htmlInput: { "aria-label": "Event name, to confirm deletion" } }}
        sx={{ mb: 1.5 }}
      />
      <Button
        variant="contained"
        color="error"
        disableElevation
        disabled={typedName !== event.name || deleteEvent.isPending}
        onClick={askDelete}
      >
        {deleteEvent.isPending ? <CircularProgress size={16} /> : "Delete event"}
      </Button>
      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}

/**
 * Settings: the event's own fields and days, saved as one whole-event PUT,
 * plus its track topics and deletion. Admin only, by its route's guard.
 */
export default function EventSettingsPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const { data: event, isLoading, isError, error } = useEvent(eventId);
  const [topicsOpen, setTopicsOpen] = useState(false);

  if (isLoading) {
    return <Skeleton variant="rectangular" height={420} sx={{ borderRadius: 1.5, maxWidth: 560 }} />;
  }

  if (isError || !event) {
    return (
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <ErrorNotice error={error}>Couldn&apos;t load this event.</ErrorNotice>
        <Button component={RouterLink} to={EVENTS_LIST_PATH}>
          Back to events
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 560 }}>
      {/* Keyed by event, so switching events starts from the new one's values. */}
      <SettingsForm key={event.id} event={event} />

      <Box sx={{ p: 2.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75 }}>
          Track topics
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Manage the topics that drive the public agenda&apos;s track filter dropdown.
        </Typography>
        <Button variant="outlined" onClick={() => setTopicsOpen(true)}>
          Manage track topics
        </Button>
      </Box>
      {topicsOpen && <TrackTopicsDialog eventId={event.id} onClose={() => setTopicsOpen(false)} />}

      <DangerZone key={event.id} event={event} />
    </Stack>
  );
}
