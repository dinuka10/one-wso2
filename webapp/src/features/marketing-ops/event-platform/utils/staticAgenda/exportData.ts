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

// The agenda and speakers exports, read defensively into the shapes the
// renderers use. The previews arrive typed `unknown` (see api/event.ts), and
// the backend's Go models (models/export.go) are the reference: anything
// missing or of the wrong type falls back rather than reaching markup as
// "undefined" or as an object.

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  if (typeof value === "string") return value;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function optStr(value: unknown): string | null {
  const s = str(value);
  return s ? s : null;
}

function int(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export interface ExportSpeaker {
  id: string;
  name: string;
  title: string;
  bio: string;
  photoUrl: string | null;
  companyLogoUrl: string | null;
  companyLogoSize: string | null;
  modalCompanyLogoSize: string | null;
  company: string | null;
  linkedinUrl: string | null;
  speakerType: string;
  role: string;
}

export function readSpeaker(value: unknown): ExportSpeaker {
  const s = obj(value);
  return {
    id: str(s.id),
    name: str(s.name),
    title: str(s.title),
    bio: str(s.bio),
    photoUrl: optStr(s.photoUrl),
    companyLogoUrl: optStr(s.companyLogoUrl),
    companyLogoSize: optStr(s.companyLogoSize),
    modalCompanyLogoSize: optStr(s.modalCompanyLogoSize),
    company: optStr(s.company),
    linkedinUrl: optStr(s.linkedinUrl),
    speakerType: str(s.speakerType),
    role: str(s.role),
  };
}

export interface SessionSpeakerRef {
  speakerId: string;
  role: string;
}

export interface ExportArtifact {
  label: string;
  url: string;
}

export interface AgendaSession {
  id: string;
  kind: string;
  title: string;
  description: string;
  startSlot: number;
  /** Five-minute slots, derived from the wire's durationMins. */
  durationSlots: number;
  sectionLabel: string | null;
  category: string | null;
  room: string | null;
  artifacts: ExportArtifact[];
  // Older exports carried these two as their own fields; the template still
  // reads them, so a hand-kept export keeps working.
  articleUrl: string | null;
  articleLabel: string | null;
  videoUrl: string | null;
  videoLabel: string | null;
  speakers: SessionSpeakerRef[];
}

function readSession(value: unknown): AgendaSession {
  const s = obj(value);
  const roles = obj(s.speakerRoles);
  const room = typeof s.room === "string" ? s.room : optStr(obj(s.room).name);
  return {
    id: str(s.id),
    kind: str(s.kind),
    title: str(s.title),
    description: str(s.description),
    startSlot: int(s.startSlot, 0),
    durationSlots: Math.round(int(s.durationMins, 0) / 5),
    sectionLabel: optStr(s.sectionLabel),
    category: optStr(s.category),
    room,
    artifacts: arr(s.artifacts).map((a) => ({ label: str(obj(a).label), url: str(obj(a).url) })),
    articleUrl: optStr(s.articleUrl),
    articleLabel: optStr(s.articleLabel),
    videoUrl: optStr(s.videoUrl),
    videoLabel: optStr(s.videoLabel),
    speakers: arr(s.speakerIds).map((id) => ({
      speakerId: str(id),
      role: str(roles[str(id)]) || "speaker",
    })),
  };
}

export interface AgendaTrack {
  id: string;
  name: string;
  colorClass: string;
}

export interface AgendaSection {
  trackId: string | null;
  label: string;
  startSlot: number;
  durationSlots: number;
  sessions: AgendaSession[];
}

export interface AgendaUnsectioned {
  kind: string;
  trackId: string | null;
  startSlot: number;
  durationSlots: number;
  sessions: AgendaSession[];
  text: string;
}

export interface AgendaDay {
  dayIndex: number;
  label: string | null;
  date: string;
  anchor: string | null;
  startMinute: number;
  tracks: AgendaTrack[];
  trackSections: AgendaSection[];
  keynoteSections: AgendaSection[];
  unsectioned: AgendaUnsectioned[];
}

export interface AgendaExport {
  conference: { name: string; startDate: string };
  speakers: Map<string, ExportSpeaker>;
  days: AgendaDay[];
  trackFilters: { slug: string; label: string }[];
}

function readSection(value: unknown): AgendaSection {
  const s = obj(value);
  return {
    trackId: optStr(s.trackId),
    label: str(s.label),
    startSlot: int(s.startSlot, 0),
    durationSlots: int(s.durationSlots, 0),
    sessions: arr(s.sessions).map(readSession),
  };
}

function readDay(value: unknown): AgendaDay {
  const d = obj(value);
  return {
    dayIndex: int(d.dayIndex, 0),
    label: optStr(d.label),
    date: str(d.date),
    anchor: optStr(d.anchor),
    // The template's defaults: an 8:00 start.
    startMinute: int(d.startMinute, 480),
    tracks: arr(d.tracks).map((t) => ({
      id: str(obj(t).id),
      name: str(obj(t).name),
      colorClass: str(obj(t).colorClass),
    })),
    trackSections: arr(d.trackSections).map(readSection),
    keynoteSections: arr(d.keynoteSections).map(readSection),
    unsectioned: arr(d.unsectioned).map((u) => {
      const item = obj(u);
      return {
        kind: str(item.kind),
        trackId: optStr(item.trackId),
        startSlot: int(item.startSlot, 0),
        durationSlots: int(item.durationSlots, 0),
        sessions: arr(item.sessions).map(readSession),
        text: str(item.text),
      };
    }),
  };
}

export function readAgendaExport(raw: unknown): AgendaExport {
  const root = obj(raw);
  const conference = obj(root.conference);
  const speakers = new Map<string, ExportSpeaker>();
  // The backend sends a map keyed by id; an array is accepted as the source did.
  const speakerList = Array.isArray(root.speakers) ? root.speakers : Object.values(obj(root.speakers));
  speakerList.map(readSpeaker).forEach((s) => speakers.set(s.id, s));

  return {
    conference: { name: str(conference.name), startDate: str(conference.startDate) },
    speakers,
    days: arr(root.days)
      .map(readDay)
      .sort((a, b) => a.dayIndex - b.dayIndex),
    trackFilters: arr(root.trackFilters).map((t) => ({
      slug: str(obj(t).slug),
      label: str(obj(t).label),
    })),
  };
}

export interface SpeakersExport {
  conference: { name: string; startDate: string };
  sections: { label: string; speakers: ExportSpeaker[] }[];
}

export function readSpeakersExport(raw: unknown): SpeakersExport {
  const root = obj(raw);
  const conference = obj(root.conference);
  return {
    conference: { name: str(conference.name), startDate: str(conference.startDate) },
    sections: arr(root.sections).map((s) => ({
      label: str(obj(s).label),
      speakers: arr(obj(s).speakers).map(readSpeaker),
    })),
  };
}
