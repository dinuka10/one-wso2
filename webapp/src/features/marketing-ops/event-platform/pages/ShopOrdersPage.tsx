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
import { useParams } from "react-router";
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  DatePickers,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Paper,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { EyeIcon, FilterIcon, SearchIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useNotifyFailure } from "../api/base";
import { useListShopOrders, useUpdateShopOrderStatus } from "../api/shopOrders";
import DatePickerProvider from "../components/DatePickerProvider";
import { PICKER_SLOT_PROPS } from "../components/pickerSlotProps";
import ShopOrderDrawer from "../components/shop/ShopOrderDrawer";
import {
  DEFAULT_ORDER_FILTERS,
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_INFO,
  activeOrderFilterCount,
  bulkFulfillTargets,
  clampPage,
  filterShopOrders,
  formatOrderDate,
  isBulkFulfillable,
  numberOrEmpty,
  orderDateBounds,
  pageOf,
  pageSelectionState,
  runInOrder,
  selectPage,
  shortOrderId,
  sliderMax,
  toggleId,
  type OrderFilters,
} from "../utils/shop";

const { DateTimePicker } = DatePickers;

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

/**
 * `events/:eventId/shop/orders` — every order placed at one event's shop.
 *
 * Open to admins and shop operators with the same actions for both, as in the
 * source; the route guard decides who reaches it. Each order carries the
 * buyer's email and address, so this page shows them and does nothing else
 * with them — no logging, and no order field in a toast or an error.
 */
