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

// The speakers export as the public speakers page's markup, ported from the
// render() script in the source's public/speaker-template.html (a drop-a-file
// preview there; nothing in the source app built it). Same reasoning as
// renderAgenda.ts for building strings here rather than running the
// template's script. Speakers are grouped Keynotes → Customers and
// Influencers → internal speakers, and each card opens a Bootstrap modal
// with the bio.

import { escapeHtml as esc, safeImageUrl, safeLinkUrl, safeLogoStyle } from "./html";
import type { ExportSpeaker, SpeakersExport } from "./exportData";

/**
 * The session roles the speakers page is built from. The export's default is
 * internal and external only, which leaves out keynote speakers and panel
 * leads and moderators: exactly the people the page leads with.
 */
export const SPEAKERS_PAGE_ROLES = "keynote,leader,moderator,internal,external";

const INTERNAL_LABEL = "Internal Speakers";
const INTERNAL_HEADING = "WSO2 Speakers";
const EXTERNAL_HEADING = "Customers and Influencers";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatar(speaker: ExportSpeaker, size: number, fontSize: number, imgClass: string, spacing = ""): string {
  const photo = safeImageUrl(speaker.photoUrl);
  if (photo) {
    return `<img src="${esc(photo)}" alt="${esc(speaker.name)}" class="${imgClass}" style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover;" loading="lazy">`;
  }
  const name = speaker.name || "?";
  return `<div class="speaker-avatar-initials ${spacing}mx-auto d-flex align-items-center justify-content-center" style="width: ${size}px; height: ${size}px; border-radius: 50%; font-size: ${fontSize}px; background-color: var(--avatar-${
    name.length % 7
  }); color: white;">${esc(initials(name))}</div>`;
}

// The source linked to its CDN's LinkedIn and info icons; these are text and
// an inline glyph instead, so the page loads nothing from the organiser's hosts.
const INFO_ICON = `<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="var(--color-orange-gradient-start)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="17"/><circle cx="12" cy="7.5" r="0.6" fill="var(--color-orange-gradient-start)"/></svg>`;

function renderSpeakerCard(speaker: ExportSpeaker, modalId: string): string {
  const logoSrc = safeImageUrl(speaker.companyLogoUrl);
  const logoStyle = safeLogoStyle(speaker.companyLogoSize) || "max-height: 40px; max-width: 107px";
  const logoHtml = logoSrc
    ? `<img src="${esc(logoSrc)}" class="Logo" alt="${esc(speaker.company ?? "")}" loading="lazy" style="${esc(logoStyle)}">`
    : "";
  const linkedinUrl = safeLinkUrl(speaker.linkedinUrl);
  const linkedin = linkedinUrl
    ? `<a href="${esc(linkedinUrl)}" target="_blank" rel="noopener" class="cSpeakerLinkedin">LinkedIn</a>`
    : "";
  const bio = speaker.bio
    ? speaker.bio
        .split("\n")
        .map((p) => `<p>${esc(p)}</p>`)
        .join("")
    : "<p>No biography provided.</p>";

  // The first space becomes a line break, as on the public site: first name
  // over the rest. Escaped first, so the <br> is the only markup added.
  return `
                <div class="col-sm-12 col-md-4 col-lg-4 mb-4">
                  <div class="cSpeakerBlock cAlignCenter ccard h-100 cSpeakerCard" data-bs-toggle="modal" data-bs-target="#${modalId}" style="cursor: pointer; padding: 30px 20px; border: 1px solid #eaeaea; background: #fff; text-align: center;">
                    ${avatar(speaker, 150, 60, "profile_pic mb-3 mx-auto d-block", "mb-3 ")}
                    <h4 style="font-weight: 600; color: var(--color-navy); margin-bottom: 5px; font-size: 1.25rem;">${esc(
                      speaker.name || "Unknown",
                    ).replace(" ", "<br>")}</h4>
                    <p style="color: #737171; font-size: 0.95rem; margin-bottom: 25px;">${esc(speaker.title)}</p>
                    <div class="row align-items-center mt-auto" style="border-top: 1px solid #eaeaea; padding-top: 15px; margin-left: 0; margin-right: 0;">
                      <div class="col-6" style="text-align: left; padding: 0;">
                        ${logoHtml}
                      </div>
                      <div class="col-6 d-flex justify-content-end align-items-center gap-2" style="padding: 0;">
                        ${linkedin}
                        <button type="button" class="btn btn-link p-0 border-0" data-bs-toggle="modal" data-bs-target="#${modalId}" aria-label="Show biography" title="Click for more info.">
                          ${INFO_ICON}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-xl">
                      <div class="modal-content" style="border-radius: 12px; border: none; padding: 1rem;">
                        <div class="modal-header border-0 pb-0">
                           <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" style="background-color: var(--color-orange-gradient-start); color: #fff; filter: invert(1); opacity: 1; border-radius: 50%; padding: 0.5rem; margin: -0.5rem -0.5rem 0 auto;"></button>
                        </div>
                        <div class="modal-body pt-0">
                          <div class="row mt-2">
                            <div class="col-md-4 text-center mb-4 mb-md-0">
                              ${avatar(speaker, 180, 70, "img-fluid rounded-circle")}
                            </div>
                            <div class="col-md-8 text-start">
                              <h3 style="color: var(--color-navy); font-weight: 700; margin-bottom: 5px;">${esc(speaker.name || "Unknown")}</h3>
                              <p style="color: #737171; font-weight: 500; font-size: 1.1rem; margin-bottom: 10px;">${esc(speaker.title)}</p>
                              ${
                                !logoSrc && speaker.company
                                  ? `<p style="font-weight: 600; color: var(--color-navy); margin-bottom: 20px;">${esc(speaker.company)}</p>`
                                  : ""
                              }
                              <div style="font-size: 1rem; color: #494848; line-height: 1.6;">
                                ${bio}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>`;
}

