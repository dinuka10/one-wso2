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

import { useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { InfoIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useNotifyFailure } from "../../api/base";
import { useUpdateShopOrderStatus } from "../../api/shopOrders";
import type { ShopOrder, ShopOrderStatus } from "../../types/eventPlatformTypes";
import {
  ORDER_STATUS_INFO,
  formatOrderDate,
  joinAddressParts,
  lineTotal,
  nextOrderStatuses,
} from "../../utils/shop";

// How each hand transition's button looks — the source's colours and order.
const TRANSITION_BUTTON: Partial<
  Record<ShopOrderStatus, { label: string; color: "success" | "error" | "info"; variant: "contained" | "outlined" }>
> = {
  CONFIRMED: { label: "Mark as confirmed", color: "success", variant: "contained" },
  EXPIRED: { label: "Mark as expired", color: "error", variant: "outlined" },
  FULFILLED: { label: "Mark as fulfilled", color: "info", variant: "contained" },
};

// What a hand change skips. The status is recorded as given: this screen does
// not look for the payment on the blockchain, so the operator is told so.
const HAND_CHANGE_NOTE: Partial<Record<ShopOrderStatus, string>> = {
  CONFIRMED: "This does not check the blockchain for the payment — confirm only an order you know was paid.",
  EXPIRED: "A payment still in flight may yet complete — expire only an order you know won't be paid.",
};

interface Props {
  eventId: string;
  /** The order to show; null keeps the drawer closed. */
  order: ShopOrder | null;
  onClose: () => void;
}

/**
 * One order in full: the buyer, where it ships, what is in it, and the status
 * changes an operator may make by hand.
 *
 * The status change sends `{status}` and gets an empty 200 back. The source
 * also sent a transaction hash; the backend takes none, so there is no hash
 * to enter or show.
 */
export default function ShopOrderDrawer({ eventId, order, onClose }: Props) {
  const updateStatus = useUpdateShopOrderStatus(eventId);
  const { showSuccess } = useNotifications();
  const notifyFailure = useNotifyFailure();
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);

  if (!order) return null;
  const info = ORDER_STATUS_INFO[order.status];

  function askStatus(id: string, status: ShopOrderStatus) {
    const label = ORDER_STATUS_INFO[status].label.toLowerCase();
    setConfirm({
      title: "Change the order's status",
      text: [`Mark this order as ${label}?`, HAND_CHANGE_NOTE[status], "This can't be undone."]
        .filter(Boolean)
        .join(" "),
      confirmAction: () =>
        updateStatus.mutate(
          { id, status },
          {
            // The message names the status only: an order's fields are the
            // buyer's, and toasts are screenshotted.
            onSuccess: () => showSuccess(`Order marked as ${label}.`),
            onError: (err) => notifyFailure("Couldn't update the order.", err),
          },
        ),
    });
  }

  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { width: { xs: "100%", sm: 400 }, p: 3, display: "flex", flexDirection: "column", bgcolor: "background.paper" },
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Order details
        </Typography>
        <IconButton size="small" aria-label="Close" onClick={onClose}>
          <XIcon size={18} />
        </IconButton>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 3 }}>
        <Detail label="ID">
          <Box component="span" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
            {order.id}
          </Box>
        </Detail>
        <Detail label="Email">{order.shippingEmail}</Detail>
        <Detail label="Placed">{formatOrderDate(order.createdOn)}</Detail>
        <Detail label="Total">{order.totalCoinsAmount} O2C</Detail>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Status:
          </Typography>
          <Chip label={info.label} size="small" color={info.color} />
          <Tooltip title={info.description}>
            <Box sx={{ display: "flex", color: "text.secondary", cursor: "help" }} aria-label={info.description}>
              <InfoIcon size={16} />
            </Box>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <SectionLabel>Shipping</SectionLabel>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 3 }}>
        <Detail label="Name">{order.shippingRecipientName}</Detail>
        <Typography variant="body2" component="div">
          <Box component="span" sx={{ fontWeight: 600 }}>
            Address:
          </Box>
          <Box sx={{ mt: 0.25 }}>
            {[
              order.shippingAddressLine1,
              order.shippingAddressLine2,
              joinAddressParts(order.shippingCity, order.shippingState, order.shippingPostalCode),
              order.shippingCountry,
            ]
              .filter((line) => line && line.trim())
              .map((line, i) => (
                <Box key={i}>{line}</Box>
              ))}
          </Box>
        </Typography>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <SectionLabel>Items ({order.items.length})</SectionLabel>
      <List disablePadding>
        {order.items.map((item, i) => (
          <ListItem
            // An order can list one item twice at different prices, so the
            // item id alone is not a key.
            key={`${item.itemId}-${i}`}
            disableGutters
            sx={{
              mb: 1.5,
              p: 1.5,
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {item.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.priceAtPurchase} O2C each
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right", flexShrink: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                ×{item.quantity}
              </Typography>
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
                {lineTotal(item)} O2C
              </Typography>
            </Box>
          </ListItem>
        ))}
      </List>

      <Box sx={{ mt: "auto", pt: 3, display: "flex", flexDirection: "column", gap: 1 }}>
        {nextOrderStatuses(order.status).map((status) => {
          const button = TRANSITION_BUTTON[status];
          if (!button) return null;
          return (
            <Button
              key={status}
              fullWidth
              variant={button.variant}
              color={button.color}
              disabled={updateStatus.isPending}
              onClick={() => askStatus(order.id, status)}
            >
              {button.label}
            </Button>
          );
        })}
        {updateStatus.isPending && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
            <CircularProgress size={20} />
          </Box>
        )}
      </Box>

      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
    </Drawer>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Typography variant="body2">
      <Box component="span" sx={{ fontWeight: 600 }}>
        {label}:
      </Box>{" "}
      {children}
    </Typography>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}
    >
      {children}
    </Typography>
  );
}
