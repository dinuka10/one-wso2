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

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Par360Review, ParLegacyHistory, ParLegacyQuestionAnswer, ParRating } from "../api/types";
import { decodeParComment, sanitizeParHtml } from "./parComment";
import { pdfRatingText } from "./parLabels";
import {
  formatLegacyCycleName,
  formatLegacyQuestionAnswers,
  hasLegacyContent,
  parseLegacyFeedback360,
  stripRedundantRatingPrefix,
} from "./parLegacyHistory";
import { getLegacyQuestionGroups } from "./legacyParCatalogs";
import { resolveLegacy2015EmployeeRatingLabel, resolveLegacyRating } from "./legacyParRatingResolvers";

type PdfRow = (string | { content: string; colSpan?: number; styles: Record<string, unknown> })[];

// Ports par-app's EmployeePar.tsx downloadPDF (and, when `reviews` is
// passed, LeadReviewPanel.tsx's extended version): a two-column table under
// a header naming the employee, their rating, special rating, and who
// shared it, optionally followed by a "360° Reviews" section — one row per
// reviewer, unfiltered by review status (the on-screen 360 list filters to
// SHARED-only; the PDF export never did).
export function downloadParPdf(rating: ParRating, selfComment: string, leadComment: string, reviews?: Par360Review[]): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const rows: PdfRow[] = [];
  if (selfComment) {
    rows.push([
      "Employee Comment",
      "",
      { content: htmlToPdfText(selfComment), styles: { textColor: [50, 50, 50], cellPadding: 6 } },
    ]);
  }
  if (leadComment) {
    rows.push([
      "Lead Comment",
      "",
      { content: htmlToPdfText(leadComment), styles: { textColor: [50, 50, 50], cellPadding: 6 } },
    ]);
  }

  if (reviews && reviews.length > 0) {
    rows.push([{ content: "360° Reviews", colSpan: 3, styles: { fontStyle: "bold", fillColor: [200, 200, 200], halign: "center" } }]);
  }
  (reviews ?? []).forEach((review) => {
    rows.push([
      review.reviewerEmail ?? "-",
      review.reviewRating ?? "-",
      {
        content: review.reviewComment ? htmlToPdfText(decodeParComment(review.reviewComment)) : "-",
        styles: { textColor: [50, 50, 50], cellPadding: 6 },
      },
    ]);
  });

  autoTable(doc, {
    head: [
      [
        {
          content:
            ` - Employee: ${rating.parEmployeeEmail}\n` +
            ` - PAR Rating: ${pdfRatingText(rating.parRating)}\n` +
            ` - Top 5%/20% Rating: ${pdfRatingText(rating.parSpecialRating)}\n` +
            ` - PAR Shared By: ${rating.parRatingSharedBy || "Not Provided"}`,
          colSpan: 3,
          styles: { halign: "left", fontSize: 12, cellPadding: 10 },
        },
      ],
    ],
    showHead: "firstPage",
    body: rows,
    startY: 30,
    styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak", valign: "top" },
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 60 }, 2: { cellWidth: "auto" } },
  });

  doc.save(`${rating.parEmployeeEmail}_par_summary.pdf`);
}

