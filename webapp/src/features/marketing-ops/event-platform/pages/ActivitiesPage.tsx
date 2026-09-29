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

import { useRef, useState } from "react";
import { useParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { PencilIcon, PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import ConfirmationDialog, {
  type ConfirmationContent,
} from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useEvent } from "@features/marketing-ops/event-platform/api/event";
import {
  useCreateActivity,
  useDeleteActivity,
  useListActivities,
  useReplaceActivityHours,
  useUpdateActivity,
} from "@features/marketing-ops/event-platform/api/activities";
import { useNotifyFailure } from "@features/marketing-ops/event-platform/api/base";
import type { Activity } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import ActivityForm from "../components/activities/ActivityForm";
import {
  activitySaveErrorMessage,
  hoursChipLabel,
  nextActivityPosition,
  planActivitySave,
  type ActivityFormValues,
} from "../components/activities/activityHours";

/** Sessions → Activities: things open at the venue while the agenda runs. */
export default function ActivitiesPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const { showError } = useNotifications();
  const notifyFailure = useNotifyFailure();

  const { data: event } = useEvent(eventId);
  const { data: activities = [], isLoading, isError, error, refetch, isFetching } = useListActivities(eventId);
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const replaceHours = useReplaceActivityHours();

  // `undefined` = closed, `null` = adding, an activity = editing it.
  const [editing, setEditing] = useState<Activity | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);
  // An activity this dialog created whose hours then failed to save. A second
  // Save must update it, not create it again: the source did the latter, which
  // the duplicate-name check then refused.
  const createdRef = useRef<Activity | null>(null);

  const days = [...(event?.days ?? [])].sort((a, b) => a.dayIndex - b.dayIndex);
  const isPending = createActivity.isPending || updateActivity.isPending || replaceHours.isPending;

  const closeForm = () => {
    setEditing(undefined);
    createdRef.current = null;
  };

  const handleSave = async (values: ActivityFormValues) => {
    const existing = editing ?? createdRef.current ?? undefined;
    const plan = planActivitySave(existing, values);
    try {
      let id = existing?.id;
      if (plan.details === "create") {
        const created = await createActivity.mutateAsync({
          configId: eventId,
          name: plan.name,
          description: plan.description,
          position: nextActivityPosition(activities),
        });
        createdRef.current = created;
        id = created.id;
      } else if (plan.details === "update" && id) {
        await updateActivity.mutateAsync({ id, name: plan.name, description: plan.description });
      }
      // Hours are their own table, set by a second call — creating first is
      // what yields the id it needs.
      if (plan.hours && id) await replaceHours.mutateAsync({ id, hours: values.hours });
      closeForm();
    } catch (err) {
      showError(activitySaveErrorMessage(err, values.name, !editing && createdRef.current !== null));
    }
  };

  const askDelete = (activity: Activity) =>
    setConfirm({
      title: "Delete activity",
      text: `Delete "${activity.name}" and all its opening hours?`,
      confirmLabel: "Delete",
      confirmAction: () =>
        deleteActivity.mutate(
          { id: activity.id },
          { onError: (err) => notifyFailure("Couldn't delete the activity.", err) },
        ),
    });

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Activities
        </Typography>
        <Button variant="contained" disableElevation startIcon={<PlusIcon size={16} />} onClick={() => setEditing(null)}>
          Add activity
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Things open at the venue while the agenda runs, like a bar or a booth. These appear in the attendee app and
        never in the printed agenda.
      </Typography>

      {isLoading && <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />}

      {isError && (
        <ErrorNotice error={error} onRetry={() => void refetch()} retrying={isFetching}>
          Couldn&apos;t load the activities.
        </ErrorNotice>
      )}

      {!isLoading && !isError && activities.length === 0 && <Alert severity="info">No activities yet.</Alert>}

      {!isLoading && !isError && activities.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Opening hours</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>{activity.name}</TableCell>
                  <TableCell sx={{ maxWidth: 320, color: "text.secondary" }}>{activity.description}</TableCell>
                  <TableCell>
                    {activity.hours.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        Not scheduled
                      </Typography>
                    ) : (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {activity.hours.map((h) => (
                          <Chip key={h.id} size="small" label={hoursChipLabel(h, days)} />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <IconButton size="small" aria-label={`Edit ${activity.name}`} onClick={() => setEditing(activity)}>
                      <PencilIcon size={14} />
                    </IconButton>
                    <IconButton size="small" aria-label={`Delete ${activity.name}`} onClick={() => askDelete(activity)}>
                      <Trash2Icon size={14} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={editing !== undefined} onClose={closeForm} maxWidth="md" fullWidth>
        {editing !== undefined && (
          <ActivityForm
            key={editing?.id ?? "new"}
            initial={editing ?? undefined}
            days={days}
            isPending={isPending}
            onSave={(values) => void handleSave(values)}
            onClose={closeForm}
          />
        )}
      </Dialog>

      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}
