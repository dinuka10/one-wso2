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

// PAR (Performance Appraisal Review) app types. Subset of the PAR backend's
// types — only the employee-facing fields this app renders.

// GET /employees/{workEmail} — mirrors the backend's EmployeeInfo,
// narrowed to the one field this app reads:
// `leadEmail`, which OngoingCycleView.tsx's tab-set gate checks directly
// (`employeeInfo?.leadEmail !== null`).
export interface ParEmployeeInfo {
  leadEmail: string | null;
  // par-app backend's isLeadInActiveParCycle, plus an "any active direct
  // reports" fallback — scoped to the active PAR cycle, so this is false
  // whenever there is none, even for someone who leads a team.
  isTeamLead: boolean;
  // Only set when the request is a self-lookup (workEmail === the caller's
  // own email) — absent otherwise. See useParIsAdmin.ts.
  isAdmin?: boolean;
}

export type ParCycleStatus =
  | "PENDING"
  | "PENDING_QUOTA"
  | "OPEN"
  | "CLOSED"
  | "FAILED";

export type ParEmployeeStatus = "PENDING" | "DRAFT" | "SHARED" | "SHARED_BLOCKED";
export type ParLeadStatus = "PENDING" | "DRAFT" | "SHARED";
export type ParF2fStatus = "PENDING" | "SCHEDULED" | "COMPLETED";
export type ParEmployeeAcceptanceStatus = "PENDING" | "ACCEPTED" | "REJECTED";

// The admin-configured question/rating-scale text for a cycle. Mirrors
// par-app backend's ParCycleConfigurations — only the employee-facing
// question is rendered today; the 360 question and the rating scales are
// unused until those screens land.
export interface ParCycleConfigurations {
  employeeParQuestion: string;
  threeSixtyReviewQuestion: string;
  parRatings: string[];
  threeSixtyReviewRatings: string[];
  // Not on the wire yet — the backend's ParCycleConfigurations is a closed
  // record with no such fields, so these are always undefined today. Typed
  // ahead of a planned backend change so ParLeadReviewPanel.tsx's fallback
  // chain (cycle config → apiConfig.ts's window.config value → hardcoded
  // default) picks them up automatically once the backend ships them,
  // with no frontend change needed at that point. Never send these back on
  // a PUT until the backend actually accepts them — a closed record 400s on
  // an unrecognized field.
  top5p20pEnabledRating?: string;
  evidenceEnabledRating?: string;
  // Which entry in parRatings is auto-assigned to an employee/lead who
  // misses their PAR deadline, set per cycle.
  missedDeadlineRating?: string;
  // Which entries in parRatings a leadership employee may be given, set per
  // cycle. Falls back to LEADERSHIP_ALLOWED_RATINGS (util/parLeadership.ts)
  // when the cycle hasn't configured it.
  leadershipAllowedRatings?: string[];
}

export interface ParCycle {
  parCycleId: number;
  parCycleName: string;
  parCycleStartDate: string;
  parCycleEndDate: string;
  parEvaluationStartDate: string;
  parEvaluationEndDate: string;
  // Per-stage deadlines. Matches the four stages the employee moves
  // through (self-eval → 360 → lead → F2F).
  parEmployeeDeadline: string;
  parThreeSixtyRatingDeadline: string;
  parLeadDeadline: string;
  parF2FDeadline: string;
  parSpecialRatingDeadline?: string;
  parCycleConfigurations: ParCycleConfigurations;
  parCycleStatus: ParCycleStatus;
}

