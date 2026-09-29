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

// The shop's pure logic — the inventory and orders filters, the order status
// transitions, selection and paging, and the item form <-> payload mapping —
// kept out of the pages so it is tested without React. The source had all of
// this inline in two 500–850 line page components, plus constants/shop.ts.
//
// Orders carry the buyer's email and address. Nothing here logs or formats an
// order into a message; the search reads those fields only to match them.

import type { ShopItemInput } from "@features/marketing-ops/event-platform/api/payloads";
import type {
  ShopItem,
  ShopOrder,
  ShopOrderItem,
  ShopOrderStatus,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";

// ---------------------------------------------------------------------------
// Shared: selection and paging
// ---------------------------------------------------------------------------

/** One page of `list`. `page` is zero-based, as TablePagination counts. */
export function pageOf<T>(list: readonly T[], page: number, rowsPerPage: number): T[] {
  return list.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
}

/**
 * The page to show once the list has shrunk under it — after a delete, or a
 * status change that drops a row out of the current filter. Without it the
 * table shows an empty page with "11–10 of 10".
 */
export function clampPage(page: number, count: number, rowsPerPage: number): number {
  const last = Math.max(0, Math.ceil(count / rowsPerPage) - 1);
  return Math.min(Math.max(0, page), last);
}

/** Adds or removes one id. */
export function toggleId(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}

/**
 * The header checkbox: select every id on the page (keeping selections made on
 * other pages), or clear just this page's.
 */
export function selectPage(selected: readonly string[], pageIds: readonly string[], checked: boolean): string[] {
  if (checked) return Array.from(new Set([...selected, ...pageIds]));
  const onPage = new Set(pageIds);
  return selected.filter((id) => !onPage.has(id));
}

/** The header checkbox's state for the ids on the page. */
export function pageSelectionState(selected: readonly string[], pageIds: readonly string[]) {
  const picked = pageIds.filter((id) => selected.includes(id)).length;
  const all = pageIds.length > 0 && picked === pageIds.length;
  return { all, some: picked > 0 && !all };
}

/** How a bulk run ended: how many steps went through, and the error that stopped it, if one did. */
export interface BulkRun {
  done: number;
  error?: unknown;
}

/**
 * Runs `step` on each target in turn — there are no bulk endpoints — and
 * stops at the first failure, so the rest are not raced against it. Returns
 * rather than throws, so the caller can say how far the run got.
 */
export async function runInOrder<T>(targets: readonly T[], step: (target: T) => Promise<unknown>): Promise<BulkRun> {
  let done = 0;
  for (const target of targets) {
    try {
      await step(target);
    } catch (error) {
      return { done, error };
    }
    done += 1;
  }
  return { done };
}

/** A number field's value: `""` for empty, otherwise the number (NaN kept out). */
export function numberOrEmpty(raw: string): number | "" {
  if (raw.trim() === "") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "";
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/** At or under this many left (and above zero), an item counts as low stock. */
export const LOW_STOCK_THRESHOLD = 10;

export type StockFilter = "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type VisibilityFilter = "ALL" | "VISIBLE" | "HIDDEN" | "DELETED";
export type LimitFilter = "ALL" | "HAS_LIMIT" | "NO_LIMIT";

export const STOCK_FILTER_LABELS: Record<StockFilter, string> = {
  ALL: "All",
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
};

export const VISIBILITY_FILTER_LABELS: Record<VisibilityFilter, string> = {
  ALL: "All",
  VISIBLE: "Visible",
  HIDDEN: "Hidden",
  DELETED: "Deleted",
};

export const LIMIT_FILTER_LABELS: Record<LimitFilter, string> = {
  ALL: "All",
  HAS_LIMIT: "Has limit",
  NO_LIMIT: "No limit",
};

export interface InventoryFilters {
  categories: string[];
  stock: StockFilter;
  visibility: VisibilityFilter;
  minPrice: number | "";
  maxPrice: number | "";
  limit: LimitFilter;
}

export const DEFAULT_INVENTORY_FILTERS: InventoryFilters = {
  categories: [],
  stock: "ALL",
  visibility: "ALL",
  minPrice: "",
  maxPrice: "",
  limit: "ALL",
};

/** An item with a per-buyer cap. The source treated 0 and null alike: no cap. */
export function hasPurchaseLimit(item: Pick<ShopItem, "maxPerUser">): boolean {
  return item.maxPerUser !== null && item.maxPerUser > 0;
}

/**
 * The items the table shows. "All" visibility still leaves out deleted items —
 * they are only listed when asked for, as in the source.
 */
export function filterShopItems(
  items: readonly ShopItem[],
  search: string,
  f: InventoryFilters,
): ShopItem[] {
  const query = search.trim().toLowerCase();
  return items.filter((i) => {
    if (query && !i.name.toLowerCase().includes(query) && !i.category.toLowerCase().includes(query)) {
      return false;
    }
    if (f.categories.length > 0 && !f.categories.includes(i.category)) return false;

    if (f.stock === "IN_STOCK" && i.availableStock <= 0) return false;
    if (f.stock === "OUT_OF_STOCK" && i.availableStock > 0) return false;
    if (f.stock === "LOW_STOCK" && (i.availableStock <= 0 || i.availableStock > LOW_STOCK_THRESHOLD)) {
      return false;
    }

    if (f.visibility === "ALL" ? i.visibility === "DELETED" : i.visibility !== f.visibility) return false;

    if (f.minPrice !== "" && i.price < f.minPrice) return false;
    if (f.maxPrice !== "" && i.price > f.maxPrice) return false;

    if (f.limit === "HAS_LIMIT" && !hasPurchaseLimit(i)) return false;
    if (f.limit === "NO_LIMIT" && hasPurchaseLimit(i)) return false;
    return true;
  });
}

/** The badge on the Filters button. A price range counts once, however many ends are set. */
export function activeInventoryFilterCount(f: InventoryFilters): number {
  return (
    f.categories.length +
    (f.stock !== "ALL" ? 1 : 0) +
    (f.visibility !== "ALL" ? 1 : 0) +
    (f.minPrice !== "" || f.maxPrice !== "" ? 1 : 0) +
    (f.limit !== "ALL" ? 1 : 0)
  );
}

/** The distinct, non-empty categories in use, in first-seen order. */
export function itemCategories(items: readonly Pick<ShopItem, "category">[]): string[] {
  return Array.from(new Set(items.map((i) => i.category))).filter(Boolean);
}

/** The top of a price or amount slider: the largest value, at least 1 (1000 with nothing to go by). */
export function sliderMax(values: readonly number[]): number {
  return values.length > 0 ? Math.max(1, ...values) : 1000;
}

/**
 * Items some order already references. The backend will not delete those
 * (409), so the page offers to hide them instead, before the request is sent.
 */
export function purchasedItemIds(orders: readonly Pick<ShopOrder, "items">[]): Set<string> {
  return new Set(orders.flatMap((o) => (o.items ?? []).map((i) => i.itemId)));
}

/**
 * Units sold per item id. Only orders that were paid count: a pending one may
 * still expire, and an expired or failed one had its quantity put back.
 */
export function soldCounts(orders: readonly Pick<ShopOrder, "status" | "items">[]): Map<string, number> {
  const sold = new Map<string, number>();
  for (const o of orders) {
    if (o.status !== "CONFIRMED" && o.status !== "FULFILLED") continue;
    for (const line of o.items ?? []) sold.set(line.itemId, (sold.get(line.itemId) ?? 0) + line.quantity);
  }
  return sold;
}

/** What the eye button does to an item: hide a visible one, show (or restore) the rest. */
export function toggledVisibility(item: Pick<ShopItem, "visibility">): ShopItemInput["visibility"] {
  return item.visibility === "VISIBLE" ? "HIDDEN" : "VISIBLE";
}

/** The eye button's verb — "hide", "show", or "restore" for a deleted item. */
export function visibilityAction(item: Pick<ShopItem, "visibility">): "hide" | "show" | "restore" {
  if (item.visibility === "VISIBLE") return "hide";
  return item.visibility === "DELETED" ? "restore" : "show";
}

/**
 * An update body for an existing item at a new visibility — the item's own
 * fields, re-sent in full because the endpoint is a PUT. Pass the item as the
 * server has it now, not the cached copy: stock falls as orders come in, and
 * the cached figure would put back what was sold since the list loaded.
 */
export function withVisibility(
  item: ShopItem,
  visibility: ShopItemInput["visibility"],
): ShopItemInput & { id: string } {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: item.imageUrl,
    availableStock: item.availableStock,
    category: item.category,
    maxPerUser: item.maxPerUser,
    visibility,
  };
}

/** The selected items a bulk hide (`"HIDDEN"`) or show (`"VISIBLE"`) would change. */
export function bulkVisibilityTargets(
  items: readonly ShopItem[],
  selectedIds: readonly string[],
  target: ShopItemInput["visibility"],
): ShopItem[] {
  const picked = new Set(selectedIds);
  return items.filter(
    (i) => picked.has(i.id) && (target === "HIDDEN" ? i.visibility === "VISIBLE" : i.visibility !== "VISIBLE"),
  );
}

/**
 * The selected items a bulk delete acts on. Deleted items are left out, as the
 * row's Delete button is disabled for them: hiding a purchased one would bring
 * it back as HIDDEN. Pass the items on screen, so the count on the button is
 * what the operator sees.
 */
export function bulkDeleteTargets(items: readonly ShopItem[], selectedIds: readonly string[]): ShopItem[] {
  const picked = new Set(selectedIds);
  return items.filter((i) => picked.has(i.id) && i.visibility !== "DELETED");
}

export interface BulkDeletePlan {
  toDelete: ShopItem[];
  toHide: ShopItem[];
}

/**
 * How a bulk delete splits: purchased items can only be hidden (and those
 * already hidden need nothing), the rest are deleted. Deleted items and ids
 * no longer in the list are dropped.
 */
export function planBulkDelete(
  items: readonly ShopItem[],
  selectedIds: readonly string[],
  purchased: ReadonlySet<string>,
): BulkDeletePlan {
  const toDelete: ShopItem[] = [];
  const toHide: ShopItem[] = [];
  for (const item of bulkDeleteTargets(items, selectedIds)) {
    if (!purchased.has(item.id)) toDelete.push(item);
    else if (item.visibility !== "HIDDEN") toHide.push(item);
  }
  return { toDelete, toHide };
}

export interface BulkDeleteResult {
  deleted: number;
  hidden: number;
  /** Items the backend refused to delete (409): some order references them. */
  conflicted: string[];
  /** The failure that stopped the run, if one did. */
  error?: unknown;
}

/**
 * Carries out a bulk-delete plan, one request at a time. A delete refused
 * with a conflict means an order placed since the list loaded names the item:
 * it is hidden instead (unless it already is) and reported in `conflicted`.
 * Any other failure stops the run. Returns rather than throws, so what was
 * done before the failure is still reported.
 */
export async function runBulkDelete(
  plan: BulkDeletePlan,
  ops: {
    remove: (item: ShopItem) => Promise<unknown>;
    hide: (item: ShopItem) => Promise<unknown>;
    isConflict: (err: unknown) => boolean;
  },
): Promise<BulkDeleteResult> {
  const hide = [...plan.toHide];
  const conflicted: string[] = [];
  let deleted = 0;
  for (const item of plan.toDelete) {
    try {
      await ops.remove(item);
      deleted += 1;
    } catch (error) {
      if (!ops.isConflict(error)) return { deleted, hidden: 0, conflicted, error };
      conflicted.push(item.id);
      if (item.visibility !== "HIDDEN") hide.push(item);
    }
  }
  const run = await runInOrder(hide, ops.hide);
  return { deleted, hidden: run.done, conflicted, ...("error" in run ? { error: run.error } : {}) };
}

// ---- The item form ---------------------------------------------------------

/**
 * What the item dialog edits. Numbers are strings while being typed, so an
 * emptied field reads as empty rather than snapping to 0 as the source's
 * `Number(e.target.value)` did.
 */
export interface ShopItemFormValues {
  name: string;
  description: string;
  price: string;
  availableStock: string;
  imageUrl: string;
  category: string;
  maxPerUser: string;
}

/** The fields a save sends; visibility is the page's to decide, not the form's. */
export type ShopItemFields = Omit<ShopItemInput, "visibility">;

/** The source's default category for a new item. */
export const DEFAULT_CATEGORY = "merch";

export function toShopItemFormValues(item?: ShopItem | null): ShopItemFormValues {
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    price: String(item?.price ?? 0),
    availableStock: String(item?.availableStock ?? 0),
    imageUrl: item?.imageUrl ?? "",
    category: item?.category ?? DEFAULT_CATEGORY,
    maxPerUser: item?.maxPerUser == null ? "" : String(item.maxPerUser),
  };
}

