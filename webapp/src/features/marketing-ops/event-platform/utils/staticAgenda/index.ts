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

// One self-contained HTML file per export, for the public conference site:
// the markup already built, Bootstrap and the web fonts from their public
// CDNs, and (for the agenda) a small inline runtime for what cannot be
// serialised. Nothing is fetched to build it — the templates and the runtime
// are bundled with ?raw — and nothing runs in this app while building it.

import agendaTemplate from "./templates/agenda-template.html?raw";
import speakerTemplate from "./templates/speaker-template.html?raw";
import agendaRuntime from "./runtime.js?raw";
import { escapeHtml } from "./html";
import { readAgendaExport, readSpeakersExport } from "./exportData";
import { renderAgendaParts, type AgendaRenderOptions } from "./renderAgenda";
import { renderSpeakersParts } from "./renderSpeakers";

const SLOT = /%%([A-Z_]+)%%/g;

/**
 * Fills a template's %%NAME%% slots in one pass, so text inserted into one
 * slot is never scanned for another. Every slot must be filled exactly once:
 * a template that changed shape fails the build instead of shipping a page
 * with a hole in it.
 */
export function fillTemplate(template: string, slots: Record<string, string>): string {
  // The license comment ahead of <!DOCTYPE> is for this repo, not the page.
  const page = template.replace(/^<!--[\s\S]*?-->\s*/, "");
  const seen = new Set<string>();
  const html = page.replace(SLOT, (_match, name: string) => {
    if (!(name in slots)) throw new Error(`Template slot %%${name}%% has no value.`);
    if (seen.has(name)) throw new Error(`Template slot %%${name}%% appears twice.`);
    seen.add(name);
    return slots[name];
  });
  const unused = Object.keys(slots).filter((name) => !seen.has(name));
  if (unused.length) throw new Error(`Template has no slot for ${unused.join(", ")}.`);
  return html;
}

// Inlined into a <script>, so the one sequence that could end it early is
// ruled out; the runtime is this repo's own file, so this only guards edits.
function inlineScript(source: string): string {
  if (/<\/script/i.test(source)) throw new Error("The agenda runtime cannot contain </script>.");
  return source;
}

/** The agenda export (the Export screen's preview) as the public agenda page. */
export function buildStaticAgendaHtml(agenda: unknown, options: AgendaRenderOptions = {}): string {
  const parts = renderAgendaParts(readAgendaExport(agenda), options);
  return fillTemplate(agendaTemplate, {
    TITLE: escapeHtml(parts.title),
    DAY_TABS: parts.tabsHtml,
    TRACK_FILTER: parts.filterHtml,
    AGENDA_CONTENT: parts.contentHtml,
    AGENDA_MODALS: parts.modalsHtml,
    COUNTDOWN: parts.countdownHtml,
    RUNTIME: inlineScript(agendaRuntime),
  });
}

/** The speakers export as the public speakers page. */
export function buildStaticSpeakersHtml(speakers: unknown): string {
  const parts = renderSpeakersParts(readSpeakersExport(speakers));
  return fillTemplate(speakerTemplate, {
    TITLE: escapeHtml(parts.title),
    TAGLINE: parts.taglineHtml,
    SPEAKER_CONTENT: parts.contentHtml,
  });
}

/** Saves a built page. The object URL is revoked a tick later, as download.ts explains. */
export function saveHtmlFile(html: string, filename: string): void {
  const objectUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
