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

import { useCallback, useMemo, useState } from "react";
import { Avatar, Box, Button, Card, Chip, DataGrid, IconButton, InputAdornment, Link, Skeleton, Stack, Tab, Tabs, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, SearchIcon, UserIcon, UsersIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useLegacyParHistoryByCycle } from "../api/useParAdmin";
import { useParLegacyHistory } from "../api/useLeadHistory";
import { formatShortDate } from "../util/parDate";
import { deriveLegacyCycleDates } from "../util/parLegacyHistory";
import {
  groupLegacyParticipantsByTeam,
  isLegacyEmployeeParDone,
  isLegacyLeadFeedbackDone,
  legacyCycleHasSpecialRatings,
  legacyOverallRating,
  legacySpecialRating,
  type LegacyTeamGroup,
} from "../util/parAdminHistory";
import ParAdminLegacyEmployeeViewTab from "./ParAdminLegacyEmployeeViewTab";
import ParEmptyState from "./ParEmptyState";
import ParLegacyRecordDetail from "./ParLegacyRecordDetail";
import ParStatusChip from "./ParStatusChip";
import { ParGridToolbar } from "./parGridToolbar";
import type { ParLegacyHistory } from "../api/types";

// A record opened from Employee View has no group -- going back from it
// returns straight to the cycle dashboard rather than to a team roster.
type Selection =
  | { level: "groups" }
  | { level: "roster"; group: LegacyTeamGroup }
  | { level: "record"; group?: LegacyTeamGroup; record: ParLegacyHistory };

function LegacyChip({ ml = 0 }: { ml?: number }) {
  return <Chip label="Legacy" size="small" color="warning" variant="outlined" sx={{ ml }} />;
}

const DEFAULT_PAGINATION: DataGrid.GridPaginationModel = { page: 0, pageSize: 10 };

// Admin's breadcrumb trail is click-to-navigate text, but nothing here ever
// behaved like a dedicated "go back" affordance the way the employee
// History tab's own ArrowLeftIcon button does -- added the same button
// here, wired to the nearest parent level (the last breadcrumb item), so
// going back one level works the same way in both places.
function Breadcrumb({ items, current }: { items: { label: string; onClick: () => void }[]; current: string }) {
  const back = items[items.length - 1];
  return (
    <Stack spacing={1}>
      <Button size="small" startIcon={<ArrowLeftIcon size={14} />} onClick={back.onClick} sx={{ alignSelf: "flex-start" }}>
        Back
      </Button>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
        {items.map((item) => (
          <Box key={item.label} sx={{ display: "flex", alignItems: "center" }}>
            <Link component="button" underline="hover" onClick={item.onClick} sx={{ mr: 0.5 }}>
              {item.label}
            </Link>
            <Typography component="span" sx={{ mx: 0.5 }}>
              /
            </Typography>
          </Box>
        ))}
        <Typography component="span" variant="h5">
          {current}
        </Typography>
        <LegacyChip ml={1.5} />
      </Box>
    </Stack>
  );
}

// Same header as ParOrgSummary's historyMode: a Back button, then the
// History link, the cycle as a chip, its date range, plus the Legacy marker.
function CycleHeader({ cycleName, onBack }: { cycleName: string; onBack: () => void }) {
  const { startDate, endDate } = deriveLegacyCycleDates(cycleName);
  return (
    <Stack spacing={1}>
      <Button size="small" startIcon={<ArrowLeftIcon size={14} />} onClick={onBack} sx={{ alignSelf: "flex-start" }}>
        Back
      </Button>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Link component="button" underline="hover" onClick={onBack} sx={{ mr: 0.5 }}>
          History
        </Link>
        <Typography component="span" sx={{ mx: 0.5 }}>
          /
        </Typography>
        <Chip label={cycleName} size="small" color="primary" variant="outlined" />
        {startDate && endDate && (
          <Typography component="span" variant="caption" color="text.secondary">
            ({formatShortDate(startDate)} - {formatShortDate(endDate)})
          </Typography>
        )}
        <LegacyChip />
      </Box>
    </Stack>
  );
}

