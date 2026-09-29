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
import type { Speaker } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { parseSessionCsv } from "./sessionCsv";

const speakers = [
  { id: "42", name: "Speaker One" },
  { id: "43", name: " Speaker Two " },
] as Speaker[];

const HEADER = "title,description,kind,duration_minutes,speaker_names";

describe("parseSessionCsv", () => {
  it("needs a header and at least one row", () => {
    expect(parseSessionCsv("", speakers)).toEqual({ rows: [], unmatched: [] });
    expect(parseSessionCsv(HEADER, speakers)).toEqual({ rows: [], unmatched: [] });
  });

  it("reads a row and matches speakers by name, ignoring case", () => {
    const { rows, unmatched } = parseSessionCsv(
      `${HEADER}\nOpening,Welcome,keynote,45,speaker one; Speaker Two`,
      speakers,
    );
    expect(unmatched).toEqual([]);
    expect(rows).toEqual([
      {
        title: "Opening",
        description: "Welcome",
        kind: "keynote",
        durationSlots: 9,
        durationMinutes: 45,
        speakerNames: ["speaker one", "Speaker Two"],
        matchedSpeakerIds: ["42", "43"],
        unmatchedNames: [],
        valid: true,
      },
    ]);
  });

  it("keeps a quoted comma inside its cell", () => {
    const { rows } = parseSessionCsv(`${HEADER}\n"Talk","One, two",session,30,`, speakers);
    expect(rows[0].description).toBe("One, two");
    expect(rows[0].durationSlots).toBe(6);
  });

  it("defaults the kind and duration, and reports unknown speakers once", () => {
    const { rows, unmatched } = parseSessionCsv(
      `${HEADER}\nA,,panel,abc,Nobody\nB,,,,Nobody;Speaker One`,
      speakers,
    );
    expect(rows.map((r) => r.kind)).toEqual(["session", "session"]);
    expect(rows.map((r) => r.durationSlots)).toEqual([1, 1]);
    expect(rows[0].durationMinutes).toBe(0);
    expect(rows[1].matchedSpeakerIds).toEqual(["42"]);
    expect(unmatched).toEqual(["Nobody"]);
  });

  it("reads the columns by header name, in any order and case", () => {
    const { rows } = parseSessionCsv("Duration_Minutes, Title\n15,Short", speakers);
    expect(rows[0]).toMatchObject({ title: "Short", durationSlots: 3, description: "", kind: "session" });
  });

  it("marks a row without a title invalid and skips blank lines", () => {
    const { rows } = parseSessionCsv(`${HEADER}\r\n,No title,,10,\r\n   \r\n`, speakers);
    expect(rows).toHaveLength(1);
    expect(rows[0].valid).toBe(false);
  });
});
