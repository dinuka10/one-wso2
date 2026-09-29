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

import { describe, expect, it } from "vitest";
import type { ShopItem, ShopOrder } from "../types/eventPlatformTypes";
import {
  DEFAULT_INVENTORY_FILTERS,
  DEFAULT_ORDER_FILTERS,
  activeInventoryFilterCount,
  activeOrderFilterCount,
  bulkFulfillTargets,
  bulkVisibilityTargets,
  checkImageUrl,
  checkLimit,
  checkPrice,
  checkStock,
  clampPage,
  filterShopItems,
  filterShopOrders,
  formatOrderDate,
  fromShopItemFormValues,
  itemCategories,
  joinAddressParts,
  lineTotal,
  nextOrderStatuses,
  numberOrEmpty,
  orderDateBounds,
  pageOf,
  pageSelectionState,
  planBulkDelete,
  purchasedItemIds,
  selectPage,
  shortOrderId,
  sliderMax,
  toShopItemFormValues,
  toggleId,
  toggledVisibility,
  visibilityAction,
  withVisibility,
} from "./shop";

function item(over: Partial<ShopItem> & { id: string }): ShopItem {
  return {
    name: `Item ${over.id}`,
    description: null,
    price: 10,
    imageUrl: "https://images.example.com/item.png",
    availableStock: 20,
    category: "merch",
    maxPerUser: null,
    visibility: "VISIBLE",
    ...over,
  };
}

// Obvious fakes only: every order is "Buyer One" at someone@example.com.
function order(over: Partial<ShopOrder> & { id: string }): ShopOrder {
  return {
    userUuid: "user-1",
    status: "CONFIRMED",
    transactionHash: null,
    totalCoinsAmount: 50,
    createdOn: "2026-09-29T10:00:00Z",
    createdBy: "user-1",
    updatedOn: "2026-09-29T10:00:00Z",
    updatedBy: "user-1",
    shippingRecipientName: "Buyer One",
    shippingEmail: "someone@example.com",
    shippingAddressLine1: "1 Example Street",
    shippingAddressLine2: null,
    shippingCity: "Example City",
    shippingState: null,
    shippingPostalCode: "00000",
    shippingCountry: "Exampleland",
    items: [],
    ...over,
  };
}

describe("selection and paging", () => {
  it("pages a list and clamps a page the list has shrunk under", () => {
    const list = Array.from({ length: 25 }, (_, i) => i);
    expect(pageOf(list, 2, 10)).toEqual([20, 21, 22, 23, 24]);
    expect(clampPage(2, 20, 10)).toBe(1);
    expect(clampPage(3, 0, 10)).toBe(0);
    expect(clampPage(1, 25, 10)).toBe(1);
  });

  it("toggles one id and selects or clears a page without touching other pages", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
    expect(selectPage(["x"], ["a", "b"], true)).toEqual(["x", "a", "b"]);
    expect(selectPage(["x", "a", "b"], ["a", "b"], false)).toEqual(["x"]);
  });

  it("reports the header checkbox state", () => {
    expect(pageSelectionState([], [])).toEqual({ all: false, some: false });
    expect(pageSelectionState(["a"], ["a", "b"])).toEqual({ all: false, some: true });
    expect(pageSelectionState(["a", "b"], ["a", "b"])).toEqual({ all: true, some: false });
  });

  it("reads a number field as empty or a number", () => {
    expect(numberOrEmpty("")).toBe("");
    expect(numberOrEmpty(" ")).toBe("");
    expect(numberOrEmpty("12")).toBe(12);
    expect(numberOrEmpty("abc")).toBe("");
  });
});

