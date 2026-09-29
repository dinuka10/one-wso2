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


/**
 * Runtime for the pre-rendered agenda page, inlined into it as-is (imported
 * with ?raw). The markup is already built by renderAgenda.ts, so this only
 * attaches the interactions: column levelling, day tabs, the fixed tab bar,
 * keyboard opening of session cards, the track filter and the countdown. The
 * two must stay in sync: change a selector or class name there and it has to
 * change here too.
 *
 * It reads nothing from the export except the countdown's start date, which it
 * checks the shape of, and it writes only text and inline sizes — no markup.
 */
(() => {
  // ── Column height sync ───────────────────────────────────────────
  // Each track-column stacks its own SessionBlocks independently with no shared
  // grid, so a panel with 4 speakers in one track and a 1-speaker talk in the next
  // both sitting at "3:30 PM" render at different heights. Level them here by
  // matching each column's Nth SessionBlock against its counterparts in the same
  // band row.
  const TRACK_SYNC_MIN_WIDTH = 992; // Bootstrap lg — below this .track-column is full width (col-md-12) and stacks vertically, so there's nothing to level.

  function syncTrackColumnHeights() {
    const shouldSync = window.innerWidth >= TRACK_SYNC_MIN_WIDTH;

    document.querySelectorAll("#agenda-content .row").forEach((row) => {
      const columns = row.querySelectorAll(":scope > .track-column");
      if (columns.length < 2) return;

      // A linked session's SessionBlock is wrapped in an <a>, so it's a grandchild
      // of .track-column, not a direct child — querySelectorAll here (rather than
      // col.children) finds it either way, in document order, so it isn't dropped
      // from the list and every block after it doesn't shift out of index
      // alignment with sibling columns.
      const blockLists = Array.from(columns).map((col) =>
        Array.from(
          col.querySelectorAll(
            ":scope > .SessionBlock, :scope > a > .SessionBlock",
          ),
        ),
      );

      // Clear previous run's min-height first — otherwise it leaks into this run's
      // measurements, and it's also how we undo the sync below lg.
      blockLists.forEach((list) =>
        list.forEach((block) => {
          block.style.minHeight = "";
        }),
      );
      if (!shouldSync) return;

      const maxBlocks = Math.max(...blockLists.map((list) => list.length));
      for (let i = 0; i < maxBlocks; i++) {
        const blocksAtIndex = blockLists.map((list) => list[i]).filter(Boolean);
        if (blocksAtIndex.length < 2) continue;
        const tallest = Math.max(
          ...blocksAtIndex.map((b) => b.getBoundingClientRect().height),
        );
        blocksAtIndex.forEach((b) => {
          b.style.minHeight = tallest + "px";
        });
      }
    });
  }

  let trackSyncResizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(trackSyncResizeTimer);
    trackSyncResizeTimer = setTimeout(syncTrackColumnHeights, 150);
  });

  // ── Day tabs ─────────────────────────────────────────────────────

  document.getElementById("day-tabs").addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const target = document.getElementById(a.getAttribute("href").slice(1));
    if (target) {
      const offset = 150; // fixed header (72px) + fixed tab bar (~72px), plus a little breathing room
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
    document
      .querySelectorAll("#day-tabs .nav-link")
      .forEach((l) => l.classList.remove("active"));
    a.classList.add("active");
  });

  // Fixed tab bar on scroll: past a 100px scroll threshold the tab bar detaches
  // into a fixed navy bar. A placeholder is inserted in its place to reserve its
  // former layout space, so the rest of the page doesn't jump.
  const agendaSection = document.getElementById("tab-bar");
  const agendaPlaceholder = document.createElement("div");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 100 && !agendaSection.classList.contains("fixed")) {
      agendaPlaceholder.style.height = `${agendaSection.offsetHeight}px`;
      agendaSection.parentNode.insertBefore(agendaPlaceholder, agendaSection);
      agendaSection.classList.add("fixed");
    } else if (
      window.scrollY <= 100 &&
      agendaSection.classList.contains("fixed")
    ) {
      agendaSection.classList.remove("fixed");
      if (agendaPlaceholder.parentNode)
        agendaPlaceholder.parentNode.removeChild(agendaPlaceholder);
    }
  });

  // Bootstrap's data-bs-toggle only reacts to clicks — session cards carry
  // role="button" tabindex="0", so honor Enter/Space too (Space also scrolls the
  // page without the preventDefault).
  document.getElementById("agenda-content").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest('[data-bs-toggle="modal"]');
    if (!card) return;
    if (e.key === " ") e.preventDefault();
    card.click();
  });

  // ── Track filter ─────────────────────────────────────────────────
  // Shows only elements tagged `.agenda-items.<value>`: an .agenda-items element
  // with no matching category class (e.g. the break/registration bar) hides under
  // any specific selection.

  // A track column (or a whole day) with nothing visible after filtering is worse
  // than no column/day at all — collapse it rather than leave an empty box.
  function hasVisibleItem(container) {
    return Array.from(container.querySelectorAll(".agenda-items")).some(
      (item) => item.style.display !== "none",
    );
  }

  function updateEmptyVisibility() {
    document.querySelectorAll(".track-column").forEach((col) => {
      col.style.display = hasVisibleItem(col) ? "" : "none";
    });

    // Day sections with nothing left collapse, but their day tabs stay put: the
    // tab bar is the page's navigation, and having tabs appear/disappear as tracks
    // are picked makes the whole bar jump around.
    document
      .querySelectorAll("#agenda-content [data-anchor]")
      .forEach((dayEl) => {
        dayEl.style.display = hasVisibleItem(dayEl) ? "" : "none";
      });

    syncTrackColumnHeights();
  }

  // Absent when the export had no tracks to filter by.
  const filterSelect = document.getElementById("track-filter-select");
  if (filterSelect) {
    filterSelect.addEventListener("change", function () {
      const selected = this.value;
      document.querySelectorAll(".agenda-items").forEach((item) => {
        item.style.display =
          selected === "all" || item.classList.contains(selected) ? "" : "none";
      });
      updateEmptyVisibility();
    });
  }

  // ── Tab active state ─────────────────────────────────────────────

  function setupTabObserver() {
    const links = document.querySelectorAll("#day-tabs .nav-link");
    const bookmarks = Array.from(links)
      .map((l) => document.getElementById(l.getAttribute("href").slice(1)))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          links.forEach((l) => {
            const active = l.getAttribute("href") === "#" + id;
            l.classList.toggle("active", active);
          });
        });
      },
      { rootMargin: "-150px 0px -60% 0px", threshold: 0 },
    );

    bookmarks.forEach((b) => observer.observe(b));
  }

  setupTabObserver();

  // ── Countdown widget ─────────────────────────────────────────────

  function countdownDigits(startDate) {
    const diffMs = startDate.getTime() - Date.now();
    if (diffMs <= 0) return null;
    const totalHours = Math.floor(diffMs / 3600000);
    return `${Math.floor(totalHours / 24)}d ${totalHours % 24}h`;
  }

  // This file is routinely opened from file://, where some browsers throw on any
  // localStorage access.
  function readDismissed() {
    try {
      return localStorage.getItem(COUNTDOWN_DISMISS_KEY);
    } catch {
      return null;
    }
  }

  function writeDismissed() {
    try {
      localStorage.setItem(COUNTDOWN_DISMISS_KEY, "1");
    } catch {
      /* dismissal just won't stick across reloads */
    }
  }

  // Absent when the agenda was exported without a future start date.
  const widget = document.querySelector(".countdown-widget");
  const startDateText = widget ? widget.dataset.startDate || "" : "";
  // Scoped to the event's start date: every agenda published to the same
  // origin shares one localStorage, so a bare key would hide next event's
  // countdown from anyone who dismissed this one's.
  const COUNTDOWN_DISMISS_KEY = "agenda-countdown-dismissed:" + startDateText;
  if (widget && !/^\d{4}-\d{2}-\d{2}$/.test(startDateText)) {
    widget.remove();
  } else if (widget) {
    const startDate = new Date(startDateText + "T00:00:00");
    let countdownTimer = null;

    const removeWidget = () => {
      clearInterval(countdownTimer);
      widget.remove();
    };

    // The digits baked in at export time are stale by the time anyone opens the
    // file, so recompute before the first paint rather than waiting a tick.
    const digits = isNaN(startDate.getTime()) ? null : countdownDigits(startDate);
    if (readDismissed() || !digits) {
      widget.remove();
    } else {
      widget.querySelector(".digits").textContent = digits;

      widget
        .querySelector(".countdown-dismiss")
        .addEventListener("click", () => {
          writeDismissed();
          removeWidget();
        });

      countdownTimer = setInterval(() => {
        const next = countdownDigits(startDate);
        if (!next) {
          removeWidget();
          return;
        }
        widget.querySelector(".digits").textContent = next;
      }, 60000);
    }
  }

  syncTrackColumnHeights();
  // Host Grotesk can still be loading when the sync above runs, and a font swap
  // changes how titles wrap — re-sync once it's actually settled.
  if (document.fonts) document.fonts.ready.then(syncTrackColumnHeights);
})();