/**
 * An edit's fields, with the stock the server has now (`latest`) unless the
 * operator changed the figure the dialog opened with (`loaded`). The endpoint
 * is a PUT, so re-sending the loaded figure would put back stock sold while
 * the dialog was open.
 */
export function keepLiveStock(
  fields: ShopItemFields,
  loaded: Pick<ShopItem, "availableStock">,
  latest: Pick<ShopItem, "availableStock"> | undefined,
): ShopItemFields {
  if (!latest || fields.availableStock !== loaded.availableStock) return fields;
  return { ...fields, availableStock: latest.availableStock };
}

/** Trimmed and typed. Call only on values the validators below accept. */
export function fromShopItemFormValues(v: ShopItemFormValues): ShopItemFields {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    price: Number(v.price),
    availableStock: Number(v.availableStock),
    imageUrl: v.imageUrl.trim(),
    category: v.category.trim(),
    maxPerUser: v.maxPerUser.trim() === "" ? null : Number(v.maxPerUser),
  };
}

/** react-hook-form `validate` results: an error message, or `true` when fine. */
export type FieldCheck = string | true;

export function checkRequired(label: string) {
  return (v: string): FieldCheck => (v.trim() ? true : `${label} is required.`);
}

export function checkPrice(v: string): FieldCheck {
  if (v.trim() === "") return "Price is required.";
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? true : "Price must be zero or more.";
}

