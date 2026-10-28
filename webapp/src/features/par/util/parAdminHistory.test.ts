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
import { buildAdminHistoryRows, groupLegacyParticipantsByTeam, legacyCycleHasSpecialRatings, legacyOverallRating } from "./parAdminHistory";
import type { ParCycle, ParLegacyCycleSummary, ParLegacyHistory } from "../api/types";

function cycle(overrides: Partial<ParCycle> = {}): ParCycle {
  return {
    parCycleId: 1,
    parCycleName: "2026 Performance Evaluation - H1",
    parCycleStartDate: "2026-01-01",
    parCycleEndDate: "2026-06-30",
    parEvaluationStartDate: "2026-01-01",
    parEvaluationEndDate: "2026-06-30",
    parEmployeeDeadline: "2026-02-01",
    parThreeSixtyRatingDeadline: "2026-03-01",
    parLeadDeadline: "2026-04-01",
    parF2FDeadline: "2026-05-01",
    parCycleConfigurations: { employeeParQuestion: "", threeSixtyReviewQuestion: "", parRatings: [], threeSixtyReviewRatings: [] },
    parCycleStatus: "CLOSED",
    ...overrides,
  };
}

function legacyCycle(overrides: Partial<ParLegacyCycleSummary> = {}): ParLegacyCycleSummary {
  return { cycleName: "2024 Performance Evaluation - H1", participantCount: 10, latestCompletedDate: "2024-06-15", ...overrides };
}

function legacyRecord(overrides: Partial<ParLegacyHistory> = {}): ParLegacyHistory {
  return {
    legacyHeaderId: 1,
    employeeEmail: "employee@wso2.com",
    location: null,
    businessUnit: "Engineering",
    department: "Platform",
    team: null,
    subTeam: null,
    reviewerName: "Lead One",
    reviewerEmail: "lead@wso2.com",
    cycleName: "2024 Performance Evaluation - H1",
    reviewCompletedDate: "2024-06-01",
    overallRating: null,
    overallSpecialRating: null,
    overallCommentEmployee: "Some employee comment",
    overallCommentManager: "Some manager comment",
    employeeScoreCode: null,
    managerScoreCode: 3,
    employeeHasQuestionAnswer: false,
    questionAnswers: null,
    feedback360: null,
    ...overrides,
  };
}

describe("buildAdminHistoryRows", () => {
  it("merges real and legacy cycles, latest end date first", () => {
    const rows = buildAdminHistoryRows(
      [cycle({ parCycleId: 1, parCycleName: "2026 H1", parCycleEndDate: "2026-06-30" })],
      [legacyCycle({ cycleName: "2024 Performance Evaluation - H1" })],
    );
    expect(rows.map((r) => r.cycleName)).toEqual(["2026 H1", "2024 Performance Evaluation - H1"]);
  });

  it("tags legacy rows and carries no parCycleId for them", () => {
    const rows = buildAdminHistoryRows([], [legacyCycle()]);
    expect(rows[0].isLegacy).toBe(true);
    expect(rows[0].parCycleId).toBeUndefined();
  });

  it("tags real rows with isLegacy false and their parCycleId", () => {
    const rows = buildAdminHistoryRows([cycle({ parCycleId: 42 })], []);
    expect(rows[0]).toMatchObject({ isLegacy: false, parCycleId: 42 });
  });

  it("derives legacy row dates from the cycle name", () => {
    const rows = buildAdminHistoryRows([], [legacyCycle({ cycleName: "2023 Performance Evaluation - H2" })]);
    expect(rows[0]).toMatchObject({ startDate: "2023-07-01", endDate: "2023-12-31" });
  });

  it("is empty for no cycles at all", () => {
    expect(buildAdminHistoryRows([], [])).toEqual([]);
  });
});