// Legacy counterpart to downloadParPdf above: every titled group (Employee
// PAR / Lead's Feedback, and each era's own category -- "General",
// "Quality & Dependability, Job Knowledge", etc.) is its own autoTable
// call, chained down the page via startY = the previous call's finalY. A
// real `head` (not a styled body row) makes jsPDF-autotable repeat that
// header at the top of a continuation page if the group's content spans
// pages.
//
// hideThreeSixtyFeedback mirrors the on-screen privacy gate: an employee's
// own self-view PDF must never leak reviewer-identifiable 360 feedback that
// the on-screen self-view already hides -- every admin call site passes
// false (or omits it) so 360 feedback is included there as normal.
export function downloadLegacyParPdf(
  record: ParLegacyHistory,
  questionAnswers: ParLegacyQuestionAnswer[],
  hideThreeSixtyFeedback = false,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const cycleName = formatLegacyCycleName(record.cycleName);
  const employeeGroups = getLegacyQuestionGroups(cycleName, questionAnswers, "employee") ?? [];
  const leadGroups = getLegacyQuestionGroups(cycleName, questionAnswers, "lead") ?? [];
  // "category" layout is exclusive to the 2015 catalog -- same fix as
  // ParLegacyRecordDetail.tsx's own legacy2015EmployeeRating: gating on
  // employeeGroups alone showed this PAR Rating row for every catalogued
  // era (2016-2019 too), using the 2015 label table on scores it was never
  // meant for. Only 2015 cycles have a real employee-side rating.
  const legacy2015EmployeeRating =
    employeeGroups[0]?.layout === "category" ? resolveLegacy2015EmployeeRatingLabel(record.employeeScoreCode) : null;
  const resolved = resolveLegacyRating(cycleName, record.managerScoreCode, questionAnswers);
  const rating = resolved.rating ?? record.overallRating;
  const special = resolved.special ?? record.overallSpecialRating;

  // Same 2017 Q3/Q4 "score, not a narrative comment" special case as
  // ParLegacyRecordDetail.tsx's own isLegacy2017ScoreCycle -- the Manager
  // Overall Comments value is a bare score (e.g. "68.0"), shown after the
  // per-question group blocks as "Score", not as "Lead Comment" before them.
  const isLegacy2017ScoreCycle =
    (cycleName === "2017 Quarterly Review - Q3" || cycleName === "2017 Quarterly Review - Q4") &&
    record.managerScoreCode === 3;

  // Same "360 Confirmation" workflow-note section as
  // ParLegacyRecordDetail.tsx's own threeSixtyConfirmationAnswer -- shown
  // here too (not gated to admin), per explicit local request.
  const threeSixtyConfirmationAnswer = questionAnswers.find(
    (qa) => qa.title?.trim().replace(/\.$/, "") === "360 Confirmation" && hasLegacyContent(qa.managerFeedback),
  )?.managerFeedback;

  const contentStyles = { textColor: [50, 50, 50] as [number, number, number], cellPadding: 6 };
  const baseTableStyles = { fontSize: 9, cellPadding: 4, overflow: "linebreak" as const, valign: "top" as const };
  const columnStyles = { 0: { cellWidth: 220 }, 1: { cellWidth: "auto" as const } };

  let cursorY = 30;
  const pageHeight = doc.internal.pageSize.getHeight();
  // Reserve enough room for a header plus at least one short row before
  // ever starting a block -- otherwise a block's head alone can fit in the
  // little room left at the bottom of a page even when its first body row
  // can't, and autoTable reprints the same head again at the top of the
  // next page right above itself.
  const MIN_BLOCK_HEIGHT = 90;
  const addBlock = (title: string, rows: PdfRow[], level: "section" | "group") => {
    if (rows.length === 0) return;
    if (pageHeight - cursorY < MIN_BLOCK_HEIGHT) {
      doc.addPage();
      cursorY = 30;
    }
    autoTable(doc, {
      head: [
        [
          {
            content: title,
            colSpan: 2,
            styles:
              level === "section"
                ? { fontStyle: "bold", fontSize: 11, halign: "left" }
                : {
                    fontStyle: "bold",
                    fontSize: 9,
                    halign: "left",
                    fillColor: [245, 245, 245] as [number, number, number],
                    textColor: [20, 20, 20] as [number, number, number],
                  },
          },
        ],
      ],
      body: rows,
      startY: cursorY,
      showHead: "everyPage",
      styles: baseTableStyles,
      columnStyles,
      margin: { top: 30, bottom: 30 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  };

  // Top 5%/20% was only introduced starting 2021 -- every earlier era never
  // captured it at all, so the line is omitted entirely there instead of
  // always printing "Not Assigned" clutter. 2021 onward always prints it
  // (even as "Not Assigned"), matching ParLegacyRecordDetail.tsx's own
  // hideSpecialRating / dedicated Top 5%/20% Rating row.
  const hideSpecialRating = (Number(cycleName.match(/^(\d{4})/)?.[1]) || 0) < 2021;
  const headerLines = [
    ` - Employee: ${record.employeeEmail}`,
    ` - Cycle: ${cycleName} (Legacy - PeopleHR)`,
    ` - PAR Rating: ${pdfRatingText(rating ?? undefined)}`,
    ...(hideSpecialRating ? [] : [` - Top 5%/20% Rating: ${pdfRatingText(special ?? undefined)}`]),
    ` - PAR Shared By: ${record.reviewerEmail || record.reviewerName || "Not Provided"}`,
  ];

  autoTable(doc, {
    head: [
      [
        {
          content: headerLines.join("\n"),
          colSpan: 2,
          styles: { halign: "left", fontSize: 12, cellPadding: 10 },
        },
      ],
    ],
    showHead: "firstPage",
    body: [],
    startY: cursorY,
    styles: baseTableStyles,
    columnStyles,
  });
  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  // ---- Employee PAR ----
  const employeeTopRows: PdfRow[] = [];
  if (legacy2015EmployeeRating) {
    employeeTopRows.push(["PAR Rating", { content: legacy2015EmployeeRating, styles: contentStyles }]);
  }
  // Same "N/A" (and flat-layout-suppressed) treatment as the on-screen
  // detail view's employeeComment. For a cycle with no question catalog,
  // employeeGroups is empty and the per-question answers would otherwise
  // be silently dropped from the export even though the screen shows them
  // (as a flat formatted block) -- fall back to that same formatting here.
  if (hasLegacyContent(record.overallCommentEmployee)) {
    employeeTopRows.push(["Employee Comment", { content: htmlToPdfText(record.overallCommentEmployee!), styles: contentStyles }]);
  } else if (employeeGroups.length > 0 && employeeGroups[0]?.layout !== "flat") {
    employeeTopRows.push(["Employee Comment", { content: "N/A", styles: contentStyles }]);
  } else if (employeeGroups.length === 0) {
    const flat = formatLegacyQuestionAnswers(questionAnswers);
    if (flat) employeeTopRows.push(["Employee Comment", { content: htmlToPdfText(flat), styles: contentStyles }]);
  }
  addBlock("Employee PAR", employeeTopRows, "section");
  for (const group of employeeGroups) {
    addBlock(
      group.title,
      group.rows.map((row) => [row.label, { content: row.employeeAnswer || "-", styles: contentStyles }]),
      "group",
    );
  }

  // ---- Lead's Feedback ----
  // Explicit local request, scoped to this one cycle: "Is the employees in
  // the top 5% or top 20% in the team?" goes right after Lead Comment inside
  // the main Lead's Feedback table, not as its own separate "Performance
  // Questions and Answers" block below it.
  const isLegacy2021H1 = cycleName === "2021 Performance Evaluation - H1";
  const leadTopRows: PdfRow[] = [];
  if (!isLegacy2017ScoreCycle) {
    if (hasLegacyContent(record.overallCommentManager)) {
      leadTopRows.push(["Lead Comment", { content: htmlToPdfText(record.overallCommentManager!), styles: contentStyles }]);
    } else if (leadGroups.length > 0 && leadGroups[0]?.layout !== "flat") {
      leadTopRows.push(["Lead Comment", { content: "N/A", styles: contentStyles }]);
    }
  }
  if (isLegacy2021H1) {
    for (const group of leadGroups) {
      for (const row of group.rows) {
        leadTopRows.push([row.label, { content: row.managerFeedback || "-", styles: contentStyles }]);
      }
    }
  }
  addBlock("Lead's Feedback", leadTopRows, "section");
  if (threeSixtyConfirmationAnswer) {
    addBlock(
      "360 Confirmation",
      [["360 Confirmation", { content: htmlToPdfText(threeSixtyConfirmationAnswer), styles: contentStyles }]],
      "section",
    );
  }
  if (!isLegacy2021H1) {
    for (const group of leadGroups) {
      addBlock(
        group.title,
        group.rows.map((row) => [row.label, { content: row.managerFeedback || "-", styles: contentStyles }]),
        "group",
      );
    }
  }
  if (isLegacy2017ScoreCycle && hasLegacyContent(record.overallCommentManager)) {
    addBlock("Score", [["Score", { content: htmlToPdfText(record.overallCommentManager!), styles: contentStyles }]], "section");
  }

  // ---- 360° Feedback ----
  if (!hideThreeSixtyFeedback) {
    const reviews = parseLegacyFeedback360(record.feedback360);
    const reviewRows: PdfRow[] = reviews.map((review) => {
      const rating = review.reviewRating ? stripRedundantRatingPrefix(review.reviewRating) : "";
      const ratingSuffix = rating ? ` (Rating: ${rating})` : "";
      const content = review.reviewComment ? htmlToPdfText(review.reviewComment) : "No comment provided";
      return [`${review.reviewerName}${ratingSuffix}`, { content, styles: contentStyles }];
    });
    addBlock("360° Feedback", reviewRows, "section");
  }

  // Includes the cycle name -- without it, downloading PDFs for several
  // different cycles all produced the exact same filename
  // (`{email}_legacy_par_summary.pdf`), so the browser just appended
  // "(1)", "(2)"... instead of giving each cycle its own distinguishable
  // file. Sanitized for the filesystem: spaces/slashes/other punctuation
  // in a real cycle name (e.g. "2017 Quarterly Review - Q1") replaced
  // with underscores, collapsed, and trimmed.
  const safeCycleName = cycleName
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  doc.save(`${record.employeeEmail}_${safeCycleName}_legacy_par_summary.pdf`);
}

// Converts sanitized comment HTML into indented plain text for the PDF body
// — lists become "•"/"1." lines, matching what the rich-text editor showed.
const BLOCK_TAGS = new Set(["P", "UL", "OL"]);

export function htmlToPdfText(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = sanitizeParHtml(html);

  const walk = (el: Element, depth: number): string => {
    const indent = "    ".repeat(depth);
    if (el.tagName === "UL" || el.tagName === "OL") {
      const ordered = el.tagName === "OL";
      return Array.from(el.children)
        .map((li, i) => `${indent}${ordered ? `${i + 1}.` : "•"} ${walk(li, depth + 1).trim()}\n`)
        .join("");
    }
    // Recurse only while there are further block-level children (nested
    // paragraphs/lists), so each one keeps its own line. A leaf paragraph
    // or list item is read via `textContent` in one go — walking its
    // *element* children alone would skip direct text sitting beside
    // inline formatting, e.g. "the"/"." in <p><b>Shipped</b> the <em>port</em>.</p>.
    const hasBlockChildren = Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName));
    if (hasBlockChildren) {
      return Array.from(el.children)
        .map((child) => walk(child, depth))
        .join("");
    }
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    return text ? `${text}\n` : "";
  };

  const text = walk(root, 0)
    .split("\n")
    .map((line) => (line.trim() ? `    ${line}` : line))
    .join("\n")
    .trim();
  return text || "-";
}
