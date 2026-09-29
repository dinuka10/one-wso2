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
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  MessageSquarePlus as AddFootnoteIcon,
  MessageSquareText as FootnoteIcon,
  Pencil as PencilIcon,
  Trash2 as TrashIcon,
} from "@wso2/oxygen-ui-icons-react";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import type { TimeslotFootnote } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";

const FOOTNOTE_MAX_LENGTH = 500;

// Inherits the tooltip's own colour so the controls read against its dark
// surface instead of the board's background.
const tooltipActionSx = {
  width: 16,
  height: 16,
  padding: 0,
  flexShrink: 0,
  color: "inherit",
  opacity: 0.7,
  "&:hover": { opacity: 1, bgcolor: "transparent" },
};

interface TimeslotFootnotesProps {
  slot: number;
  footnotes: TimeslotFootnote[];
  isPending: boolean;
  // Each calls onSuccess once saved; the dialog stays open until then.
  onAdd: (slotIndex: number, text: string, onSuccess: () => void) => void;
  onUpdate: (id: string, text: string, onSuccess: () => void) => void;
  onDelete: (id: string) => void;
}

// Popup body for a slot's footnotes, passed as a Tooltip title the same way
// CardTooltipContent is. Editing and deleting live in here rather than in the
// time column because that column is 90px wide, too narrow for the text to
// sit beside its own controls.
function FootnoteTooltipContent({
  footnotes,
  onEdit,
  onDelete,
}: {
  footnotes: TimeslotFootnote[];
  onEdit: (footnote: TimeslotFootnote) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Box sx={{ lineHeight: 1.5, maxWidth: 240 }}>
      {footnotes.map((footnote, index) => (
        <Box
          key={footnote.id}
          sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, mt: index === 0 ? 0 : 0.75 }}
        >
          <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 11, wordBreak: "break-word" }}>
            {footnote.text}
          </Box>
          <IconButton size="small" aria-label="Edit footnote" sx={tooltipActionSx} onClick={() => onEdit(footnote)}>
            <PencilIcon size={11} />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Delete footnote"
            sx={tooltipActionSx}
            onClick={() => onDelete(footnote.id)}
          >
            <TrashIcon size={11} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}

// Footnotes anchored to a single 30-minute time label. A slot that carries
// notes shows a persistent icon; everything about those notes, including the
// text itself, lives in the icon's hover popup. The add control stays
// hover-only via a stable className read by an "&:hover" selector on the
// ancestor label Box, so the reveal survives re-renders from unrelated query
// invalidations.
export default function TimeslotFootnotes({
  slot,
  footnotes,
  isPending,
  onAdd,
  onUpdate,
  onDelete,
}: TimeslotFootnotesProps) {
  const [editing, setEditing] = useState<{ id: string | null; text: string } | null>(null);

  const close = () => setEditing(null);

  const text = editing?.text ?? "";
  const overLimit = text.length > FOOTNOTE_MAX_LENGTH;
  const canSave = text.trim().length > 0 && !overLimit;

  const handleSave = () => {
    if (!editing || !canSave || isPending) return;
    const value = text.trim();
    if (editing.id) onUpdate(editing.id, value, close);
    else onAdd(slot, value, close);
  };

  const handleKeyDown = useSubmitShortcut(handleSave, canSave && !isPending);

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
        {footnotes.length > 0 && (
          <Tooltip
            title={
              <FootnoteTooltipContent
                footnotes={footnotes}
                onEdit={(footnote) => setEditing({ id: footnote.id, text: footnote.text })}
                onDelete={onDelete}
              />
            }
            placement="right"
            arrow
            leaveDelay={150}
          >
            <Box
              tabIndex={0}
              aria-label={`${footnotes.length} footnote${footnotes.length > 1 ? "s" : ""} on this timeslot`}
              onMouseDown={(e) => e.stopPropagation()}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                color: "text.secondary",
                cursor: "default",
                "&:hover": { color: "text.primary" },
              }}
            >
              <FootnoteIcon size={11} />
              {footnotes.length > 1 && (
                <Box component="span" sx={{ fontSize: 9, lineHeight: 1 }}>
                  {footnotes.length}
                </Box>
              )}
            </Box>
          </Tooltip>
        )}
        <IconButton
          className="footnote-add"
          size="small"
          aria-label="Add footnote"
          sx={{
            opacity: 0,
            transition: "opacity 0.15s",
            width: 14,
            height: 14,
            padding: 0,
            flexShrink: 0,
            color: "text.secondary",
            "&:hover": { color: "text.primary", bgcolor: "transparent" },
            "&:focus-visible": { opacity: 1 },
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setEditing({ id: null, text: "" });
          }}
        >
          <AddFootnoteIcon size={11} />
        </IconButton>
      </Box>

      <Dialog open={editing !== null} onClose={isPending ? undefined : close} maxWidth="xs" fullWidth onKeyDown={handleKeyDown}>
        <DialogTitle sx={{ fontWeight: 600 }}>{editing?.id ? "Edit footnote" : "Add footnote"}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            multiline
            minRows={3}
            fullWidth
            value={text}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, text: e.target.value } : prev))}
            placeholder="Add a note for this timeslot"
            sx={{ mt: 1 }}
          />
          <Typography
            variant="caption"
            color={overLimit ? "error" : "text.secondary"}
            sx={{ display: "block", mt: 0.5, textAlign: "right" }}
          >
            {text.length} / {FOOTNOTE_MAX_LENGTH}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={close} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="contained" disableElevation onClick={handleSave} disabled={!canSave || isPending}>
            {isPending ? <CircularProgress size={16} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
