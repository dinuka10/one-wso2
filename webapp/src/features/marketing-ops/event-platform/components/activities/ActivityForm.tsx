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

import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DatePickers,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import { dayOptionLabel } from "@features/marketing-ops/event-platform/utils/agenda";
import { isValidDate, minuteToTime, timeToMinute } from "@features/marketing-ops/event-platform/utils/dateTime";
import type {
  Activity,
  ConferenceDay,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import DatePickerProvider from "../DatePickerProvider";
import { PICKER_SLOT_PROPS } from "../pickerSlotProps";
import {
  canSaveActivity,
  closesBeforeOpening,
  isRemovedDay,
  newHoursRow,
  toActivityFormValues,
  type ActivityFormValues,
} from "./activityHours";

const { TimePicker } = DatePickers;

/**
 * The add/edit activity dialog body: name, description, and one opening
 * window per day. Mount it inside a Dialog, keyed by the activity, so switching
 * straight from one activity to another starts from the new one's values.
 */
export default function ActivityForm({
  initial,
  days,
  isPending,
  onSave,
  onClose,
}: {
  initial?: Activity;
  days: readonly ConferenceDay[];
  isPending: boolean;
  onSave: (values: ActivityFormValues) => void;
  onClose: () => void;
}) {
  const { control, register, handleSubmit } = useForm<ActivityFormValues>({
    defaultValues: toActivityFormValues(initial),
  });
  // react-hook-form's own row keys: the rows are removable before save, and a
  // row that does not exist yet has no server id to key it by.
  const { fields, append, remove } = useFieldArray({ control, name: "hours" });
  const values = useWatch({ control }) as ActivityFormValues;
  const hours = values.hours ?? [];

  const canSubmit = !isPending && canSaveActivity({ ...values, hours }, days);
  const submit = handleSubmit(onSave);
  const handleKeyDown = useSubmitShortcut(() => void submit(), canSubmit);

  const addRow = () => {
    const row = newHoursRow(days, hours);
    if (row) append(row);
  };

  return (
    <DatePickerProvider>
      <DialogTitle>{initial ? "Edit activity" : "Add activity"}</DialogTitle>
      <DialogContent
        onKeyDown={handleKeyDown}
        sx={{ pt: "16px !important", display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label="Name"
          required
          autoFocus
          size="small"
          fullWidth
          helperText="Shown on the attendee app's General page. Attendees see this exact text."
          {...register("name")}
        />
        <TextField label="Description" size="small" fullWidth multiline minRows={2} {...register("description")} />

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Opening hours
          </Typography>
          {days.length === 0 && <Alert severity="info">Add days to this event before setting opening hours.</Alert>}
          {days.length > 0 && fields.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Not running on any day yet.
            </Typography>
          )}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {fields.map((field, index) => {
              const row = hours[index];
              const backwards = row ? closesBeforeOpening(row) : false;
              const removedDay = row ? isRemovedDay(row, days) : false;
              return (
                <Box key={field.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <Controller
                    control={control}
                    name={`hours.${index}.dayId`}
                    render={({ field: dayField }) => (
                      <FormControl size="small" sx={{ minWidth: 170 }} error={removedDay}>
                        <InputLabel>Day</InputLabel>
                        <Select label="Day" value={dayField.value} onChange={(e) => dayField.onChange(e.target.value)}>
                          {/* Keeps the stored value among the options, so the
                              picker says what it holds instead of going blank. */}
                          {removedDay && (
                            <MenuItem value={dayField.value} disabled>
                              Removed day
                            </MenuItem>
                          )}
                          {days.map((day, i) => (
                            <MenuItem key={day.id} value={day.id}>
                              {dayOptionLabel(day, i)}
                            </MenuItem>
                          ))}
                        </Select>
                        {removedDay && <FormHelperText>This day was removed</FormHelperText>}
                      </FormControl>
                    )}
                  />
                  <Controller
                    control={control}
                    name={`hours.${index}.startMinute`}
                    render={({ field: startField }) => (
                      <TimePicker
                        label="Opens"
                        value={minuteToTime(startField.value)}
                        onChange={(v) => {
                          if (isValidDate(v)) startField.onChange(timeToMinute(v));
                        }}
                        slotProps={PICKER_SLOT_PROPS}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`hours.${index}.endMinute`}
                    render={({ field: endField }) => (
                      <TimePicker
                        label="Closes"
                        value={minuteToTime(endField.value)}
                        onChange={(v) => {
                          if (isValidDate(v)) endField.onChange(timeToMinute(v));
                        }}
                        slotProps={{
                          ...PICKER_SLOT_PROPS,
                          textField: {
                            ...PICKER_SLOT_PROPS.textField,
                            error: backwards,
                            helperText: backwards ? "Must be after opening" : undefined,
                          },
                        }}
                      />
                    )}
                  />
                  <IconButton size="small" aria-label="Remove this day" onClick={() => remove(index)} sx={{ mt: 0.5 }}>
                    <Trash2Icon size={14} />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
          <Button
            size="small"
            sx={{ mt: 1 }}
            startIcon={<PlusIcon size={14} />}
            disabled={days.length === 0}
            onClick={addRow}
          >
            Add a day
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button disabled={isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!canSubmit} onClick={() => void submit()}>
          {isPending ? <CircularProgress size={16} /> : "Save"}
        </Button>
      </DialogActions>
    </DatePickerProvider>
  );
}