// ParRating carries many fields (lead comments, 360 reviewers, admin
// comment, etc.); we only pick the ones the employee-facing screens
// surface — the four-stage Performance & growth block, self-review, and
// the read-only "lead's feedback" panel shown once the lead has shared.
// Lead/admin-only fields (parSpecialRating quota context, parAdminComment,
// ...) are a separate, larger type to add when the Lead/Admin portals are
// ported.
export interface ParRating {
  parRatingId: number;
  parCycleId: number;
  parEmployeeEmail: string;
  // The employee's display name. Required in the source app's own ParRating
  // (par-app/webapp/src/utils/types.ts), so the wire does carry it — optional
  // here for the same reason parBusinessUnit and the rest below are: this
  // backend omits fields in some states, and the only reader already falls
  // back to the email.
  parEmployeeName?: string;
  parLeadEmail?: string;
  // Present on the wire but unused until now — the History tab's "Team"
  // info row (EmployeeHistoryView.tsx's own parTeam/parDepartment) and
  // Review.tsx's own breadcrumb (all four, BU/Dept/Team/SubTeam).
  parBusinessUnit?: string;
  parTeam?: string;
  parDepartment?: string;
  // Present on the wire; source's own Report.tsx hides both by default
  // (toggleable via its column selector) rather than omitting them.
  parCompany?: string;
  parLocation?: string;
  parSubTeam?: string;
  // Base64 of a UTF-8-encoded string (par-app's NONE_EMPTY_BASE64_STRING_REGEX
  // constraint) — decode with decodeParComment before rendering. Absent until
  // the employee has saved a draft.
  parEmployeeComment?: string;
  parEmployeeStatus: ParEmployeeStatus;
  // The three fields below are all sanitizeParRatingForSelf-gated: the
  // backend omits them from the response entirely while parLeadStatus is
  // PENDING/DRAFT, so their presence already means "the lead has shared".
  parRating?: string;
  parSpecialRating?: string;
  parLeadComment?: string;
  parLeadStatus: ParLeadStatus;
  // Who invoked the share (a lead, or an admin sharing on a lead's behalf),
  // shown to the employee as "PAR Shared By".
  parRatingSharedBy?: string;
  // Who last updated parRating — a real invoker's email normally, or the literal string
  // "SYSTEM" when the rating was auto-assigned after a missed deadline. ParLeadReviewPanel.tsx uses this to flag an auto-assigned rating distinctly,
  // so nobody mistakes it for (or blames a lead for) something the system did.
  parRatingUpdatedBy?: string;
  parF2fStatus: ParF2fStatus;
  parF2fDate?: string;
  parEmployeeAcceptanceStatus?: ParEmployeeAcceptanceStatus;
  // Admin-only note, distinct from parLeadComment. Stripped from every
  // non-admin response.
  parAdminComment?: string;
  // Lead-only evidence for a "Needs Improvement" rating — newline-delimited
  // Google Drive file URLs, not an array on the wire. See
  // util/parDriveFile.ts's parseSavedUrls.
  parPerformanceNoticeAck?: string;
  // Computed once at cycle-creation time — false for leadership employees,
  // employees under the tenure threshold, etc. An ineligible employee can't
  // be given a Top 5% or Top 20% rating, so ParLeadReviewPanel.tsx disables
  // those controls.
  parSpecialRatingEligibility?: boolean;
  // Whether the employee holds an active leadership attribute, as determined
  // by the backend. Computed once at cycle-creation time, same as
  // parSpecialRatingEligibility above. When true, the employee's parRating is
  // restricted to "Successful"/"Step Up".
  parIsLeadershipEmployee: boolean;
}

// ---- 360° feedback ----------------------------------------------------------
//
// Mirrors the backend's Par360Reviewer / Par360ReviewRequest / Par360Review
// / Par360ReviewUpdate / Par360ReviewRequestCreate.
// "SANITIZED" is a real wire value (a past review privacy-scrubbed after the
// fact) that this app treats the same as REJECTED — nothing to act on, nothing
// to show.

export type Par360ReviewStatus = "PENDING" | "DRAFT" | "SHARED" | "REJECTED" | "SANITIZED";

// One person you've asked (or your lead has asked, on your behalf) to review
// you. GET .../employees/{email}/reviewers.
export interface Par360Reviewer {
  reviewerEmail: string;
  reviewStatus: Par360ReviewStatus;
  isLeadRequested: boolean;
  isEmployeeRequested: boolean;
}

// Body for POST .../employees/{email}/reviewers.
export interface Par360ReviewRequestCreate {
  reviewerEmails: string[];
}

// One request FOR you to review someone else. GET .../employees/{email}/review-requests
// (`email` here is the person being reviewed; the caller is resolved from the
// token as the reviewer).
export interface Par360ReviewRequest {
  employeeEmail: string;
  reviewStatus: Par360ReviewStatus;
  isEmployeeRequested: boolean;
  isLeadRequested: boolean;
}

// Your own review of one employee. GET .../employees/{email}/review.
export interface Par360Review {
  reviewerEmail: string;
  reviewRating?: string;
  // Base64 of a UTF-8-encoded string, same scheme as ParRating's comments —
  // decode with decodeParComment.
  reviewComment?: string;
  reviewStatus: Par360ReviewStatus;
}

