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
  Alert,
  Avatar,
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
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useCreateSpeaker, useUpdateSpeaker } from "../../api/speakers";
import { describeEventPlatformError } from "../../api/responses";
import { useSubmitShortcut } from "../../hooks/useSubmitShortcut";
import type { Speaker, SpeakerType } from "../../types/eventPlatformTypes";
import {
  INTERNAL_COMPANY_NAME,
  isSpeakerFormValid,
  speakerFormValues,
  speakerTypeChoices,
  toSpeakerInput,
  type SpeakerFormValues,
} from "./speakerFormValues";
import { SPEAKER_TYPE_LABELS } from "./speakerTypes";

export interface SpeakerFormDialogProps {
  open: boolean;
  /** The speaker to edit, or null to add one to the (global) library. */
  speaker: Speaker | null;
  onClose: () => void;
  /** After the server accepted the save, with the speaker it returned. The dialog does not close itself. */
  onSaved: (speaker: Speaker) => void;
  /** An info line above the fields — e.g. that a speaker added here joins the global library. */
  hint?: string;
  /** Restricts the type Select (all four when omitted). A speaker's current type is always kept. */
  typeOptions?: readonly SpeakerType[];
  /**
   * Prefilled as the company logo when an internal type is picked and the
   * logo is empty — the event's `defaultInternalLogoUrl`, where there is one.
   */
  defaultInternalLogoUrl?: string | null;
}

// Add or edit one speaker. It owns the create/update calls, so any screen —
// the library, an event's speakers, the session editor's speaker picker — can
// open it with just a speaker (or null) and hear back what was saved.
export default function SpeakerFormDialog({ open, onClose, ...formProps }: SpeakerFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      {/* Keyed so a different speaker gets fresh field state without the
          Dialog replaying its open animation. */}
      <SpeakerForm key={formProps.speaker?.id ?? "new"} onClose={onClose} {...formProps} />
    </Dialog>
  );
}

function SpeakerForm({
  speaker,
  onClose,
  onSaved,
  hint,
  typeOptions,
  defaultInternalLogoUrl,
}: Omit<SpeakerFormDialogProps, "open">) {
  const { showError } = useNotifications();
  const createSpeaker = useCreateSpeaker();
  const updateSpeaker = useUpdateSpeaker();
  const isPending = createSpeaker.isPending || updateSpeaker.isPending;

  const { control, getValues, setValue, handleSubmit } = useForm<SpeakerFormValues>({
    defaultValues: speakerFormValues(speaker),
  });
  const [name, title, speakerType, photoUrl, companyLogoUrl] = useWatch({
    control,
    name: ["name", "title", "speakerType", "photoUrl", "companyLogoUrl"],
  });

  const isValid = isSpeakerFormValid({ name, title, speakerType });
  const showCompanyLogo = speakerType === "internal" || speakerType === "external";
  const types = speakerTypeChoices(typeOptions, speaker?.speakerType ?? "");

  const save = handleSubmit(async (values) => {
    const input = toSpeakerInput(values);
    try {
      const saved = speaker
        ? await updateSpeaker.mutateAsync({ id: speaker.id, ...input })
        : await createSpeaker.mutateAsync(input);
      onSaved(saved);
    } catch (err) {
      showError(`Couldn't save the speaker. ${describeEventPlatformError(err)}`);
    }
  });
  const submit = () => {
    if (isValid && !isPending) void save();
  };
  const handleKeyDown = useSubmitShortcut(submit, isValid && !isPending);

  const onTypeChange = (next: SpeakerType | "") => {
    setValue("speakerType", next);
    // An internal speaker's company is the organiser; fill it (and the event's
    // default logo, when known) rather than make every entry retype it.
    if (next === "internal") {
      const current = getValues();
      if (!current.company.trim()) setValue("company", INTERNAL_COMPANY_NAME);
      if (!current.companyLogoUrl.trim() && defaultInternalLogoUrl) {
        setValue("companyLogoUrl", defaultInternalLogoUrl);
      }
    }
  };

  return (
    <>
      <DialogTitle>{speaker ? "Edit speaker" : "Add speaker"}</DialogTitle>
      <DialogContent
        onKeyDown={handleKeyDown}
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}
      >
        {hint && (
          <Alert severity="info" variant="outlined">
            {hint}
          </Alert>
        )}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {photoUrl && <Avatar src={photoUrl} alt="Speaker photo preview" />}
          <Controller
            control={control}
            name="photoUrl"
            render={({ field }) => (
              <TextField
                {...field}
                label="Photo URL"
                size="small"
                fullWidth
                placeholder="https://example.com/photo.jpg"
              />
            )}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, flexDirection: { xs: "column", sm: "row" } }}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <TextField {...field} label="Name" required autoFocus size="small" fullWidth />
            )}
          />
          <Controller
            control={control}
            name="title"
            render={({ field }) => <TextField {...field} label="Title" required size="small" fullWidth />}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, flexDirection: { xs: "column", sm: "row" } }}>
          <FormControl size="small" fullWidth required>
            <InputLabel id="speaker-type-label">Speaker type</InputLabel>
            <Select
              labelId="speaker-type-label"
              label="Speaker type"
              value={speakerType}
              displayEmpty
              onChange={(e) => onTypeChange(e.target.value as SpeakerType | "")}
            >
              <MenuItem value="" disabled>
                Select a type
              </MenuItem>
              {types.map((t) => (
                <MenuItem key={t} value={t}>
                  {SPEAKER_TYPE_LABELS[t]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Controller
            control={control}
            name="company"
            render={({ field }) => <TextField {...field} label="Company" size="small" fullWidth />}
          />
        </Box>
        <Controller
          control={control}
          name="linkedinUrl"
          render={({ field }) => (
            <TextField
              {...field}
              label="LinkedIn URL"
              size="small"
              fullWidth
              placeholder="https://linkedin.com/in/..."
            />
          )}
        />
        <Controller
          control={control}
          name="bio"
          render={({ field }) => (
            <TextField {...field} label="Bio" multiline rows={4} size="small" fullWidth />
          )}
        />
        {showCompanyLogo && (
          <Box>
            <Typography variant="caption">Company logo</Typography>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mt: 0.5 }}>
              {companyLogoUrl && (
                <Avatar src={companyLogoUrl} alt="Company logo preview" variant="rounded" />
              )}
              <Controller
                control={control}
                name="companyLogoUrl"
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Company logo URL"
                    size="small"
                    fullWidth
                    placeholder="https://example.com/logo.png"
                  />
                )}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2, mt: 1, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                control={control}
                name="companyLogoSize"
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Card Logo Size/Styles"
                    placeholder="e.g. width: 120px; height: 90px;"
                    size="small"
                    fullWidth
                  />
                )}
              />
              <Controller
                control={control}
                name="modalCompanyLogoSize"
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Modal Logo Size/Styles"
                    placeholder="e.g. width: 120px; height: 90px;"
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!isValid || isPending} onClick={submit}>
          {isPending ? <CircularProgress size={16} /> : "Save"}
        </Button>
      </DialogActions>
    </>
  );
}
