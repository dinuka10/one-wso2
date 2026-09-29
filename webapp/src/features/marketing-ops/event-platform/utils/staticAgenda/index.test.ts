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
import { buildStaticAgendaHtml, buildStaticSpeakersHtml, fillTemplate } from "./index";

const NOW = new Date("2026-01-10T09:00:00");
const PHOTO = "https://cdn.example.com/speaker-one.png";
const LOGO = "https://cdn.example.com/logo.png";

const speakerOne = {
  id: "sp-1",
  name: "Speaker One",
  title: "Engineer",
  bio: "Bio of speaker one.",
  photoUrl: PHOTO,
  companyLogoUrl: LOGO,
  companyLogoSize: "max-width: 80px",
  modalCompanyLogoSize: null,
  company: "Example Co",
  linkedinUrl: "https://www.linkedin.example.com/in/speaker-one",
  speakerType: "external",
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    kind: "session",
    title: "<p>Opening talk</p>",
    description: "<p>What the talk covers.</p>",
    startSlot: 12,
    durationMins: 30,
    sectionLabel: "Morning",
    category: "ai",
    room: { name: "Room A", colorToken: "blue" },
    artifacts: [],
    speakerIds: ["sp-1"],
    speakerRoles: { "sp-1": "speaker" },
    ...overrides,
  };
}

function agenda(sessionOverrides: Record<string, unknown> = {}, rest: Record<string, unknown> = {}) {
  return {
    conference: { id: "evt-7", name: "Example Conf", startDate: "2026-03-04" },
    generatedAt: "2026-01-01T00:00:00Z",
    speakers: { "sp-1": speakerOne },
    trackFilters: [{ slug: "ai", label: "AI" }],
    days: [
      {
        id: "d-1",
        dayIndex: 0,
        label: "Day 1",
        date: "2026-03-04",
        anchor: "ConfDay1",
        startMinute: 480,
        endMinute: 1080,
        tracks: [{ id: "t-1", name: "Track 1", colorClass: "palette-orange" }],
        trackSections: [
          { id: "ts-1", trackId: "t-1", label: "Morning", startSlot: 12, durationSlots: 6, sessions: [session(sessionOverrides)] },
        ],
        keynoteSections: [],
        unsectioned: [
          { kind: "footnote", trackId: null, startSlot: 30, durationSlots: 0, sessions: [], text: "Lunch is served <here>" },
        ],
      },
    ],
    ...rest,
  };
}

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("fillTemplate", () => {
  it("fills every slot in one pass, so inserted text is never re-scanned", () => {
    expect(fillTemplate("<a>%%A%%</a><b>%%B%%</b>", { A: "%%B%%", B: "x" })).toBe("<a>%%B%%</a><b>x</b>");
  });

  it("strips the leading license comment", () => {
    expect(fillTemplate("<!-- license -->\n<!DOCTYPE html>%%A%%", { A: "1" })).toBe("<!DOCTYPE html>1");
  });

  it("fails on a missing, repeated or unused slot", () => {
    expect(() => fillTemplate("%%A%%", {})).toThrow(/no value/);
    expect(() => fillTemplate("%%A%%%%A%%", { A: "" })).toThrow(/twice/);
    expect(() => fillTemplate("%%A%%", { A: "", B: "" })).toThrow(/no slot for B/);
  });
});

