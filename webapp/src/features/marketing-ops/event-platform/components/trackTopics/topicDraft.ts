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

// The pure half of the track topics dialog: draft validation, ordering, and
// the messages a failed save shows.

import { HttpError } from "@api/http";
import { describeEventPlatformError } from "@features/marketing-ops/event-platform/api/responses";
import type { TrackTopic } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";

// The backend's slug rule: lowercase words joined by single hyphens.
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface TopicDraft {
  name: string;
  slug: string;
  showInFilter: boolean;
}

export const EMPTY_TOPIC_DRAFT: TopicDraft = { name: "", slug: "", showInFilter: true };

export interface TopicDraftErrors {
  name?: string;
  slug?: string;
}

/** `namesInUse` is every OTHER topic's name; names clash case-insensitively. */
export function validateTopicDraft(draft: TopicDraft, namesInUse: readonly string[]): TopicDraftErrors {
  const errors: TopicDraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Name is required";
  else if (namesInUse.some((n) => n.toLowerCase() === name.toLowerCase())) {
    errors.name = "That name is already used by another topic";
  }
  const slug = draft.slug.trim();
  if (slug && !SLUG_PATTERN.test(slug)) {
    errors.slug = "Lowercase letters, numbers and single hyphens only, e.g. api-management";
  }
  return errors;
}

/** The create/update fields. A blank slug is left out, so the server derives one from the name. */
export function topicPayload(draft: TopicDraft): { name: string; showInFilter: boolean; slug?: string } {
  const slug = draft.slug.trim();
  return { name: draft.name.trim(), showInFilter: draft.showInFilter, ...(slug ? { slug } : {}) };
}

export function sortTopics(topics: readonly TrackTopic[]): TrackTopic[] {
  return [...topics].sort((a, b) => a.position - b.position);
}

export function nextTopicPosition(topics: readonly Pick<TrackTopic, "position">[]): number {
  return topics.reduce((max, t) => Math.max(max, t.position), 0) + 1;
}

/**
 * The position writes that move `sorted[index]` one step up (-1) or down (1):
 * the two topics trade positions. Where they share one (rows made before
 * positions were kept unique), the mover steps past its neighbour instead, as
 * a trade would change nothing. Null at either end of the list.
 */
export function topicMove(
  sorted: readonly TrackTopic[],
  index: number,
  direction: -1 | 1,
): { id: string; position: number }[] | null {
  const target = sorted[index];
  const neighbor = sorted[index + direction];
  if (!target || !neighbor) return null;
  if (target.position === neighbor.position) {
    return [{ id: target.id, position: neighbor.position + direction }];
  }
  return [
    { id: target.id, position: neighbor.position },
    { id: neighbor.id, position: target.position },
  ];
}

/** A failed create or update. A 409 is the one conflict the backend reports here: the slug. */
export function topicSaveErrorMessage(err: unknown): string {
  if (err instanceof HttpError && err.status === 409) {
    return "Another topic in this event already uses that slug.";
  }
  return `Couldn't save the topic. ${describeEventPlatformError(err)}`;
}
