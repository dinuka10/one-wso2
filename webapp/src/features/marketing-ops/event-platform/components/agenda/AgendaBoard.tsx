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

// The agenda grid for one day: a time column, one column per track, sections
// drawn over the slots, and cards placed in them. Native HTML5 drag and drop —
// every card is `draggable` and carries its session id as text/plain; every
// drop target resolves a (track, slot, section) and hands it to `place`, which
// decides whether the drop lands (useAgendaEditor → resolveDrop).
//
// Stacking, bottom to top: track background columns (a drop there means slot
// 0), per-slot cells (precise drops and the highlight), sections, then cards.

import { useState, type CSSProperties, type DragEvent, type MouseEvent, type RefObject } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  alpha,
} from "@wso2/oxygen-ui";
import type { SxProps, Theme } from "@wso2/oxygen-ui";
import { Pencil as PencilIcon } from "@wso2/oxygen-ui-icons-react";
import type { ColorScheme } from "@features/marketing-ops/event-platform/types/colorTokens";
import type {
  ConferenceDay,
  Session,
  TimeslotFootnote,
  Track,
  TrackSection,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  itemColorHex,
  sectionColorHex,
  slotLabel,
  trackColorHex,
  trackLabel,
} from "@features/marketing-ops/event-platform/utils/agenda";
import { allowDrop } from "@features/marketing-ops/event-platform/utils/drag";
import type { OverCell } from "@features/marketing-ops/event-platform/hooks/agendaPlacement";
import { useColorSchemeMode } from "@features/marketing-ops/event-platform/hooks/useColorSchemeMode";
import {
  CardTooltipContent,
  SessionCardBody,
} from "@features/marketing-ops/event-platform/components/sessions/SessionCard";
import TimeslotFootnotes from "./TimeslotFootnotes";
import {
  TIME_LABEL_EVERY,
  boardGridTemplate,
  freeCardLayout,
  pointerSlot,
  sectionCardBox,
  sectionDropSlot,
  slotRow,
  timeLabelSlots,
  trackColumn,
} from "./agendaGrid";

type SectionKind = TrackSection["kind"];