describe("buildStaticAgendaHtml", () => {
  it("builds a complete page from the export", () => {
    const html = buildStaticAgendaHtml(agenda(), { now: NOW });
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).not.toMatch(/%%[A-Z_]+%%/);

    const doc = parse(html);
    expect(doc.title).toBe("Agenda — Example Conf");
    const tab = doc.querySelector("#day-tabs a.nav-link.active");
    expect(tab?.getAttribute("href")).toBe("#ConfDay1");
    expect(tab?.textContent).toBe("Day 1 - Mar 4");
    expect(doc.querySelector(".day-heading")?.innerHTML).toBe("Day 1 (Wednesday, Mar 4<sup>th</sup>)");

    // 480 + 12 slots × 5 min = 09:00.
    expect(doc.querySelector(".cTimeBar h3")?.textContent).toBe("09:00 a.m. - 09:30 a.m.");
    const card = doc.querySelector(".track-column .SessionBlock");
    expect(card?.classList.contains("agenda-items")).toBe(true);
    expect(card?.classList.contains("ai")).toBe(true);
    expect(card?.getAttribute("data-bs-target")).toBe("#modal-s-1");
    expect(card?.querySelector("h3")?.innerHTML).toBe("Opening talk");
    expect(doc.querySelector(".cTrackBand")?.classList.contains("track-palette-orange")).toBe(true);
    expect(doc.querySelector(".cSpeaker h5")?.textContent).toBe("Speaker One");
    expect(doc.querySelector(".cAgendaSpeaker img")?.getAttribute("src")).toBe(PHOTO);
    expect(doc.querySelector(".LocationSet span")?.textContent).toBe("Room A");

    const modal = doc.querySelector("#modal-s-1");
    expect(modal?.querySelector(".PoPAbstract")?.innerHTML).toBe("<p>What the talk covers.</p>");
    expect(modal?.querySelector(".cBioText")?.textContent).toBe("Bio of speaker one.");
    expect(modal?.querySelector(".cTrackPopup")?.getAttribute("style")).toContain("var(--palette-orange-bg)");

    const filter = doc.querySelectorAll("#track-filter-select option");
    expect([...filter].map((o) => o.getAttribute("value"))).toEqual(["all", "ai"]);
    expect(doc.querySelector(".cFootnote")?.textContent?.trim()).toBe("*Lunch is served <here>");

    const widget = doc.querySelector(".countdown-widget");
    expect(widget?.getAttribute("data-start-date")).toBe("2026-03-04");
    expect(widget?.querySelector(".digits")?.textContent).toMatch(/^\d+d \d+h$/);
  });

  it("inlines the runtime and loads scripts only from the public CDN", () => {
    const doc = parse(buildStaticAgendaHtml(agenda(), { now: NOW }));
    const scripts = [...doc.querySelectorAll("script")];
    expect(scripts.filter((s) => s.src).map((s) => new URL(s.src).host)).toEqual(["cdn.jsdelivr.net"]);
    const inline = scripts.filter((s) => !s.src);
    expect(inline).toHaveLength(1);
    expect(inline[0].textContent).toContain("syncTrackColumnHeights");
  });

  it("links a card with an artifact out instead of opening a modal", () => {
    const doc = parse(
      buildStaticAgendaHtml(agenda({ artifacts: [{ label: "Slides", url: "https://example.com/slides" }] }), { now: NOW }),
    );
    const link = doc.querySelector(".track-column > a");
    expect(link?.getAttribute("href")).toBe("https://example.com/slides");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.querySelector(".cLinkCTA")?.textContent).toBe("Slides");
    expect(link?.querySelector("[data-bs-toggle]")).toBeNull();
    // Unlike the source, no unreachable modal is emitted for it.
    expect(doc.querySelector("#modal-s-1")).toBeNull();
  });

  it("omits the countdown once the start date has passed", () => {
    const html = buildStaticAgendaHtml(agenda(), { now: new Date("2026-06-01T00:00:00") });
    expect(parse(html).querySelector(".countdown-widget")).toBeNull();
  });

  it("refuses an export with no days", () => {
    expect(() => buildStaticAgendaHtml({ conference: { name: "Example Conf" }, days: [] })).toThrow(/no scheduled days/);
    expect(() => buildStaticAgendaHtml(null)).toThrow(/no scheduled days/);
  });

  it("neutralises hostile values in every field it writes", () => {
    const evil = '"><script>alert(1)</script><img src=x onerror=alert(1)>';
    const hostile = {
      ...agenda(
        {
          id: `s-1${evil}`,
          title: `<p>Talk<script>alert(1)</script><img src=x onerror="alert(1)"></p>`,
          description: `<p onclick="alert(1)">Desc<a href="javascript:alert(1)">x</a></p>`,
          sectionLabel: evil,
          category: `ai${evil}`,
          room: { name: evil, colorToken: "blue" },
          artifacts: [
            { label: evil, url: "javascript:alert(1)" },
            { label: "Ok", url: "https://example.com/ok" },
          ],
        },
        {
          trackFilters: [
            { slug: `ai${evil}`, label: "bad" },
            { slug: "ok", label: evil },
          ],
        },
      ),
      conference: { id: "evt-7", name: evil, startDate: `2026-03-04${evil}` },
      speakers: {
        "sp-1": {
          ...speakerOne,
          name: evil,
          title: evil,
          bio: evil,
          company: evil,
          photoUrl: "javascript:alert(1)",
          companyLogoUrl: "data:image/svg+xml,<svg onload=alert(1)>",
          companyLogoSize: "position:fixed;inset:0;background:url(https://tracker.example.com/p.gif)",
          linkedinUrl: "javascript:alert(1)",
        },
      },
    };
    hostile.days[0].anchor = `ConfDay1${evil}`;
    hostile.days[0].label = evil;
    hostile.days[0].tracks[0].colorClass = `palette-red${evil}`;
    hostile.days[0].unsectioned[0].text = evil;

    const html = buildStaticAgendaHtml(hostile, { now: NOW });
    const doc = parse(html);

    // The one inline script is the runtime; nothing from the data became a
    // script, a handler, or a javascript:/data: URL.
    expect([...doc.querySelectorAll("script")].filter((s) => !s.src)).toHaveLength(1);
    expect(doc.querySelector("script:not([src])")?.textContent).not.toContain("alert(1)");
    const handlers = [...doc.querySelectorAll("*")].flatMap((el) =>
      el.getAttributeNames().filter((name) => name.startsWith("on") && name !== "onerror"),
    );
    expect(handlers).toEqual([]);
    // The template's own fallback handlers are fixed strings.
    for (const el of doc.querySelectorAll("[onerror]")) {
      expect(el.getAttribute("onerror")).not.toContain("alert");
    }
    for (const el of doc.querySelectorAll("[href], [src]")) {
      const url = el.getAttribute("href") ?? el.getAttribute("src") ?? "";
      expect(url).not.toMatch(/^\s*(javascript|data|vbscript):/i);
    }
    expect(doc.querySelectorAll("img[src='x']")).toHaveLength(0);

    // Hostile text arrives as text.
    expect(doc.querySelector(".cSpeaker h5")?.textContent).toBe(evil);
    expect(doc.querySelector(".LocationSet span")?.textContent).toBe(evil);
    expect(doc.querySelector(".day-heading")?.textContent).toContain(evil);
    expect(doc.title).toBe(`Agenda — ${evil}`);
    // Ids, anchors, classes and the palette slot are squashed or refused.
    expect(doc.querySelector("#day-tabs a")?.getAttribute("href")).toMatch(/^#[\w-]+$/);
    expect(doc.querySelector(".cTrackBand")?.classList.contains("track-palette-main")).toBe(true);
    expect([...doc.querySelectorAll("#track-filter-select option")].map((o) => o.getAttribute("value"))).toEqual([
      "all",
      "ok",
    ]);
    // The logo size lost everything but sizing, and the unsafe logo is gone.
    expect(html).not.toContain("tracker.example.com");
    expect(html).not.toContain("position:fixed");
    // Only the safe artifact survives, and the card links to it.
    expect(doc.querySelector(".track-column > a")?.getAttribute("href")).toBe("https://example.com/ok");
    // A start date of the wrong shape means no countdown.
    expect(doc.querySelector(".countdown-widget")).toBeNull();
  });

  it("uses the event's internal logo under an all-internal keynote panel", () => {
    const internal = (id: string) => ({ ...speakerOne, id, name: `Speaker ${id}`, speakerType: "internal", companyLogoUrl: null });
    const data = agenda();
    Object.assign(data, { speakers: { a: internal("a"), b: internal("b") } });
    data.days[0].unsectioned = [
      {
        kind: "keynote",
        trackId: null,
        startSlot: 0,
        durationSlots: 6,
        text: "",
        sessions: [session({ id: "k-1", speakerIds: ["a", "b"], speakerRoles: { a: "leader", b: "keynote" } })],
      },
    ] as never;
    const doc = parse(buildStaticAgendaHtml(data, { now: NOW, internalLogoUrl: LOGO }));
    const rows = doc.querySelectorAll(".cKeynoteBlock .row.pt-1 img");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("src")).toBe(LOGO);
  });
});

