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
import type { Speaker } from "../../types/eventPlatformTypes";
import {
  isSpeakerFormValid,
  speakerFormValues,
  speakerTypeChoices,
  toSpeakerInput,
} from "./speakerFormValues";
import { SPEAKER_TYPES } from "./speakerTypes";

const speaker: Speaker = {
  id: "42",
  name: "Speaker One",
  title: "Engineer",
  bio: "A bio.",
  photoUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  speakerType: "keynote",
  company: null,
  companyLogoUrl: "https://api.example.com/logo.png",
  companyLogoSize: "width: 120px;",
  modalCompanyLogoSize: null,
  linkedinUrl: null,
  visible: true,
};

describe("speakerFormValues", () => {
  it("starts empty with no type for a new speaker", () => {
    const v = speakerFormValues(null);
    expect(v.name).toBe("");
    expect(v.speakerType).toBe("");
  });

  it("turns a speaker's nulls into empty strings", () => {
    const v = speakerFormValues(speaker);
    expect(v.company).toBe("");
    expect(v.companyLogoUrl).toBe("https://api.example.com/logo.png");
    expect(v.modalCompanyLogoSize).toBe("");
  });
});

describe("isSpeakerFormValid", () => {
  it("needs a name, a title and a type", () => {
    expect(isSpeakerFormValid({ name: "A", title: "B", speakerType: "internal" })).toBe(true);
    expect(isSpeakerFormValid({ name: "  ", title: "B", speakerType: "internal" })).toBe(false);
    expect(isSpeakerFormValid({ name: "A", title: "", speakerType: "internal" })).toBe(false);
    expect(isSpeakerFormValid({ name: "A", title: "B", speakerType: "" })).toBe(false);
  });
});

describe("toSpeakerInput", () => {
  it("trims, keeps the bio as typed and nulls blank URLs and styles", () => {
    const input = toSpeakerInput({
      ...speakerFormValues(null),
      name: "  Speaker One ",
      title: " Engineer ",
      bio: "  Line one\n",
      speakerType: "external",
      company: "  ",
      photoUrl: "   ",
      companyLogoSize: " ",
      linkedinUrl: " https://api.example.com/in/one ",
    });
    expect(input).toEqual({
      name: "Speaker One",
      title: "Engineer",
      bio: "  Line one\n",
      speakerType: "external",
      company: "",
      linkedinUrl: "https://api.example.com/in/one",
      photoUrl: null,
      companyLogoUrl: null,
      companyLogoSize: null,
      modalCompanyLogoSize: null,
    });
  });

  it("refuses a form with no type", () => {
    expect(() => toSpeakerInput(speakerFormValues(null))).toThrow();
  });
});

describe("speakerTypeChoices", () => {
  it("offers every type when nothing is restricted", () => {
    expect(speakerTypeChoices(undefined, "")).toEqual([...SPEAKER_TYPES]);
  });

  it("filters to the allowed types, in the canonical order", () => {
    expect(speakerTypeChoices(["external", "internal"], "")).toEqual(["internal", "external"]);
  });

  it("keeps the current type even when it is not allowed", () => {
    expect(speakerTypeChoices(["internal", "external"], "keynote")).toEqual([
      "keynote",
      "internal",
      "external",
    ]);
  });
});