describe("groupLegacyParticipantsByTeam", () => {
  it("groups by department + reviewer name", () => {
    const groups = groupLegacyParticipantsByTeam([
      legacyRecord({ department: "Platform", reviewerName: "Lead One" }),
      legacyRecord({ department: "Platform", reviewerName: "Lead One" }),
      legacyRecord({ department: "Platform", reviewerName: "Lead Two" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.parLeadEmail === "Lead One")?.participants).toHaveLength(2);
  });

  it("defaults a missing department or reviewer to Unassigned", () => {
    const groups = groupLegacyParticipantsByTeam([legacyRecord({ department: null, reviewerName: null })]);
    expect(groups[0]).toMatchObject({ parDepartment: "-", parLeadEmail: "-" });
  });

  it("counts employee PAR / lead feedback completion, treating blank and N/A as not done", () => {
    const groups = groupLegacyParticipantsByTeam([
      legacyRecord({ overallCommentEmployee: "Written", overallCommentManager: "N/A" }),
      legacyRecord({ overallCommentEmployee: "", overallCommentManager: "Written" }),
    ]);
    expect(groups[0]).toMatchObject({ employeeParCompletion: "1/2", leadFeedbackCompletion: "1/2" });
  });

  it("counts employee PAR as done from employeeHasQuestionAnswer even with no overallCommentEmployee", () => {
    // employeeHasQuestionAnswer is the server-computed signal for "answered
    // some per-question row" -- the roster this feeds is fetched in summary
    // mode, where questionAnswers itself is always null, so the completion
    // count can't derive this by parsing questionAnswers client-side.
    const groups = groupLegacyParticipantsByTeam([
      legacyRecord({ overallCommentEmployee: null, employeeHasQuestionAnswer: true, questionAnswers: null }),
      legacyRecord({ overallCommentEmployee: null, employeeHasQuestionAnswer: false, questionAnswers: null }),
    ]);
    expect(groups[0]).toMatchObject({ employeeParCompletion: "1/2" });
  });

  // overallSpecialRating is always null on real migrated rows -- the slot
  // count is derived from managerScoreCode via resolveLegacyRating instead
  // (same resolver the detail view uses), not the raw (unpopulated) field.
  it("counts 5% and 20% special-rating slots via resolveLegacyRating, not the always-null overallSpecialRating field", () => {
    const groups = groupLegacyParticipantsByTeam([
      legacyRecord({ managerScoreCode: 1 }), // "Successful - Top 5%" for 2024 H1
      legacyRecord({ managerScoreCode: 2 }), // "Successful - Top 20%"
      legacyRecord({ managerScoreCode: 2 }),
      legacyRecord({ managerScoreCode: 3 }), // "Successful", no special rating
    ]);
    expect(groups[0]).toMatchObject({ numberOf5pSlots: 1, numberOf20pSlots: 2 });
  });

  it("is empty for no participants", () => {
    expect(groupLegacyParticipantsByTeam([])).toEqual([]);
  });
});

describe("groupLegacyParticipantsByTeam special-rating slots for 2021", () => {
  it("counts no slot for 2021 H1, whose special rating needs question answers the summary list doesn't carry", () => {
    const [group] = groupLegacyParticipantsByTeam([
      legacyRecord({ cycleName: "2021 Performance Evaluation - H1", managerScoreCode: 1, questionAnswers: null }),
    ]);
    expect(group.numberOf5pSlots).toBe(0);
    expect(group.numberOf20pSlots).toBe(0);
  });

  it("counts a 5% slot for 2021 H2 managerScoreCode 1 (Successful - Top 5%)", () => {
    const [group] = groupLegacyParticipantsByTeam([
      legacyRecord({ cycleName: "2021 Performance Evaluation - H2", managerScoreCode: 1 }),
    ]);
    expect(group.numberOf5pSlots).toBe(1);
    expect(group.numberOf20pSlots).toBe(0);
  });
});

describe("legacyOverallRating", () => {
  it("resolves the cycle's own rating label from managerScoreCode", () => {
    expect(legacyOverallRating(legacyRecord({ managerScoreCode: 3 }))).toBe("Successful");
  });

  it("falls back to overallRating, then Not Assigned, when no label resolves", () => {
    expect(legacyOverallRating(legacyRecord({ managerScoreCode: null, overallRating: "Exceeds" }))).toBe("Exceeds");
    expect(legacyOverallRating(legacyRecord({ managerScoreCode: null }))).toBe("Not Assigned");
  });
});

describe("legacyCycleHasSpecialRatings", () => {
  it("is false for cycles before 2021, which never had Top 5%/20% ratings", () => {
    expect(legacyCycleHasSpecialRatings("2015 ANNUAL PERFORMANCE REVIEW for Engineering Employees")).toBe(false);
    expect(legacyCycleHasSpecialRatings("2019  Performance Evaluation - Q2")).toBe(false);
    expect(legacyCycleHasSpecialRatings("2020 Performance Evaluation - H2")).toBe(false);
  });

  it("is true from 2021 H1 onwards", () => {
    expect(legacyCycleHasSpecialRatings("2021 Performance Evaluation - H1")).toBe(true);
    expect(legacyCycleHasSpecialRatings("2024 Performance Evaluation - H1")).toBe(true);
  });
});