// The HTML build asks for every session role (see SPEAKERS_PAGE_ROLES), and
// the export groups on it, so a speaker with two roles arrives once per role.
// Each speaker gets one card: in Keynotes if any of their roles is keynote,
// otherwise in the internal or external section their type puts them in.
// Leaders and moderators have no section of their own on the public page.
function groupSections(speakers: SpeakersExport): { label: string; speakers: ExportSpeaker[] }[] {
  const byId = new Map<string, { speaker: ExportSpeaker; keynote: boolean; internal: boolean }>();
  speakers.sections.forEach((section) =>
    section.speakers.forEach((s) => {
      const keynote = section.role === "keynote" || s.role === "keynote";
      const internal =
        section.label === INTERNAL_LABEL || section.role === "internal" || s.role === "internal" || s.speakerType === "internal";
      const seen = byId.get(s.id);
      if (seen) {
        seen.keynote ||= keynote;
        seen.internal ||= internal;
      } else byId.set(s.id, { speaker: s, keynote, internal });
    }),
  );

  const entries = [...byId.values()];
  const pick = (test: (e: (typeof entries)[number]) => boolean) => entries.filter(test).map((e) => e.speaker);
  const keynotes = pick((e) => e.keynote);
  const internal = pick((e) => !e.keynote && e.internal);
  const external = pick((e) => !e.keynote && !e.internal);

  // Without keynotes the page keeps the export's own order, internal first.
  const sections = keynotes.length
    ? [
        { label: "Keynotes", speakers: keynotes },
        { label: EXTERNAL_HEADING, speakers: external },
        { label: INTERNAL_HEADING, speakers: internal },
      ]
    : [
        { label: INTERNAL_HEADING, speakers: internal },
        { label: EXTERNAL_HEADING, speakers: external },
      ];
  return sections.filter((s) => s.speakers.length > 0);
}

export interface SpeakersPageParts {
  title: string;
  taglineHtml: string;
  contentHtml: string;
}

export function renderSpeakersParts(speakers: SpeakersExport): SpeakersPageParts {
  const sections = groupSections(speakers);
  if (!sections.some((s) => s.speakers.length)) throw new Error("The speakers export has no speakers to publish.");
  const name = speakers.conference.name;

  const contentHtml = sections
    .map((section, i) => {
      const cards = section.speakers.map((s, idx) => renderSpeakerCard(s, `speakerModal_${i}_${idx}`)).join("");
      return `
            <span id="section-${i}" class="cBookmark" style="scroll-margin-top: 150px; display: block;"></span>
            <section class="cWhiteBG cImageGallery pb-4 pt-4">
              <div class="container">
                <div class="row cAlignCenter">
                  <div class="col-sm-12 col-md-12 col-lg-12">
                    <h2 style="font-weight: 600; color: var(--color-navy); margin-bottom: 30px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border-day-heading);">${esc(
                      section.label || "Speakers",
                    )}</h2>
                  </div>
                  <div class="clearfix"></div>
                  ${cards}
                </div>
              </div>
            </section>`;
    })
    .join("");

  return {
    title: name ? `Speakers — ${name}` : "Speakers",
    // The source hard-coded one year's event name here.
    taglineHtml: name ? `Meet the voices behind ${esc(name)}` : "",
    contentHtml,
  };
}
