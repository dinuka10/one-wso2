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
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { eventPlatformKeys as keys } from "@features/marketing-ops/event-platform/api/queryKeys";
import { useCreateSession } from "@features/marketing-ops/event-platform/api/sessions";
import { useListSpeakers } from "@features/marketing-ops/event-platform/api/speakers";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import type { Speaker } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  SESSION_CSV_COLUMNS,
  parseSessionCsv,
  textToBlockHtml,
  textToInlineHtml,
  type ParsedSessionRow,
} from "./sessionCsv";

interface Props {
  configId: string;
  open: boolean;
  onClose: () => void;
}

type Step = "pick" | "preview" | "importing";

interface ImportState {
  done: number;
  total: number;
  failed: number;
}

function FilePicker({
  onParsed,
  speakers,
}: {
  onParsed: (rows: ParsedSessionRow[], unmatched: string[]) => void;
  speakers: Speaker[];
}) {
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Browsers suppress onChange when the same file is chosen again; clearing
    // the value re-arms it.
    e.target.value = "";
    if (!file) return;
    file
      .text()
      .then((text) => {
        const { rows, unmatched } = parseSessionCsv(text, speakers);
        if (rows.length === 0) {
          setError("No data rows found. Make sure the file has a header and at least one row.");
          return;
        }
        setError(null);
        onParsed(rows, unmatched);
      })
      .catch(() => setError("Couldn't read that file."));
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, py: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Upload a CSV with columns: {SESSION_CSV_COLUMNS.join(", ")}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        speaker_names should be semicolon-separated. kind is &quot;session&quot; or &quot;keynote&quot;
        (default: session).
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Button variant="outlined" component="label">
        Choose CSV file
        <input type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
      </Button>
    </Box>
  );
}

function Preview({
  rows,
  unmatched,
  onBack,
  onImport,
}: {
  rows: ParsedSessionRow[];
  unmatched: string[];
  onBack: () => void;
  onImport: () => void;
}) {
  const validCount = rows.filter((r) => r.valid).length;

  return (
    <>
      {unmatched.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some speaker names could not be matched: {unmatched.join(", ")}. These will be skipped.
        </Alert>
      )}
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Speakers</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i} sx={!row.valid ? { opacity: 0.5 } : undefined}>
                <TableCell>{row.title || <em>empty</em>}</TableCell>
                <TableCell>{row.kind}</TableCell>
                <TableCell>{row.durationMinutes} min</TableCell>
                <TableCell>
                  {row.matchedSpeakerIds.length}/{row.speakerNames.length}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color={row.valid ? "success.main" : "error.main"}>
                    {row.valid ? "ready" : "invalid"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" disabled={validCount === 0} onClick={onImport}>
          Import {validCount} session{validCount !== 1 ? "s" : ""}
        </Button>
      </Box>
    </>
  );
}

function Importing({ state, onDone }: { state: ImportState; onDone: () => void }) {
  const progress = state.total > 0 ? (state.done / state.total) * 100 : 0;
  const finished = state.done === state.total;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, py: 1 }}>
      <Typography variant="body2">
        {finished ? "Import complete." : `Importing ${state.done} of ${state.total}...`}
      </Typography>
      <LinearProgress variant="determinate" value={progress} />
      {state.failed > 0 && (
        <Alert severity="warning">
          {state.failed} row{state.failed !== 1 ? "s" : ""} failed to import.
        </Alert>
      )}
      {finished && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="contained" onClick={onDone}>
            Done
          </Button>
        </Box>
      )}
    </Box>
  );
}

function Content({
  configId,
  onClose,
  onLockChange,
}: {
  configId: string;
  onClose: () => void;
  // True while rows are being created, so the dialog can't be dismissed.
  onLockChange: (locked: boolean) => void;
}) {
  const { data: speakers = [] } = useListSpeakers();
  const createSession = useCreateSession();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("pick");
  const [rows, setRows] = useState<ParsedSessionRow[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [importState, setImportState] = useState<ImportState>({ done: 0, total: 0, failed: 0 });

  const handleParsed = (parsed: ParsedSessionRow[], parsedUnmatched: string[]) => {
    setRows(parsed);
    setUnmatched(parsedUnmatched);
    setStep("preview");
  };

  // One at a time, not in parallel: the backend rate-limits per client, and
  // the progress bar counts them off in order. Every row becomes an
  // unscheduled session with its matched speakers as externals, as in the
  // source; a failed row is counted and the rest carry on.
  const handleImport = async () => {
    const valid = rows.filter((r) => r.valid);
    setImportState({ done: 0, total: valid.length, failed: 0 });
    setStep("importing");
    onLockChange(true);

    let failed = 0;
    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      try {
        await createSession.mutateAsync({
          configId,
          kind: row.kind,
          // Titles and descriptions are stored as rich text; the CSV's are plain.
          title: textToInlineHtml(row.title),
          description: textToBlockHtml(row.description),
          durationSlots: row.durationSlots,
          speakerAssignments: row.matchedSpeakerIds.map((speakerId) => ({ speakerId, role: "external" })),
          dayId: null,
          trackId: null,
          slotIndex: null,
        });
      } catch {
        failed += 1;
      }
      setImportState({ done: i + 1, total: valid.length, failed });
    }
    onLockChange(false);
  };

  const handleDone = () => {
    qc.invalidateQueries({ queryKey: keys.sessionsRoot });
    onClose();
  };

  const validCount = rows.filter((r) => r.valid).length;
  const importFinished = importState.total > 0 && importState.done === importState.total;
  const canImport = step === "preview" && validCount > 0;
  const canFinish = step === "importing" && importFinished;
  const handleKeyDown = useSubmitShortcut(() => {
    if (canImport) void handleImport();
    else if (canFinish) handleDone();
  }, canImport || canFinish);

  return (
    <>
      <DialogTitle>Import sessions from CSV</DialogTitle>
      <DialogContent onKeyDown={handleKeyDown}>
        {step === "pick" && <FilePicker speakers={speakers} onParsed={handleParsed} />}
        {step === "preview" && (
          <Preview
            rows={rows}
            unmatched={unmatched}
            onBack={() => setStep("pick")}
            onImport={() => void handleImport()}
          />
        )}
        {step === "importing" && <Importing state={importState} onDone={handleDone} />}
      </DialogContent>
      {step === "pick" && (
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
        </DialogActions>
      )}
    </>
  );
}

// Imports unscheduled sessions from a CSV: pick a file, preview what would be
// created, then create them one by one. Backdrop and Escape do nothing while
// the rows go in: closing would unmount the progress but not stop the loop,
// and a second import would then duplicate what the first was still adding.
export default function SessionCsvImportDialog({ configId, open, onClose }: Props) {
  const [locked, setLocked] = useState(false);
  return (
    <Dialog open={open} onClose={locked ? undefined : onClose} maxWidth="md" fullWidth>
      <Content key={open ? "open" : "closed"} configId={configId} onClose={onClose} onLockChange={setLocked} />
    </Dialog>
  );
}