interface AgendaBoardProps {
  tracks: Track[];
  tracksLoading: boolean;
  sessionsLoading: boolean;
  isBusy: boolean;
  slots: number[];
  slotCount: number;
  // The event's sessions, for the length of whatever is being dragged.
  sessions: Session[];
  placed: Session[];
  sections: TrackSection[];
  keynoteSections: TrackSection[];
  activeDay: ConferenceDay | undefined;
  overCell: OverCell;
  isCellHighlighted: (trackId: string, slot: number) => boolean;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragEnd: () => void;
  setOverCell: (cell: OverCell) => void;
  place: (id: string, trackId: string | null, slot: number, sectionId?: string | null) => void;
  onEdit: (id: string) => void;
  onRemove: (e: MouseEvent<HTMLButtonElement>, id: string) => void;
  onEditTrack: (trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onAddSection: (trackId: string, sectionKind: SectionKind) => void;
  onEditSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  articleLinksEnabled: boolean;
  videoLinksEnabled: boolean;
  wasDragging: RefObject<boolean>;
  footnotes: TimeslotFootnote[];
  onAddFootnote: (slotIndex: number, text: string, onSuccess: () => void) => void;
  onEditFootnote: (id: string, text: string, onSuccess: () => void) => void;
  onDeleteFootnote: (id: string) => void;
  footnotesPending: boolean;
}

// What every card on the board shares, whatever it sits in. Its border and
// fill come from where it sits.
const cardFrameSx = {
  borderRadius: 1,
  px: 1,
  py: 0.75,
  cursor: "pointer",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: 0.25,
  "&:hover .chip-remove": { opacity: 1 },
} as const;

// The section's label band sits on the section's own colour, so its text and
// controls are white whatever the scheme.
const bandActionSx = (theme: Theme) => ({
  width: 18,
  height: 18,
  color: alpha(theme.palette.common.white, 0.75),
  "&:hover": { bgcolor: alpha(theme.palette.common.white, 0.15), color: "common.white" },
});

interface CardHandlers {
  onDragStart: (e: DragEvent, id: string) => void;
  onDragEnd: () => void;
  onEdit: (id: string) => void;
  onRemove: (e: MouseEvent<HTMLButtonElement>, id: string) => void;
  wasDragging: RefObject<boolean>;
}

// One draggable card. A short card shows its details in a tooltip instead; a
// click that ends a drag does not open the card.
function BoardCard({
  item,
  activeDay,
  isCompact,
  showKind,
  articleLinksEnabled,
  videoLinksEnabled,
  handlers,
  sx,
  style,
  onDragOver,
  onDrop,
}: {
  item: Session;
  activeDay: ConferenceDay;
  isCompact: boolean;
  showKind: boolean;
  articleLinksEnabled: boolean;
  videoLinksEnabled: boolean;
  handlers: CardHandlers;
  sx: SxProps<Theme>;
  style: CSSProperties;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
}) {
  return (
    <Tooltip
      title={isCompact ? <CardTooltipContent item={item} activeDay={activeDay} showKind={showKind} /> : false}
      placement="top"
      arrow
    >
      <Box
        sx={[cardFrameSx, ...(Array.isArray(sx) ? sx : [sx])]}
        style={style}
        draggable
        onDragStart={(e) => handlers.onDragStart(e, item.id)}
        onDragEnd={handlers.onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => {
          if (!handlers.wasDragging.current) handlers.onEdit(item.id);
        }}
      >
        <SessionCardBody
          item={item}
          activeDay={activeDay}
          isCompact={isCompact}
          showKind={showKind}
          articleLinksEnabled={articleLinksEnabled}
          videoLinksEnabled={videoLinksEnabled}
          onRemove={(e) => {
            e.stopPropagation();
            handlers.onRemove(e, item.id);
          }}
        />
      </Box>
    </Tooltip>
  );
}

// A track section (in one track's column) or a keynote section (across every
// track): a coloured label band with its edit and delete controls, and a body
// its sessions are positioned in. Dropping on it places the dragged item at the
// slot under the pointer, pulled back so it ends inside the section.
function SectionBlock({
  section,
  track,
  gridColumn,
  scheme,
  sessions,
  placed,
  activeDay,
  overCell,
  setOverCell,
  hoverTrackId,
  dropTrackId,
  place,
  onEditSection,
  onDeleteSection,
  articleLinksEnabled,
  videoLinksEnabled,
  handlers,
}: {
  section: TrackSection;
  // Null for a keynote section.
  track: Track | null;
  gridColumn: string;
  scheme: ColorScheme;
  sessions: Session[];
  placed: Session[];
  activeDay: ConferenceDay;
  overCell: OverCell;
  setOverCell: (cell: OverCell) => void;
  // The track the hover highlight is reported against, and the one a drop
  // places into (null for a keynote section, whose items belong to no track).
  hoverTrackId: string;
  dropTrackId: string | null;
  place: AgendaBoardProps["place"];
  onEditSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  articleLinksEnabled: boolean;
  videoLinksEnabled: boolean;
  handlers: CardHandlers;
}) {
  const isKeynote = track === null;
  const color = sectionColorHex(section, track, scheme);
  const sectionSessions = placed.filter((p) => p.sectionId === section.id);

  return (
    <Box
      sx={{
        display: "flex",
        overflow: "hidden",
        zIndex: 2,
        borderTop: `2px solid ${color}`,
        borderRight: 1,
        borderRightColor: "divider",
      }}
      style={{ gridColumn, gridRow: `${slotRow(section.startSlot)} / span ${section.durationSlots}` }}
      onDragOver={(e) => {
        allowDrop(e);
        const slot = pointerSlot(section, e.clientY - e.currentTarget.getBoundingClientRect().top);
        const sameTrack = isKeynote || overCell?.trackId === hoverTrackId;
        if (!sameTrack || overCell?.slot !== slot || overCell?.sectionId !== section.id) {
          setOverCell({ trackId: hoverTrackId, slot, sectionId: section.id });
        }
      }}
      onDrop={(e) => {
        const sessionId = e.dataTransfer.getData("text/plain");
        const len = sessions.find((s) => s.id === sessionId)?.durationSlots ?? 1;
        const slot = sectionDropSlot(section, e.clientY - e.currentTarget.getBoundingClientRect().top, len);
        handlers.onDragEnd();
        place(sessionId, dropTrackId, slot, section.id);
      }}
    >
      {/* Label band */}
      <Box
        sx={{
          width: 60,
          flexShrink: 0,
          bgcolor: color,
          display: "flex",
          flexDirection: "column",
          alignSelf: "stretch",
          overflow: "hidden",
        }}
      >
        <Box
          sx={(theme) => ({
            flex: 1,
            p: "6px 4px 4px 6px",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1.35,
            color: alpha(theme.palette.common.white, 0.92),
            wordBreak: "break-word",
            overflowWrap: "break-word",
            overflow: "hidden",
            letterSpacing: "0.01em",
            textTransform: "uppercase",
          })}
        >
          {section.label}
        </Box>
        <Box sx={{ display: "flex", justifyContent: "center", gap: 0.25, pb: 0.5, flexShrink: 0 }}>
          <IconButton
            size="small"
            aria-label={`Edit ${section.label}`}
            sx={bandActionSx}
            onClick={() => onEditSection(section.id)}
          >
            <PencilIcon size={10} />
          </IconButton>
          <IconButton
            size="small"
            aria-label={`Delete ${section.label}`}
            sx={(theme) => ({ ...bandActionSx(theme), fontSize: 13 })}
            onClick={() => onDeleteSection(section.id)}
          >
            ×
          </IconButton>
        </Box>
      </Box>

      {/* Session body */}
      <Box
        sx={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          bgcolor: alpha(color, 0.06),
          borderLeft: `1px solid ${alpha(color, 0.15)}`,
        }}
      >
        {sectionSessions.map((item) => {
          const { topPx, heightPx, isCompact } = sectionCardBox(item, section);
          const itemColor = itemColorHex(item, section, track, scheme);
          return (
            <BoardCard
              key={item.id}
              item={item}
              activeDay={activeDay}
              isCompact={isCompact}
              showKind={isKeynote}
              articleLinksEnabled={articleLinksEnabled}
              videoLinksEnabled={videoLinksEnabled}
              handlers={handlers}
              sx={{
                position: "absolute",
                left: 3,
                right: 3,
                zIndex: 3,
                // A keynote card is tinted with its colour; a track card sits
                // on the paper with a coloured outline.
                bgcolor: isKeynote ? alpha(itemColor, 0.1) : "background.paper",
                border: `1px solid ${itemColor}`,
              }}
              style={{ top: `${topPx + 2}px`, height: `${heightPx - 4}px` }}
            />
          );
        })}
      </Box>
    </Box>
  );
}

