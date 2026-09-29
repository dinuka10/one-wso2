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


import type { Session, SessionSpeakerRole, Speaker } from "../../types/eventPlatformTypes";

// An event's speakers are not stored anywhere: they are whoever its sessions
// name. Pure, so the role roll-up is tested without a query.

export interface EventSpeakerEntry {
  speaker: Speaker;
  // Every role this speaker holds across the event's sessions, first seen first.
  roles: SessionSpeakerRole[];
}

/** Each speaker on any of `sessions`, once, in the order they first appear. */
export function collectEventSpeakers(sessions: readonly Session[]): EventSpeakerEntry[] {
  const entries = new Map<string, EventSpeakerEntry>();
  for (const session of sessions) {
    for (const { speaker, role } of session.speakers) {
      const entry = entries.get(speaker.id);
      if (!entry) entries.set(speaker.id, { speaker, roles: [role] });
      else if (!entry.roles.includes(role)) entry.roles.push(role);
    }
  }
  return [...entries.values()];
}

/**
 * The one role a card shows. Someone who moderates one session and speaks on
 * another is shown as a speaker: moderating is the lesser billing, so it wins
 * only when it is all they do.
 */
export function primaryRole(roles: readonly SessionSpeakerRole[]): SessionSpeakerRole {
  return roles.find((r) => r !== "moderator") ?? "moderator";
}