export default function ShopOrdersPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const ordersQuery = useListShopOrders(eventId);
  const updateStatus = useUpdateShopOrderStatus(eventId);
  const { showSuccess } = useNotifications();
  const notifyFailure = useNotifyFailure();

  const orders = ordersQuery.data ?? [];

  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_ORDER_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Read from the cache on every render, so the drawer follows a status change.
  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;

  const visible = filterShopOrders(orders, search, filters);
  // Only still-confirmed orders on screen count as picked: one fulfilled from
  // the drawer after it was ticked drops out rather than being sent again, and
  // one the filters or search hide is not fulfilled unseen.
  const picked = bulkFulfillTargets(visible, selected);
  const filterCount = activeOrderFilterCount(filters);
  const currentPage = clampPage(page, visible.length, rowsPerPage);
  const paged = pageOf(visible, currentPage, rowsPerPage);
  const selectableIds = paged.filter(isBulkFulfillable).map((o) => o.id);
  const headerState = pageSelectionState(picked, selectableIds);
  const amountMax = sliderMax(orders.map((o) => o.totalCoinsAmount));
  const dateBounds = orderDateBounds(orders);
  const statusInfo = filters.status === "ALL" ? null : ORDER_STATUS_INFO[filters.status];

  function changeFilters(patch: Partial<OrderFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  }

  function askBulkFulfil() {
    const ids = picked;
    setConfirm({
      title: "Fulfil selected orders",
      text: `Mark ${ids.length} order${ids.length === 1 ? "" : "s"} as fulfilled? This can't be undone.`,
      confirmAction: () => void bulkFulfil(ids),
    });
  }

  // One request per order — there is no bulk endpoint. Sequential, as in the
  // source, so a failure stops where it is; the orders already done stay done
  // (the hook patches each into the cache as it succeeds).
  async function bulkFulfil(ids: string[]) {
    setBulkBusy(true);
    try {
      const { done, ...run } = await runInOrder(ids, (id) => updateStatus.mutateAsync({ id, status: "FULFILLED" }));
      if ("error" in run) {
        notifyFailure(`Fulfilled ${done} of ${ids.length} orders, then stopped.`, run.error);
        return;
      }
      showSuccess(`${done} order${done === 1 ? "" : "s"} marked as fulfilled.`);
      setSelected([]);
    } finally {
      setBulkBusy(false);
    }
  }

  if (ordersQuery.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (ordersQuery.isError) {
    return (
      <ErrorNotice
        error={ordersQuery.error}
        onRetry={() => void ordersQuery.refetch()}
        retrying={ordersQuery.isFetching}
      >
        Couldn't load the orders.
      </ErrorNotice>
    );
  }
  if (orders.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ textAlign: "center", mt: 8 }}>
        No orders have been placed yet.
      </Typography>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1, mb: 2, overflowX: "auto", pb: 0.5 }} role="group" aria-label="Order status">
        {ORDER_STATUS_FILTERS.map((status) => (
          <Button
            key={status}
            size="small"
            variant={filters.status === status ? "contained" : "outlined"}
            aria-pressed={filters.status === status}
            onClick={() => changeFilters({ status })}
            sx={{ flexShrink: 0 }}
          >
            {status === "ALL" ? "All" : ORDER_STATUS_INFO[status].label}
          </Button>
        ))}
      </Box>

      <Alert severity={statusInfo?.color ?? "info"} sx={{ mb: 2 }}>
        {statusInfo?.description ?? "Showing every order, whatever its status."}
      </Alert>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2, alignItems: { md: "center" } }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by order ID, email or name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    edge="end"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearch("");
                      setPage(0);
                    }}
                  >
                    <XIcon size={16} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: "center" }}>
          <Badge badgeContent={filterCount} color="primary">
            <Button
              variant="outlined"
              startIcon={<FilterIcon size={16} />}
              onClick={() => setDrawerOpen(true)}
              sx={{ whiteSpace: "nowrap" }}
            >
              Filters
            </Button>
          </Badge>
          {picked.length > 0 && (
            <Button
              variant="contained"
              color="info"
              disabled={bulkBusy}
              onClick={askBulkFulfil}
              sx={{ whiteSpace: "nowrap" }}
            >
              {bulkBusy ? <CircularProgress size={20} color="inherit" /> : `Mark as fulfilled (${picked.length})`}
            </Button>
          )}
        </Stack>
      </Stack>

      {filterCount > 0 && <ActiveFilterChips filters={filters} onChange={changeFilters} />}

      {visible.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 8 }}>
          No orders match your search.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={headerState.some}
                    checked={headerState.all}
                    disabled={selectableIds.length === 0}
                    onChange={(e) => setSelected(selectPage(picked, selectableIds, e.target.checked))}
                    slotProps={{ input: { "aria-label": "Select every confirmed order on this page" } }}
                  />
                </TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Placed</TableCell>
                <TableCell align="right">Total (O2C)</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((order) => {
                const selectable = isBulkFulfillable(order);
                const isSelected = picked.includes(order.id);
                const info = ORDER_STATUS_INFO[order.status];
                return (
                  <TableRow key={order.id} hover selected={isSelected}>
                    <TableCell padding="checkbox">
                      {/* Only confirmed orders may be bulk-fulfilled; the rest
                          still show a box so the column lines up. */}
                      <Checkbox
                        checked={isSelected}
                        disabled={!selectable}
                        onChange={() => setSelected(toggleId(picked, order.id))}
                        slotProps={{ input: { "aria-label": `Select order ${shortOrderId(order.id)}` } }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>
                      <Tooltip title={order.id} arrow>
                        <span>{shortOrderId(order.id)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={order.shippingEmail} arrow>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                          {order.shippingEmail}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatOrderDate(order.createdOn)}</TableCell>
                    <TableCell align="right">{order.totalCoinsAmount}</TableCell>
                    <TableCell align="center">
                      <Chip label={info.label} size="small" color={info.color} />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View order" arrow>
                        <IconButton
                          size="small"
                          aria-label={`View order ${shortOrderId(order.id)}`}
                          onClick={() => setOpenOrderId(order.id)}
                        >
                          <EyeIcon size={16} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            count={visible.length}
            rowsPerPage={rowsPerPage}
            page={currentPage}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>
      )}

      <OrderFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onChange={changeFilters}
        amountMax={amountMax}
        minDate={dateBounds.min}
        maxDate={dateBounds.max}
      />

      <ShopOrderDrawer eventId={eventId} order={openOrder} onClose={() => setOpenOrderId(null)} />

      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}

function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: OrderFilters;
  onChange: (patch: Partial<OrderFilters>) => void;
}) {
  return (
    <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
      <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5, fontWeight: 500 }}>
        Active filters:
      </Typography>
      {(filters.minAmount !== "" || filters.maxAmount !== "") && (
        <Chip
          size="small"
          label={`Amount: ${filters.minAmount === "" ? 0 : filters.minAmount} – ${
            filters.maxAmount === "" ? "max" : filters.maxAmount
          }`}
          onDelete={() => onChange({ minAmount: "", maxAmount: "" })}
        />
      )}
      {filters.from && (
        <Chip
          size="small"
          label={`From: ${formatOrderDate(filters.from.toISOString())}`}
          onDelete={() => onChange({ from: null })}
        />
      )}
      {filters.to && (
        <Chip
          size="small"
          label={`To: ${formatOrderDate(filters.to.toISOString())}`}
          onDelete={() => onChange({ to: null })}
        />
      )}
      <Button
        size="small"
        onClick={() => onChange({ minAmount: "", maxAmount: "", from: null, to: null })}
      >
        Clear all
      </Button>
    </Box>
  );
}

function OrderFilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  amountMax,
  minDate,
  maxDate,
}: {
  open: boolean;
  onClose: () => void;
  filters: OrderFilters;
  onChange: (patch: Partial<OrderFilters>) => void;
  amountMax: number;
  minDate?: Date;
  maxDate?: Date;
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 340 }, p: 3, bgcolor: "background.paper" } } }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Filters
        </Typography>
        <IconButton size="small" aria-label="Close filters" onClick={onClose}>
          <XIcon size={20} />
        </IconButton>
      </Box>

      <Box sx={{ overflowY: "auto" }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
          Total amount
        </Typography>
        <Box sx={{ px: 1.5, mt: 1 }}>
          <Slider
            value={[
              filters.minAmount === "" ? 0 : filters.minAmount,
              filters.maxAmount === "" ? amountMax : filters.maxAmount,
            ]}
            onChange={(_, v) => {
              const [min, max] = v as number[];
              // The slider's ends mean "no bound" rather than today's extremes.
              onChange({ minAmount: min === 0 ? "" : min, maxAmount: max === amountMax ? "" : max });
            }}
            valueLabelDisplay="auto"
            min={0}
            max={amountMax}
            getAriaLabel={(i) => (i === 0 ? "Minimum amount" : "Maximum amount")}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          <TextField
            size="small"
            type="number"
            placeholder="Min"
            value={filters.minAmount}
            onChange={(e) => onChange({ minAmount: numberOrEmpty(e.target.value) })}
            slotProps={{ htmlInput: { "aria-label": "Minimum amount", min: 0 } }}
          />
          <TextField
            size="small"
            type="number"
            placeholder="Max"
            value={filters.maxAmount}
            onChange={(e) => onChange({ maxAmount: numberOrEmpty(e.target.value) })}
            slotProps={{ htmlInput: { "aria-label": "Maximum amount", min: 0 } }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
          Placed between
        </Typography>
        <DatePickerProvider>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2 }}>
            <DateTimePicker
              label="From"
              value={filters.from}
              // A half-typed date is an Invalid Date; wait until it parses.
              onChange={(d: Date | null) => {
                if (d === null || !Number.isNaN(d.getTime())) onChange({ from: d });
              }}
              minDateTime={minDate}
              maxDateTime={filters.to ?? maxDate}
              slotProps={PICKER_SLOT_PROPS}
            />
            <DateTimePicker
              label="To"
              value={filters.to}
              onChange={(d: Date | null) => {
                if (d === null || !Number.isNaN(d.getTime())) onChange({ to: d });
              }}
              minDateTime={filters.from ?? minDate}
              maxDateTime={maxDate}
              slotProps={PICKER_SLOT_PROPS}
            />
          </Box>
        </DatePickerProvider>

        {activeOrderFilterCount(filters) > 0 && (
          <Button
            fullWidth
            variant="outlined"
            sx={{ mt: 2 }}
            onClick={() => onChange({ minAmount: "", maxAmount: "", from: null, to: null })}
          >
            Clear all filters
          </Button>
        )}
      </Box>
    </Drawer>
  );
}