// Body for PATCH .../employees/{email}/review — submitting or declining a
// review you were asked to give, or (with `reviewerEmail` set to your own
// address) offering one voluntarily — see the "Voluntary Feedback" flow in
// ParProvideFeedbackTab.tsx.
export interface Par360ReviewUpdate {
  reviewRating?: string;
  reviewComment?: string;
  par360ReviewStatus?: Par360ReviewStatus;
  reviewerEmail?: string;
}

// GET /par-cycles/{cycleId}/participants — mirrors par-app backend's
// Participant record exactly (name + email only, no thumbnail — the
// source's own avatar in OfferFeedbackView.tsx comes from a separate
// whole-org employee lookup this app doesn't carry, so the picker shows
// name/email without a photo). Backs "Voluntary Feedback"'s picker.
export interface ParParticipant {
  employeeName: string;
  workEmail: string;
}

// Body for PATCH /par-cycles/{cycleId}/employees/{email}/par-ratings/{id}.
// The backend rejects (403) any field outside what the caller's role may
// touch. Its self and lead checks are each a DENYLIST, not an allowlist:
// self blocks parRating/parSpecialRating/parLeadComment/parLeadStatus/parAdminComment/
// parPerformanceNoticeAck; lead blocks parEmployeeComment/parEmployeeStatus/
// parEmployeeAcceptanceStatus/parEmployeeAcceptanceComment/parAdminComment.
// Everything else on the type goes through for that caller — which is why
// parF2fStatus/parF2fDate are here too: neither denylist blocks them, and
// both self (marking F2F complete) and the lead (scheduling it) use this
// same endpoint to set them.
export interface ParRatingModify {
  parEmployeeComment?: string;
  parEmployeeStatus?: ParEmployeeStatus;
  parF2fStatus?: ParF2fStatus;
  parF2fDate?: string;
  // The employee can't set these four; the self denylist above blocks them.
  parRating?: string;
  parSpecialRating?: string;
  parLeadComment?: string;
  parLeadStatus?: ParLeadStatus;
  // Admin-only — both the self and lead denylists reject a non-empty value
  // here, so only an admin caller may actually set it.
  parAdminComment?: string;
  // Lead-only, per the denylist comment above.
  parPerformanceNoticeAck?: string;
}

// ---- Lead Portal ---------------------------------------------------------
//
// Mirrors the backend's ParTeamSummary/ParTeamDetails/ParRatingMinimal
// — the "Direct Reports" tab's team browser.

export interface ParTeamSummaryCounts {
  employeeParCompletedCount: number;
  leadsReviewCompletedCount: number;
  f2fCompletedCount: number;
}

// GET /par-cycles/{cycleId}/teams?leadEmail= — one row per team a lead owns
// (a lead can have more than one: different BU/department/team splits).
export interface ParTeamSummary {
  parTeamId: number;
  parCycleId: number;
  parBusinessUnit: string;
  parDepartment: string;
  parTeam?: string;
  parSubTeam?: string;
  parLeadEmail?: string;
  numberOfTeamMembers: number;
  numberOf5pSlots: number;
  numberOf20pSlots: number;
  available5pSlots: number;
  available20pSlots: number;
  summary: ParTeamSummaryCounts;
}

export interface Par360ReviewCounts {
  requestedReviewCount: number;
  sharedReviewCount: number;
}

// One row of a team's roster — GET /par-cycles/{cycleId}/teams/{teamId}'s
// own `details` array.
export interface ParRatingMinimal {
  parRatingId: number;
  parCycleId: number;
  parEmployeeEmail: string;
  parEmployeeName: string;
  parTeamId: number;
  parRating?: string;
  parSpecialRating?: string;
  parEmployeeStatus: ParEmployeeStatus;
  parLeadStatus: ParLeadStatus;
  par360ReviewStatus: Par360ReviewStatus;
  par360ReviewCounts: Par360ReviewCounts;
  parF2fStatus: ParF2fStatus;
  parEmployeeAcceptanceStatus?: ParEmployeeAcceptanceStatus;
}

// GET /par-cycles/{cycleId}/teams/{teamId}. `details` is nullable in the
// backend type — absent/empty roster reads the same as "no members yet".
export interface ParTeamDetails extends ParTeamSummary {
  details: ParRatingMinimal[] | null;
}

