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
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControlLabel,
  FormGroup,
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  EyeIcon,
  EyeOffIcon,
  FilterIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "@wso2/oxygen-ui-icons-react";
import { HttpError } from "@api/http";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useNotifyFailure } from "../api/base";
import { useCreateShopItem, useDeleteShopItem, useListShopItems, useUpdateShopItem } from "../api/shop";
import { useListShopOrders } from "../api/shopOrders";
import ShopItemFormDialog from "../components/shop/ShopItemFormDialog";
import type { ShopItem } from "../types/eventPlatformTypes";
import {
  DEFAULT_INVENTORY_FILTERS,
  LIMIT_FILTER_LABELS,
  STOCK_FILTER_LABELS,
  VISIBILITY_FILTER_LABELS,
  activeInventoryFilterCount,
  bulkDeleteTargets,
  bulkVisibilityTargets,
  clampPage,
  filterShopItems,
  hasPurchaseLimit,
  itemCategories,
  keepLiveStock,
  numberOrEmpty,
  pageOf,
  pageSelectionState,
  planBulkDelete,
  purchasedItemIds,
  runBulkDelete,
  runInOrder,
  selectPage,
  sliderMax,
  soldCounts,
  toggleId,
  toggledVisibility,
  visibilityAction,
  withVisibility,
  type BulkRun,
  type InventoryFilters,
  type LimitFilter,
  type ShopItemFields,
  type StockFilter,
  type VisibilityFilter,
} from "../utils/shop";

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

// The backend's answer to deleting an item some order already references.
function isConflict(err: unknown): boolean {
  return err instanceof HttpError && err.status === 409;
}

const VISIBILITY_CHIP: Record<ShopItem["visibility"], { label: string; color: "success" | "default" | "error" }> = {
  VISIBLE: { label: "Visible", color: "success" },
  HIDDEN: { label: "Hidden", color: "default" },
  DELETED: { label: "Deleted", color: "error" },
};

const TOGGLE_WORDING = {
  hide: { label: "Hide", where: "from", done: "hidden" },
  show: { label: "Show", where: "in", done: "visible" },
  restore: { label: "Restore", where: "to", done: "visible" },
} as const;

/**
 * `events/:eventId/shop/inventory` — the items on offer at one event's shop.
 *
 * Open to admins and shop operators alike, with the same actions for both:
 * the source hid nothing on this screen from its shop role, so neither does
 * the port. The route guard is what decides who reaches it.
 */
