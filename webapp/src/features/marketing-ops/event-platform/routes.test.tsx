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

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, useLocation } from "react-router";
import type { MarketingOpsGate } from "@features/marketing-ops/api/useMarketingOpsGate";
import { eventPlatformRoutes } from "./routes";
import {
  EVENT_TABS,
  TOP_LEVEL_TABS,
  eventPath,
  eventPlatformPath,
  type EventPlatformKindDef,
} from "./eventPlatformTabs";

// eventPlatformTabs.test.ts pins what the tabs OFFER. This pins what the ROUTES
// allow, which is the part that is access control: the gate ids are written
// out twice, and a typed URL goes through the routes, not the tabs.

vi.mock("@config/apiConfig", () => ({
  isMarketingOpsBackendConfigured: () => true,
  isEventPlatformConfigured: () => true,
}));

// The event switcher in the event header lists events; what it lists is not
// what these tests are about, and the real hook needs Asgardeo and a
// QueryClient.
vi.mock("@features/marketing-ops/event-platform/api/events", () => ({
  useListEvents: () => ({ data: [], isLoading: false }),
}));

// The routes are under test here, not the screens. The finished screens
// need a QueryClient and more of the API than the mocks above, so they are
// swapped for the placeholder the visits below wait for.
vi.mock("./pages/EventsDashboardPage", async () => {
  const { default: ComingSoon } = await import("./components/ComingSoon");
  return { default: () => <ComingSoon screen="Events" phase={3} /> };
});
vi.mock("./pages/SpeakerLibraryPage", async () => {
  const { default: ComingSoon } = await import("./components/ComingSoon");
  return { default: () => <ComingSoon screen="Speaker library" phase={3} /> };
});
vi.mock("./pages/EventSpeakersPage", async () => {
  const { default: ComingSoon } = await import("./components/ComingSoon");
  return { default: () => <ComingSoon screen="Speakers" phase={3} /> };
});

const gate = vi.hoisted(() => ({ value: {} as MarketingOpsGate }));
vi.mock("@features/marketing-ops/api/useMarketingOpsGate", () => ({
  useMarketingOpsGate: () => gate.value,
}));

// The finished Settings screen needs a QueryClient and a signed-in session; the routes are
// under test here, so it is swapped for the placeholder the visits wait for.
vi.mock("./pages/EventSettingsPage", async () => {
  const { default: ComingSoon } = await import("./components/ComingSoon");
  return { default: () => <ComingSoon screen="Settings" phase={4} /> };
});

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
const NOBODY = gateAllowing();

function UrlProbe() {
  return <div data-testid="url">{useLocation().pathname}</div>;
}

async function visit(path: string, g: MarketingOpsGate) {
  gate.value = g;
  render(
    <MemoryRouter initialEntries={[path]}>
      <UrlProbe />
      <Routes>{eventPlatformRoutes}</Routes>
    </MemoryRouter>,
  );
  // Leaves are lazy, so wait for the chunk rather than the first paint.
  await screen.findByText(/Coming in phase/);
}

const url = () => screen.getByTestId("url").textContent;

describe("the Event Platform routes", () => {
  it("land an admin on the events list", async () => {
    await visit("/marketing-ops/event-platform", ADMIN);
    expect(url()).toBe("/marketing-ops/event-platform/events");
  });

  it("land an admin inside an event at its agenda", async () => {
    await visit("/marketing-ops/event-platform/events/42", ADMIN);
    expect(url()).toBe("/marketing-ops/event-platform/events/42/sessions/agenda");
    expect(screen.getByRole("link", { name: /All events/ })).toBeInTheDocument();
  });

  it("land a shop-only user inside an event at its inventory", async () => {
    await visit("/marketing-ops/event-platform/events/42", SHOP_ONLY);
    expect(url()).toBe("/marketing-ops/event-platform/events/42/shop/inventory");
    // The list is open to them too, so the way back is offered.
    expect(screen.getByRole("link", { name: /All events/ })).toBeInTheDocument();
  });

  it("send a shop-only user who types an admin URL to the shop instead", async () => {
    await visit("/marketing-ops/event-platform/events/42/sessions/rooms", SHOP_ONLY);
    expect(url()).toBe("/marketing-ops/event-platform/events/42/shop/inventory");
  });

  it("let a shop-only user open the orders", async () => {
    await visit("/marketing-ops/event-platform/events/42/shop/orders", SHOP_ONLY);
    expect(url()).toBe("/marketing-ops/event-platform/events/42/shop/orders");
    expect(screen.getByText("Shop orders")).toBeInTheDocument();
  });

  // The All Events rail item is open to shop users, so its route must be too —
  // otherwise the rail offers a dead end.
  it("land a shop-only user at the top level on the events list", async () => {
    await visit("/marketing-ops/event-platform", SHOP_ONLY);
    expect(url()).toBe("/marketing-ops/event-platform/events");
  });

  it("send a shop-only user who types the speaker library URL to the events list", async () => {
    await visit("/marketing-ops/event-platform/speakers", SHOP_ONLY);
    expect(url()).toBe("/marketing-ops/event-platform/events");
  });

  it("tell someone with neither role that nothing is available", () => {
    gate.value = NOBODY;
    render(
      <MemoryRouter initialEntries={["/marketing-ops/event-platform"]}>
        <Routes>{eventPlatformRoutes}</Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/isn.t available for your role/)).toBeInTheDocument();
  });

  // A tab's parent path goes through its index, not a guarded leaf, so it
  // needs the same fallback: the shop user has no Sessions kind to land on.
  it("send a shop-only user who types a tab they cannot use to the shop", async () => {
    await visit("/marketing-ops/event-platform/events/42/sessions", SHOP_ONLY);
    expect(url()).toBe("/marketing-ops/event-platform/events/42/shop/inventory");
  });

  it("render a malformed event id instead of blanking the app", async () => {
    await visit("/marketing-ops/event-platform/events/%E0/settings", ADMIN);
    expect(url()).toBe("/marketing-ops/event-platform/events/%E0/settings");
  });
});

// Every leaf, read off the tab definitions: the routes spell their gate ids out
// separately, so walk each kind and check its route asks exactly that id. A
// leaf wired to the wrong gate (a shop gate on Settings, say) fails here.
const LEAVES: { path: string; kind: EventPlatformKindDef }[] = [
  ...TOP_LEVEL_TABS.flatMap((tab) =>
    tab.kinds.map((kind) => ({ path: eventPlatformPath(tab, kind.kind), kind })),
  ),
  ...EVENT_TABS.flatMap((tab) =>
    tab.kinds.map((kind) => ({ path: eventPath("42", tab, kind.kind), kind })),
  ),
];
const ALL_GATE_IDS = [...new Set(LEAVES.map((l) => l.kind.gateId))];

describe("each Event Platform leaf", () => {
  it.each(LEAVES)("opens $path to its own gate id", async ({ path, kind }) => {
    await visit(path, gateAllowing(kind.gateId));
    expect(url()).toBe(path);
  });

  it.each(LEAVES)("refuses $path to everyone but its own gate id", async ({ path, kind }) => {
    gate.value = gateAllowing(...ALL_GATE_IDS.filter((id) => id !== kind.gateId));
    render(
      <MemoryRouter initialEntries={[path]}>
        <UrlProbe />
        <Routes>{eventPlatformRoutes}</Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      const refused =
        url() !== path || screen.queryByText(/isn.t available for your role/) !== null;
      expect(refused).toBe(true);
    });
  });
});
