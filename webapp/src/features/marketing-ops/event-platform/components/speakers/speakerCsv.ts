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


import Papa from "papaparse";
import type { SpeakerInput } from "../../api/speakers";
import type { Speaker, SpeakerType } from "../../types/eventPlatformTypes";
import { SPEAKER_TYPES } from "./speakerTypes";

// Speaker CSV import, the pure half: reading the file into preview rows, and
// turning a row into a request body. The dialog does the I/O.
//
// The source split the text on newlines and commas by hand, which broke any
// bio with a line break inside quotes (every such row became two garbage
// rows). papaparse reads quoted cells properly; everything else — the
// columns, the type fallback, the duplicate rule — is the source's.

/** The columns read, matched case-insensitively after trimming. Others are ignored. */
export const SPEAKER_CSV_COLUMNS = [
  "name",
  "title",
  "bio",
  "type",
  "company",
  "linkedin_url",
  "photo_url",
] as const;

export const DEFAULT_CSV_SPEAKER_TYPE: SpeakerType = "external";

export interface ParsedSpeakerRow {
  name: string;
  title: string;
  bio: string;
  speakerType: SpeakerType;
  company: string;
  linkedinUrl: string;
  photoUrl: string;
}

export type CsvRowStatus = "new" | "duplicate" | "invalid";
export type DuplicateAction = "keep" | "replace";

export interface SpeakerPreviewRow {
  parsed: ParsedSpeakerRow;
  status: CsvRowStatus;
  // The library speaker a duplicate row shares its name with.
  existing?: Speaker;
  duplicateAction: DuplicateAction;
}

export interface SpeakerCsvParseResult {
  rows: SpeakerPreviewRow[];
  error: string | null;
}

// Names compare case- and whitespace-insensitively, as the source did.
const nameKey = (name: string) => name.trim().toLowerCase();

// "Keynote", " MODERATOR " and so on are accepted; anything else is external.
function toSpeakerType(raw: string): SpeakerType {
  const normalised = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return (SPEAKER_TYPES as readonly string[]).includes(normalised)
    ? (normalised as SpeakerType)
    : DEFAULT_CSV_SPEAKER_TYPE;
}

/**
 * Reads a speaker CSV (first row a header) into preview rows, each marked
 * new, duplicate (a library speaker has the same name — kept unless the user
 * chooses to replace it) or invalid (no name). `error` is set, and `rows`
 * empty, when there is nothing to import.
 */
export function parseSpeakerCsv(text: string, existing: readonly Speaker[]): SpeakerCsvParseResult {
  const result = Papa.parse<Record<string, string | undefined>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    delimiter: ",",
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  // A short or long row is still readable by column name — the source took
  // such rows too. A broken quote is not: past it, every cell is shifted.
  if (result.errors.some((e) => e.type !== "FieldMismatch")) {
    return { rows: [], error: "Failed to parse CSV. Check the file format." };
  }
  if (result.data.length === 0) {
    return { rows: [], error: "No data rows found in CSV." };
  }

  const byName = new Map(existing.map((s) => [nameKey(s.name), s]));

  const rows = result.data.map((record): SpeakerPreviewRow => {
    const get = (column: (typeof SPEAKER_CSV_COLUMNS)[number]) => (record[column] ?? "").trim();
    const parsed: ParsedSpeakerRow = {
      name: get("name"),
      title: get("title"),
      bio: get("bio"),
      speakerType: toSpeakerType(get("type")),
      company: get("company"),
      linkedinUrl: get("linkedin_url"),
      photoUrl: get("photo_url"),
    };
    if (!parsed.name) return { parsed, status: "invalid", duplicateAction: "keep" };
    const match = byName.get(nameKey(parsed.name));
    if (match) return { parsed, status: "duplicate", existing: match, duplicateAction: "keep" };
    return { parsed, status: "new", duplicateAction: "keep" };
  });
  return { rows, error: null };
}

/** Will importing touch this row — a new one, or a duplicate the user chose to replace? */
export function isActionableRow(row: SpeakerPreviewRow): boolean {
  return row.status === "new" || (row.status === "duplicate" && row.duplicateAction === "replace");
}

function baseInput(parsed: ParsedSpeakerRow): SpeakerInput {
  return {
    name: parsed.name,
    title: parsed.title,
    bio: parsed.bio,
    speakerType: parsed.speakerType,
    company: parsed.company || null,
    linkedinUrl: parsed.linkedinUrl || null,
    photoUrl: parsed.photoUrl || null,
  };
}

/** The POST body for a new row. */
export function csvCreateInput(parsed: ParsedSpeakerRow): SpeakerInput {
  return baseInput(parsed);
}

/**
 * The PUT body replacing `existing` with a row. PUT replaces the whole
 * speaker, so what the CSV has no column for — the company logo and its
 * styles — is carried over from the existing speaker rather than cleared. (The
 * source carried the styles but dropped the logo URL.)
 */
export function csvReplaceInput(parsed: ParsedSpeakerRow, existing: Speaker): SpeakerInput {
  return {
    ...baseInput(parsed),
    companyLogoUrl: existing.companyLogoUrl || null,
    companyLogoSize: existing.companyLogoSize || null,
    modalCompanyLogoSize: existing.modalCompanyLogoSize || null,
  };
}
