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
  Avatar,
  Box,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  EyeIcon,
  EyeOffIcon,
  LinkedinIcon,
  PencilIcon,
  Trash2Icon,
} from "@wso2/oxygen-ui-icons-react";
import ConfirmationDialog, {
  type ConfirmationContent,
} from "@components/confirmation-dialog/ConfirmationDialog";
import type { SessionSpeakerRole, Speaker } from "../../types/eventPlatformTypes";
import { SESSION_ROLE_LABELS } from "../../utils/agenda";
import { ExternalSpeakerChip, InternalSpeakerBadge } from "./SpeakerBadges";
import { SPEAKER_TYPE_LABELS } from "./speakerTypes";

interface SpeakerCardProps {
  speaker: Speaker;
  onPreview: (s: Speaker) => void;
  onEdit?: (s: Speaker) => void;
  // Asks first; called only once the delete is confirmed.
  onDelete?: (id: string) => void;
  onToggleVisibility?: (id: string, visible: boolean) => void;
  // The library hides the type chip (every speaker there has one); an event's
  // page shows the role they hold in its sessions instead.
  showType?: boolean;
  sessionRole?: SessionSpeakerRole;
}

// One speaker in a grid: photo, name, type or role, title, company and the
// start of the bio. Clicking the body opens the preview; the actions sit below.
export default function SpeakerCard({
  speaker,
  onPreview,
  onEdit,
  onDelete,
  onToggleVisibility,
  showType = true,
  sessionRole,
}: SpeakerCardProps) {
  const [confirmation, setConfirmation] = useState<ConfirmationContent | null>(null);

  const hasActions = speaker.linkedinUrl || onEdit || onDelete || onToggleVisibility;

  return (
    <>
      <Card
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          opacity: speaker.visible ? 1 : 0.6,
          position: "relative",
        }}
      >
        <CardContent
          sx={{ flex: 1, textAlign: "center", cursor: "pointer" }}
          onClick={() => onPreview(speaker)}
        >
          <Avatar
            src={speaker.photoUrl ?? undefined}
            sx={{ width: 72, height: 72, mb: 1.5, mx: "auto", bgcolor: "primary.main", fontSize: 28 }}
          >
            {speaker.name.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
            {speaker.name}
          </Typography>
          {speaker.speakerType === "internal" && (
            <Box sx={{ position: "absolute", top: 10, right: 10 }}>
              <InternalSpeakerBadge />
            </Box>
          )}
          {speaker.speakerType === "external" && (
            <Box sx={{ position: "absolute", top: 8, right: 8 }}>
              {speaker.companyLogoUrl ? (
                <Tooltip title={speaker.company || "External"}>
                  <Box
                    component="img"
                    src={speaker.companyLogoUrl}
                    alt={speaker.company || "External"}
                    sx={{ height: 64, width: 64, objectFit: "contain", display: "block" }}
                  />
                </Tooltip>
              ) : (
                <ExternalSpeakerChip />
              )}
            </Box>
          )}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 0.5,
              flexWrap: "wrap",
              mb: 0.5,
            }}
          >
            {sessionRole ? (
              <Chip
                label={SESSION_ROLE_LABELS[sessionRole]}
                size="small"
                variant="outlined"
                color={sessionRole === "moderator" ? "warning" : "default"}
              />
            ) : showType ? (
              <Chip
                label={SPEAKER_TYPE_LABELS[speaker.speakerType]}
                size="small"
                variant="outlined"
                color={speaker.speakerType === "moderator" ? "warning" : "default"}
              />
            ) : null}
            {/* Moderators never reach the public agenda, whatever `visible` says. */}
            {speaker.speakerType === "moderator" && (
              <Chip label="Not public" size="small" variant="outlined" />
            )}
            {!speaker.visible && speaker.speakerType !== "moderator" && (
              <Chip label="Hidden" size="small" variant="outlined" />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {speaker.title}
          </Typography>
          {speaker.company && (
            <Typography variant="caption" color="text.secondary">
              {speaker.company}
            </Typography>
          )}
          {speaker.bio && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                textAlign: "left",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }}
            >
              {speaker.bio}
            </Typography>
          )}
        </CardContent>
        {hasActions && (
          <CardActions sx={{ justifyContent: "flex-end", pt: 0 }}>
            {speaker.linkedinUrl && (
              <IconButton
                size="small"
                aria-label="LinkedIn profile"
                component="a"
                href={speaker.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LinkedinIcon size={16} />
              </IconButton>
            )}
            {onToggleVisibility && (
              <Tooltip title={speaker.visible ? "Hide from downstream" : "Show in downstream"}>
                <IconButton
                  size="small"
                  aria-label={speaker.visible ? "Hide speaker" : "Show speaker"}
                  onClick={() => onToggleVisibility(speaker.id, !speaker.visible)}
                >
                  {speaker.visible ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
                </IconButton>
              </Tooltip>
            )}
            {onEdit && (
              <IconButton size="small" aria-label="Edit speaker" onClick={() => onEdit(speaker)}>
                <PencilIcon size={16} />
              </IconButton>
            )}
            {onDelete && (
              <IconButton
                size="small"
                color="error"
                aria-label="Delete speaker"
                onClick={() =>
                  setConfirmation({
                    title: "Delete speaker",
                    text: `Remove ${speaker.name} from the speaker list? This cannot be undone.`,
                    confirmLabel: "Delete",
                    confirmAction: () => onDelete(speaker.id),
                  })
                }
              >
                <Trash2Icon size={16} />
              </IconButton>
            )}
          </CardActions>
        )}
      </Card>

      <ConfirmationDialog content={confirmation} onClose={() => setConfirmation(null)} />
    </>
  );
}