export function checkStock(v: string): FieldCheck {
  if (v.trim() === "") return "Stock is required.";
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? true : "Stock must be a whole number, zero or more.";
}

export function checkLimit(v: string): FieldCheck {
  if (v.trim() === "") return true;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? true : "Leave empty for no limit, or enter a whole number above zero.";
}

// The source took any string. The value becomes an <img src> here and in the
// attendee app, so only a web address is accepted.
export function checkImageUrl(v: string): FieldCheck {
  const s = v.trim();
  if (!s) return "Image URL is required.";
  try {
    const url = new URL(s);
    return url.protocol === "https:" || url.protocol === "http:" ? true : "Use an http or https address.";
  } catch {
    return "Enter a full address, starting with https://.";
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type AlertTone = "info" | "warning" | "success" | "error";

/** What each status means, for the chip colour and the explanation under the filter. */
export const ORDER_STATUS_INFO: Record<ShopOrderStatus, { color: AlertTone; label: string; description: string }> = {
  PENDING: {
    color: "warning",
    label: "Pending",
    description: "Order placed, awaiting blockchain payment confirmation.",
  },
  CONFIRMED: {
    color: "success",
    label: "Confirmed",
    description: "Payment confirmed on the blockchain. The items are ready to be handed to the attendee.",
  },
  FULFILLED: {
    color: "info",
    label: "Fulfilled",
    description: "Items shipped or handed over to the attendee.",
  },
  EXPIRED: {
    color: "error",
    label: "Expired",
    description:
      "Payment was not completed in time. The order quantity was reverted, and no money was deducted from the attendee.",
  },
  FAILED: {
    color: "error",
    label: "Failed",
    description: "The payment transaction failed on the blockchain. The order was not processed.",
  },
};

/** The status filter buttons, in the source's order: the actionable ones first. */
export const ORDER_STATUS_FILTERS: readonly ("ALL" | ShopOrderStatus)[] = [
  "ALL",
  "CONFIRMED",
  "FULFILLED",
  "EXPIRED",
  "FAILED",
  "PENDING",
];

/**
 * The status changes an operator may make by hand, from the source drawer's
 * buttons. FULFILLED, EXPIRED and FAILED are final. The backend decides what it
 * actually accepts; this only decides which buttons to draw.
 */
export const ORDER_TRANSITIONS: Record<ShopOrderStatus, readonly ShopOrderStatus[]> = {
  PENDING: ["CONFIRMED", "EXPIRED"],
  CONFIRMED: ["FULFILLED"],
  FULFILLED: [],
  EXPIRED: [],
  FAILED: [],
};

export function nextOrderStatuses(status: ShopOrderStatus): readonly ShopOrderStatus[] {
  return ORDER_TRANSITIONS[status] ?? [];
}

/** Only confirmed orders may be picked for bulk fulfilment, as in the source. */
export function isBulkFulfillable(order: Pick<ShopOrder, "status">): boolean {
  return order.status === "CONFIRMED";
}

/**
 * The selected orders a bulk fulfil would change, re-checked against the list
 * as it is now — an order fulfilled from the drawer since it was ticked drops out.
 */
export function bulkFulfillTargets(orders: readonly ShopOrder[], selectedIds: readonly string[]): string[] {
  const picked = new Set(selectedIds);
  return orders.filter((o) => picked.has(o.id) && isBulkFulfillable(o)).map((o) => o.id);
}

export interface OrderFilters {
  status: "ALL" | ShopOrderStatus;
  minAmount: number | "";
  maxAmount: number | "";
  from: Date | null;
  to: Date | null;
}

export const DEFAULT_ORDER_FILTERS: OrderFilters = {
  status: "ALL",
  minAmount: "",
  maxAmount: "",
  from: null,
  to: null,
};

// The pickers choose to the minute, so "to 14:30" has to take in the whole of
// that minute or an order placed at 14:30:20 falls outside it.
const MINUTE_MS = 60_000;

/** The orders the table shows. Search matches the id, the buyer's email or name, and the status. */
export function filterShopOrders(
  orders: readonly ShopOrder[],
  search: string,
  f: OrderFilters,
): ShopOrder[] {
  const query = search.trim().toLowerCase();
  const from = f.from ? f.from.getTime() : null;
  const to = f.to ? f.to.getTime() + MINUTE_MS - 1 : null;
  return orders.filter((o) => {
    if (f.status !== "ALL" && o.status !== f.status) return false;
    if (f.minAmount !== "" && o.totalCoinsAmount < f.minAmount) return false;
    if (f.maxAmount !== "" && o.totalCoinsAmount > f.maxAmount) return false;
    if (from !== null || to !== null) {
      const placed = new Date(o.createdOn).getTime();
      if (from !== null && placed < from) return false;
      if (to !== null && placed > to) return false;
    }
    if (!query) return true;
    return (
      o.id.toLowerCase().includes(query) ||
      (o.shippingEmail ?? "").toLowerCase().includes(query) ||
      (o.shippingRecipientName ?? "").toLowerCase().includes(query) ||
      o.status.toLowerCase().includes(query)
    );
  });
}

/** The badge on the Filters button. Status has its own row of buttons and is not counted. */
export function activeOrderFilterCount(f: OrderFilters): number {
  return (f.minAmount !== "" || f.maxAmount !== "" ? 1 : 0) + (f.from || f.to ? 1 : 0);
}

/**
 * The earliest and latest order, to bound the date pickers. The earliest is
 * floored to its minute: the pickers choose whole minutes, and a bound at
 * 09:00:20 would mark "from 09:00" invalid though it includes that order.
 */
export function orderDateBounds(orders: readonly Pick<ShopOrder, "createdOn">[]): { min?: Date; max?: Date } {
  const times = orders.map((o) => new Date(o.createdOn).getTime()).filter((t) => Number.isFinite(t));
  if (times.length === 0) return {};
  const min = Math.min(...times);
  return { min: new Date(min - (min % MINUTE_MS)), max: new Date(Math.max(...times)) };
}

/**
 * A line's cost. Prices may be fractional, so the product is rounded to 12
 * significant digits: 3 × 0.1 shows as 0.3, not 0.30000000000000004.
 */
export function lineTotal(item: Pick<ShopOrderItem, "quantity" | "priceAtPurchase">): number {
  return Number((item.quantity * item.priceAtPurchase).toPrecision(12));
}

/** An order's id as the table shows it — the tail, since the full id is a UUID. */
export function shortOrderId(id: string): string {
  return id.length > 4 ? `…${id.slice(-4)}` : id;
}

const ORDER_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Sep 29, 2026, 2:30 PM" in the viewer's zone; the raw value when it does not parse. */
export function formatOrderDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : ORDER_DATE_FORMAT.format(d);
}

/** One line of a buyer's address: the non-empty parts, comma-joined. */
export function joinAddressParts(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => p?.trim()).filter(Boolean).join(", ");
}
