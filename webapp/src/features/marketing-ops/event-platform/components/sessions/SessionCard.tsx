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

// What a session card on the agenda board shows, and the tooltip a card too
// short for text shows instead. The card's frame (position, border, drag) is
// the board's; this is only its content.

import type { MouseEvent } from "react";
import { Box, IconButton } from "@wso2/oxygen-ui";
import { X as XIcon } from "@wso2/oxygen-ui-icons-react";
import RichText from "@features/marketing-ops/event-platform/components/RichText";
import { useColorSchemeMode } from "@features/marketing-ops/event-platform/hooks/useColorSchemeMode";
import type {
  ConferenceDay,
  Session,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  ITEM_KIND_LABELS,
  cardTimeLabel,
  hasPresenterDetail,
  itemColorHex,
} from "@features/marketing-ops/event-platform/utils/agenda";
import { isHttpUrl } from "./itemForm";

function SessionLink({ href, label }: { href: string; label: string }) {
  return (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{ fontSize: 10, color: "primary.main" }}
      // The card opens its preview on click; a link inside it must not.
      onClick={(e: MouseEvent) => e.stopPropagation()}
    >
      {label}
    </Box>
  );
}

// Revealed by the card's own `&:hover .chip-remove` rule, so it stays out of
// the way until the pointer is on the card.
export function ChipRemoveButton({
  onClick,
}: {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <IconButton
      className="chip-remove"
      size="small"
      aria-label="Move back to Unscheduled"
      sx={{
        opacity: 0,
        transition: "opacity 0.15s",
        width: 16,
        height: 16,
        padding: 0,
        flexShrink: 0,
        color: "text.secondary",
        "&:hover": { color: "text.primary", bgcolor: "transparent" },
        "&:focus-visible": { opacity: 1 },
      }}
      onClick={onClick}
    >
      <XIcon size={10} />
    </IconButton>
  );
}

export function CardTooltipContent({
  item,
  activeDay,
  showKind,
}: {
  item: Session;
  activeDay: ConferenceDay;
  showKind: boolean;
}) {
  return (
    <Box sx={{ lineHeight: 1.5 }}>
      <Box sx={{ fontWeight: 600 }}>
        <RichText html={item.title} component="span" variant="inline" />
      </Box>
      <Box sx={{ opacity: 0.8, fontSize: 11 }}>{cardTimeLabel(item, activeDay)}</Box>
      {item.speakers.length > 0 && (
        <Box sx={{ opacity: 0.8, fontSize: 11 }}>
          {item.speakers.map((ss) => ss.speaker.name).join(", ")}
        </Box>
      )}
      {item.room && <Box sx={{ opacity: 0.8, fontSize: 11 }}>{item.room.name}</Box>}
      {showKind && (
        <Box sx={{ opacity: 0.8, fontSize: 10 }}>{ITEM_KIND_LABELS[item.kind]} · all tracks</Box>
      )}
    </Box>
  );
}

export function SessionCardBody({
  item,
  activeDay,
  isCompact,
  showKind,
  articleLinksEnabled,
  videoLinksEnabled,
  onRemove,
}: {
  item: Session;
  activeDay: ConferenceDay;
  isCompact: boolean;
  showKind: boolean;
  articleLinksEnabled: boolean;
  videoLinksEnabled: boolean;
  onRemove: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const scheme = useColorSchemeMode();

  if (isCompact) {
    return (
      <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <ChipRemoveButton onClick={onRemove} />
      </Box>
    );
  }

  // Breaks and activities are full-width bars that belong to no track and no
  // room, so there is no token to resolve for them and they stay neutral.
  // Keynotes resolve through their own room, like any other item.
  const kindAccent =
    item.kind === "break" || item.kind === "activity"
      ? "text.secondary"
      : itemColorHex(item, null, null, scheme);
  const presenter = hasPresenterDetail(item.kind);

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0.5 }}>
        <Box component="span" sx={{ fontSize: 10, color: "text.secondary" }}>
          {cardTimeLabel(item, activeDay)}
        </Box>
        <ChipRemoveButton onClick={onRemove} />
      </Box>
      <Box component="strong" sx={{ fontSize: 13, color: "text.primary", lineHeight: 1.2 }}>
        <RichText html={item.title} component="span" variant="inline" />
      </Box>
      {presenter && item.speakers.length > 0 && (
        <Box
          component="span"
          sx={{
            fontSize: 11,
            color: "text.secondary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.speakers.map((ss) => ss.speaker.name).join(", ")}
        </Box>
      )}
      {presenter && item.room && (
        <Box component="span" sx={{ fontSize: 11, color: "text.secondary" }}>
          {item.room.name}
        </Box>
      )}
      {presenter && articleLinksEnabled && item.articleUrl && isHttpUrl(item.articleUrl) && (
        <SessionLink href={item.articleUrl} label={item.articleLabel ?? "Article"} />
      )}
      {presenter && videoLinksEnabled && item.videoUrl && isHttpUrl(item.videoUrl) && (
        <SessionLink href={item.videoUrl} label={item.videoLabel ?? "Video"} />
      )}
      {showKind && (
        <Box component="span" sx={{ fontSize: 10, fontWeight: 600, color: kindAccent }}>
          {ITEM_KIND_LABELS[item.kind]} · all tracks
        </Box>
      )}
    </>
  );
}
