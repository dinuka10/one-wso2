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
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import RichText from "@features/marketing-ops/event-platform/components/RichText";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import type {
  Session,
  SessionArtifact,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { isLinkValid } from "./itemForm";

interface Props {
  open: boolean;
  session: Session | null;
  // The event's artifact labels (Settings); each row picks one.
  artifactLabels: string[];
  isPending: boolean;
  onSave: (artifacts: SessionArtifact[]) => void;
  onClose: () => void;
}

// Edits a session's artifact links (slides, recording, …). Rows are read from
// the session once, on mount — the caller keys this on the session id. A row
// without a URL is dropped on save rather than refused; one whose URL isn't
// http(s) blocks the save.
export default function ArtifactEditDialog({
  open,
  session,
  artifactLabels,
  isPending,
  onSave,
  onClose,
}: Props) {
  const [rows, setRows] = useState<SessionArtifact[]>(() => session?.artifacts ?? []);

  const addRow = () => setRows((prev) => [...prev, { label: artifactLabels[0] ?? "", url: "" }]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const updateRow = (idx: number, field: keyof SessionArtifact, value: string) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const allLinksValid = rows.every((r) => isLinkValid(r.url));
  const canSave = !isPending && artifactLabels.length > 0 && allLinksValid;

  const handleSave = () => {
    if (!canSave) return;
    onSave(
      rows.filter((r) => r.label && r.url.trim()).map((r) => ({ label: r.label, url: r.url.trim() })),
    );
  };

  const handleKeyDown = useSubmitShortcut(handleSave, canSave);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth onKeyDown={handleKeyDown}>
      <DialogTitle sx={{ fontWeight: 600 }}>
        Edit Artifacts
        {session && (
          <Typography component="div" variant="body2" color="text.secondary" sx={{ fontWeight: 400, mt: 0.25 }}>
            <RichText html={session.title} component="span" variant="inline" />
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {artifactLabels.length === 0 ? (
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No artifact labels defined. Add labels in Event Settings to enable artifacts.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 1 }}>
            {rows.map((row, idx) => (
              // Rows have no id of their own, and two may share a label.
              <Box key={idx} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Select
                  size="small"
                  value={row.label}
                  onChange={(e) => updateRow(idx, "label", String(e.target.value))}
                  sx={{ minWidth: 160 }}
                  inputProps={{ "aria-label": "Artifact label" }}
                >
                  {artifactLabels.map((label) => (
                    <MenuItem key={label} value={label}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
                <TextField
                  size="small"
                  value={row.url}
                  onChange={(e) => updateRow(idx, "url", e.target.value)}
                  placeholder="https://"
                  type="url"
                  fullWidth
                  error={!isLinkValid(row.url)}
                  helperText={isLinkValid(row.url) ? undefined : "Must start with http:// or https://"}
                  slotProps={{ htmlInput: { "aria-label": "Artifact URL" } }}
                />
                <IconButton size="small" onClick={() => removeRow(idx)} aria-label="Remove artifact">
                  ×
                </IconButton>
              </Box>
            ))}
            <Button
              size="small"
              variant="outlined"
              sx={{ alignSelf: "flex-start", mt: 0.5 }}
              disabled={isPending}
              onClick={addRow}
            >
              + Add artifact
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={handleSave}
          disabled={!canSave}
        >
          {isPending ? <CircularProgress size={16} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
