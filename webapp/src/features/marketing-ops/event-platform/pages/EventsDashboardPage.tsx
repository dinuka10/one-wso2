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

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  DatePickers,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Paper,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  type SxProps,
  type Theme,
} from "@wso2/oxygen-ui";
import { LayoutGridIcon, ListIcon, PlusIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isMarketingOpsBackendConfigured } from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useMarketingOpsGate } from "@features/marketing-ops/api/useMarketingOpsGate";
import {
  useCreateEvent,
  useListEvents,
  type CreateEventPayload,
} from "../api/events";
import { describeEventPlatformError } from "../api/responses";
import DatePickerProvider from "../components/DatePickerProvider";
import { PICKER_SLOT_PROPS } from "../components/pickerSlotProps";
import { eventPath, eventTab, firstAllowedPath } from "../eventPlatformTabs";
import { useSubmitShortcut } from "../hooks/useSubmitShortcut";
import type { ConferenceConfig } from "../types/eventPlatformTypes";
import {
  TIMEZONE_OPTIONS,
  browserTimeZone,
  formatDateRange,
  isNowBefore,
  isValidDate,
  toDateOnlyString,
} from "../utils/dateTime";

const { DatePicker } = DatePickers;

// The source's EventsDashboard: every event, and creating one.
//
// Two faces on one route (the port spec's §8 Q1). An admin gets the dashboard
// as the source had it. A shop-only operator gets the same list read-only — no
// create — because without it they had no way to reach an event's shop. Where
// a card leads is firstAllowedPath for that event, so it follows the same gate
// as the event's own index redirect: the agenda for an admin, `shop/inventory`
// for a shop operator.

const ADMIN_GATE = "mops-event-platform-admin";

// A new event's days start with the source's default 08:00–17:00 window; the
// real hours are set later in the event's Settings.
const DEFAULT_DAY_START_MINUTE = 480;
const DEFAULT_DAY_END_MINUTE = 1020;
const DAY_COUNT_OPTIONS = [1, 2, 3] as const;

interface CreateEventForm {
  name: string;
  startDate: Date | null;
  dayCount: number;
  // Always three, so switching the day count down and back up keeps what was typed.
  dayLabels: string[];
  timezone: string;
  venueName: string;
  venueAddress: string;
}

function emptyForm(): CreateEventForm {
  return {
    name: "",
    startDate: new Date(),
    dayCount: 1,
    dayLabels: ["", "", ""],
    timezone: browserTimeZone(),
    venueName: "",
    venueAddress: "",
  };
}

function toPayload(values: CreateEventForm): CreateEventPayload {
  return {
    name: values.name.trim(),
    startDate: toDateOnlyString(values.startDate) as string,
    days: Array.from({ length: values.dayCount }, (_, i) => ({
      startMinute: DEFAULT_DAY_START_MINUTE,
      endMinute: DEFAULT_DAY_END_MINUTE,
      label: values.dayLabels[i]?.trim() || null,
    })),
    timezone: values.timezone,
    venueName: values.venueName.trim() || null,
    venueAddress: values.venueAddress.trim() || null,
  };
}

function CreateEventDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { showError } = useNotifications();
  const createEvent = useCreateEvent();
  const { data: events } = useListEvents();
  const [showWarning, setShowWarning] = useState(false);
  const { control, getValues, reset } = useForm<CreateEventForm>({ defaultValues: emptyForm() });
  const [name, startDate, dayCount, timezone] = useWatch({
    control,
    name: ["name", "startDate", "dayCount", "timezone"],
  });

  const canCreate =
    name.trim().length > 0 && isValidDate(startDate) && timezone.trim().length > 0;

  // The most recently created event is the one the attendee app is showing;
  // creating another moves the app over to the new one.
  const activeEvent =
    events && events.length > 0
      ? [...events].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0]
      : null;
  // No closing time means the shop never closes, so it counts as open.
  const isCurrentShopOpen = activeEvent
    ? !activeEvent.shopClosingTime || isNowBefore(activeEvent.shopClosingTime)
    : false;

  function handleClose() {
    reset(emptyForm());
    setShowWarning(false);
    onClose();
  }

  async function handleCreate() {
    if (!canCreate) return;
    let created: ConferenceConfig;
    try {
      created = await createEvent.mutateAsync(toPayload(getValues()));
    } catch (err) {
      showError(`Couldn't create the event. ${describeEventPlatformError(err)}`);
      return;
    }
    handleClose();
    navigate(newEventPath(created.id));
  }

  function handleCreateClick() {
    if (!canCreate) return;
    if (isCurrentShopOpen) setShowWarning(true);
    else void handleCreate();
  }

  const handleKeyDown = useSubmitShortcut(() => void handleCreate(), canCreate && !createEvent.isPending);

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>New Event</DialogTitle>
        <DialogContent
          onKeyDown={handleKeyDown}
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}
        >
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <TextField {...field} label="Event name" required autoFocus fullWidth />
            )}
          />
          <DatePickerProvider>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <DatePicker
                  label="Start date"
                  value={field.value}
                  // Clearing the field is ignored, as in the source: an event
                  // always has a start date.
                  onChange={(v) => {
                    if (v) field.onChange(v);
                  }}
                  slotProps={PICKER_SLOT_PROPS}
                />
              )}
            />
          </DatePickerProvider>
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Number of days
            </Typography>
            <Controller
              control={control}
              name="dayCount"
              render={({ field }) => (
                <Box sx={{ display: "flex", gap: 1 }}>
                  {DAY_COUNT_OPTIONS.map((n) => (
                    <Button
                      key={n}
                      variant={field.value === n ? "contained" : "outlined"}
                      size="small"
                      onClick={() => field.onChange(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </Box>
              )}
            />
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="body2">
              Day labels{" "}
              <Typography component="span" variant="body2" color="text.secondary">
                (optional)
              </Typography>
            </Typography>
            {Array.from({ length: dayCount }, (_, i) => (
              <Controller
                key={i}
                control={control}
                name={`dayLabels.${i}`}
                render={({ field }) => (
                  <TextField
                    {...field}
                    size="small"
                    label={`Day ${i + 1}`}
                    placeholder={`Day ${i + 1}`}
                    fullWidth
                  />
                )}
              />
            ))}
          </Box>
          <Controller
            control={control}
            name="venueName"
            render={({ field }) => (
              <TextField {...field} label="Venue name" placeholder="Optional" fullWidth />
            )}
          />
          <Controller
            control={control}
            name="venueAddress"
            render={({ field }) => (
              <TextField {...field} label="Venue address" placeholder="Optional" fullWidth />
            )}
          />
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <Autocomplete
                options={TIMEZONE_OPTIONS}
                // A zone this browser can't list (an older Intl) still shows as itself.
                value={
                  TIMEZONE_OPTIONS.find((o) => o.value === field.value) ?? {
                    label: field.value,
                    value: field.value,
                  }
                }
                onChange={(_, v) => field.onChange(v?.value ?? "UTC")}
                disableClearable
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, val) => option.value === val.value}
                renderInput={(params) => <TextField {...params} label="Timezone" required />}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateClick}
            disabled={!canCreate || createEvent.isPending}
          >
            {createEvent.isPending ? <CircularProgress size={16} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={showWarning} onClose={() => setShowWarning(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: "warning.main" }}>
          Heads Up: Switching Live Events
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <Typography variant="body1">
            We noticed that the merchandise shop for your current event (
            {activeEvent?.name ? <strong>{activeEvent.name}</strong> : "the active conference"}) is
            still active!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            When you create a new conference event, our system automatically transitions the mobile
            app to the new event so you can start preparing it. If your current conference is still
            winding down, attendees will suddenly see an empty store and reset order history.
          </Typography>
          <Box sx={{ bgcolor: "action.hover", p: 2, borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
              What would you like to do?
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              • <strong>Wait:</strong> Go back and let the current shop finish until its official
              closing time.
            </Typography>
            <Typography variant="body2">
              • <strong>Switch Now:</strong> Create the new event immediately (previous orders will
              be safely preserved in the database archive).
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setShowWarning(false)}>Go Back</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => void handleCreate()}
            disabled={createEvent.isPending}
          >
            {createEvent.isPending ? <CircularProgress size={16} /> : "Create New Event Anyway"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// Only an admin can create, so a new event opens where an admin lands: its agenda.
function newEventPath(eventId: string): string {
  return eventPath(eventId, eventTab("sessions")!, "agenda");
}

function EventCard({ event, to }: { event: ConferenceConfig; to?: string }) {
  const navigate = useNavigate();
  const dayCount = event.days.length;

  return (
    <Paper
      role={to ? "link" : undefined}
      tabIndex={to ? 0 : undefined}
      sx={{ cursor: to ? "pointer" : "default", p: 2.5 }}
      onClick={() => to && navigate(to)}
      onKeyDown={(e) => {
        if (to && e.key === "Enter") navigate(to);
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {event.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {formatDateRange(event.startDate, dayCount)}
      </Typography>
      <Box sx={{ mt: 1.5 }}>
        <Chip label={`${dayCount} day${dayCount !== 1 ? "s" : ""}`} size="small" />
      </Box>
    </Paper>
  );
}

export default function EventsDashboardPage() {
  const gate = useMarketingOpsGate(isMarketingOpsBackendConfigured());
  const { data: events, isLoading, isError, error, refetch, isRefetching } = useListEvents();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const canCreate = gate.canSee(ADMIN_GATE);
  const query = search.trim().toLowerCase();
  const visibleEvents = query
    ? (events ?? []).filter((e) => e.name.toLowerCase().includes(query))
    : (events ?? []);

  const containerSx: SxProps<Theme> =
    view === "grid"
      ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 2 }
      : { display: "flex", flexDirection: "column", gap: 1.5 };

  return (
    <Box>
      {/* The shell already titles the page "Events", so the source's heading
          row keeps only its controls. */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 1, flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="Search events"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
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
        {canCreate && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<PlusIcon size={16} />}
            onClick={() => setDialogOpen(true)}
          >
            New Event
          </Button>
        )}
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          onChange={(_, v: "grid" | "list" | null) => {
            if (v) setView(v);
          }}
        >
          <ToggleButton value="grid" aria-label="Grid view">
            <LayoutGridIcon size={18} />
          </ToggleButton>
          <ToggleButton value="list" aria-label="List view">
            <ListIcon size={18} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {isError ? (
        <ErrorNotice error={error} onRetry={() => void refetch()} retrying={isRefetching}>
          Couldn&apos;t load the events.
        </ErrorNotice>
      ) : isLoading ? (
        <Box sx={containerSx}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
          ))}
        </Box>
      ) : visibleEvents.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 8 }}>
          {events?.length ? "No events match your search." : "No events yet."}
        </Typography>
      ) : (
        <Box sx={containerSx}>
          {visibleEvents.map((event) => (
            <EventCard key={event.id} event={event} to={firstAllowedPath(gate.canSee, event.id)} />
          ))}
        </Box>
      )}

      {canCreate && <CreateEventDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />}
    </Box>
  );
}