describe("inventory filters", () => {
  const items = [
    item({ id: "1", name: "Mug", category: "merch", availableStock: 0, price: 5 }),
    item({ id: "2", name: "Tee", category: "apparel", availableStock: 5, price: 30, maxPerUser: 2 }),
    item({ id: "3", name: "Cap", category: "apparel", availableStock: 50, price: 15, visibility: "HIDDEN" }),
    item({ id: "4", name: "Old", category: "merch", visibility: "DELETED" }),
  ];
  const ids = (list: ShopItem[]) => list.map((i) => i.id);
  const f = DEFAULT_INVENTORY_FILTERS;

  it("hides deleted items unless asked for them", () => {
    expect(ids(filterShopItems(items, "", f))).toEqual(["1", "2", "3"]);
    expect(ids(filterShopItems(items, "", { ...f, visibility: "DELETED" }))).toEqual(["4"]);
    expect(ids(filterShopItems(items, "", { ...f, visibility: "HIDDEN" }))).toEqual(["3"]);
  });

  it("searches name and category, case-insensitively", () => {
    expect(ids(filterShopItems(items, " MUG ", f))).toEqual(["1"]);
    expect(ids(filterShopItems(items, "apparel", f))).toEqual(["2", "3"]);
  });

  it("filters by stock state", () => {
    expect(ids(filterShopItems(items, "", { ...f, stock: "OUT_OF_STOCK" }))).toEqual(["1"]);
    expect(ids(filterShopItems(items, "", { ...f, stock: "LOW_STOCK" }))).toEqual(["2"]);
    expect(ids(filterShopItems(items, "", { ...f, stock: "IN_STOCK" }))).toEqual(["2", "3"]);
  });

  it("filters by category, price range and purchase limit", () => {
    expect(ids(filterShopItems(items, "", { ...f, categories: ["merch"] }))).toEqual(["1"]);
    expect(ids(filterShopItems(items, "", { ...f, minPrice: 10, maxPrice: 20 }))).toEqual(["3"]);
    expect(ids(filterShopItems(items, "", { ...f, limit: "HAS_LIMIT" }))).toEqual(["2"]);
    expect(ids(filterShopItems(items, "", { ...f, limit: "NO_LIMIT" }))).toEqual(["1", "3"]);
  });

  it("counts a price range once", () => {
    expect(activeInventoryFilterCount(f)).toBe(0);
    expect(
      activeInventoryFilterCount({ ...f, categories: ["a", "b"], minPrice: 1, maxPrice: 2, stock: "IN_STOCK" }),
    ).toBe(4);
  });

  it("lists categories once each and sizes the slider", () => {
    expect(itemCategories([...items, item({ id: "5", category: "" })])).toEqual(["merch", "apparel"]);
    expect(sliderMax([])).toBe(1000);
    expect(sliderMax([0])).toBe(1);
    expect(sliderMax([5, 30])).toBe(30);
  });
});

describe("inventory actions", () => {
  it("collects the ids any order references", () => {
    const orders = [
      order({ id: "o1", items: [{ itemId: "1", name: "Mug", quantity: 1, priceAtPurchase: 5 }] }),
      order({ id: "o2", items: [{ itemId: "2", name: "Tee", quantity: 2, priceAtPurchase: 30 }] }),
    ];
    expect([...purchasedItemIds(orders)].sort()).toEqual(["1", "2"]);
  });

  it("toggles visibility, restoring a deleted item to visible", () => {
    expect(toggledVisibility({ visibility: "VISIBLE" })).toBe("HIDDEN");
    expect(toggledVisibility({ visibility: "HIDDEN" })).toBe("VISIBLE");
    expect(toggledVisibility({ visibility: "DELETED" })).toBe("VISIBLE");
    expect(visibilityAction({ visibility: "DELETED" })).toBe("restore");
    expect(visibilityAction({ visibility: "HIDDEN" })).toBe("show");
  });

  it("re-sends the item's own fields at the new visibility", () => {
    const i = item({ id: "7", maxPerUser: 3 });
    expect(withVisibility(i, "HIDDEN")).toEqual({ ...i, visibility: "HIDDEN" });
  });

  it("picks only the selected items a bulk hide or show would change", () => {
    const items = [
      item({ id: "1" }),
      item({ id: "2", visibility: "HIDDEN" }),
      item({ id: "3", visibility: "DELETED" }),
      item({ id: "4" }),
    ];
    const sel = ["1", "2", "3"];
    expect(bulkVisibilityTargets(items, sel, "HIDDEN").map((i) => i.id)).toEqual(["1"]);
    expect(bulkVisibilityTargets(items, sel, "VISIBLE").map((i) => i.id)).toEqual(["2", "3"]);
  });

  it("hides purchased items rather than deleting them", () => {
    const items = [item({ id: "1" }), item({ id: "2" }), item({ id: "3", visibility: "HIDDEN" })];
    const plan = planBulkDelete(items, ["1", "2", "3", "gone"], new Set(["2", "3"]));
    expect(plan.toDelete.map((i) => i.id)).toEqual(["1"]);
    expect(plan.toHide.map((i) => i.id)).toEqual(["2"]);
  });
});

describe("the item form", () => {
  it("round-trips an item through the form values", () => {
    const i = item({ id: "7", description: "Soft", maxPerUser: 2 });
    expect(fromShopItemFormValues(toShopItemFormValues(i))).toEqual({
      name: i.name,
      description: i.description,
      price: i.price,
      imageUrl: i.imageUrl,
      availableStock: i.availableStock,
      category: i.category,
      maxPerUser: i.maxPerUser,
    });
  });

  it("starts a new item empty, at the default category", () => {
    const v = toShopItemFormValues();
    expect(v).toMatchObject({ name: "", price: "0", availableStock: "0", category: "merch", maxPerUser: "" });
  });

  it("trims text, nulls an empty description and an empty limit", () => {
    const out = fromShopItemFormValues({
      name: "  Mug ",
      description: "   ",
      price: "4.5",
      availableStock: "3",
      imageUrl: " https://images.example.com/m.png ",
      category: " merch ",
      maxPerUser: "",
    });
    expect(out).toEqual({
      name: "Mug",
      description: null,
      price: 4.5,
      availableStock: 3,
      imageUrl: "https://images.example.com/m.png",
      category: "merch",
      maxPerUser: null,
    });
  });

  it("validates the numbers", () => {
    expect(checkPrice("0")).toBe(true);
    expect(checkPrice("-1")).not.toBe(true);
    expect(checkPrice("")).not.toBe(true);
    expect(checkStock("3")).toBe(true);
    expect(checkStock("1.5")).not.toBe(true);
    expect(checkLimit("")).toBe(true);
    expect(checkLimit("0")).not.toBe(true);
    expect(checkLimit("2")).toBe(true);
  });

  it("accepts only a web address for the image", () => {
    expect(checkImageUrl("https://images.example.com/a.png")).toBe(true);
    expect(checkImageUrl("javascript:alert(1)")).not.toBe(true);
    expect(checkImageUrl("a.png")).not.toBe(true);
    expect(checkImageUrl("")).not.toBe(true);
  });
});

