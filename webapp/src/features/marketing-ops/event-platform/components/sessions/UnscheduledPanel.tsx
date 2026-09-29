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

// The palette: this event's unscheduled items, dragged from here onto the
// board. It is also a drop target — dropping a placed card here unschedules it.

import type { DragEvent, MouseEvent, RefObject } from "react";
import { Box, Button, IconButton, Typography } from "@wso2/oxygen-ui";
import { Trash2 as TrashIcon } from "@wso2/oxygen-ui-icons-react";
import RichText from "@features/marketing-ops/event-platform/components/RichText";
import { useColorSchemeMode } from "@features/marketing-ops/event-platform/hooks/useColorSchemeMode";
import type { Session } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import { ITEM_KIND_LABELS, itemColorHex } from "@features/marketing-ops/event-platform/utils/agenda";
import { allowDrop } from "@features/marketing-ops/event-platform/utils/drag";

interface UnscheduledPanelProps {
  palette: Session[];
  onAdd: () => void;
  onImportCsv: () => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragEnd: () => void;
  onUnplace: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClearOverCell: () => void;
  wasDragging: RefObject<boolean>;
}

export default function UnscheduledPanel({
  palette,
  onAdd,
  onImportCsv,
  onDragStart,
  onDragEnd,
  onUnplace,
  onEdit,
  onDelete,
  onClearOverCell,
  wasDragging,
}: UnscheduledPanelProps) {
  const scheme = useColorSchemeMode();

  return (
    <Box
      component="aside"
      aria-label="Unscheduled items"
      sx={{
        flex: "none",
        width: 240,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        backgroundColor: "background.paper",
        p: 1.75,
        overflow: "auto",
      }}
      onDragOver={(e) => {
        allowDrop(e);
        // Over the palette, no board cell should stay lit.
        onClearOverCell();
      }}
      onDrop={(e) => onUnplace(e.dataTransfer.getData("text/plain"))}
    >
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Unscheduled
      </Typography>
      <Box sx={{ display: "flex", gap: 1, mb: 1.75 }}>
        <Button size="small" variant="outlined" fullWidth onClick={onAdd}>
          + Add
        </Button>
        <Button size="small" variant="outlined" fullWidth onClick={onImportCsv}>
          Import CSV
        </Button>
      </Box>
      {palette.map((item) => (
        <Box
          key={item.id}
          sx={{
            border: 1,
            borderColor: "divider",
            borderLeft: "4px solid",
            borderLeftColor:
              item.kind === "keynote" ? itemColorHex(item, null, null, scheme) : "text.primary",
            borderRadius: 1,
            px: 1.25,
            py: 1,
            mb: 1,
            fontSize: 14,
            color: "text.primary",
            cursor: "grab",
            bgcolor: "background.paper",
            display: "flex",
            alignItems: "flex-start",
            gap: 0.5,
            "&:hover .paddock-delete": { opacity: 1 },
          }}
          draggable
          onDragStart={(e) => onDragStart(e, item.id)}
          onDragEnd={onDragEnd}
          onClick={() => {
            if (!wasDragging.current) onEdit(item.id);
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              component="span"
              sx={{
                display: "block",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "text.secondary",
              }}
            >
              {ITEM_KIND_LABELS[item.kind]}
            </Box>
            <RichText html={item.title} component="span" variant="inline" />
          </Box>
          <IconButton
            className="paddock-delete"
            size="small"
            aria-label="Delete session"
            sx={{
              opacity: 0,
              transition: "opacity 0.15s",
              width: 20,
              height: 20,
              padding: 0,
              flexShrink: 0,
              color: "text.secondary",
              "&:hover": { color: "error.main", bgcolor: "transparent" },
              "&:focus-visible": { opacity: 1 },
            }}
            onMouseDown={(e: MouseEvent) => e.stopPropagation()}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <TrashIcon size={12} />
          </IconButton>
        </Box>
      ))}
      <Typography variant="caption" sx={{ display: "block", mt: 1.5, color: "text.secondary", lineHeight: 1.4 }}>
        Drag items onto the board. Drag back here to unschedule.
      </Typography>
    </Box>
  );
}