// GET /employees?leadEmail= — mirrors backend's BasicEmployeeInfo. Pure
// org-chart data (managerEmail match), not tied to any PAR cycle or rating
// record — direct reports only, unlike the PAR-cycle-scoped "reports"/
// "report-levels" endpoints above. Backs the Employee History tab's
// employee picker (EmployeeReportView.tsx's fetchEntityEmployees).
export interface ParEmployee {
  employeeName: string;
  workEmail: string;
  employeeThumbnail?: string;
  isLead?: boolean;
  managerEmail?: string;
}

// GET /legacy-par-history/{employeeEmail} — mirrors backend's
// LegacyParHistory exactly. Pre-migration PeopleHR export data; the legacy
// system never populated overallRating/overallSpecialRating, so those are
// always null and a display-only rating is derived from managerScoreCode
// instead (see util/parLegacyHistory.ts).
export interface ParLegacyHistory {
  legacyHeaderId: number;
  employeeEmail: string;
  // First and last name from the migrated sheet. Optional: a backend that
  // predates the field omits it.
  employeeName?: string | null;
  location: string | null;
  businessUnit: string | null;
  department: string | null;
  team: string | null;
  subTeam: string | null;
  reviewerName: string | null;
  reviewerEmail: string | null;
  cycleName: string;
  reviewCompletedDate: string | null;
  overallRating: string | null;
  overallSpecialRating: string | null;
  overallCommentEmployee: string | null;
  overallCommentManager: string | null;
  employeeScoreCode: number | null;
  managerScoreCode: number | null;
  // Whether the employee gave any meaningful answer to any per-question
  // row -- always computed server-side, independent of whether
  // questionAnswers below was requested in full or stripped to a summary
  // (admin roster/grouping view). Use this for a completion check instead
  // of parsing questionAnswers, which can be null in summary mode.
  employeeHasQuestionAnswer: boolean;
  // Raw JSON string — array of ParLegacyQuestionAnswer, one per review
  // question (variable length). Parse with parseLegacyQuestionAnswers.
  questionAnswers: string | null;
  // Raw JSON string — array of ParLegacyThreeSixtyReview, one per legacy
  // 360 reviewer, if migrated. Parse with parseLegacyFeedback360.
  feedback360: string | null;
}

export interface ParLegacyQuestionAnswer {
  title: string | null;
  employeeAnswer: string | null;
  managerFeedback: string | null;
  employeeAnswerComment?: string | null;
  managerAnswerComment?: string | null;
  employeeAnsweredBy?: string | null;
  managerAnsweredBy?: string | null;
}

// The legacy PeopleHR export only ever captured the reviewer's name, not an
// email — unlike Par360Review, which is keyed by reviewerEmail.
export interface ParLegacyThreeSixtyReview {
  reviewerName: string;
  ratingQuestion: string;
  reviewRating: string;
  commentQuestion: string;
  reviewComment: string | null;
}

// GET /legacy-par-history-cycles — mirrors backend's LegacyParCycleSummary:
// one distinct legacy cycle, aggregated org-wide across every employee who
// has a row for it. Admin-only (Admin Portal's History tab).
export interface ParLegacyCycleSummary {
  cycleName: string;
  participantCount: number;
  latestCompletedDate: string | null;
}

// GET /par-cycles/{cycleId}/reports?leadEmail= — mirrors backend's
// AdditionalReportsParRating exactly (ParRatingMinimal + these two fields).
// Returns BOTH direct and indirect reports; the "Additional Reports" tab
// keeps only `reportingType === "indirect"` client-side, matching source's
// own getFilteredRows — direct reports already have their own tab.
export interface ParAdditionalReport extends ParRatingMinimal {
  parDirectLead: string;
  reportingType: string;
}

// GET /par-cycles/{cycleId}/report-levels?leadEmail= — mirrors backend's
// ChainReportsParRating exactly. One level of the "Report Chain" tab's
// drill-down: the DIRECT reports of whichever email is currently selected
// (starting with the caller's own). `isEmployeeALead` is a literal "True"/
// "False" string from the backend, not a boolean — compared as such,
// matching source.
export interface ParChainReport extends ParRatingMinimal {
  parTeam: string;
  parSubTeam: string;
  parLeadEmail: string;
  parDepartment: string;
  parBusinessUnit: string;
  isEmployeeALead: string;
}