export default function AgendaBoard({
  tracks,
  tracksLoading,
  sessionsLoading,
  isBusy,
  slots,
  slotCount,
  sessions,
  placed,
  sections,
  keynoteSections,
  activeDay,
  overCell,
  isCellHighlighted,
  onDragStart,
  onDragEnd,
  setOverCell,
  place,
  onEdit,
  onRemove,
  onEditTrack,
  onDeleteTrack,
  onAddSection,
  onEditSection,
  onDeleteSection,
  articleLinksEnabled,
  videoLinksEnabled,
  wasDragging,
  footnotes,
  onAddFootnote,
  onEditFootnote,
  onDeleteFootnote,
  footnotesPending,
}: AgendaBoardProps) {
  const scheme = useColorSchemeMode();
  const [sectionMenu, setSectionMenu] = useState<{ anchorEl: HTMLElement; trackId: string } | null>(null);
  const handlers: CardHandlers = { onDragStart, onDragEnd, onEdit, onRemove, wasDragging };
  const cardLinks = { articleLinksEnabled, videoLinksEnabled };

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "auto",
        overscrollBehavior: "none",
        border: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
        borderRadius: 2,
        cursor: isBusy ? "progress" : undefined,
      }}
    >
      {activeDay && tracksLoading && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 6 }}>
          <CircularProgress size={32} />
        </Box>
      )}
      {activeDay && !tracksLoading && tracks.length === 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            p: 6,
            color: "text.secondary",
          }}
        >
          <Typography variant="body2">No tracks yet</Typography>
          <Typography variant="caption">Use the &ldquo;+ Track&rdquo; button above to add one</Typography>
        </Box>
      )}
      {activeDay && tracks.length > 0 && (
        <Box
          sx={(theme) => {
            // A faint rule every slot, derived from the divider so it stays
            // visible in both schemes.
            const gridline = alpha(theme.palette.divider, 0.06);
            return {
              display: "grid",
              pointerEvents: isBusy ? "none" : undefined,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent 13px, ${gridline} 13px, ${gridline} 14px)`,
            };
          }}
          style={boardGridTemplate(tracks.length, slotCount)}
        >
          {/* Corner cell */}
          <Box
            sx={{
              position: "sticky",
              top: 0,
              left: 0,
              zIndex: 20,
              bgcolor: "background.paper",
              borderRight: 1,
              borderBottom: 2,
              borderColor: "divider",
            }}
            style={{ gridColumn: 1, gridRow: 1 }}
          />

          {/* Track headers */}
          {tracks.map((track, ti) => (
            <Box
              key={track.id}
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                bgcolor: "background.paper",
                fontWeight: 600,
                color: "text.primary",
                px: 1.5,
                py: 1.25,
                borderBottom: "3px solid",
                borderRight: 1,
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
              }}
              style={{
                gridColumn: trackColumn(ti),
                gridRow: 1,
                borderBottomColor: trackColorHex(track, scheme),
              }}
            >
              <Box
                component="span"
                sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {track.room?.name ?? "No room"}
              </Box>
              {sessionsLoading && <CircularProgress size={14} sx={{ flexShrink: 0 }} />}
              <IconButton
                size="small"
                aria-label={`Edit ${trackLabel(track)}`}
                onClick={() => onEditTrack(track.id)}
                sx={{ flexShrink: 0 }}
              >
                <PencilIcon size={13} />
              </IconButton>
              <Button
                size="small"
                variant="text"
                onClick={(e) => setSectionMenu({ anchorEl: e.currentTarget, trackId: track.id })}
                sx={{ fontSize: 10, py: 0.25, px: 0.75, minWidth: 0, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                + Section
              </Button>
              {tracks.length > 1 && (
                <IconButton
                  size="small"
                  aria-label={`Delete ${trackLabel(track)}`}
                  onClick={() => onDeleteTrack(track.id)}
                  sx={{ flexShrink: 0 }}
                >
                  ×
                </IconButton>
              )}
            </Box>
          ))}

          {/* Time labels */}
          {timeLabelSlots(slotCount).map((slot) => (
            <Box
              key={`time-${slot}`}
              sx={{
                position: "sticky",
                left: 0,
                zIndex: 5,
                bgcolor: "background.paper",
                fontSize: 12,
                color: "text.secondary",
                px: 1,
                pt: 0.5,
                borderRight: 1,
                borderRightColor: "divider",
                borderBottom: "1px solid",
                borderBottomColor: "divider",
                "&:hover .footnote-add": { opacity: 1 },
              }}
              style={{ gridColumn: 1, gridRow: `${slotRow(slot)} / span ${TIME_LABEL_EVERY}` }}
            >
              {slotLabel(slot, activeDay.startMinute)}
              <TimeslotFootnotes
                slot={slot}
                footnotes={footnotes.filter((f) => f.slotIndex === slot)}
                isPending={footnotesPending}
                onAdd={onAddFootnote}
                onUpdate={onEditFootnote}
                onDelete={onDeleteFootnote}
              />
            </Box>
          ))}

          {/* Track background columns — one per track, full height. A drop that
              misses every cell lands at the top of the track. */}
          {tracks.map((track, ti) => (
            <Box
              key={`${track.id}-bg`}
              sx={{ borderRight: 1, borderColor: "divider", zIndex: 0 }}
              style={{ gridColumn: trackColumn(ti), gridRow: `2 / span ${slotCount}` }}
              onDragOver={(e) => {
                allowDrop(e);
                if (overCell?.trackId !== track.id || overCell?.sectionId) {
                  setOverCell({ trackId: track.id, slot: 0 });
                }
              }}
              onDrop={(e) => {
                onDragEnd();
                place(e.dataTransfer.getData("text/plain"), track.id, 0, undefined);
              }}
            />
          ))}

          {/* Per-slot drop cells for precise placement and the highlight */}
          {slots.map((slot) =>
            tracks.map((track, ti) => {
              const highlighted = isCellHighlighted(track.id, slot);
              return (
                <Box
                  key={`${track.id}:${slot}`}
                  sx={{
                    zIndex: 1,
                    p: 0.375,
                    ...(highlighted
                      ? { bgcolor: "action.selected", outline: "2px solid", outlineColor: "primary.main" }
                      : {}),
                  }}
                  style={{ gridColumn: trackColumn(ti), gridRow: slotRow(slot) }}
                  onDragOver={(e) => {
                    allowDrop(e);
                    if (overCell?.trackId !== track.id || overCell?.slot !== slot || overCell?.sectionId) {
                      setOverCell({ trackId: track.id, slot });
                    }
                  }}
                  onDrop={(e) => {
                    onDragEnd();
                    place(e.dataTransfer.getData("text/plain"), track.id, slot, undefined);
                  }}
                />
              );
            }),
          )}

          {/* Track sections */}
          {tracks.map((track, ti) =>
            sections
              .filter((s) => s.trackId === track.id)
              .map((section) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  track={track}
                  gridColumn={String(trackColumn(ti))}
                  scheme={scheme}
                  sessions={sessions}
                  placed={placed}
                  activeDay={activeDay}
                  overCell={overCell}
                  setOverCell={setOverCell}
                  hoverTrackId={track.id}
                  dropTrackId={track.id}
                  place={place}
                  onEditSection={onEditSection}
                  onDeleteSection={onDeleteSection}
                  handlers={handlers}
                  {...cardLinks}
                />
              )),
          )}

          {/* Keynote sections — full width, spanning every track */}
          {keynoteSections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              track={null}
              gridColumn={`2 / span ${tracks.length}`}
              scheme={scheme}
              sessions={sessions}
              placed={placed}
              activeDay={activeDay}
              overCell={overCell}
              setOverCell={setOverCell}
              hoverTrackId={tracks[0]?.id ?? ""}
              dropTrackId={null}
              place={place}
              onEditSection={onEditSection}
              onDeleteSection={onDeleteSection}
              handlers={handlers}
              {...cardLinks}
            />
          ))}

          {/* Free items (keynotes, breaks, activities, and anything outside a
              section) — direct grid children */}
          {placed
            .filter((item) => !item.sectionId)
            .map((item) => {
              const layout = freeCardLayout(item, tracks, slotCount);
              if (!layout) return null;
              const { isFullWidth, track, slotStart } = layout;

              // A keynote is tinted with its room's colour; a break or an
              // activity is a neutral dashed bar; a track item is outlined in
              // its track's colour.
              const cardSx =
                item.kind === "keynote"
                  ? {
                      bgcolor: alpha(itemColorHex(item, null, null, scheme), 0.1),
                      border: `1px solid ${itemColorHex(item, null, null, scheme)}`,
                    }
                  : isFullWidth
                    ? { bgcolor: "action.hover", border: "1px dashed", borderColor: "divider" }
                    : {
                        backgroundColor: "background.paper",
                        border: "1px solid",
                        borderColor: itemColorHex(item, null, track, scheme),
                      };

              return (
                <BoardCard
                  key={item.id}
                  item={item}
                  activeDay={activeDay}
                  isCompact={layout.isCompact}
                  showKind={isFullWidth}
                  handlers={handlers}
                  {...cardLinks}
                  sx={{
                    boxSizing: "border-box",
                    position: "relative",
                    height: "calc(100% - 6px)",
                    mx: 0.375,
                    my: 0.375,
                    zIndex: 1,
                    ...cardSx,
                  }}
                  style={{ gridColumn: layout.gridColumn, gridRow: layout.gridRow }}
                  // Dropping onto a placed card targets its start slot, which
                  // the overlap check then refuses unless it is the same card.
                  onDragOver={(e) => {
                    allowDrop(e);
                    const trackId = isFullWidth ? tracks[0].id : track!.id;
                    if (
                      (!isFullWidth && overCell?.trackId !== trackId) ||
                      overCell?.slot !== slotStart ||
                      overCell?.sectionId
                    ) {
                      setOverCell({ trackId, slot: slotStart });
                    }
                  }}
                  onDrop={(e) => {
                    onDragEnd();
                    place(
                      e.dataTransfer.getData("text/plain"),
                      isFullWidth ? null : track!.id,
                      slotStart,
                      undefined,
                    );
                  }}
                />
              );
            })}
        </Box>
      )}

      {/* Which kind of section "+ Section" adds */}
      <Menu
        anchorEl={sectionMenu?.anchorEl ?? null}
        open={Boolean(sectionMenu)}
        onClose={() => setSectionMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <MenuItem
          onClick={() => {
            if (sectionMenu) onAddSection(sectionMenu.trackId, "track");
            setSectionMenu(null);
          }}
        >
          Track section
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (sectionMenu) onAddSection(sectionMenu.trackId, "keynote");
            setSectionMenu(null);
          }}
        >
          Keynote section
        </MenuItem>
      </Menu>
    </Box>
  );
}
