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

// The agenda export as the public agenda page's markup. Ported from the
// render() script in the source's public/agenda-template.html, which the
// source ran inside a hidden iframe and then snapshotted. Here it runs as
// plain string building: this app's production CSP blocks inline script, and
// a srcdoc iframe inherits that policy, so the template's own script would
// never run once built. The markup, class names and layout rules are the
// template's; templates/agenda-template.html holds its styles, and runtime.js
// re-attaches the interactions that depend on these class names.

import {
  descriptionRichHtml,
  escapeHtml as esc,
  inlineRichHtml,
  safeClassName,
  safeDomId,
  safeImageUrl,
  safeLinkUrl,
  safeLogoStyle,
  safePaletteClass,
} from "./html";
import type {
  AgendaDay,
  AgendaExport,
  AgendaSection,
  AgendaSession,
  AgendaTrack,
  ExportArtifact,
  ExportSpeaker,
} from "./exportData";

type SpeakersMap = Map<string, ExportSpeaker>;

// ── Time and date labels ───────────────────────────────────────────────

const SLOT_MINUTES = 5;

// The public site spells times as "09:00 a.m.".
export function slotToTime(slot: number, startMinute: number): string {
  const total = startMinute + slot * SLOT_MINUTES;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const period = h >= 12 ? "p.m." : "a.m.";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function durationMinsLabel(slots: number): string {
  const min = slots * SLOT_MINUTES;
  return `${min} min${min === 1 ? "" : "s"}`;
}

// Day 1 is "ConfDay1" and every later day "ConDay{n}", with no "f": the
// public site's own anchors, kept for an export that omits `anchor`.
function defaultAnchor(dayIndex: number): string {
  return dayIndex === 0 ? "ConfDay1" : `ConDay${dayIndex + 1}`;
}

function dayAnchor(day: AgendaDay, i: number): string {
  return day.anchor ? safeDomId(day.anchor) : defaultAnchor(i);
}

function parseDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ordinalSuffix(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
}

const weekday = (d: Date, style: "long" | "short") => d.toLocaleDateString("en-US", { weekday: style });
const month = (d: Date, style: "long" | "short") => d.toLocaleDateString("en-US", { month: style });

// "Wednesday, May 20<sup>th</sup>", "Wednesday, May 20th", "May 20": the
// template's three DATE_FORMATS, written out rather than kept as a format
// mini-language nobody here edits.
function dayHeadingDate(d: Date): string {
  return `${weekday(d, "long")}, ${month(d, "short")} ${d.getDate()}<sup>${ordinalSuffix(d.getDate())}</sup>`;
}

function popupDate(d: Date): string {
  return `${weekday(d, "long")}, ${month(d, "long")} ${d.getDate()}${ordinalSuffix(d.getDate())}`;
}

function dayTabDate(d: Date): string {
  return `${month(d, "short")} ${d.getDate()}`;
}

// ── Speakers ───────────────────────────────────────────────────────────

const AVATAR_SLOT_COUNT = 7; // matches the .avatar-N rules in the template

function avatarClass(name: string): string {
  const n = name || "?";
  let hash = 0;
  for (let i = 0; i < n.length; i++) hash = n.charCodeAt(i) + ((hash << 5) - hash);
  return `avatar-${Math.abs(hash) % AVATAR_SLOT_COUNT}`;
}

function initials(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase();
}

function speakerAvatar(speaker: ExportSpeaker, size: number): string {
  const sz = `${size}px`;
  const initialsBox = (hidden: boolean) =>
    `<div class="speaker-avatar-initials ${avatarClass(speaker.name)}" style="width:${sz};height:${sz};font-size:${
      size * 0.3
    }px${hidden ? ";display:none" : ""}">${esc(initials(speaker.name))}</div>`;
  const photo = safeImageUrl(speaker.photoUrl);
  if (!photo) return initialsBox(false);
  // The handler is a fixed string, never data: a broken photo falls back to initials.
  return `<img class="speaker-avatar" src="${esc(photo)}" alt="${esc(speaker.name)}"
            width="${size}" height="${size}" style="width:${sz};height:${sz}"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            loading="lazy">
            ${initialsBox(true)}`;
}

function logoStyle(size: string | null, isModal: boolean): string {
  return safeLogoStyle(size) || (isModal ? "max-width: 90px;" : "max-width: 90px !important;");
}

function logoImg(speaker: ExportSpeaker, size: string | null, attrs: string, isModal = false): string {
  const src = safeImageUrl(speaker.companyLogoUrl);
  if (!src) return "";
  const style = `${logoStyle(size, isModal)}; margin-top: ${isModal ? "1rem" : "12px"};`;
  return `<img${attrs} src="${esc(src)}" style="${esc(style)}" alt="${esc(speaker.company ?? "")}" loading="lazy">`;
}

function resolveSpeakers(session: AgendaSession, speakers: SpeakersMap): ExportSpeaker[] {
  return session.speakers.map((sp) => speakers.get(sp.speakerId)).filter((s): s is ExportSpeaker => !!s);
}

// A modal only has something to show with a description or a speaker bio.
function canOpenModal(session: AgendaSession, speakers: SpeakersMap): boolean {
  if (session.description.trim()) return true;
  return resolveSpeakers(session, speakers).some((s) => s.bio.trim());
}

// ── Session cards ──────────────────────────────────────────────────────

function buildArtifacts(session: AgendaSession): ExportArtifact[] {
  const links: ExportArtifact[] = [];
  if (session.articleUrl) links.push({ label: session.articleLabel || "Article", url: session.articleUrl });
  if (session.videoUrl) links.push({ label: session.videoLabel || "Video", url: session.videoUrl });
  session.artifacts.forEach((a) => {
    if (a.url) links.push(a);
  });
  // A link that fails the scheme check is dropped, badge and all, rather
  // than left pointing at "#".
  return links
    .map((a) => ({ label: a.label, url: safeLinkUrl(a.url) }))
    .filter((a): a is ExportArtifact => a.url !== null);
}

// A card with its own article, or failing that any artifact, links out;
// otherwise it may open a modal.
function cardLink(session: AgendaSession, artifacts: ExportArtifact[]): string | null {
  return safeLinkUrl(session.articleUrl) ?? artifacts[0]?.url ?? null;
}

function modalAttrs(session: AgendaSession): string {
  return ` data-bs-toggle="modal" data-bs-target="#modal-${safeDomId(session.id)}" role="button" tabindex="0"`;
}

function ctaBadges(artifacts: ExportArtifact[]): string {
  return artifacts.map((a) => `<span class="cLinkCTA">${esc(a.label)}</span>`).join(" ");
}

// Each speaker row sums to 12 grid columns (avatar 2 + name + logo), or the
// next speaker's avatar wraps onto this one's line.
function renderSpeakerCols(speaker: ExportSpeaker): string {
  const logo = logoImg(speaker, speaker.companyLogoSize, ' class="Logo" onerror="this.style.display=\'none\'"');
  const logoHtml = logo ? `<div class="col-md-2 col-lg-2 p-0">${logo}</div>` : "";
  const nameCol = logo ? "col-md-8 col-lg-8" : "col-md-10 col-lg-10";
  return `
    <div class="col-md-2 col-lg-2 p-0 cAgendaSpeaker">${speakerAvatar(speaker, 45)}</div>
    <div class="${nameCol} cNameHover p-0">
      <div class="cSpeaker">
        <h5>${esc(speaker.name)}</h5>
        <h6>${esc([speaker.title, logo ? null : speaker.company].filter(Boolean).join(", "))}</h6>
      </div>
    </div>
    ${logoHtml}`;
}

// Room + artifact badges. Badges are spans: a card with any artifact is
// already wrapped in a link, and anchors cannot nest.
function renderCardFooter(room: string | null, artifacts: ExportArtifact[], colorClass: string): string {
  if (!room && !artifacts.length) return "";
  const roomHtml = room
    ? `<div class="col-5 LocationSet track-text-${safePaletteClass(colorClass)}"><span>${esc(room)}</span></div>`
    : '<div class="col-5"></div>';
  return `
    <div class="col-md-12 col-lg-12 p-0 cCardFooter">
      <hr>
      <div class="row">
        ${roomHtml}
        <div class="col-7 text-end pe-0">${ctaBadges(artifacts)}</div>
      </div>
    </div>`;
}

function speakerCountHeightClass(count: number): string {
  if (count <= 1) return "cOneSpeakerHight";
  if (count === 2) return "cTwoSpeakerHight";
  if (count === 3) return "cThreeSpeakerHight";
  if (count === 4) return "cFourSpeakerHight";
  return "cFiveSpeakerHight";
}

type CardVariant = "normal" | "vari";

// 'normal' is a standalone session; 'vari' is one of several short sessions
// merged into a single 30-minute SessionBlock. `extraClass` carries
// cTopBorderZero, the filter classes, and cVariGrow for the last vari card.
function renderSessionCard(
  session: AgendaSession,
  speakers: SpeakersMap,
  track: AgendaTrack | null,
  startMinute: number,
  variant: CardVariant,
  extraClass: string,
): string {
  const people = resolveSpeakers(session, speakers);
  const artifacts = buildArtifacts(session);
  const timeLabel = `${slotToTime(session.startSlot, startMinute)} (${durationMinsLabel(session.durationSlots)})`;
  const speakersHtml = people.map(renderSpeakerCols).join("");
  const heightClass = variant === "vari" ? "cVariSpeakerHight" : speakerCountHeightClass(people.length);

  const linkUrl = cardLink(session, artifacts);
  const openable = !linkUrl && canOpenModal(session, speakers);
  const footerHtml = renderCardFooter(session.room, artifacts, track?.colorClass ?? "");
  const isGrow = /(^|\s)cVariGrow(\s|$)/.test(extraClass);
  const outerClass =
    (variant === "vari" ? `cVariCard ${heightClass}` : "SessionBlock") +
    (linkUrl || openable ? " cAbstractBlock" : "") +
    (extraClass ? ` ${extraClass}` : "");

  // cCardBody wraps everything but the footer, so the card is a two-item
  // flex column and the footer sticks to the bottom via margin-top:auto.
  const titleHtml = inlineRichHtml(session.title, { unlink: !!linkUrl });
  const innerHtml =
    variant === "vari"
      ? `<div class="cCardBody row">
        <div class="col-md-12 col-lg-12 p-0">
          <div class="TimeSet"><span>${timeLabel}</span></div>
          <h3>${titleHtml}</h3>
        </div>
        ${speakersHtml}
      </div>
      ${footerHtml}`
      : `<div class="cCardBody">
        <div class="col-md-12 col-lg-10 p-0">
          <div class="TimeSet"><span>${timeLabel}</span></div>
        </div>
        <h3>${titleHtml}</h3>
        <div class="row ${heightClass}">${speakersHtml}</div>
      </div>
      ${footerHtml}`;

  const block = `<div class="${outerClass}"${openable ? modalAttrs(session) : ""}>${innerHtml}</div>`;
  if (!linkUrl) return block;
  // The grow class goes on the wrapping <a> too; see `.SessionBlock > a.cVariGrow`.
  const growClass = isGrow && variant === "vari" ? ' class="cVariGrow"' : "";
  return `<a href="${esc(linkUrl)}" target="_blank" rel="noopener"${growClass} style="text-decoration:none">${block}</a>`;
}

function sessionFilterClasses(session: AgendaSession): string[] {
  const cls = safeClassName(session.category);
  return cls ? [cls] : [];
}

// Two 15-minute sessions back to back fall in the same 30-minute block and
// share one SessionBlock, as on the public site.
function groupSessionsByBlock(sessions: AgendaSession[]): AgendaSession[][] {
  const SLOTS_PER_BLOCK = 6;
  const groups = new Map<number, AgendaSession[]>();
  sessions.forEach((s) => {
    const key = Math.floor(s.startSlot / SLOTS_PER_BLOCK);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  });
  return [...groups.keys()].sort((a, b) => a - b).map((key) => groups.get(key)!);
}

function renderSessionStack(
  sessions: AgendaSession[],
  speakers: SpeakersMap,
  track: AgendaTrack | null,
  startMinute: number,
): string {
  const sorted = [...sessions].sort((a, b) => a.startSlot - b.startSlot);
  return groupSessionsByBlock(sorted)
    .map((group, i) => {
      const classes = [
        i === 0 ? "cTopBorderZero" : "",
        "agenda-items",
        ...new Set(group.flatMap(sessionFilterClasses)),
      ]
        .filter(Boolean)
        .join(" ");
      if (group.length === 1) {
        return renderSessionCard(group[0], speakers, track, startMinute, "normal", classes);
      }
      const items = group
        .map((s, idx) =>
          renderSessionCard(s, speakers, track, startMinute, "vari", idx === group.length - 1 ? "cVariGrow" : ""),
        )
        .join("<hr>");
      return `<div class="SessionBlock ${classes}">${items}</div>`;
    })
    .join("");
}

// ── Keynotes ───────────────────────────────────────────────────────────

interface KeynoteEntry {
  speaker: ExportSpeaker;
  role: string;
}

function keynoteEntries(session: AgendaSession, speakers: SpeakersMap): KeynoteEntry[] {
  return session.speakers
    .map((sp) => ({ speaker: speakers.get(sp.speakerId), role: sp.role }))
    .filter((e): e is KeynoteEntry => !!e.speaker);
}

function keynoteSpeakerName(speaker: ExportSpeaker, extraClass = ""): string {
  return `<div class="cSpeaker mt-2${extraClass}" style="margin-bottom:0;">
            <h5>${esc(speaker.name)}</h5>
            <h6>${esc(speaker.title)}</h6>
          </div>`;
}

// `hideLogo` is set only when every panelist is internal: the shared logo
// row below the panel stands in for theirs.
function renderKeynoteLeader(speaker: ExportSpeaker, hideLogo: boolean): string {
  const logo = hideLogo ? "" : logoImg(speaker, speaker.companyLogoSize, ' class="Logo"');
  return `
        <div class="col-1 cKeynoteSpeaker">${speakerAvatar(speaker, 65)}</div>
        <div class="col-8 cNameHover p-0">
          ${keynoteSpeakerName(speaker)}
        </div>
        ${logo ? `<div class="col-3 p-0">${logo}</div>` : ""}`;
}

function renderKeynotePanelSpeaker(speaker: ExportSpeaker, hideLogo: boolean): string {
  const logo = hideLogo ? "" : logoImg(speaker, speaker.companyLogoSize, ' class="Logo"');
  return `
        <div class="col-md-2 col-lg-2 px-3">
          <div class="cKeynoteSpeaker">${speakerAvatar(speaker, 65)}</div>
          <div class="cNameHover p-0">
            ${keynoteSpeakerName(speaker)}
          </div>
          ${logo}
        </div>`;
}

// The speaker tagged 'leader' sits on top, the rest in a row beneath an
// <hr>; with no leader everyone shares the one row.
function splitKeynotePanel(entries: KeynoteEntry[]) {
  const leader = entries.filter((e) => e.role === "leader");
  const rest = entries.filter((e) => e.role !== "leader");
  return leader.length ? { leader, rest } : { leader: [], rest: entries };
}

function renderKeynotePanel(entries: KeynoteEntry[], hideLogo: boolean, bordered: boolean): string {
  const wrapperClass = bordered ? "row border-bottom pb-2" : "row";
  const { leader, rest } = splitKeynotePanel(entries);
  const restRow = rest.map((e) => renderKeynotePanelSpeaker(e.speaker, hideLogo)).join("");
  if (!leader.length) return `<div class="${wrapperClass}">${restRow}</div>`;
  return `
      <div class="${wrapperClass}">
        <div class="row pb-3 ps-0">${leader.map((e) => renderKeynoteLeader(e.speaker, hideLogo)).join("")}</div>
        ${rest.length ? `<hr>\n      <div class="row pt-3 ps-0">${restRow}</div>` : ""}
      </div>`;
}

function renderKeynoteSoloSpeaker(speaker: ExportSpeaker): string {
  const logo = logoImg(speaker, speaker.companyLogoSize, ' class="Logo"');
  return `
      <div class="col-md-1 col-lg-1"></div>
      <div class="col-md-1 col-lg-1 p-0 cKeynoteSpeaker">${speakerAvatar(speaker, 65)}</div>
      <div class="col-md-2 col-lg-2 cNameHover p-0">
        ${keynoteSpeakerName(speaker, " row")}
      </div>
      ${logo ? `<div class="col-md-2 col-lg-2">${logo}</div>` : ""}`;
}

// An all-internal panel drops each speaker's logo for one shared one. The
// source hard-coded the organiser's logo from its CDN; here it is the event's
// own default internal logo, or failing that a panelist's company logo.
function sharedLogoRow(logoUrl: string): string {
  return `
      <div class="row pt-1">
        <img src="${esc(logoUrl)}" style="width: 118px !important;margin-top: 5px;" class="Logo" alt="" loading="lazy">
      </div>`;
}

function keynoteTimeLabel(session: AgendaSession, startMinute: number): string {
  return `${slotToTime(session.startSlot, startMinute)} (${durationMinsLabel(session.durationSlots)})`;
}

function renderKeynoteItem(
  session: AgendaSession,
  speakers: SpeakersMap,
  startMinute: number,
  internalLogoUrl: string | null,
): string {
  const room = session.room;
  const artifacts = buildArtifacts(session);
  const entries = keynoteEntries(session, speakers);
  // A keynote still waiting on its speaker keeps the solo layout, so filling
  // the speaker in later does not reflow its time/room/title block.
  const solo = entries.length <= 1;
  const ctaHtml = ctaBadges(artifacts);

  const linkUrl = cardLink(session, artifacts);
  const openable = !linkUrl && canOpenModal(session, speakers);
  const clickAttrs = openable ? modalAttrs(session) : "";
  const stateClass = linkUrl ? " cAbstractBlock" : openable ? "" : " not-clickable";
  const wrap = (html: string) =>
    linkUrl ? `<a href="${esc(linkUrl)}" target="_blank" rel="noopener" style="text-decoration:none">${html}</a>` : html;
  const timeHtml = `<div class="TimeSet">
              <span>${keynoteTimeLabel(session, startMinute)}</span>
            </div>`;
  const titleInner = inlineRichHtml(session.title, { unlink: !!linkUrl });
  const titleHtml = `
      <div class="col-md-12 col-lg-12 ps-0">
        <h3>${titleInner}</h3>
      </div>`;

  if (solo) {
    const roomHtml = ctaHtml
      ? `<div class="col-md-12 col-lg-7 ps-0">
          <div class="row">
            <div class="col-5 LocationSet cKeynoteTheme"><span>${esc(room ?? "")}</span></div>
            <div class="col-7 pe-0 ps-0">${ctaHtml}</div>
          </div>
        </div>`
      : room
        ? `<div class="col-md-12 col-lg-4 ps-0"><div class="LocationSet cKeynoteTheme"><span>${esc(room)}</span></div></div>`
        : "";
    return wrap(`
    <div class="row row SessionBlock cKeynoteBlock${stateClass}"${clickAttrs}>
      <div class="col-md-6 col-lg-6 ps-0">
        <div class="row">
          <div class="col-md-12 col-lg-5 ps-0">
            ${timeHtml}
          </div>
          ${roomHtml}
          <div class="col-md-12 col-lg-12 ps-0">
            <h3>${titleInner}</h3>
          </div>
        </div>
      </div>
      ${entries.length ? renderKeynoteSoloSpeaker(entries[0].speaker) : ""}
    </div>`);
  }

  const allInternal = entries.every((e) => e.speaker.speakerType === "internal");
  const sharedLogo = allInternal
    ? (safeImageUrl(internalLogoUrl) ??
      entries.map((e) => safeImageUrl(e.speaker.companyLogoUrl)).find((u): u is string => !!u) ??
      null)
    : null;
  // The panel's bottom border only separates it from the shared logo row.
  const panelHtml = renderKeynotePanel(entries, allInternal, !!sharedLogo);
  const logoRowHtml = sharedLogo ? sharedLogoRow(sharedLogo) : "";

  // A panel with a leader carries the solo header (time and room paired in
  // a half-width column); a leaderless one has a full-width time bar.
  if (splitKeynotePanel(entries).leader.length) {
    const roomCol = room ? `<div class="col-7 LocationSet cKeynoteTheme"><span>${esc(room)}</span></div>` : "";
    const ctaCol = ctaHtml ? `<div class="col-5 pe-0 ps-0">${ctaHtml}</div>` : "";
    return wrap(`
    <div class="row SessionBlock cKeynoteBlock${stateClass}"${clickAttrs}>
      <div class="col-md-12 col-lg-6" style="padding-left: 0;">
        <div class="row">
          <div class="col-md-12 col-lg-5 ps-0">
            ${timeHtml}
          </div>
          <div class="col-md-12 col-lg-7 ps-0">
            <div class="row">
              ${roomCol}${ctaCol}
            </div>
          </div>
        </div>
      </div>
      ${titleHtml}
      ${panelHtml}
      ${logoRowHtml}
    </div>`);
  }

  const roomHtml = room ? `<div class="col-4 LocationSet cKeynoteTheme"><span>${esc(room)}</span></div>` : "";
  return wrap(`
    <div class="row row SessionBlock cKeynoteBlock${stateClass}"${clickAttrs}>
      <div class="col-md-12 col-lg-2 ps-0">
        ${timeHtml}
      </div>
      <div class="col-md-12 col-lg-7 ps-0">
        <div class="row">
          ${roomHtml}
          <div class="col-7 pe-0 ps-0">${ctaHtml}</div>
        </div>
      </div>
      ${titleHtml}
      ${panelHtml}
      ${logoRowHtml}
    </div>`);
}

function renderKeynoteSectionHeader(section: AgendaSection, startMinute: number): string {
  const start = slotToTime(section.startSlot, startMinute);
  const end = slotToTime(section.startSlot + section.durationSlots, startMinute);
  return `
    <div class="cTimeBar cKeyNoteBar">
      <h5>${start} - ${end} &nbsp;&nbsp;&nbsp;<span>${esc(section.label)}</span></h5>
    </div>`;
}

// ── Full-width bars ────────────────────────────────────────────────────

function renderBreakBar(session: AgendaSession, startMinute: number): string {
  return `
    <div class="col-md-12 col-lg-12 agenda-items">
      <div class="cBreakBar">
        <h3>${slotToTime(session.startSlot, startMinute)} - <span class="cDarkBlue">${inlineRichHtml(session.title)}</span></h3>
      </div>
    </div>`;
}

// Unlike a break, an activity shows a start-end range.
function renderActivityBar(session: AgendaSession, startMinute: number): string {
  const start = slotToTime(session.startSlot, startMinute);
  const end = slotToTime(session.startSlot + session.durationSlots, startMinute);
  return `
    <div class="col-md-12 col-lg-12 agenda-items">
      <div class="cTimeBar">
        <h5>${start} - ${end} | <span class="cDarkBlue">${inlineRichHtml(session.title)}</span></h5>
      </div>
    </div>`;
}

function renderFootnote(text: string): string {
  return `
    <div class="col-md-12 col-lg-12 agenda-items">
      <div class="cFootnote">
        *${esc(text)}
      </div>
    </div>`;
}

// ── Modals ─────────────────────────────────────────────────────────────

// One <p> per line, as on the speakers page: the bio is a plain multiline
// field, and a single paragraph would run its lines together.
function bioParagraphs(bio: string): string {
  return bio
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p class="cBioText">${esc(line)}</p>`)
    .join("");
}

function renderSpeakerPopupRow(speaker: ExportSpeaker, isLast: boolean): string {
  // No class="Logo": its 30px height cap would shrink the modal's logos.
  const logoHtml = logoImg(speaker, speaker.modalCompanyLogoSize, "", true);
  const linkedinUrl = safeLinkUrl(speaker.linkedinUrl);
  const linkedin = linkedinUrl
    ? `<a href="${esc(linkedinUrl)}" target="_blank" rel="noopener" class="cSpeakerLinkedin">&#8599; LinkedIn</a>`
    : "";
  const bioBlock =
    speaker.bio || linkedin
      ? `<div class="col-md-12 col-lg-12">
          <div class="cModelBio">
            ${bioParagraphs(speaker.bio)}
            ${linkedin}
          </div>
        </div>`
      : "";
  return `
    <div class="row"${isLast ? "" : ' style="padding-bottom: 3rem;"'}>
      <div class="col-md-2 col-lg-2 cSpeakerSide pe-0">${speakerAvatar(speaker, 85)}</div>
      <div class="col-md-5 col-lg-5 cSpeakerSide ps-0 pe-0">
        <h3>${esc(speaker.name)}</h3>
        <h4>${esc([speaker.title, logoHtml ? null : speaker.company].filter(Boolean).join(", "))}</h4>
      </div>
      <div class="col-md-5 col-lg-5 cAlignCenter">${logoHtml}</div>
      ${bioBlock}
    </div>`;
}

// The chip reads the same custom properties as the .chip-palette-* classes,
// as CSS variables. The source resolved them through getComputedStyle at
// render time, which needs a live document.
function paletteChipStyle(paletteClass: string): string {
  return `background-color:var(--${paletteClass}-bg);color:var(--${paletteClass}-text)!important;border-left:solid 5px var(--${paletteClass}-chip-border)!important;`;
}

function renderSessionModal(
  session: AgendaSession,
  speakers: SpeakersMap,
  track: AgendaTrack | null,
  day: AgendaDay,
  dayLabel: string,
): string {
  const id = safeDomId(session.id);
  const people = resolveSpeakers(session, speakers);
  const artifacts = buildArtifacts(session);
  const date = parseDate(day.date);

  const sectionChip =
    track && session.sectionLabel
      ? `<div class="cTrackPopup" style="${paletteChipStyle(safePaletteClass(track.colorClass))}"><p>${esc(
          session.sectionLabel,
        )}</p></div>`
      : "";
  const timeText = `${esc(dayLabel)}${date ? ` (${popupDate(date)})` : ""}&nbsp;&nbsp;|&nbsp;&nbsp;${slotToTime(
    session.startSlot,
    day.startMinute,
  )} (${durationMinsLabel(session.durationSlots)})`;
  const abstractHtml = descriptionRichHtml(session.description);
  const speakerRows = people.map((s, i) => renderSpeakerPopupRow(s, i === people.length - 1)).join("");
  const artifactsHtml = artifacts.length
    ? `<div class="col-md-12 col-lg-12 pt-2 d-flex flex-wrap gap-2">${artifacts
        .map((a) => `<a class="cLinkCTA" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.label)}</a>`)
        .join("")}</div>`
    : "";

  return `
    <div class="modal fade" id="modal-${id}" tabindex="-1"
         data-bs-backdrop="static" data-bs-keyboard="false"
         aria-labelledby="modal-label-${id}" aria-hidden="true">
        <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-body">
            <div class="modal-header-area">
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              ${sectionChip}
              <div class="TimeSetPopup"><span>${timeText}</span></div>
              <h2 class="modal-title" id="modal-label-${id}">${inlineRichHtml(session.title)}</h2>
            </div>
            <div class="col-md-12 col-lg-12 cBlockAbstract">
              ${abstractHtml ? `<div class="PoPAbstract">${abstractHtml}</div>` : ""}
              ${speakerRows}
              ${artifactsHtml}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Day layout ─────────────────────────────────────────────────────────

interface BandColumn {
  trackIndex: number;
  startSlot: number;
  durationSlots: number;
  label: string | null;
  sessions: AgendaSession[];
}

// Track content that starts together forms a band: one row of track columns,
// as the public site opens a fresh row per time band.
function buildTrackBands(day: AgendaDay): { startSlot: number; columns: BandColumn[] }[] {
  const columns: BandColumn[] = [];
  const trackIndexOf = (trackId: string | null) => day.tracks.findIndex((t) => t.id === trackId);
  day.trackSections.forEach((section) => {
    const trackIndex = trackIndexOf(section.trackId);
    if (trackIndex < 0) return;
    columns.push({ ...section, trackIndex, label: section.label });
  });
  day.unsectioned.forEach((item) => {
    if (item.kind !== "session") return;
    const trackIndex = trackIndexOf(item.trackId);
    if (trackIndex < 0) return;
    columns.push({ ...item, trackIndex, label: null });
  });

  const byStart = new Map<number, BandColumn[]>();
  columns.forEach((c) => byStart.set(c.startSlot, [...(byStart.get(c.startSlot) ?? []), c]));
  return [...byStart.keys()]
    .sort((a, b) => a - b)
    .map((startSlot) => ({
      startSlot,
      columns: byStart.get(startSlot)!.sort((a, b) => a.trackIndex - b.trackIndex),
    }));
}

interface ModalEntry {
  session: AgendaSession;
  track: AgendaTrack | null;
}

function renderDayGrid(
  day: AgendaDay,
  speakers: SpeakersMap,
  modals: ModalEntry[],
  internalLogoUrl: string | null,
): string {
  const colWidth = Math.max(1, Math.floor(12 / Math.max(day.tracks.length, 1)));
  const rows: { startSlot: number; html: string }[] = [];

  buildTrackBands(day).forEach((band) => {
    const maxDuration = Math.max(...band.columns.map((c) => c.durationSlots || 0));
    const filterClasses = band.columns.flatMap((c) => c.sessions.flatMap(sessionFilterClasses));
    const timeBar = `
    <div class="col-md-12 col-lg-12 agenda-items ${filterClasses.join(" ")}">
      <div class="cTimeBar">
        <h3>${slotToTime(band.startSlot, day.startMinute)} - ${slotToTime(band.startSlot + maxDuration, day.startMinute)}</h3>
      </div>
    </div>`;
    const cols = band.columns
      .map((col) => {
        const track = day.tracks[col.trackIndex];
        col.sessions.forEach((session) => modals.push({ session, track }));
        const bandLabel = col.label
          ? `<div class="cTrackBand track-${safePaletteClass(track.colorClass)}"><p>${esc(col.label)}</p></div>`
          : "";
        return `<div class="col-md-12 col-lg-${colWidth} track-column">${bandLabel}${renderSessionStack(
          col.sessions,
          speakers,
          track,
          day.startMinute,
        )}</div>`;
      })
      .join("");
    rows.push({ startSlot: band.startSlot, html: `<div class="row">${timeBar}</div><div class="row">${cols}</div>` });
  });

  day.keynoteSections.forEach((section) => {
    section.sessions.forEach((session) => modals.push({ session, track: null }));
    const items = [...section.sessions]
      .sort((a, b) => a.startSlot - b.startSlot)
      .map(
        (s) =>
          `<div class="col-md-12 col-lg-12">${renderKeynoteItem(s, speakers, day.startMinute, internalLogoUrl)}</div>`,
      )
      .join("");
    rows.push({
      startSlot: section.startSlot,
      html: `<div class="row"><div class="col-md-12 agenda-items keynotes"><div class="keynote-section-box">${renderKeynoteSectionHeader(
        section,
        day.startMinute,
      )}${items}</div></div></div>`,
    });
  });

  day.unsectioned.forEach((item) => {
    const first = item.sessions[0];
    if (item.kind === "keynote" && first) {
      modals.push({ session: first, track: null });
      rows.push({
        startSlot: item.startSlot,
        html: `<div class="row"><div class="col-md-12 agenda-items keynotes">${renderKeynoteItem(
          first,
          speakers,
          day.startMinute,
          internalLogoUrl,
        )}</div></div>`,
      });
    } else if (item.kind === "break" && first) {
      item.sessions.forEach((session) => modals.push({ session, track: null }));
      rows.push({ startSlot: item.startSlot, html: `<div class="row">${renderBreakBar(first, day.startMinute)}</div>` });
    } else if (item.kind === "activity" && first) {
      // No modal: an activity has no speakers or description to show.
      rows.push({
        startSlot: item.startSlot,
        html: `<div class="row">${renderActivityBar(first, day.startMinute)}</div>`,
      });
    } else if (item.kind === "footnote") {
      rows.push({ startSlot: item.startSlot, html: `<div class="row">${renderFootnote(item.text)}</div>` });
    }
  });

  // Stable sort, so rows sharing a slot keep bands, keynotes, then the rest.
  return rows
    .sort((a, b) => a.startSlot - b.startSlot)
    .map((r) => r.html)
    .join("");
}

// ── Page parts ─────────────────────────────────────────────────────────

export interface AgendaRenderOptions {
  /** The event's default internal logo, for all-internal keynote panels. */
  internalLogoUrl?: string | null;
  /** The build time, for whether the countdown is still worth showing. */
  now?: Date;
}

export interface AgendaPageParts {
  title: string;
  tabsHtml: string;
  filterHtml: string;
  contentHtml: string;
  modalsHtml: string;
  countdownHtml: string;
}

function countdownDigits(start: Date, now: Date): string | null {
  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const totalHours = Math.floor(diffMs / 3_600_000);
  return `${Math.floor(totalHours / 24)}d ${totalHours % 24}h`;
}

// The digits are recomputed by runtime.js when the page opens; these only
// fill the first paint. The start date travels as a data attribute, and only
// in the YYYY-MM-DD shape parseDate accepts.
function renderCountdown(conference: AgendaExport["conference"], now: Date): string {
  const start = parseDate(conference.startDate);
  const digits = start && countdownDigits(start, now);
  if (!digits) return "";
  return `
    <div class="countdown-widget" data-start-date="${esc(conference.startDate)}">
      <button class="countdown-dismiss" aria-label="Dismiss countdown">&times;</button>
      <p>${esc(conference.name || "The event")} starts in</p>
      <div class="digits">${digits}</div>
    </div>`;
}

// Only the options the stylesheet's .dropdown-box knows. The source wrote
// both slug and label into the markup unescaped.
function renderTrackFilter(filters: AgendaExport["trackFilters"]): string {
  const options = filters.filter((f) => safeClassName(f.slug));
  if (!options.length) return "";
  return `
    <div class="dropdown-box">
      <select id="track-filter-select" aria-label="Filter by track">
        <option value="all">All Tracks</option>
        ${options.map((o) => `<option value="${esc(o.slug)}">${esc(o.label)}</option>`).join("")}
      </select>
    </div>`;
}

export function renderAgendaParts(agenda: AgendaExport, options: AgendaRenderOptions = {}): AgendaPageParts {
  const { conference, speakers, days } = agenda;
  if (!days.length) throw new Error("The agenda has no scheduled days to publish.");
  const internalLogoUrl = options.internalLogoUrl ?? null;

  const tabsHtml = days
    .map((day, i) => {
      const date = parseDate(day.date);
      const label = day.label || `Day ${i + 1}`;
      return `<li class="nav-item"><a class="nav-link${i === 0 ? " active" : ""}" href="#${dayAnchor(day, i)}">${esc(
        label,
      )}${date ? ` - ${dayTabDate(date)}` : ""}</a></li>`;
    })
    .join("");

  const content: string[] = [];
  const modals: string[] = [];
  days.forEach((day, i) => {
    const anchor = dayAnchor(day, i);
    const label = day.label || `Day ${i + 1}`;
    const date = parseDate(day.date);
    const dayModals: ModalEntry[] = [];
    const grid = renderDayGrid(day, speakers, dayModals, internalLogoUrl);
    content.push(`
      <span id="${anchor}" class="cBookmark"></span>
      <div data-day-index="${i}" data-anchor="${anchor}">
        <section class="cNameBlock cWhiteBG day-section">
          <div class="container">
            <div class="row">
              <div class="col-12">
                <h2 class="day-heading">${esc(label)}${date ? ` (${dayHeadingDate(date)})` : ""}</h2>
              </div>
            </div>
          </div>
        </section>
        <section class="cAgendaBlock cWhiteBG">
          <div class="container">${grid}</div>
        </section>
      </div>`);
    // Only cards that open one: a linked card goes to its link, and the
    // source's modal for it could never be reached.
    dayModals.forEach(({ session, track }) => {
      const linked = cardLink(session, buildArtifacts(session)) !== null;
      if (!linked && canOpenModal(session, speakers)) {
        modals.push(renderSessionModal(session, speakers, track, day, label));
      }
    });
  });

  return {
    title: conference.name ? `Agenda — ${conference.name}` : "Agenda",
    tabsHtml,
    filterHtml: renderTrackFilter(agenda.trackFilters),
    contentHtml: content.join(""),
    modalsHtml: modals.join(""),
    countdownHtml: renderCountdown(conference, options.now ?? new Date()),
  };
}
