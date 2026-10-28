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

import { deriveLegacyCycleDates, formatLegacyCycleName, hasLegacyContent } from "./parLegacyHistory";
import { resolveLegacyRating } from "./legacyParRatingResolvers";
import type { ParCycle, ParLegacyCycleSummary, ParLegacyHistory } from "../api/types";

export interface AdminHistoryRow {
  key: string;
  cycleName: string;
  startDate: string | null;
  endDate: string | null;
  isLegacy: boolean;
  parCycleId?: number;
}

// Ports HistoryPanel.tsx's own mergedRows: every closed real cycle plus one
// row per distinct legacy cycle, latest end date first. An entry with no
// derivable end date (never expected in practice) sorts to the very end
// rather than the top.
export function buildAdminHistoryRows(closedCycles: ParCycle[], legacyCycles: ParLegacyCycleSummary[]): AdminHistoryRow[] {
  const rows: AdminHistoryRow[] = [
    ...closedCycles.map((cycle) => ({
      key: `cycle-${cycle.parCycleId}`,
      cycleName: cycle.parCycleName,
      startDate: cycle.parCycleStartDate,
      endDate: cycle.parCycleEndDate,
      isLegacy: false,
      parCycleId: cycle.parCycleId,
    })),
    ...legacyCycles.map((cycle) => {
      const { startDate, endDate } = deriveLegacyCycleDates(cycle.cycleName);
      return {
        key: `legacy-${cycle.cycleName}`,
        cycleName: cycle.cycleName,
        startDate,
        endDate,
        isLegacy: true,
      };
    }),
  ];

  return rows.sort((a, b) => {
    if (!a.endDate) return 1;
    if (!b.endDate) return -1;
    return b.endDate.localeCompare(a.endDate);
  });
}

// ParLegacyRecordDetail renders migrated Employee's Feedback content from
// questionAnswers[].employeeAnswer, with overallCommentEmployee only as its
// own fallback for older records that never got question-level data — this
// check must recognize the same content or a record can show real
// Employee's Feedback content once opened while counting here as not done.
// employeeHasQuestionAnswer is the server-computed version of that same
// per-question check -- the admin cycle list is fetched in summary mode,
// where the full questionAnswers JSON is deliberately null.
export const isLegacyEmployeeParDone = (record: ParLegacyHistory): boolean =>
  record.employeeHasQuestionAnswer || hasLegacyContent(record.overallCommentEmployee);

export const isLegacyLeadFeedbackDone = (record: ParLegacyHistory): boolean =>
  hasLegacyContent(record.overallCommentManager);

// overallSpecialRating is always null on migrated rows (the old system never
// populated it) -- the real signal is derived from managerScoreCode via
// resolveLegacyRating, same resolver the detail view uses. 2021 H1 is the
// one cycle whose special rating depends on questionAnswers, which the
// summary-mode list doesn't carry -- passing [] here means that cycle's
// special ratings read as none rather than silently miscounting them.
export const legacySpecialRating = (record: ParLegacyHistory) =>
  resolveLegacyRating(formatLegacyCycleName(record.cycleName), record.managerScoreCode, []).special;

// Top 5%/20% ratings only exist from 2021 H1 onwards (see
// resolveLegacyRating); earlier cycles never had them, so their slot counts
// would always read 0 rather than mean "nobody was given one".
export const legacyCycleHasSpecialRatings = (cycleName: string): boolean =>
  Number(formatLegacyCycleName(cycleName).trim().slice(0, 4)) >= 2021;

// The overall rating every admin legacy grid shows. Same resolver
// ParLegacyRecordDetail uses, so a record can't show a different rating in a
// list than once opened; each cycle has its own rating scale, so this can't
// be derived generically.
export const legacyOverallRating = (record: ParLegacyHistory): string =>
  resolveLegacyRating(formatLegacyCycleName(record.cycleName), record.managerScoreCode, []).rating ??
  record.overallRating ??
  "Not Assigned";

export interface LegacyTeamGroup {
  id: string;
  parBusinessUnit: string;
  parDepartment: string;
  parTeam: string;
  parSubTeam: string;
  parLeadEmail: string;
  employeeParCompletion: string;
  leadFeedbackCompletion: string;
  numberOf5pSlots: number;
  numberOf20pSlots: number;
  participants: ParLegacyHistory[];
}

// Ports HistoryPanel.tsx's own groupLegacyParticipantsByTeam: legacy data has
// no real team concept (par_team is always null — there was never a team
// table for it), but every row does carry a real department and lead, so
// grouping on that pair is the finest-grained real split legacy data
// actually supports. Grouping by "team" instead (as real cycles do) would
// collapse every lead in a department into one row, since they'd all share
// the same "Unassigned" team value.
export function groupLegacyParticipantsByTeam(participants: ParLegacyHistory[]): LegacyTeamGroup[] {
  const groups = new Map<string, ParLegacyHistory[]>();
  participants.forEach((record) => {
    const department = record.department ?? "Unassigned";
    const leadName = record.reviewerName ?? "Unassigned";
    const groupKey = `${department}||${leadName}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(record);
    } else {
      groups.set(groupKey, [record]);
    }
  });

  return Array.from(groups.entries())
    .map(([groupKey, members]) => {
      const first = members[0];
      // Resolved once per member, then counted for both slot columns.
      const specials = members.map(legacySpecialRating);
      return {
        id: groupKey,
        parBusinessUnit: first.businessUnit ?? "-",
        parDepartment: first.department ?? "-",
        parTeam: first.team ?? "Unassigned",
        parSubTeam: first.subTeam ?? "-",
        parLeadEmail: first.reviewerName ?? "-",
        employeeParCompletion: `${members.filter(isLegacyEmployeeParDone).length}/${members.length}`,
        leadFeedbackCompletion: `${members.filter(isLegacyLeadFeedbackDone).length}/${members.length}`,
        numberOf5pSlots: specials.filter((s) => s === "TOP5P").length,
        numberOf20pSlots: specials.filter((s) => s === "TOP20P").length,
        participants: members,
      };
    })
    .sort((a, b) => a.parDepartment.localeCompare(b.parDepartment) || a.parLeadEmail.localeCompare(b.parLeadEmail));
}
