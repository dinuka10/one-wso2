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


import { useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { eventPlatformKeys as keys } from "../../api/queryKeys";
import { useCreateSpeaker, useListSpeakers, useUpdateSpeaker } from "../../api/speakers";
import { useSubmitShortcut } from "../../hooks/useSubmitShortcut";
import {
  csvCreateInput,
  csvReplaceInput,
  isActionableRow,
  parseSpeakerCsv,
  type DuplicateAction,
  type SpeakerPreviewRow,
} from "./speakerCsv";

type DialogStep = "idle" | "preview" | "importing" | "done";
type ImportProgress = "success" | "error";

interface ImportRow extends SpeakerPreviewRow {
  progress?: ImportProgress;
}

interface SpeakerCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
}

// Pick a CSV, review what it would add or replace, then import row by row.
// One request per row, in order, as the source did: the backend has no bulk
// endpoint, and one at a time keeps a big file under its rate limit.
export default function SpeakerCsvImportDialog({ open, onClose }: SpeakerCsvImportDialogProps) {
  const [step, setStep] = useState<DialogStep>("idle");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const { data: speakers = [] } = useListSpeakers();
  const createSpeaker = useCreateSpeaker();
  const updateSpeaker = useUpdateSpeaker();
  const queryClient = useQueryClient();

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Browsers suppress onChange when the same file is chosen again; clearing
    // the value re-arms it.
    e.target.value = "";
    if (!file) return;

    file
      .text()
      .then((text) => {
        const result = parseSpeakerCsv(text, speakers);
        if (result.error) {
          setParseError(result.error);
          return;
        }
        setParseError(null);
        setRows(result.rows);
        setStep("preview");
      })
      .catch(() => setParseError("Failed to read the file."));
  }

  function setDuplicateAction(index: number, action: DuplicateAction) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, duplicateAction: action } : r)));
  }

  const markRow = (index: number, progress: ImportProgress) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, progress } : r)));

  async function handleImport() {
    setStep("importing");
    for (const [i, row] of rows.entries()) {
      if (!isActionableRow(row)) continue;
      try {
        if (row.status === "new") {
          await createSpeaker.mutateAsync(csvCreateInput(row.parsed));
        } else if (row.existing) {
          await updateSpeaker.mutateAsync({
            id: row.existing.id,
            ...csvReplaceInput(row.parsed, row.existing),
          });
        }
        markRow(i, "success");
      } catch {
        // Shown on the row; the rest of the file still goes through.
        markRow(i, "error");
      }
    }
    setStep("done");
  }

  function reset() {
    setStep("idle");
    setRows([]);
    setParseError(null);
  }

  function handleDone() {
    void queryClient.invalidateQueries({ queryKey: keys.speakers });
    reset();
    onClose();
  }

  const actionableCount = rows.filter(isActionableRow).length;
  const doneCount = rows.filter((r) => r.progress).length;
  const progressValue = actionableCount > 0 ? (doneCount / actionableCount) * 100 : 0;

  const newCount = rows.filter((r) => r.status === "new").length;
  const dupCount = rows.filter((r) => r.status === "duplicate").length;
  const invalidCount = rows.filter((r) => r.status === "invalid").length;
  const allInvalid = rows.length > 0 && rows.every((r) => r.status === "invalid");
  const successCount = rows.filter((r) => r.progress === "success").length;
  const errorCount = rows.filter((r) => r.progress === "error").length;

  const handleKeyDown = useSubmitShortcut(
    () => {
      if (step === "preview" && !allInvalid) void handleImport();
      else if (step === "done") handleDone();
    },
    step === "preview" || step === "done",
  );

  return (
    <Dialog
      open={open}
      // No way out mid-import: closing would leave the loop running unseen.
      onClose={step === "importing" ? undefined : onClose}
      maxWidth="md"
      fullWidth
      onKeyDown={handleKeyDown}
    >
      <DialogTitle>Import speakers from CSV</DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        {step === "idle" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Upload a CSV with columns:{" "}
              <code>name, title, bio, type, company, linkedin_url, photo_url</code>. The first row
              must be a header.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Valid types: <code>keynote</code>, <code>internal</code>, <code>external</code>,{" "}
              <code>moderator</code>. Defaults to <code>external</code> if unrecognised.
            </Typography>
            {parseError && (
              <Typography variant="body2" color="error">
                {parseError}
              </Typography>
            )}
            <Button variant="outlined" component="label" sx={{ alignSelf: "flex-start" }}>
              Choose CSV file
              <input type="file" accept=".csv,text/csv" hidden onChange={handleFileChange} />
            </Button>
          </Box>
        )}

        {step !== "idle" && (
          <>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Typography variant="body2">
                {newCount} new, {dupCount} duplicate{dupCount !== 1 ? "s" : ""}, {invalidCount} invalid
              </Typography>
              {step === "importing" && (
                <LinearProgress
                  variant="determinate"
                  value={progressValue}
                  sx={{ flex: 1, minWidth: 120 }}
                />
              )}
              {step === "done" && (
                <Typography variant="body2" color="text.secondary">
                  {successCount} imported, {errorCount} failed
                </Typography>
              )}
            </Box>

            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, i) => (
                    // A CSV row has no id of its own; its position is its identity.
                    <TableRow key={i}>
                      <TableCell>{row.parsed.name || <em>empty</em>}</TableCell>
                      <TableCell>{row.parsed.title}</TableCell>
                      <TableCell>{row.parsed.speakerType}</TableCell>
                      <TableCell>
                        <RowStatusChip row={row} />
                      </TableCell>
                      <TableCell>
                        {row.status === "duplicate" && step === "preview" && (
                          <RadioGroup
                            row
                            value={row.duplicateAction}
                            onChange={(_, v) => setDuplicateAction(i, v as DuplicateAction)}
                          >
                            <FormControlLabel
                              value="keep"
                              control={<Radio size="small" />}
                              label="Keep existing"
                            />
                            <FormControlLabel
                              value="replace"
                              control={<Radio size="small" />}
                              label="Replace"
                            />
                          </RadioGroup>
                        )}
                        {row.status === "duplicate" && step !== "preview" && (
                          <Typography variant="body2" color="text.secondary">
                            {row.duplicateAction === "keep" ? "Kept existing" : "Replaced"}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        {step === "idle" && <Button onClick={onClose}>Cancel</Button>}
        {step === "preview" && (
          <>
            <Button onClick={reset}>Back</Button>
            <Button variant="contained" disabled={allInvalid} onClick={() => void handleImport()}>
              Import
            </Button>
          </>
        )}
        {step === "importing" && <Button disabled>Importing...</Button>}
        {step === "done" && (
          <Button variant="contained" onClick={handleDone}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function RowStatusChip({ row }: { row: ImportRow }) {
  if (row.progress === "success") return <Chip label="Imported" color="success" size="small" />;
  if (row.progress === "error") return <Chip label="Error" color="error" size="small" />;
  if (row.status === "new") return <Chip label="New" color="success" size="small" />;
  if (row.status === "duplicate") return <Chip label="Duplicate" color="warning" size="small" />;
  return <Chip label="Invalid" color="error" size="small" />;
}
