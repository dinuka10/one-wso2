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
  csvCreateInput,
  csvReplaceInput,
  isActionableRow,
  parseSpeakerCsv,
} from "./speakerCsv";

function speaker(overrides: Partial<Speaker> = {}): Speaker {
  return {
    id: "42",
    name: "Speaker One",
    title: "Engineer",
    bio: "",
    photoUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    speakerType: "external",
    company: null,
    companyLogoUrl: "https://api.example.com/logo.png",
    companyLogoSize: "width: 120px;",
    modalCompanyLogoSize: "height: 90px;",
    linkedinUrl: null,
    visible: true,
    ...overrides,
  };
}

const HEADER = "name,title,bio,type,company,linkedin_url,photo_url";

describe("parseSpeakerCsv", () => {
  it("reads every column, trimmed", () => {
    const { rows, error } = parseSpeakerCsv(
      `${HEADER}\n Speaker Two , Architect ,Bio,keynote,Example Co,https://api.example.com/in/two, https://api.example.com/two.png`,
      [],
    );
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      parsed: {
        name: "Speaker Two",
        title: "Architect",
        bio: "Bio",
        speakerType: "keynote",
        company: "Example Co",
        linkedinUrl: "https://api.example.com/in/two",
        photoUrl: "https://api.example.com/two.png",
      },
      status: "new",
      duplicateAction: "keep",
    });
  });

  it("matches headers case-insensitively, in any order, ignoring extra columns", () => {
    const { rows } = parseSpeakerCsv(" Title ,NAME,notes\nArchitect,Speaker Two,x", []);
    expect(rows[0].parsed.name).toBe("Speaker Two");
    expect(rows[0].parsed.title).toBe("Architect");
    expect(rows[0].parsed.bio).toBe("");
  });

  it("keeps commas, quotes and line breaks inside quoted cells", () => {
    const { rows } = parseSpeakerCsv(
      `${HEADER}\n"Speaker Two","Lead, Platform","Line one\nLine ""two""",internal,,,`,
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].parsed.title).toBe("Lead, Platform");
    expect(rows[0].parsed.bio).toBe('Line one\nLine "two"');
  });

  it("normalises the type and falls back to external", () => {
    const { rows } = parseSpeakerCsv(
      "name,type\nA, Moderator \nB,panellist\nC,\nD,INTERNAL",
      [],
    );
    expect(rows.map((r) => r.parsed.speakerType)).toEqual(["moderator", "external", "external", "internal"]);
  });

  it("marks a row without a name invalid", () => {
    const { rows } = parseSpeakerCsv("name,title\n ,Architect", []);
    expect(rows[0].status).toBe("invalid");
  });

  it("marks a name already in the library a duplicate, kept by default", () => {
    const existing = speaker();
    const { rows } = parseSpeakerCsv("name,title\n speaker ONE ,Architect\nSpeaker Two,X", [existing]);
    expect(rows[0].status).toBe("duplicate");
    expect(rows[0].existing).toBe(existing);
    expect(rows[0].duplicateAction).toBe("keep");
    expect(rows[1].status).toBe("new");
  });

  it("marks a later row repeating a name in the same file invalid, in any case", () => {
    const csv = "name,title\nNew Person,A\n new PERSON ,B\nSpeaker One,C\nspeaker one,D";
    const { rows } = parseSpeakerCsv(csv, [speaker()]);
    expect(rows.map((r) => r.status)).toEqual(["new", "invalid", "duplicate", "invalid"]);
    expect(rows.filter(isActionableRow)).toHaveLength(1);
  });

  it("skips blank lines, CRLF endings and a byte-order mark", () => {
    const { rows } = parseSpeakerCsv("\uFEFFname,title\r\n\r\nA,X\r\n   \r\nB,Y\r\n", []);
    expect(rows.map((r) => r.parsed.name)).toEqual(["A", "B"]);
  });

  it("tolerates short and long rows", () => {
    const { rows, error } = parseSpeakerCsv("name,title\nA\nB,Y,extra", []);
    expect(error).toBeNull();
    expect(rows.map((r) => r.parsed.title)).toEqual(["", "Y"]);
  });

  it("reports a header with no data rows", () => {
    expect(parseSpeakerCsv(HEADER, [])).toEqual({ rows: [], error: "No data rows found in CSV." });
    expect(parseSpeakerCsv("", []).error).toBe("No data rows found in CSV.");
  });

  it("reports a broken quote", () => {
    const result = parseSpeakerCsv('name,title\n"A,X\nB,Y', []);
    expect(result.rows).toEqual([]);
    expect(result.error).toBe("Failed to parse CSV. Check the file format.");
  });
});

describe("isActionableRow", () => {
  it("imports new rows and duplicates set to replace, nothing else", () => {
    const parsed = parseSpeakerCsv("name\nA", []).rows[0].parsed;
    expect(isActionableRow({ parsed, status: "new", duplicateAction: "keep" })).toBe(true);
    expect(isActionableRow({ parsed, status: "duplicate", duplicateAction: "keep" })).toBe(false);
    expect(isActionableRow({ parsed, status: "duplicate", duplicateAction: "replace" })).toBe(true);
    expect(isActionableRow({ parsed, status: "invalid", duplicateAction: "replace" })).toBe(false);
  });
});

describe("csv request bodies", () => {
  const parsed = {
    name: "Speaker One",
    title: "Architect",
    bio: "",
    speakerType: "internal" as const,
    company: "",
    linkedinUrl: "",
    photoUrl: "",
  };

  it("sends blanks as null on create", () => {
    expect(csvCreateInput(parsed)).toEqual({
      name: "Speaker One",
      title: "Architect",
      bio: "",
      speakerType: "internal",
      company: null,
      linkedinUrl: null,
      photoUrl: null,
    });
  });

  it("keeps the existing logo and its styles on replace", () => {
    expect(csvReplaceInput(parsed, speaker())).toMatchObject({
      name: "Speaker One",
      companyLogoUrl: "https://api.example.com/logo.png",
      companyLogoSize: "width: 120px;",
      modalCompanyLogoSize: "height: 90px;",
    });
    expect(
      csvReplaceInput(parsed, speaker({ companyLogoUrl: null, companyLogoSize: null, modalCompanyLogoSize: null })),
    ).toMatchObject({ companyLogoUrl: null, companyLogoSize: null, modalCompanyLogoSize: null });
  });
});
