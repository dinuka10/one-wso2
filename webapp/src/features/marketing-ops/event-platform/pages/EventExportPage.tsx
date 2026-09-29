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

// Sessions → Export: previews of the agenda and speakers JSON the marketing
// site renders from, their downloads, and the same two exports built into
// self-contained HTML pages for the public conference site.

import { useState } from "react";
import { useParams } from "react-router";
import { Box, Button, CircularProgress, Stack, Tab, Tabs, Typography } from "@wso2/oxygen-ui";
import { DownloadIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import {
  useAgendaPreview,
  useDownloadAgenda,
  useDownloadSpeakers,
  useEvent,
  useSpeakersPreview,
} from "@features/marketing-ops/event-platform/api/event";
import { useNotifyFailure } from "@features/marketing-ops/event-platform/api/base";
import {
  buildStaticAgendaHtml,
  buildStaticSpeakersHtml,
  saveHtmlFile,
} from "@features/marketing-ops/event-platform/utils/staticAgenda";

type PreviewId = "agenda" | "speakers";

export default function EventExportPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const [preview, setPreview] = useState<PreviewId>("agenda");

  const agendaPreview = useAgendaPreview(eventId);
  const speakersPreview = useSpeakersPreview(eventId);
  // Only for the event's default internal logo, which the agenda page shows
  // under an all-internal keynote panel.
  const { data: event } = useEvent(eventId);
  const downloadAgenda = useDownloadAgenda(eventId);
  const downloadSpeakers = useDownloadSpeakers(eventId);
  const notifyFailure = useNotifyFailure();

  const saveAgendaJson = () =>
    downloadAgenda.mutate(undefined, {
      onError: (err) => notifyFailure("Could not download the agenda JSON.", err),
    });
  const saveSpeakersJson = () =>
    downloadSpeakers.mutate(undefined, {
      onError: (err) => notifyFailure("Could not download the speakers JSON.", err),
    });

  // Built from the previews already on screen, so what is saved is what the
  // admin just read. Pure string building with no request, hence no pending
  // state; a malformed export surfaces as the builder's own message.
  const saveHtml = (build: () => string, filename: string, what: string) => {
    try {
      saveHtmlFile(build(), filename);
    } catch (err) {
      notifyFailure(`Could not build the ${what} page.`, err);
    }
  };

  const tabs = {
    agenda: { label: "Agenda JSON", query: agendaPreview, what: "agenda" },
    speakers: { label: "Speakers JSON", query: speakersPreview, what: "speakers" },
  } as const;
  const active = tabs[preview];
  const anyDownloading = downloadAgenda.isPending || downloadSpeakers.isPending;

  return (
    <Stack spacing={2} sx={{ minHeight: 0 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { md: "flex-start" }, justifyContent: "space-between" }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
          Preview and download the JSON files the marketing site renders from, or save the agenda and
          speakers as single HTML pages for the public site.
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", flexShrink: 0 }}>
          <Button variant="outlined" size="small" disabled={downloadAgenda.isPending} onClick={saveAgendaJson}>
            {downloadAgenda.isPending ? <CircularProgress size={14} /> : "Agenda JSON"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={downloadSpeakers.isPending}
            onClick={saveSpeakersJson}
          >
            {downloadSpeakers.isPending ? <CircularProgress size={14} /> : "Speakers JSON"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={!agendaPreview.data}
            onClick={() =>
              saveHtml(
                () =>
                  buildStaticAgendaHtml(agendaPreview.data, {
                    internalLogoUrl: event?.defaultInternalLogoUrl ?? null,
                  }),
                "agenda.html",
                "agenda",
              )
            }
          >
            Agenda HTML
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={!speakersPreview.data}
            onClick={() =>
              saveHtml(() => buildStaticSpeakersHtml(speakersPreview.data), "speakers.html", "speakers")
            }
          >
            Speakers HTML
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={anyDownloading ? undefined : <DownloadIcon size={16} />}
            disabled={anyDownloading}
            onClick={() => {
              saveAgendaJson();
              saveSpeakersJson();
            }}
          >
            {anyDownloading ? <CircularProgress size={14} color="inherit" /> : "Download both"}
          </Button>
        </Stack>
      </Stack>

      <Box>
        <Tabs
          value={preview}
          onChange={(_e, value: PreviewId) => setPreview(value)}
          aria-label="Export previews"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          {(Object.keys(tabs) as PreviewId[]).map((id) => (
            <Tab key={id} value={id} label={tabs[id].label} sx={{ textTransform: "none" }} />
          ))}
        </Tabs>
        <Box
          role="tabpanel"
          aria-label={active.label}
          sx={(theme) => ({
            maxHeight: "60vh",
            overflow: "auto",
            bgcolor: "grey.50",
            border: 1,
            borderTop: 0,
            borderColor: "divider",
            borderRadius: "0 0 8px 8px",
            p: 2.5,
            ...theme.applyStyles("dark", { bgcolor: "background.default" }),
          })}
        >
          {active.query.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
              <CircularProgress />
            </Box>
          ) : active.query.isError ? (
            <ErrorNotice
              error={active.query.error}
              onRetry={() => void active.query.refetch()}
              retrying={active.query.isFetching}
            >
              Could not load the {active.what} export.
            </ErrorNotice>
          ) : (
            <Box
              component="pre"
              sx={{
                m: 0,
                fontSize: 12.5,
                fontFamily: "monospace",
                lineHeight: 1.65,
                color: "text.primary",
                whiteSpace: "pre",
              }}
            >
              {JSON.stringify(active.query.data, null, 2)}
            </Box>
          )}
        </Box>
      </Box>
    </Stack>
  );
}
