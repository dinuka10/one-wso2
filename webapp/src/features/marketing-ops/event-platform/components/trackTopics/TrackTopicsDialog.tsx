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
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  IconButton,
  Switch,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import ConfirmationDialog, {
  type ConfirmationContent,
} from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  useCreateTrackTopic,
  useDeleteTrackTopic,
  useListTrackTopics,
  useUpdateTrackTopic,
} from "@features/marketing-ops/event-platform/api/trackTopics";
import { useNotifyFailure } from "@features/marketing-ops/event-platform/api/base";
import { useSubmitShortcut } from "@features/marketing-ops/event-platform/hooks/useSubmitShortcut";
import type { TrackTopic } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  EMPTY_TOPIC_DRAFT,
  nextTopicPosition,
  sortTopics,
  topicMove,
  topicPayload,
  topicSaveErrorMessage,
  validateTopicDraft,
  type TopicDraft,
  type TopicDraftErrors,
} from "./topicDraft";

function TopicForm({
  draft,
  errors,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  draft: TopicDraft;
  errors: TopicDraftErrors;
  onChange: (draft: TopicDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        p: 1.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <TextField
          label="Name"
          size="small"
          autoFocus
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          error={Boolean(errors.name)}
          helperText={errors.name}
          sx={{ flex: 1 }}
        />
        <Box sx={{ flex: 1 }}>
          <TextField
            label="Slug (optional)"
            size="small"
            fullWidth
            value={draft.slug}
            onChange={(e) => onChange({ ...draft, slug: e.target.value })}
            error={Boolean(errors.slug)}
            helperText={errors.slug}
          />
          <FormHelperText>Generated from the name if left blank.</FormHelperText>
        </Box>
      </Box>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={draft.showInFilter}
            onChange={(e) => onChange({ ...draft, showInFilter: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Show in filter dropdown</Typography>}
      />
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
        <Button size="small" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={isPending || Object.keys(errors).length > 0}
          onClick={onSave}
        >
          {isPending ? <CircularProgress size={14} /> : "Save"}
        </Button>
      </Box>
    </Box>
  );
}

/**
 * The event's track topics — what drives the public agenda's track filter:
 * add, rename, reorder, hide from the dropdown, delete. Rendered only while
 * open; the caller unmounts it on close.
 */
export default function TrackTopicsDialog({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { data: topics = [], isLoading, isError, error, refetch, isFetching } = useListTrackTopics(eventId);
  const createTopic = useCreateTrackTopic();
  const updateTopic = useUpdateTrackTopic();
  const deleteTopic = useDeleteTrackTopic();
  const { showError } = useNotifications();
  const notifyFailure = useNotifyFailure();

  // "new" while adding, a topic's id while editing it.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TopicDraft>(EMPTY_TOPIC_DRAFT);
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);

  const isBusy = createTopic.isPending || updateTopic.isPending || deleteTopic.isPending;
  const sortedTopics = sortTopics(topics);

  const namesInUse = topics.filter((t) => t.id !== editingId).map((t) => t.name);
  const errors = editingId !== null ? validateTopicDraft(draft, namesInUse) : {};
  const canSave = editingId !== null && Object.keys(errors).length === 0 && !isBusy;

  const openAdd = () => {
    setEditingId("new");
    setDraft(EMPTY_TOPIC_DRAFT);
  };
  const openEdit = (topic: TrackTopic) => {
    setEditingId(topic.id);
    setDraft({ name: topic.name, slug: topic.slug, showInFilter: topic.showInFilter });
  };
  const cancelEdit = () => setEditingId(null);

  const saveDraft = () => {
    if (!canSave) return;
    const payload = topicPayload(draft);
    const options = { onSuccess: cancelEdit, onError: (err: unknown) => showError(topicSaveErrorMessage(err)) };
    if (editingId === "new") {
      createTopic.mutate({ configId: eventId, ...payload, position: nextTopicPosition(topics) }, options);
    } else if (editingId) {
      updateTopic.mutate({ id: editingId, ...payload }, options);
    }
  };

  const moveTopic = (index: number, direction: -1 | 1) => {
    for (const write of topicMove(sortedTopics, index, direction) ?? []) {
      updateTopic.mutate(write, { onError: (err) => notifyFailure("Couldn't reorder the topics.", err) });
    }
  };

  const toggleFilter = (topic: TrackTopic, showInFilter: boolean) =>
    updateTopic.mutate(
      { id: topic.id, showInFilter },
      { onError: (err) => notifyFailure("Couldn't change the topic.", err) },
    );

  const askDelete = (topic: TrackTopic) =>
    setConfirm({
      title: "Delete track topic",
      text: `Delete "${topic.name}"? Sections and sessions tagged with it will show as untagged instead.`,
      confirmLabel: "Delete",
      confirmAction: () =>
        deleteTopic.mutate(
          { id: topic.id },
          { onError: (err) => notifyFailure("Couldn't delete the topic — changes reverted.", err) },
        ),
    });

  const handleKeyDown = useSubmitShortcut(saveDraft, canSave);

  return (
    <Dialog open onClose={isBusy ? undefined : onClose} maxWidth="sm" fullWidth onKeyDown={handleKeyDown}>
      <DialogTitle>Track topics</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 0.75, pt: "16px !important" }}>
        {isLoading && <CircularProgress size={24} />}
        {isError && (
          <ErrorNotice error={error} onRetry={() => void refetch()} retrying={isFetching}>
            Couldn&apos;t load the track topics.
          </ErrorNotice>
        )}
        {!isLoading && !isError && sortedTopics.length === 0 && editingId !== "new" && (
          <Typography variant="body2" color="text.secondary">
            No track topics added yet.
          </Typography>
        )}
        {sortedTopics.map((topic, index) =>
          editingId === topic.id ? (
            <TopicForm
              key={topic.id}
              draft={draft}
              errors={errors}
              onChange={setDraft}
              onSave={saveDraft}
              onCancel={cancelEdit}
              isPending={updateTopic.isPending}
            />
          ) : (
            <Box key={topic.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {topic.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                {topic.slug}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 132 }}>
                <Switch
                  size="small"
                  checked={topic.showInFilter}
                  disabled={isBusy}
                  onChange={(e) => toggleFilter(topic, e.target.checked)}
                  slotProps={{ input: { "aria-label": `Show ${topic.name} in the filter dropdown` } }}
                />
                {!topic.showInFilter && (
                  <Typography variant="caption" color="text.secondary">
                    Hidden from dropdown
                  </Typography>
                )}
              </Box>
              <IconButton
                size="small"
                disabled={isBusy || index === 0}
                onClick={() => moveTopic(index, -1)}
                aria-label={`Move ${topic.name} up`}
              >
                <ArrowUpIcon size={16} />
              </IconButton>
              <IconButton
                size="small"
                disabled={isBusy || index === sortedTopics.length - 1}
                onClick={() => moveTopic(index, 1)}
                aria-label={`Move ${topic.name} down`}
              >
                <ArrowDownIcon size={16} />
              </IconButton>
              <IconButton size="small" disabled={isBusy} onClick={() => openEdit(topic)} aria-label={`Edit ${topic.name}`}>
                <PencilIcon size={16} />
              </IconButton>
              <IconButton
                size="small"
                disabled={isBusy}
                onClick={() => askDelete(topic)}
                aria-label={`Delete ${topic.name}`}
              >
                <Trash2Icon size={16} />
              </IconButton>
            </Box>
          ),
        )}
        {editingId === "new" ? (
          <TopicForm
            draft={draft}
            errors={errors}
            onChange={setDraft}
            onSave={saveDraft}
            onCancel={cancelEdit}
            isPending={createTopic.isPending}
          />
        ) : (
          <Button
            size="small"
            variant="outlined"
            startIcon={<PlusIcon size={14} />}
            sx={{ alignSelf: "flex-start", mt: 0.5 }}
            disabled={isLoading || isError}
            onClick={openAdd}
          >
            Add topic
          </Button>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isBusy}>
          Close
        </Button>
      </DialogActions>

      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
    </Dialog>
  );
}
