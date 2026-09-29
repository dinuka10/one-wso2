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

// Parses the session CSV import: one unscheduled session per row, speakers
// matched to the library by name.
//
// The source split lines and cells on raw "\n" and ",", so a quoted
// description with a comma in it shifted every later column. papaparse (already
// a webapp dependency) reads RFC 4180 quoting; everything else — the columns,
// the defaults, the matching — is the source's.

import Papa from "papaparse";
import type { Speaker } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { SLOT_MINUTES } from "@features/marketing-ops/event-platform/utils/agenda";

export const SESSION_CSV_COLUMNS = [
  "title",
  "description",
  "kind",
  "duration_minutes",
  "speaker_names",
] as const;

export interface ParsedSessionRow {
  title: string;
  description: string;
  kind: "session" | "keynote";
  durationSlots: number;
  durationMinutes: number;
  speakerNames: string[];
  matchedSpeakerIds: string[];
  unmatchedNames: string[];
  // Rows without a title are shown but not imported.
  valid: boolean;
}

export interface ParsedSessionCsv {
  rows: ParsedSessionRow[];
  // Every name that matched no library speaker, once each, for the warning.
  unmatched: string[];
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A CSV cell is plain text, but titles and descriptions are stored as the
// rich-text editor's HTML and read back through the sanitiser, which would
// take any "<" in them for markup. These escape it, and keep line breaks the
// way each field's editor writes them: <br> in an inline title, one <p> per
// line in a description.
export function textToInlineHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

export function textToBlockHtml(text: string): string {
  if (!text) return "";
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

/** Parses the file's text. No rows when there is no header plus at least one data row. */
export function parseSessionCsv(text: string, speakers: readonly Speaker[]): ParsedSessionCsv {
  const { data } = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  if (data.length < 2) return { rows: [], unmatched: [] };

  const headers = data[0].map((h) => h.trim().toLowerCase());
  const col = (name: (typeof SESSION_CSV_COLUMNS)[number]) => headers.indexOf(name);
  const colTitle = col("title");
  const colDesc = col("description");
  const colKind = col("kind");
  const colDuration = col("duration_minutes");
  const colSpeakers = col("speaker_names");

  const speakerIndex = new Map(speakers.map((s) => [s.name.trim().toLowerCase(), s.id]));
  const allUnmatched = new Set<string>();

  const rows = data.slice(1).map((line): ParsedSessionRow => {
    const cells = line.map((c) => c.trim());
    const cell = (index: number) => (index >= 0 ? (cells[index] ?? "") : "");

    const title = cell(colTitle);
    const kind = cell(colKind).toLowerCase() === "keynote" ? "keynote" : "session";
    const parsedMinutes = colDuration >= 0 ? parseInt(cell(colDuration) || "0", 10) : 0;
    const minutes = Number.isNaN(parsedMinutes) ? 0 : parsedMinutes;

    const speakerNames = cell(colSpeakers)
      .split(";")
      .map((n) => n.trim())
      .filter(Boolean);
    const matchedSpeakerIds: string[] = [];
    const unmatchedNames: string[] = [];
    for (const name of speakerNames) {
      const id = speakerIndex.get(name.toLowerCase());
      if (id) {
        matchedSpeakerIds.push(id);
      } else {
        unmatchedNames.push(name);
        allUnmatched.add(name);
      }
    }

    return {
      title,
      description: cell(colDesc),
      kind,
      durationSlots: Math.max(1, Math.round(minutes / SLOT_MINUTES)),
      durationMinutes: minutes,
      speakerNames,
      matchedSpeakerIds,
      unmatchedNames,
      valid: title.length > 0,
    };
  });

  return { rows, unmatched: [...allUnmatched] };
}
