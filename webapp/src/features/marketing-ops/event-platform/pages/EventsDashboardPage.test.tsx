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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { MarketingOpsGate } from "@features/marketing-ops/api/useMarketingOpsGate";
import type { ConferenceConfig } from "../types/eventPlatformTypes";
import EventsDashboardPage from "./EventsDashboardPage";

// The two faces of the dashboard (the port spec's §8 Q1) and the live-shop
// warning in front of creating an event.

vi.mock("@config/apiConfig", () => ({
  isMarketingOpsBackendConfigured: () => true,
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: vi.fn() }),
}));

const api = vi.hoisted(() => ({
  events: [] as ConferenceConfig[],
  mutateAsync: vi.fn(),
}));
vi.mock("../api/events", () => ({
  useListEvents: () => ({ data: api.events, isLoading: false, isError: false }),
  useCreateEvent: () => ({ mutateAsync: api.mutateAsync, isPending: false }),
}));

const gate = vi.hoisted(() => ({ value: {} as MarketingOpsGate }));
vi.mock("@features/marketing-ops/api/useMarketingOpsGate", () => ({
  useMarketingOpsGate: () => gate.value,
}));

function gateAllowing(...ids: string[]): MarketingOpsGate {
  return {
    canSee: (id) => ids.includes(id),
    isAuthorized: true,
    isAdmin: false,
    isResolving: false,
    isError: false,
    retry: () => {},
  };
}

const ADMIN = gateAllowing(
  "mops-event-platform-admin",
  "mops-event-platform-events",
  "mops-event-platform-shop",
);
const SHOP_ONLY = gateAllowing("mops-event-platform-events", "mops-event-platform-shop");

function event(id: string, name: string, createdAt: string, shopClosingTime: string | null): ConferenceConfig {
  return {
    id,
    name,
    startDate: "2026-10-01",
    createdAt,
    updatedAt: createdAt,
    articleLinksEnabled: false,
    videoLinksEnabled: false,
    timezone: "UTC",
    shopClosingTime,
    days: [
      {
        id: `${id}-day`,
        configId: id,
        dayIndex: 0,
        date: "2026-10-01",
        startMinute: 480,
        endMinute: 1020,
        label: null,
        startTimeOffset: "+00:00",
        endTimeOffset: "+00:00",
      },
    ],
  };
}

function UrlProbe() {
  return <div data-testid="url">{useLocation().pathname}</div>;
}

const BASE = "/marketing-ops/event-platform/events";

function renderPage(g: MarketingOpsGate) {
  gate.value = g;
  render(
    <MemoryRouter initialEntries={[BASE]}>
      <UrlProbe />
      <Routes>
        <Route path="*" element={<EventsDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function openCreateDialog() {
  fireEvent.click(screen.getByRole("button", { name: "New Event" }));
  fireEvent.change(screen.getByRole("textbox", { name: /Event name/ }), { target: { value: "Next" } });
}

describe("EventsDashboardPage", () => {
  beforeEach(() => {
    api.mutateAsync.mockReset();
    api.events = [
      // The newest by createdAt is the live one; its shop has no closing time.
      event("old", "Old Conf", "2025-01-01T00:00:00Z", "2025-02-01T00:00:00Z"),
      event("live", "Live Conf", "2026-01-01T00:00:00Z", null),
    ];
  });

  it("gives a shop-only operator the list without create, cards leading to the shop", () => {
    renderPage(SHOP_ONLY);
    expect(screen.queryByRole("button", { name: "New Event" })).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: /Live Conf/ }));
    expect(screen.getByTestId("url").textContent).toBe(`${BASE}/live/shop/inventory`);
  });

  it("gives an admin create, cards leading to the agenda", () => {
    renderPage(ADMIN);
    expect(screen.getByRole("button", { name: "New Event" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /Live Conf/ }));
    expect(screen.getByTestId("url").textContent).toBe(`${BASE}/live/sessions/agenda`);
  });

  it("warns before creating over a live shop, from the button", () => {
    renderPage(ADMIN);
    openCreateDialog();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByText("Heads Up: Switching Live Events")).toBeInTheDocument();
    expect(api.mutateAsync).not.toHaveBeenCalled();
  });

  it("warns before creating over a live shop, from Cmd/Ctrl+Enter, and a second press doesn't confirm", () => {
    renderPage(ADMIN);
    openCreateDialog();
    const name = screen.getByRole("textbox", { name: /Event name/ });
    fireEvent.keyDown(name, { key: "Enter", ctrlKey: true });
    expect(screen.getByText("Heads Up: Switching Live Events")).toBeInTheDocument();
    fireEvent.keyDown(name, { key: "Enter", metaKey: true });
    expect(api.mutateAsync).not.toHaveBeenCalled();
  });

  it("creates straight away once the live shop has closed", () => {
    api.events = [event("live", "Live Conf", "2026-01-01T00:00:00Z", "2020-01-01T00:00:00Z")];
    api.mutateAsync.mockResolvedValue(event("new", "Next", "2026-09-01T00:00:00Z", null));
    renderPage(ADMIN);
    openCreateDialog();
    fireEvent.keyDown(screen.getByRole("textbox", { name: /Event name/ }), { key: "Enter", ctrlKey: true });
    expect(screen.queryByText("Heads Up: Switching Live Events")).toBeNull();
    expect(api.mutateAsync).toHaveBeenCalledTimes(1);
  });
});
