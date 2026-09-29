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
  Grid,
  InputAdornment,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, SearchIcon, UploadIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDeleteSpeaker, useListSpeakers } from "../api/speakers";
import SpeakerCard from "../components/speakers/SpeakerCard";
import SpeakerCsvImportDialog from "../components/speakers/SpeakerCsvImportDialog";
import SpeakerFormDialog from "../components/speakers/SpeakerFormDialog";
import SpeakerPreviewDrawer from "../components/speakers/SpeakerPreviewDrawer";
import type { Speaker, SpeakerType } from "../types/eventPlatformTypes";

// The source's SpeakersPage: the speaker library every event draws from —
// search, add, edit, delete, preview, and CSV import.

// As in the source, the speaker pages offer only internal and external. An
// existing keynote or moderator keeps that type — the form always offers a
// speaker's current one.
const LIBRARY_TYPES: readonly SpeakerType[] = ["internal", "external"];

export default function SpeakerLibraryPage() {
  const { data: speakers = [], isLoading, isError, error, refetch, isRefetching } = useListSpeakers();
  const deleteSpeaker = useDeleteSpeaker();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Speaker | null>(null);
  const [previewing, setPreviewing] = useState<Speaker | null>(null);
  const [search, setSearch] = useState("");
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  const query = search.trim().toLowerCase();
  const visibleSpeakers = query
    ? speakers.filter(
        (s) => s.name.toLowerCase().includes(query) || s.title.toLowerCase().includes(query),
      )
    : speakers;

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(s: Speaker) {
    setPreviewing(null);
    setEditing(s);
    setDialogOpen(true);
  }

  function closeForm() {
    setDialogOpen(false);
    setEditing(null);
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <ErrorNotice error={error} onRetry={() => void refetch()} retrying={isRefetching}>
        Couldn&apos;t load the speakers.
      </ErrorNotice>
    );
  }

  return (
    <Box>
      {/* The shell titles the page, so the source's heading row keeps only
          its search and actions. */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3, flexWrap: "wrap" }}>
        {speakers.length > 0 ? (
          <TextField
            size="small"
            placeholder="Search speakers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
              },
            }}
          />
        ) : (
          <Box sx={{ flex: 1 }} />
        )}
        <Button
          variant="outlined"
          startIcon={<UploadIcon size={16} />}
          onClick={() => setCsvImportOpen(true)}
        >
          Import CSV
        </Button>
        <Button variant="contained" disableElevation startIcon={<PlusIcon size={16} />} onClick={openAdd}>
          Add Speaker
        </Button>
      </Box>

      {speakers.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 8 }}>
          No speakers yet. Add one to get started.
        </Typography>
      ) : visibleSpeakers.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 8 }}>
          No speakers match your search.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {visibleSpeakers.map((s) => (
            <Grid key={s.id} size={{ xs: 12, sm: 6, md: 3 }}>
              <SpeakerCard
                speaker={s}
                onPreview={setPreviewing}
                onEdit={openEdit}
                onDelete={(id) => deleteSpeaker.mutate(id)}
                showType={false}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <SpeakerPreviewDrawer speaker={previewing} onClose={() => setPreviewing(null)} onEdit={openEdit} />

      <SpeakerFormDialog
        open={dialogOpen}
        speaker={editing}
        onClose={closeForm}
        onSaved={closeForm}
        typeOptions={LIBRARY_TYPES}
      />

      <SpeakerCsvImportDialog open={csvImportOpen} onClose={() => setCsvImportOpen(false)} />
    </Box>
  );
}
