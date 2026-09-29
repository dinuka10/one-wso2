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

import { Avatar, Box, Button, Chip, Drawer, IconButton, Typography, alpha } from "@wso2/oxygen-ui";
import { Pencil as PencilIcon, X as XIcon } from "@wso2/oxygen-ui-icons-react";
import RichText from "@features/marketing-ops/event-platform/components/RichText";
import { useColorSchemeMode } from "@features/marketing-ops/event-platform/hooks/useColorSchemeMode";
import type {
  ConferenceDay,
  Session,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  SESSION_ROLE_LABELS,
  cardTimeLabel,
  itemColorHex,
} from "@features/marketing-ops/event-platform/utils/agenda";
import { isHttpUrl } from "./itemForm";

interface Props {
  session: Session | undefined;
  activeDay: ConferenceDay | undefined;
  onClose: () => void;
  onEdit: () => void;
  onEditArtifacts: () => void;
}

const headingSx = {
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  display: "block",
} as const;

// What a click on a board card opens: the session read-only, with the way on
// to its edit dialog or its artifacts.
export default function SessionPreviewDrawer({ session, activeDay, onClose, onEdit, onEditArtifacts }: Props) {
  const scheme = useColorSchemeMode();
  const keynoteColor = session ? itemColorHex(session, null, null, scheme) : undefined;

  return (
    <Drawer
      anchor="right"
      open={session !== undefined}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 380, maxWidth: "100vw", p: 3, display: "flex", flexDirection: "column" } } }}
    >
      {session && (
        <>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
            <IconButton size="small" aria-label="Close preview" onClick={onClose}>
              <XIcon size={18} />
            </IconButton>
            <IconButton size="small" aria-label="Edit session" onClick={onEdit}>
              <PencilIcon size={18} />
            </IconButton>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
              <Chip
                label={session.kind === "keynote" ? "Keynote" : "Session"}
                size="small"
                sx={{
                  bgcolor: session.kind === "keynote" ? alpha(keynoteColor!, 0.12) : "action.selected",
                  color: session.kind === "keynote" ? keynoteColor : "text.secondary",
                  fontWeight: 600,
                  fontSize: 11,
                }}
              />
              {activeDay && session.slotIndex !== null && (
                <Typography variant="caption" color="text.secondary">
                  {cardTimeLabel(session, activeDay)}
                </Typography>
              )}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
              <RichText html={session.title} component="span" variant="inline" />
            </Typography>
          </Box>

          {session.description && (
            <RichText
              html={session.description}
              sx={{
                mb: 2.5,
                lineHeight: 1.7,
                color: "text.secondary",
                fontSize: "0.875rem",
                "& p": { margin: 0, marginBottom: 1 },
                "& p:last-child": { marginBottom: 0 },
              }}
            />
          )}

          {session.room && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={headingSx}>
                Room
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {session.room.name}
              </Typography>
            </Box>
          )}

          {session.speakers.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ ...headingSx, mb: 1 }}>
                Speakers
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {session.speakers.map(({ speaker, role }) => (
                  <Box key={speaker.id} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar
                      src={speaker.photoUrl ?? undefined}
                      alt=""
                      sx={{ width: 32, height: 32, fontSize: 14, bgcolor: "primary.main" }}
                    >
                      {speaker.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }} noWrap>
                        {speaker.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {SESSION_ROLE_LABELS[role]}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {(session.artifacts ?? []).length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ ...headingSx, mb: 1 }}>
                Artifacts
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {(session.artifacts ?? []).map((artifact) => (
                  <Box key={artifact.label} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 0 }} noWrap>
                      {artifact.label}
                    </Typography>
                    {/* Only an http(s) URL is a link; anything else shows as text. */}
                    <Typography
                      {...(isHttpUrl(artifact.url)
                        ? { component: "a", href: artifact.url, target: "_blank", rel: "noopener noreferrer" }
                        : { component: "span" })}
                      variant="caption"
                      color={isHttpUrl(artifact.url) ? "primary.main" : "text.secondary"}
                      sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
                    >
                      {artifact.url}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ mt: "auto", pt: 2, display: "flex", gap: 1 }}>
            <Button variant="outlined" size="small" fullWidth onClick={onEditArtifacts}>
              Edit Artifacts
            </Button>
            <Button variant="contained" size="small" fullWidth disableElevation onClick={onEdit}>
              Edit Session
            </Button>
          </Box>
        </>
      )}
    </Drawer>
  );
}
