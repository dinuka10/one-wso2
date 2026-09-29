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
import type { Session, SessionSpeakerRole, Speaker } from "../../types/eventPlatformTypes";
import { collectEventSpeakers, primaryRole } from "./eventSpeakers";

function speaker(id: string, name: string): Speaker {
  return {
    id,
    name,
    title: "Engineer",
    bio: "",
    photoUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    speakerType: "external",
    company: null,
    companyLogoUrl: null,
    companyLogoSize: null,
    modalCompanyLogoSize: null,
    linkedinUrl: null,
    visible: true,
  };
}

function session(id: string, speakers: [Speaker, SessionSpeakerRole][]): Session {
  return {
    id,
    configId: "evt-7",
    kind: "session",
    title: `Session ${id}`,
    description: "",
    durationSlots: 2,
    dayId: null,
    trackId: null,
    slotIndex: null,
    sectionId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    speakers: speakers.map(([s, role]) => ({ speaker: s, role })),
    roomId: null,
    room: null,
    roomIsManual: false,
    topicId: null,
    topicIsManual: false,
    articleUrl: null,
    articleLabel: null,
    videoUrl: null,
    videoLabel: null,
  };
}

const one = speaker("1", "Speaker One");
const two = speaker("2", "Speaker Two");

describe("collectEventSpeakers", () => {
  it("lists each speaker once, first appearance first, with every distinct role", () => {
    const entries = collectEventSpeakers([
      session("a", [[two, "moderator"]]),
      session("b", [
        [one, "external"],
        [two, "external"],
      ]),
      session("c", [[two, "moderator"]]),
    ]);
    expect(entries.map((e) => e.speaker.id)).toEqual(["2", "1"]);
    expect(entries[0].roles).toEqual(["moderator", "external"]);
    expect(entries[1].roles).toEqual(["external"]);
  });

  it("is empty for an event with no speakers", () => {
    expect(collectEventSpeakers([session("a", [])])).toEqual([]);
  });
});

describe("primaryRole", () => {
  it("prefers any role over moderator", () => {
    expect(primaryRole(["moderator", "keynote"])).toBe("keynote");
    expect(primaryRole(["leader"])).toBe("leader");
    expect(primaryRole(["moderator"])).toBe("moderator");
  });
});
