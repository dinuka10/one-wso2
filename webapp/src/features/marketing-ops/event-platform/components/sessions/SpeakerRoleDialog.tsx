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
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@wso2/oxygen-ui";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import type { SessionSpeakerRole } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { SESSION_ROLE_LABELS } from "@features/marketing-ops/event-platform/utils/agenda";

const ROLES = Object.entries(SESSION_ROLE_LABELS) as [SessionSpeakerRole, string][];

// Picks the role a speaker plays in one session, on adding them or on clicking
// their chip. Remount (key) to start from another initial role.
export default function SpeakerRoleDialog({
  speakerName,
  initialRole,
  onConfirm,
  onCancel,
}: {
  speakerName: string;
  initialRole: SessionSpeakerRole;
  onConfirm: (role: SessionSpeakerRole) => void;
  onCancel: () => void;
}) {
  const [role, setRole] = useState<SessionSpeakerRole>(initialRole);
  const handleKeyDown = useSubmitShortcut(() => onConfirm(role));

  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth onKeyDown={handleKeyDown}>
      <DialogTitle>Assign role for {speakerName}</DialogTitle>
      <DialogContent sx={{ pt: "16px !important" }}>
        <FormControl fullWidth size="small">
          <InputLabel id="speaker-role-label">Role</InputLabel>
          <Select
            labelId="speaker-role-label"
            value={role}
            label="Role"
            onChange={(e) => setRole(e.target.value as SessionSpeakerRole)}
          >
            {ROLES.map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={() => onConfirm(role)}>
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
}
