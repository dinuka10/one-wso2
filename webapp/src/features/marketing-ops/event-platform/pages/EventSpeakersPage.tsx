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
import { useParams } from "react-router";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  InputAdornment,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useEvent } from "../api/event";
import { useListSessions } from "../api/sessions";
import { useToggleSpeakerVisibility } from "../api/speakers";
import { collectEventSpeakers, primaryRole } from "../components/speakers/eventSpeakers";
import SpeakerCard from "../components/speakers/SpeakerCard";
import SpeakerFormDialog from "../components/speakers/SpeakerFormDialog";
import SpeakerPreviewDrawer from "../components/speakers/SpeakerPreviewDrawer";
import type { Speaker, SpeakerType } from "../types/eventPlatformTypes";

// The source's EventSpeakersPage: the speakers on this event's sessions, each
// with the role they hold there, and the switch that hides one from the
// published agenda.
//
// The source listed every event's sessions and filtered here; the list is now
// fetched for this event only (see SessionFilters).

const EVENT_SPEAKER_TYPES: readonly SpeakerType[] = ["internal", "external"];

export default function EventSpeakersPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const {
    data: sessions = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useListSessions({ configId: eventId });
  // Only for the internal-logo default in the form; the page works without it.
  const { data: event } = useEvent(eventId);
  const toggleVisibility = useToggleSpeakerVisibility();

  const [previewing, setPreviewing] = useState<Speaker | null>(null);
  const [editing, setEditing] = useState<Speaker | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const allEntries = collectEventSpeakers(sessions);
  const query = search.trim().toLowerCase();
  const entries = query
    ? allEntries.filter(
        ({ speaker }) =>
          speaker.name.toLowerCase().includes(query) || speaker.title.toLowerCase().includes(query),
      )
    : allEntries;

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
        Couldn&apos;t load this event&apos;s sessions.
      </ErrorNotice>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3, flexWrap: "wrap" }}>
        {allEntries.length > 0 ? (
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
          variant="contained"
          disableElevation
          startIcon={<PlusIcon size={16} />}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Add Speaker
        </Button>
      </Box>

      {allEntries.length === 0 ? (
        <Box sx={{ textAlign: "center", mt: 8 }}>
          <Typography color="text.secondary">No speakers assigned yet.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Add speakers to sessions and they will appear here automatically.
          </Typography>
        </Box>
      ) : entries.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 8 }}>
          No speakers match your search.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {entries.map(({ speaker, roles }) => (
            <Grid key={speaker.id} size={{ xs: 12, sm: 6, md: 3 }}>
              <SpeakerCard
                speaker={speaker}
                onPreview={setPreviewing}
                onEdit={openEdit}
                sessionRole={primaryRole(roles)}
                // A moderator is never public, so there is nothing to toggle.
                onToggleVisibility={
                  speaker.speakerType !== "moderator"
                    ? (id, visible) => toggleVisibility.mutate({ id, visible })
                    : undefined
                }
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
        // A speaker added here is not on a session yet, so it will not show
        // on this page until one names it — hence the hint.
        hint={!editing ? "This speaker will also be added to the global speakers list." : undefined}
        typeOptions={EVENT_SPEAKER_TYPES}
        defaultInternalLogoUrl={event?.defaultInternalLogoUrl}
      />
    </Box>
  );
}
