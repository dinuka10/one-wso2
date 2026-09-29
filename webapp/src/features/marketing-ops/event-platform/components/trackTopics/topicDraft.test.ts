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

import { describe, expect, it } from "vitest";
import { HttpError } from "@api/http";
import type { TrackTopic } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  EMPTY_TOPIC_DRAFT,
  nextTopicPosition,
  sortTopics,
  topicMove,
  topicPayload,
  topicSaveErrorMessage,
  validateTopicDraft,
} from "./topicDraft";

const topic = (id: string, position: number): TrackTopic => ({
  id,
  configId: "evt-7",
  name: `Topic ${id}`,
  slug: `topic-${id}`,
  position,
  showInFilter: true,
  createdAt: "",
  updatedAt: "",
});

describe("validateTopicDraft", () => {
  it("wants a name that no other topic has", () => {
    expect(validateTopicDraft(EMPTY_TOPIC_DRAFT, []).name).toBe("Name is required");
    expect(validateTopicDraft({ ...EMPTY_TOPIC_DRAFT, name: " integration " }, ["Integration"]).name).toMatch(
      /already used/,
    );
    expect(validateTopicDraft({ ...EMPTY_TOPIC_DRAFT, name: "Integration" }, ["Security"])).toEqual({});
  });

  it("allows a blank slug but not a malformed one", () => {
    const draft = { ...EMPTY_TOPIC_DRAFT, name: "Integration" };
    expect(validateTopicDraft({ ...draft, slug: "api-management" }, []).slug).toBeUndefined();
    expect(validateTopicDraft({ ...draft, slug: "API Management" }, []).slug).toMatch(/Lowercase/);
    expect(validateTopicDraft({ ...draft, slug: "api--management" }, []).slug).toMatch(/Lowercase/);
    expect(validateTopicDraft({ ...draft, slug: "-api" }, []).slug).toMatch(/Lowercase/);
  });
});

describe("topicPayload", () => {
  it("leaves a blank slug to the server", () => {
    expect(topicPayload({ name: " Integration ", slug: "  ", showInFilter: false })).toEqual({
      name: "Integration",
      showInFilter: false,
    });
    expect(topicPayload({ name: "Integration", slug: "int", showInFilter: true }).slug).toBe("int");
  });
});

describe("ordering", () => {
  it("sorts by position and appends after the last", () => {
    expect(sortTopics([topic("b", 2), topic("a", 1)]).map((t) => t.id)).toEqual(["a", "b"]);
    expect(nextTopicPosition([])).toBe(1);
    expect(nextTopicPosition([topic("a", 1), topic("b", 7)])).toBe(8);
  });

  it("swaps neighbours' positions", () => {
    const sorted = [topic("a", 1), topic("b", 2), topic("c", 3)];
    expect(topicMove(sorted, 1, -1)).toEqual([
      { id: "b", position: 1 },
      { id: "a", position: 2 },
    ]);
    expect(topicMove(sorted, 1, 1)).toEqual([
      { id: "b", position: 3 },
      { id: "c", position: 2 },
    ]);
  });

  it("does nothing past either end", () => {
    const sorted = [topic("a", 1), topic("b", 2)];
    expect(topicMove(sorted, 0, -1)).toBeNull();
    expect(topicMove(sorted, 1, 1)).toBeNull();
  });

  it("steps past a neighbour sharing its position", () => {
    const sorted = [topic("a", 1), topic("b", 1)];
    expect(topicMove(sorted, 1, -1)).toEqual([{ id: "b", position: 0 }]);
    expect(topicMove(sorted, 0, 1)).toEqual([{ id: "a", position: 2 }]);
  });
});

describe("topicSaveErrorMessage", () => {
  const url = "https://api.example.com/api/track-topics/tt-1";

  it("names a slug conflict", () => {
    expect(topicSaveErrorMessage(new HttpError(url, 409, ""))).toMatch(/already uses that slug/);
  });

  it("reads the backend's reason otherwise", () => {
    expect(topicSaveErrorMessage(new HttpError(url, 400, JSON.stringify({ error: "name is required" })))).toBe(
      "Couldn't save the topic. Name is required.",
    );
  });
});