export default function ShopInventoryPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const itemsQuery = useListShopItems(eventId);
  const { data: orders } = useListShopOrders(eventId);
  const createItem = useCreateShopItem(eventId);
  const updateItem = useUpdateShopItem(eventId);
  const deleteItem = useDeleteShopItem(eventId);
  const { showSuccess } = useNotifications();
  const notifyFailure = useNotifyFailure();

  const items = itemsQuery.data ?? [];

  // Items the backend refused to delete (409) though no loaded order names
  // them — an order placed since the list loaded. Remembered so the next
  // attempt offers "hide instead" straight away.
  const [knownPurchased, setKnownPurchased] = useState<ReadonlySet<string>>(new Set());
  const purchased = new Set([...purchasedItemIds(orders ?? []), ...knownPurchased]);
  const sold = orders ? soldCounts(orders) : null;

  const [dialog, setDialog] = useState<{ open: boolean; item: ShopItem | null }>({ open: false, item: null });
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<InventoryFilters>(DEFAULT_INVENTORY_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const categories = itemCategories(items);
  const priceMax = sliderMax(items.map((i) => i.price));
  const visible = filterShopItems(items, search, filters);
  const filterCount = activeInventoryFilterCount(filters);
  const currentPage = clampPage(page, visible.length, rowsPerPage);
  const paged = pageOf(visible, currentPage, rowsPerPage);
  const pageIds = paged.map((i) => i.id);
  const headerState = pageSelectionState(selected, pageIds);

  // Bulk actions reach only the selected items the filters and search leave on
  // screen, so the count on each button is what the operator can see.
  const toHide = bulkVisibilityTargets(visible, selected, "HIDDEN");
  const toShow = bulkVisibilityTargets(visible, selected, "VISIBLE");
  const toDelete = bulkDeleteTargets(visible, selected);

  // Every filter change starts again from the first page, as in the source.
  function changeFilters(patch: Partial<InventoryFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  }

  // The item as the server has it now. Stock falls as orders come in and an
  // update is a full PUT, so a body built from the cached list would put back
  // whatever sold since it loaded. Undefined if the item has gone.
  async function latest(id: string): Promise<ShopItem | undefined> {
    const { data } = await itemsQuery.refetch({ throwOnError: true });
    return data?.find((i) => i.id === id);
  }

  async function setVisibility(item: ShopItem, visibility: "VISIBLE" | "HIDDEN") {
    await updateItem.mutateAsync(withVisibility((await latest(item.id)) ?? item, visibility));
  }

  function hideInstead(item: ShopItem): ConfirmationContent {
    return {
      title: "Item has orders",
      text: `"${item.name}" has been bought, so it can't be deleted — only hidden from the shop. Hide it instead?`,
      confirmLabel: "Hide",
      confirmAction: () =>
        void setVisibility(item, "HIDDEN").then(
          () => showSuccess(`"${item.name}" is now hidden.`),
          (err) => notifyFailure("Couldn't hide the item.", err),
        ),
    };
  }

  function askDelete(item: ShopItem) {
    if (purchased.has(item.id)) {
      setConfirm(hideInstead(item));
      return;
    }
    setConfirm({
      title: "Delete item",
      text: `Delete "${item.name}"? This can't be undone.`,
      confirmLabel: "Delete",
      confirmAction: () =>
        deleteItem.mutate(item.id, {
          onSuccess: () => showSuccess(`"${item.name}" was deleted.`),
          onError: (err) => {
            if (isConflict(err)) {
              setKnownPurchased((prev) => new Set(prev).add(item.id));
              setConfirm(hideInstead(item));
            } else {
              notifyFailure("Couldn't delete the item.", err);
            }
          },
        }),
    });
  }

  function askToggle(item: ShopItem) {
    const verb = visibilityAction(item);
    const { label, where, done } = TOGGLE_WORDING[verb];
    setConfirm({
      title: `${label} item`,
      text: `${label} "${item.name}" ${where} the shop?`,
      confirmLabel: label,
      confirmAction: () =>
        void setVisibility(item, toggledVisibility(item)).then(
          () => showSuccess(`"${item.name}" is now ${done}.`),
          (err) => notifyFailure("Couldn't change the item's visibility.", err),
        ),
    });
  }

  async function save(fields: ShopItemFields) {
    const editing = dialog.item;
    try {
      if (editing) {
        // Edit is disabled on deleted items, so this is VISIBLE or HIDDEN.
        const visibility = editing.visibility === "VISIBLE" ? "VISIBLE" : "HIDDEN";
        const fresh = keepLiveStock(fields, editing, await latest(editing.id));
        await updateItem.mutateAsync({ id: editing.id, ...fresh, visibility });
      } else {
        await createItem.mutateAsync({ ...fields, visibility: "VISIBLE" });
      }
      setDialog({ open: false, item: null });
      showSuccess(editing ? "Item updated." : "Item added.");
    } catch (err) {
      notifyFailure("Couldn't save the item.", err);
    }
  }

  // One request per item: there is no bulk endpoint. Sequential, like the
  // source, so a failure stops the run where it is instead of racing the rest.
  async function runBulk(label: string, work: () => Promise<BulkRun>, done: (count: number) => string) {
    setBulkBusy(true);
    try {
      const run = await work();
      if ("error" in run) {
        notifyFailure(`Couldn't ${label} every selected item.`, run.error);
        return;
      }
      if (run.done > 0) showSuccess(done(run.done));
      setSelected([]);
    } finally {
      setBulkBusy(false);
    }
  }

  function bulkVisibility(targets: ShopItem[], visibility: "VISIBLE" | "HIDDEN") {
    const verb = visibility === "HIDDEN" ? "hide" : "show";
    setConfirm({
      title: visibility === "HIDDEN" ? "Hide selected items" : "Show selected items",
      text: `${verb === "hide" ? "Hide" : "Show"} ${targets.length} item${targets.length === 1 ? "" : "s"} ${
        verb === "hide" ? "from" : "in"
      } the shop?`,
      confirmLabel: verb === "hide" ? "Hide items" : "Show items",
      confirmAction: () =>
        void runBulk(
          verb,
          () => runInOrder(targets, (item) => setVisibility(item, visibility)),
          (n) => `${n} item${n === 1 ? "" : "s"} ${verb === "hide" ? "hidden" : "shown"}.`,
        ),
    });
  }

  function bulkDelete(targets: ShopItem[]) {
    const count = targets.length;
    setConfirm({
      title: "Delete selected items",
      text: `Delete ${count} item${count === 1 ? "" : "s"}? Items that have been bought are hidden instead.`,
      confirmLabel: "Delete",
      confirmAction: () =>
        void runBulk(
          "delete or hide",
          async () => {
            const run = await runBulkDelete(
              planBulkDelete(targets, selected, purchased),
              {
                remove: (item) => deleteItem.mutateAsync(item.id),
                hide: (item) => setVisibility(item, "HIDDEN"),
                isConflict,
              },
            );
            if (run.conflicted.length > 0) {
              setKnownPurchased((prev) => new Set([...prev, ...run.conflicted]));
            }
            const done = run.deleted + run.hidden;
            return "error" in run ? { done, error: run.error } : { done };
          },
          (n) => `${n} item${n === 1 ? "" : "s"} processed. Items that had been bought were hidden instead.`,
        ),
    });
  }

  if (itemsQuery.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (itemsQuery.isError) {
    return (
      <ErrorNotice
        error={itemsQuery.error}
        onRetry={() => void itemsQuery.refetch()}
        retrying={itemsQuery.isFetching}
      >
        Couldn't load the shop inventory.
      </ErrorNotice>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { md: "center" } }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Search by name or category"
          value={search}
          disabled={items.length === 0}
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
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, flexShrink: 0 }}>
          <Badge badgeContent={filterCount} color="primary">
            <Button
              variant="outlined"
              startIcon={<FilterIcon size={16} />}
              disabled={items.length === 0}
              onClick={() => setDrawerOpen(true)}
              sx={{ whiteSpace: "nowrap" }}
            >
              Filters
            </Button>
          </Badge>
          {selected.length > 0 && (
            <>
              {toHide.length > 0 && (
                <Button
                  variant="outlined"
                  color="warning"
                  disabled={bulkBusy}
                  onClick={() => bulkVisibility(toHide, "HIDDEN")}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Hide ({toHide.length})
                </Button>
              )}
              {toShow.length > 0 && (
                <Button
                  variant="outlined"
                  color="info"
                  disabled={bulkBusy}
                  onClick={() => bulkVisibility(toShow, "VISIBLE")}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Show ({toShow.length})
                </Button>
              )}
              {toDelete.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  disabled={bulkBusy}
                  onClick={() => bulkDelete(toDelete)}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Delete ({toDelete.length})
                </Button>
              )}
              {bulkBusy && <CircularProgress size={20} sx={{ alignSelf: "center" }} />}
            </>
          )}
          <Button
            variant="contained"
            startIcon={<PlusIcon size={16} />}
            onClick={() => setDialog({ open: true, item: null })}
            sx={{ whiteSpace: "nowrap" }}
          >
            Add item
          </Button>
        </Stack>
      </Stack>

      {filterCount > 0 && (
        <ActiveFilterChips filters={filters} onChange={changeFilters} />
      )}

      {items.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 8 }}>
          No items in the inventory yet. Add one to get started.
        </Typography>
      ) : visible.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 8 }}>
          No items match your search.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={headerState.some}
                    checked={headerState.all}
                    onChange={(e) => setSelected(selectPage(selected, pageIds, e.target.checked))}
                    slotProps={{ input: { "aria-label": "Select every item on this page" } }}
                  />
                </TableCell>
                <TableCell>Item</TableCell>
                <TableCell align="center">Category</TableCell>
                <TableCell align="right">Price (O2C)</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="right">Sold</TableCell>
                <TableCell align="right">Limit / attendee</TableCell>
                <TableCell align="center">Visibility</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((item) => {
                const isSelected = selected.includes(item.id);
                const chip = VISIBILITY_CHIP[item.visibility];
                const verb = visibilityAction(item);
                const deleted = item.visibility === "DELETED";
                return (
                  <TableRow key={item.id} hover selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => setSelected(toggleId(selected, item.id))}
                        slotProps={{ input: { "aria-label": `Select ${item.name}` } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, maxWidth: 280 }}>
                        <ItemThumb src={item.imageUrl} alt={item.name} />
                        <Box sx={{ minWidth: 0 }}>
                          <Tooltip title={item.name} placement="top" arrow>
                            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                              {item.name}
                            </Typography>
                          </Tooltip>
                          <Tooltip title={item.id} placement="bottom" arrow>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                              {item.id}
                            </Typography>
                          </Tooltip>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={item.category} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">{item.price}</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={item.availableStock <= 0 ? "error.main" : "text.primary"}
                        sx={{ fontWeight: item.availableStock <= 0 ? 600 : 400 }}
                      >
                        {item.availableStock}
                      </Typography>
                    </TableCell>
                    {/* A dash until the orders load, rather than a wrong 0. */}
                    <TableCell align="right">{sold ? (sold.get(item.id) ?? 0) : "—"}</TableCell>
                    <TableCell align="right">
                      {hasPurchaseLimit(item) ? item.maxPerUser : (
                        <Typography component="span" variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={chip.label} color={chip.color} size="small" />
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip title={`${TOGGLE_WORDING[verb].label} item`} arrow>
                        <IconButton size="small" aria-label={`${verb} ${item.name}`} onClick={() => askToggle(item)}>
                          {item.visibility === "VISIBLE" ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                        </IconButton>
                      </Tooltip>
                      {/* A deleted item is edited after it is restored: the
                          update endpoint accepts only VISIBLE or HIDDEN, and
                          saving must not quietly bring it back. */}
                      <Tooltip title={deleted ? "Restore the item to edit it" : "Edit item"} arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Edit ${item.name}`}
                            disabled={deleted}
                            onClick={() => setDialog({ open: true, item })}
                          >
                            <PencilIcon size={16} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete item" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Delete ${item.name}`}
                            disabled={deleted}
                            onClick={() => askDelete(item)}
                          >
                            <Trash2Icon size={16} />
                          </IconButton>
                        </span>
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

      <InventoryFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onChange={changeFilters}
        categories={categories}
        priceMax={priceMax}
      />

      <ShopItemFormDialog
        open={dialog.open}
        item={dialog.item}
        existingCategories={categories}
        isPending={createItem.isPending || updateItem.isPending}
        onSave={(fields) => void save(fields)}
        onClose={() => setDialog({ open: false, item: null })}
      />

      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}

/** The item's picture, or a package icon when it has none or it fails to load. */
function ItemThumb({ src, alt }: { src: string; alt: string }) {
  // Keyed on the address, so a fixed URL gets another try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const size = { width: 40, height: 40, borderRadius: 1, flexShrink: 0 };
  if (!src || failedSrc === src) {
    return (
      <Box
        sx={{
          ...size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "action.hover",
          color: "text.secondary",
        }}
      >
        <PackageIcon size={20} />
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      sx={{ ...size, objectFit: "cover" }}
    />
  );
}

function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: InventoryFilters;
  onChange: (patch: Partial<InventoryFilters>) => void;
}) {
  return (
    <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
      <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5, fontWeight: 500 }}>
        Active filters:
      </Typography>
      {filters.visibility !== "ALL" && (
        <Chip
          size="small"
          label={`Visibility: ${VISIBILITY_FILTER_LABELS[filters.visibility]}`}
          onDelete={() => onChange({ visibility: "ALL" })}
        />
      )}
      {filters.stock !== "ALL" && (
        <Chip
          size="small"
          label={`Stock: ${STOCK_FILTER_LABELS[filters.stock]}`}
          onDelete={() => onChange({ stock: "ALL" })}
        />
      )}
      {(filters.minPrice !== "" || filters.maxPrice !== "") && (
        <Chip
          size="small"
          label={`Price: ${filters.minPrice === "" ? 0 : filters.minPrice} – ${
            filters.maxPrice === "" ? "max" : filters.maxPrice
          }`}
          onDelete={() => onChange({ minPrice: "", maxPrice: "" })}
        />
      )}
      {filters.limit !== "ALL" && (
        <Chip
          size="small"
          label={`Limit: ${LIMIT_FILTER_LABELS[filters.limit]}`}
          onDelete={() => onChange({ limit: "ALL" })}
        />
      )}
      {filters.categories.map((cat) => (
        <Chip
          key={cat}
          size="small"
          label={`Category: ${cat}`}
          onDelete={() => onChange({ categories: filters.categories.filter((c) => c !== cat) })}
        />
      ))}
      <Button size="small" onClick={() => onChange(DEFAULT_INVENTORY_FILTERS)}>
        Clear all
      </Button>
    </Box>
  );
}