// One row of GET /par-cycles/{cycleId}/special-rating-groups-quota — mirrors
// the backend's SpecialRatingAllocation record exactly. Rows share a
// parQuotaId across every (BU, department, team) combination the quota
// group covers; SpecialRatingAllocationView groups by it client-side.
export interface ParSpecialRatingAllocation {
  parBusinessUnit: string;
  parDepartment: string;
  parTeam: string;
  parQuotaId: number;
  parSpecialQuotaName: string;
  parTop5Quota: number;
  parTop20Quota: number;
}

// ---- F2F scheduling ----------------------------------------------------------
//
// Mirrors the backend's raw Google Calendar freebusy shape (gcalendar:
// FreeBusyResponse) and its own ScheduleMeetingRequest.

export interface ParCalendarBusySlot {
  start: string;
  end: string;
}

export interface ParCalendarBusy {
  busy: ParCalendarBusySlot[];
}

// GET .../calendar/busy-times?date=YYYY-MM-DD.
export interface ParFreeBusyResponse {
  calendars: Record<string, ParCalendarBusy>;
  kind: string;
  timeMax: string;
  timeMin: string;
}

// Body for POST .../calendar/schedule-f2f. The response is a bare 201 with
// no payload (the backend returns `http:CREATED` and nothing else) — there
// is no meetLink to read back from this call.
export interface ParScheduleF2fRequest {
  parRatingId: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  date: string;
}

// ---- Admin Portal ----------------------------------------------------------
//
// Admin org-wide views reuse ParTeamSummary/ParParticipant above — same
// backend record whether or not leadEmail was passed, only the row set differs.

export interface ParCycleCreate {
  parCycleName: string;
  parCycleStartDate: string;
  parCycleEndDate: string;
  parEvaluationStartDate: string;
  parEvaluationEndDate: string;
  parSpecialRatingDeadline: string;
  parThreeSixtyRatingDeadline: string;
  parF2FDeadline: string;
  parEmployeeDeadline: string;
  parLeadDeadline: string;
  parCycleConfigurations: ParCycleConfigurations;
}

export type ParCycleConfigurationsOptionalized = Partial<ParCycleConfigurations>;

// The same PATCH body edits a cycle's settings and drives its OPEN/CLOSED
// transitions. `Omit<...>` before re-adding parCycleConfigurations matters:
// without it, intersecting with Partial<ParCycleCreate>'s own (full-shape)
// field collapses back to fully-required whenever the key is present,
// defeating the whole point of the Optionalized variant.
export type ParCycleModify = Omit<Partial<ParCycleCreate>, "parCycleConfigurations"> & {
  parCycleConfigurations?: ParCycleConfigurationsOptionalized;
  parCycleStatus?: ParCycleStatus;
};

export interface ParSpecialRatingQuota {
  specialRatingQuotaId: number;
  top5pQuota: number;
  top20pQuota: number;
}

export interface ParSpecialRatingGroupWithHeadCount {
  parCycleId: number;
  specialRatingGroupId: number;
  businessUnit: string;
  department: string;
  team: string;
  subTeam?: string;
  headCount: number;
  // Absent until an admin assigns this team to a quota group.
  specialRatingQuota?: ParSpecialRatingQuota;
}

// GET .../special-rating-groups-quota (with or without leadEmail) returns
// SpecialRatingAllocation[] — reuse ParSpecialRatingAllocation for that.
// This type is a different shape, only ever SENT (one element of the POST
// body below), never received.
export interface ParSpecialRatingQuotaWithName extends ParSpecialRatingQuota {
  specialRatingQuotaName: string;
  allocatedLeads: string[];
}

export interface ParSpecialRatingGroup {
  parCycleId: number;
  specialRatingGroupId: number;
  businessUnit: string;
  department: string;
  team: string;
  specialRatingQuotaId: number;
}

// Every ungrouped team must end up in exactly one group — the backend
// rejects a partial assignment.
export interface ParSpecialRatingGroupQuota {
  parSpecialRatingGroups: ParSpecialRatingGroup[];
  specialRatingQuotas: ParSpecialRatingQuotaWithName[];
}

// A declined/withdrawn 360 review, restorable back to PENDING. Names aren't
// on the wire — resolve them against the cycle's participants.
export interface ParRejectedReview {
  employeeEmail: string;
  reviewerEmail: string;
  // Literal "offered" | "requested", not a boolean.
  isOfferedFeedback: string;
}
