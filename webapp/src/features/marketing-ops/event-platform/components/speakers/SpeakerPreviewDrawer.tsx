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


import { Avatar, Box, Button, Drawer, IconButton, Typography } from "@wso2/oxygen-ui";
import { LinkedinIcon, PencilIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import type { Speaker } from "../../types/eventPlatformTypes";
import { ExternalSpeakerChip, InternalSpeakerBadge } from "./SpeakerBadges";

interface SpeakerPreviewDrawerProps {
  // Open while a speaker is set.
  speaker: Speaker | null;
  onClose: () => void;
  onEdit?: (s: Speaker) => void;
}

// The whole speaker, bio unclipped, in a drawer on the right.
export default function SpeakerPreviewDrawer({ speaker, onClose, onEdit }: SpeakerPreviewDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={speaker !== null}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 360 }, p: 3 } } }}
    >
      {speaker && (
        <>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <IconButton size="small" aria-label="Close preview" onClick={onClose}>
              <XIcon size={18} />
            </IconButton>
            {onEdit && (
              <IconButton size="small" aria-label="Edit speaker" onClick={() => onEdit(speaker)}>
                <PencilIcon size={18} />
              </IconButton>
            )}
          </Box>

          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Avatar
              src={speaker.photoUrl ?? undefined}
              sx={{ width: 96, height: 96, mb: 2, mx: "auto", bgcolor: "primary.main", fontSize: 36 }}
            >
              {speaker.name.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {speaker.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {speaker.title}
            </Typography>
            {speaker.company && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {speaker.company}
              </Typography>
            )}
            {(speaker.speakerType === "internal" || speaker.speakerType === "external") && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
                {speaker.speakerType === "internal" ? <InternalSpeakerBadge /> : <ExternalSpeakerChip />}
              </Box>
            )}
          </Box>

          {speaker.bio && (
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {speaker.bio}
            </Typography>
          )}

          {speaker.linkedinUrl && (
            <Box sx={{ mt: 2 }}>
              <Button
                component="a"
                href={speaker.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<LinkedinIcon size={16} />}
                size="small"
                variant="outlined"
              >
                LinkedIn
              </Button>
            </Box>
          )}
        </>
      )}
    </Drawer>
  );
}