// Admin Portal History tab's legacy-only drill-down: cycle -> team-like
// groups (department + reviewer, legacy data has no real team concept, see
// groupLegacyParticipantsByTeam) -> that group's records -> one record's
// full detail. Ports HistoryPanel.tsx's own three legacy view states, but as
// DataGrids throughout rather than plain MUI tables, matching how every
// other legacy-table screen in this port (e.g. ParOrgTeamViewTab.tsx) has
// already upgraded from source's plain tables.
export default function ParAdminLegacyCycleView({ cycleName, onBack }: { cycleName: string; onBack: () => void }) {
  const history = useLegacyParHistoryByCycle(cycleName);
  const hasSpecialRatings = legacyCycleHasSpecialRatings(cycleName);
  // Leave's employee directory is used for avatars only (the legacy table has
  // no photos), same deviation ParOrgTeamRoster.tsx/ParLeadTeamRoster.tsx make.
  const employees = useLeaveEmployees();
  const employeeByEmail = useMemo(
    () => new Map(employees.data?.map((e) => [e.workEmail, e]) ?? []),
    [employees.data],
  );
  // Names come only from the legacy table itself (the migrated first/last
  // name), never the live directory, so a legacy cycle shows who the record
  // was migrated for. Falls back to the email when the sheet had no name.
  const legacyNameByEmail = useMemo(
    () => new Map((history.data ?? []).flatMap((r) => (r.employeeName ? [[r.employeeEmail, r.employeeName] as const] : []))),
    [history.data],
  );
  const nameFor = useCallback((email: string) => legacyNameByEmail.get(email) ?? email, [legacyNameByEmail]);

  const [selection, setSelection] = useState<Selection>({ level: "groups" });
  // The roster/grouping fetch above is summary-only (see
  // useLegacyParHistoryByCycle's own comment) -- once a specific record is
  // opened, fetch that one employee's FULL legacy history (same endpoint
  // the self-view uses; admins are authorized for any employee) and pick out
  // the one cycle being viewed, rather than rendering the summary row with
  // its comments/questions/360-feedback already nulled out.
  const openedEmail = selection.level === "record" ? selection.record.employeeEmail : undefined;
  const openedRecordHistory = useParLegacyHistory(openedEmail, Boolean(openedEmail));
  // Matched by legacyHeaderId, not cycle name -- one employee can have more
  // than one row in the same cycle (e.g. a raw and a canonical 2015 cycle
  // name that both normalize to the same displayed name), and matching by
  // name alone could open one record's detail view with a different
  // record's comments/ratings/360 feedback.
  const openedFullRecord =
    selection.level === "record"
      ? openedRecordHistory.data?.find((r) => r.legacyHeaderId === selection.record.legacyHeaderId)
      : undefined;
  const [searchText, setSearchText] = useState("");
  // The tab and both tabs' searches live here, not in the tab bodies, so
  // coming back from a roster or a record lands on the same tab with the
  // same search.
  const [tab, setTab] = useState(0);
  const [employeeSearchText, setEmployeeSearchText] = useState("");
  // Page and sort too: each grid unmounts while a roster or record is open,
  // so state kept inside it would land the admin back on page 1, unsorted.
  // A new search goes back to page 1 (keeping page size), since the old
  // page may no longer exist.
  const [teamPagination, setTeamPagination] = useState(DEFAULT_PAGINATION);
  const [teamSort, setTeamSort] = useState<DataGrid.GridSortModel>([]);
  const [employeePagination, setEmployeePagination] = useState(DEFAULT_PAGINATION);
  const [employeeSort, setEmployeeSort] = useState<DataGrid.GridSortModel>([]);
  const [rosterPagination, setRosterPagination] = useState(DEFAULT_PAGINATION);
  const [rosterSort, setRosterSort] = useState<DataGrid.GridSortModel>([]);
  const [rosterSearchText, setRosterSearchText] = useState("");
  const handleTeamSearch = useCallback((value: string) => {
    setSearchText(value);
    setTeamPagination((m) => ({ ...m, page: 0 }));
  }, []);
  const handleRosterSearch = useCallback((value: string) => {
    setRosterSearchText(value);
    setRosterPagination((m) => ({ ...m, page: 0 }));
  }, []);
  const handleEmployeeSearch = useCallback((value: string) => {
    setEmployeeSearchText(value);
    setEmployeePagination((m) => ({ ...m, page: 0 }));
  }, []);
  // Opening a different group starts its roster fresh; going back to the
  // same roster from a record keeps where it was.
  const openRoster = useCallback((group: LegacyTeamGroup) => {
    setRosterPagination(DEFAULT_PAGINATION);
    setRosterSort([]);
    setRosterSearchText("");
    setSelection({ level: "roster", group });
  }, []);
  const thumbnailFor = useCallback((email: string) => employeeByEmail.get(email)?.employeeThumbnail, [employeeByEmail]);
  const openRecord = useCallback((record: ParLegacyHistory) => setSelection({ level: "record", record }), []);

  // Every grid below must get a referentially-stable rows/columns array, or
  // DataGrid treats each render as "the data changed" and rebuilds its
  // internal row/column model from scratch -- that rebuild can land mid
  // click on the pagination arrows and swallow the click, making Next/
  // Previous page feel unresponsive. Recreating groups/columns inline on
  // every render (as this used to) is exactly that trap, so every one of
  // them is memoized here, unconditionally, before any early return.
  const records = useMemo(() => history.data ?? [], [history.data]);
  const groups = useMemo(() => groupLegacyParticipantsByTeam(records), [records]);
  const filteredGroups = useMemo(
    () =>
      searchText
        ? groups.filter((g) => Object.values(g).some((value) => typeof value !== "object" && String(value).toLowerCase().includes(searchText.toLowerCase())))
        : groups,
    [groups, searchText],
  );

  const rosterGroup = selection.level === "roster" ? selection.group : undefined;
  const filteredRosterRows = useMemo(() => {
    const participants = rosterGroup?.participants ?? [];
    const term = rosterSearchText.toLowerCase();
    return term
      ? participants.filter(
          (row) => nameFor(row.employeeEmail).toLowerCase().includes(term) || row.employeeEmail.toLowerCase().includes(term),
        )
      : participants;
  }, [rosterGroup, rosterSearchText, nameFor]);
  // Same layout as the new-cycle roster (ParOrgTeamRoster). No 360° Feedback
  // or F2F columns: the summary-mode list carries no 360 data, and the old
  // system never tracked F2F. Reviewer is the group's own lead (already in
  // the breadcrumb), and the completed date is never migrated.
  const rosterColumns = useMemo<DataGrid.GridColDef<ParLegacyHistory>[]>(
    () => [
      {
        field: "employeeName",
        headerName: "Team Member",
        flex: 1.5,
        valueGetter: (_v, row) => nameFor(row.employeeEmail),
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Avatar
              src={thumbnailFor(params.row.employeeEmail) || undefined}
              slotProps={{ img: { referrerPolicy: "no-referrer" } }}
              sx={{ mr: 1.5, height: "2.2rem", width: "2.2rem" }}
            />
            <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 600 }}>
                {params.value}
              </Typography>
              {/* nameFor falls back to the email, so don't show it twice. */}
              {params.value !== params.row.employeeEmail && (
                <Typography variant="caption" sx={{ fontSize: 11.5 }} color="text.secondary">
                  {params.row.employeeEmail}
                </Typography>
              )}
            </Box>
          </Box>
        ),
      },
      {
        field: "employeePar",
        headerName: "Employee PAR",
        flex: 0.8,
        valueGetter: (_v, row) => isLegacyEmployeeParDone(row),
        renderCell: (params) => <ParStatusChip content={params.value ? "COMPLETED" : "Not Done"} />,
      },
      {
        field: "leadFeedback",
        headerName: "Lead's PAR",
        flex: 0.8,
        valueGetter: (_v, row) => isLegacyLeadFeedbackDone(row),
        renderCell: (params) => <ParStatusChip content={params.value ? "COMPLETED" : "Not Done"} />,
      },
      {
        field: "overallRating",
        headerName: "Rating",
        flex: 0.8,
        valueGetter: (_v, row) => legacyOverallRating(row),
        renderCell: (params) => <ParStatusChip content={params.value} />,
      },
      ...(hasSpecialRatings
        ? [
            {
              field: "specialRating",
              headerName: "Top 5%/20% Rating",
              flex: 0.9,
              valueGetter: (_v, row) => legacySpecialRating(row) ?? "",
              renderCell: (params) => <ParStatusChip content={params.value} />,
            } satisfies DataGrid.GridColDef<ParLegacyHistory>,
          ]
        : []),
      {
        field: "actions",
        headerName: "",
        sortable: false,
        flex: 0.4,
        renderCell: (params) => (
          <Tooltip title="View" arrow>
            <IconButton
              onClick={(e) => {
                // The row's own onRowClick would open it a second time.
                e.stopPropagation();
                if (rosterGroup) setSelection({ level: "record", group: rosterGroup, record: params.row });
              }}
            >
              <EyeIcon size={18} />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [nameFor, thumbnailFor, rosterGroup, hasSpecialRatings],
  );

  const teamColumns = useMemo<DataGrid.GridColDef<LegacyTeamGroup>[]>(
    () => [
      { field: "parBusinessUnit", headerName: "BU", flex: 1 },
      { field: "parDepartment", headerName: "Department", flex: 1 },
      { field: "parTeam", headerName: "Team", flex: 1 },
      { field: "parSubTeam", headerName: "Sub Team", flex: 1 },
      { field: "parLeadEmail", headerName: "Lead", flex: 1 },
      {
        field: "employeeParCompletion",
        headerName: "Employee PAR",
        flex: 0.7,
        renderCell: (params) => <Chip size="small" label={params.row.employeeParCompletion} />,
      },
      {
        field: "leadFeedbackCompletion",
        headerName: "Lead's Feedback",
        flex: 0.7,
        renderCell: (params) => <Chip size="small" label={params.row.leadFeedbackCompletion} />,
      },
      ...(hasSpecialRatings
        ? [
            { field: "numberOf5pSlots", headerName: "5% Slots", flex: 0.5 },
            { field: "numberOf20pSlots", headerName: "20% Slots", flex: 0.5 },
          ]
        : []),
      {
        field: "actions",
        headerName: "",
        sortable: false,
        flex: 0.4,
        renderCell: (params) => (
          <Tooltip title="Open Group" arrow>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                openRoster(params.row);
              }}
            >
              <ArrowRightIcon size={18} />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [openRoster, hasSpecialRatings],
  );

  if (history.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (history.isError) {
    return (
      <ErrorNotice error={history.error} onRetry={() => history.refetch()} retrying={history.isFetching}>
        Couldn't load this legacy cycle's PAR history.
      </ErrorNotice>
    );
  }

  if (selection.level === "record") {
    const { group, record } = selection;
    return (
      <Stack spacing={2}>
        <Breadcrumb
          items={[
            { label: "History", onClick: onBack },
            { label: cycleName, onClick: () => setSelection({ level: "groups" }) },
            ...(group ? [{ label: group.parLeadEmail, onClick: () => setSelection({ level: "roster", group }) }] : []),
          ]}
          current={nameFor(record.employeeEmail)}
        />
        {openedRecordHistory.isLoading ? (
          <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />
        ) : openedRecordHistory.isError ? (
          <ErrorNotice
            error={openedRecordHistory.error}
            onRetry={() => openedRecordHistory.refetch()}
            retrying={openedRecordHistory.isFetching}
          >
            Couldn't load this employee's full legacy record.
          </ErrorNotice>
        ) : openedFullRecord ? (
          <ParLegacyRecordDetail
            record={openedFullRecord}
            thumbnail={employeeByEmail.get(record.employeeEmail)?.employeeThumbnail}
          />
        ) : (
          <ParEmptyState text="Couldn't find this employee's full legacy record." />
        )}
      </Stack>
    );
  }

  if (selection.level === "roster") {
    const { group } = selection;

    return (
      <Stack spacing={2}>
        <Breadcrumb
          items={[
            { label: "History", onClick: onBack },
            { label: cycleName, onClick: () => setSelection({ level: "groups" }) },
          ]}
          current={group.parLeadEmail}
        />
        <Card variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
            <Typography variant="h6">Members</Typography>
            <TextField
              size="small"
              placeholder="Search Members"
              value={rosterSearchText}
              onChange={(e) => handleRosterSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon size={16} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
          <DataGrid.DataGrid
            rows={filteredRosterRows}
            columns={rosterColumns}
            getRowId={(row) => row.legacyHeaderId}
            rowHeight={56}
            disableRowSelectionOnClick
            onRowClick={(params) => setSelection({ level: "record", group, record: params.row })}
            sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
            paginationModel={rosterPagination}
            onPaginationModelChange={setRosterPagination}
            sortModel={rosterSort}
            onSortModelChange={setRosterSort}
            pageSizeOptions={[10, 20, 25]}
          />
        </Card>
      </Stack>
    );
  }

  if (records.length === 0) {
    return (
      <Stack spacing={2}>
        <CycleHeader cycleName={cycleName} onBack={onBack} />
        <ParEmptyState text="No records found for this legacy cycle." />
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <CycleHeader cycleName={cycleName} onBack={onBack} />

      <Card variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
        {/* Only Team View and Employee View: the old system never had 360
            request rejections or quota allocations to show. */}
        <Tabs value={tab} onChange={(_e, value) => setTab(value)} aria-label="legacy cycle tabs" sx={{ mb: 2 }}>
          <Tab icon={<UsersIcon size={16} />} iconPosition="start" label="Team View" />
          <Tab icon={<UserIcon size={16} />} iconPosition="start" label="Employee View" />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <TextField
                size="small"
                placeholder="Search Team"
                value={searchText}
                onChange={(e) => handleTeamSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon size={16} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>
            <DataGrid.DataGrid
              rows={filteredGroups}
              columns={teamColumns}
              rowHeight={56}
              disableRowSelectionOnClick
              onRowClick={(params) => openRoster(params.row)}
              showToolbar
              slots={{ toolbar: ParGridToolbar }}
              sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
              paginationModel={teamPagination}
              onPaginationModelChange={setTeamPagination}
              sortModel={teamSort}
              onSortModelChange={setTeamSort}
              pageSizeOptions={[10, 20, 25]}
            />
          </Stack>
        )}
        {tab === 1 && (
          <ParAdminLegacyEmployeeViewTab
            records={records}
            searchText={employeeSearchText}
            onSearchTextChange={handleEmployeeSearch}
            paginationModel={employeePagination}
            onPaginationModelChange={setEmployeePagination}
            sortModel={employeeSort}
            onSortModelChange={setEmployeeSort}
            nameFor={nameFor}
            thumbnailFor={thumbnailFor}
            onOpenRecord={openRecord}
          />
        )}
      </Card>
    </Stack>
  );
}