function FilterOptions<T extends string>({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
        {label}
      </Typography>
      <ToggleButtonGroup
        color="primary"
        value={value}
        exclusive
        orientation="vertical"
        size="small"
        fullWidth
        aria-label={label}
        onChange={(_, v: T | null) => {
          if (v !== null) onChange(v);
        }}
        sx={{ mb: 2, "& .MuiToggleButton-root": { textTransform: "none" } }}
      >
        {(Object.keys(labels) as T[]).map((k) => (
          <ToggleButton key={k} value={k}>
            {labels[k]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </>
  );
}

function InventoryFilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  categories,
  priceMax,
}: {
  open: boolean;
  onClose: () => void;
  filters: InventoryFilters;
  onChange: (patch: Partial<InventoryFilters>) => void;
  categories: string[];
  priceMax: number;
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
        <FilterOptions<VisibilityFilter>
          label="Visibility"
          value={filters.visibility}
          labels={VISIBILITY_FILTER_LABELS}
          onChange={(visibility) => onChange({ visibility })}
        />
        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
          Price range
        </Typography>
        <Box sx={{ px: 1.5, mt: 1 }}>
          <Slider
            value={[
              filters.minPrice === "" ? 0 : filters.minPrice,
              filters.maxPrice === "" ? priceMax : filters.maxPrice,
            ]}
            onChange={(_, v) => {
              const [min, max] = v as number[];
              // The slider's ends mean "no bound", so an item priced above
              // today's maximum is not cut off later.
              onChange({ minPrice: min === 0 ? "" : min, maxPrice: max === priceMax ? "" : max });
            }}
            valueLabelDisplay="auto"
            min={0}
            max={priceMax}
            getAriaLabel={(i) => (i === 0 ? "Minimum price" : "Maximum price")}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          <TextField
            size="small"
            type="number"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => onChange({ minPrice: numberOrEmpty(e.target.value) })}
            slotProps={{ htmlInput: { "aria-label": "Minimum price", min: 0 } }}
          />
          <TextField
            size="small"
            type="number"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => onChange({ maxPrice: numberOrEmpty(e.target.value) })}
            slotProps={{ htmlInput: { "aria-label": "Maximum price", min: 0 } }}
          />
        </Box>
        <Divider sx={{ my: 2 }} />

        <FilterOptions<StockFilter>
          label="Stock"
          value={filters.stock}
          labels={STOCK_FILTER_LABELS}
          onChange={(stock) => onChange({ stock })}
        />
        <Divider sx={{ my: 2 }} />

        <FilterOptions<LimitFilter>
          label="Purchase limit"
          value={filters.limit}
          labels={LIMIT_FILTER_LABELS}
          onChange={(limit) => onChange({ limit })}
        />

        {categories.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
              Categories
            </Typography>
            <FormGroup sx={{ mb: 2 }}>
              {categories.map((cat) => (
                <FormControlLabel
                  key={cat}
                  label={<Typography variant="body2">{cat}</Typography>}
                  control={
                    <Checkbox
                      size="small"
                      checked={filters.categories.includes(cat)}
                      onChange={(e) =>
                        onChange({
                          categories: e.target.checked
                            ? [...filters.categories, cat]
                            : filters.categories.filter((c) => c !== cat),
                        })
                      }
                    />
                  }
                />
              ))}
            </FormGroup>
          </>
        )}

        {activeInventoryFilterCount(filters) > 0 && (
          <Button fullWidth variant="outlined" sx={{ mt: 2 }} onClick={() => onChange(DEFAULT_INVENTORY_FILTERS)}>
            Clear all filters
          </Button>
        )}
      </Box>
    </Drawer>
  );
}