describe("buildStaticSpeakersHtml", () => {
  const speakers = {
    conference: { id: "evt-7", name: "Example Conf" },
    roles: ["internal", "external"],
    sections: [
      { role: "internal", label: "Internal Speakers", speakers: [{ ...speakerOne, id: "sp-2", name: "Speaker Two", speakerType: "internal" }] },
      { role: "external", label: "External Speakers", speakers: [speakerOne] },
    ],
  };

  it("groups speakers into sections with a card and a modal each", () => {
    const html = buildStaticSpeakersHtml(speakers);
    expect(html).not.toMatch(/%%[A-Z_]+%%/);
    const doc = parse(html);
    expect(doc.title).toBe("Speakers — Example Conf");
    expect(doc.querySelector("h3")?.textContent).toBe("Meet the voices behind Example Conf");
    expect([...doc.querySelectorAll("#speaker-content h2")].map((h) => h.textContent)).toEqual([
      "WSO2 Speakers",
      "Customers and Influencers",
    ]);
    expect(doc.querySelector("#speakerModal_1_0 h3")?.textContent).toBe("Speaker One");
    expect(doc.querySelector(".cSpeakerCard h4")?.innerHTML).toBe("Speaker<br>Two");
    expect(doc.querySelector(".cSpeakerLinkedin")?.getAttribute("href")).toBe(
      "https://www.linkedin.example.com/in/speaker-one",
    );
    expect([...doc.querySelectorAll("script")].every((s) => s.src)).toBe(true);
  });

  it("puts keynote speakers first", () => {
    const withKeynote = structuredClone(speakers);
    withKeynote.sections[1].speakers[0].title = "Keynote speaker";
    const doc = parse(buildStaticSpeakersHtml(withKeynote));
    expect(doc.querySelector("#speaker-content h2")?.textContent).toBe("Keynotes");
  });

  it("escapes text and drops unsafe URLs and styles", () => {
    const evil = '"><img src=x onerror=alert(1)>';
    const hostile = structuredClone(speakers);
    Object.assign(hostile.sections[1].speakers[0], {
      name: evil,
      title: evil,
      bio: evil,
      photoUrl: "javascript:alert(1)",
      companyLogoUrl: "javascript:alert(1)",
      companyLogoSize: "background:url(https://tracker.example.com/p.gif)",
      linkedinUrl: "javascript:alert(1)",
    });
    hostile.conference.name = evil;
    const html = buildStaticSpeakersHtml(hostile);
    const doc = parse(html);
    // Only Speaker Two's: card photo, logo, modal photo.
    expect(doc.querySelectorAll("img")).toHaveLength(3);
    expect([...doc.querySelectorAll("img")].every((img) => img.getAttribute("src")?.startsWith("https://"))).toBe(true);
    expect(doc.querySelectorAll("[onerror]")).toHaveLength(0);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("tracker.example.com");
    expect(doc.querySelector("#speakerModal_1_0 h3")?.textContent).toBe(evil);
  });

  it("refuses an export with no speakers", () => {
    expect(() => buildStaticSpeakersHtml({ sections: [] })).toThrow(/no speakers/);
  });
});