describe("orders", () => {
  const orders = [
    order({ id: "ord-0001", status: "PENDING", totalCoinsAmount: 10, createdOn: "2026-09-29T09:00:00Z" }),
    order({
      id: "ord-0002",
      status: "CONFIRMED",
      totalCoinsAmount: 100,
      createdOn: "2026-09-29T10:30:20Z",
      shippingRecipientName: "Buyer Two",
      shippingEmail: "another@example.com",
    }),
    order({ id: "ord-0003", status: "FULFILLED", totalCoinsAmount: 60, createdOn: "2026-09-30T12:00:00Z" }),
  ];
  const ids = (list: ShopOrder[]) => list.map((o) => o.id);
  const f = DEFAULT_ORDER_FILTERS;

  it("filters by status and amount", () => {
    expect(ids(filterShopOrders(orders, "", { ...f, status: "CONFIRMED" }))).toEqual(["ord-0002"]);
    expect(ids(filterShopOrders(orders, "", { ...f, minAmount: 50, maxAmount: 80 }))).toEqual(["ord-0003"]);
  });

  it("takes in the whole of the 'to' minute", () => {
    const to = new Date("2026-09-29T10:30:00Z");
    expect(ids(filterShopOrders(orders, "", { ...f, to }))).toEqual(["ord-0001", "ord-0002"]);
    const from = new Date("2026-09-29T10:00:00Z");
    expect(ids(filterShopOrders(orders, "", { ...f, from }))).toEqual(["ord-0002", "ord-0003"]);
  });

  it("searches id, email, name and status", () => {
    expect(ids(filterShopOrders(orders, "0003", f))).toEqual(["ord-0003"]);
    expect(ids(filterShopOrders(orders, "ANOTHER@", f))).toEqual(["ord-0002"]);
    expect(ids(filterShopOrders(orders, "buyer two", f))).toEqual(["ord-0002"]);
    expect(ids(filterShopOrders(orders, "pending", f))).toEqual(["ord-0001"]);
  });

  it("counts the drawer's filters, not the status", () => {
    expect(activeOrderFilterCount({ ...f, status: "PENDING" })).toBe(0);
    expect(activeOrderFilterCount({ ...f, minAmount: 1, from: new Date(), to: new Date() })).toBe(2);
  });

  it("offers only the source's hand transitions", () => {
    expect(nextOrderStatuses("PENDING")).toEqual(["CONFIRMED", "EXPIRED"]);
    expect(nextOrderStatuses("CONFIRMED")).toEqual(["FULFILLED"]);
    expect(nextOrderStatuses("FULFILLED")).toEqual([]);
    expect(nextOrderStatuses("EXPIRED")).toEqual([]);
    expect(nextOrderStatuses("FAILED")).toEqual([]);
  });

  it("bulk-fulfils only orders still confirmed", () => {
    expect(bulkFulfillTargets(orders, ["ord-0001", "ord-0002", "ord-0003", "gone"])).toEqual(["ord-0002"]);
  });

  it("bounds the date pickers by the orders", () => {
    expect(orderDateBounds([])).toEqual({});
    const { min, max } = orderDateBounds(orders);
    expect(min?.toISOString()).toBe("2026-09-29T09:00:00.000Z");
    expect(max?.toISOString()).toBe("2026-09-30T12:00:00.000Z");
  });

  it("totals a line, shortens an id, joins an address and formats a date", () => {
    expect(lineTotal({ quantity: 3, priceAtPurchase: 7 })).toBe(21);
    expect(shortOrderId("ord-0001")).toBe("…0001");
    expect(shortOrderId("ab")).toBe("ab");
    expect(joinAddressParts("Example City", null, " ", "00000")).toBe("Example City, 00000");
    expect(formatOrderDate("not a date")).toBe("not a date");
    expect(formatOrderDate("2026-09-29T10:00:00Z")).toMatch(/2026/);
  });
});
