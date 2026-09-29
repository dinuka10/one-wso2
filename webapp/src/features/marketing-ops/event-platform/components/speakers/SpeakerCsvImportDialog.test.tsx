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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventPlatformKeys as keys } from "../../api/queryKeys";
import SpeakerCsvImportDialog from "./SpeakerCsvImportDialog";

const api = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../api/speakers", () => ({
  useListSpeakers: () => ({ data: [] }),
  useCreateSpeaker: () => ({ mutateAsync: api.create }),
  useUpdateSpeaker: () => ({ mutateAsync: vi.fn() }),
}));

function setup() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const onClose = vi.fn();
  const ui = (open: boolean) => (
    <QueryClientProvider client={client}>
      <SpeakerCsvImportDialog open={open} onClose={onClose} />
    </QueryClientProvider>
  );
  const { rerender } = render(ui(true));
  return { onClose, invalidate, reopen: () => (rerender(ui(false)), rerender(ui(true))) };
}

async function choose(csv: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  // jsdom's File has no text(), the one method the dialog reads it with.
  fireEvent.change(input, { target: { files: [{ text: () => Promise.resolve(csv) }] } });
  await screen.findByRole("button", { name: "Import" });
}

const escape = () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

describe("SpeakerCsvImportDialog", () => {
  beforeEach(() => api.create.mockReset().mockResolvedValue({}));

  it("reopens empty after Escape in the preview", async () => {
    const { onClose, reopen } = setup();
    await choose("name\nNew Person");
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    reopen();
    expect(await screen.findByText("Choose CSV file")).toBeInTheDocument();
    expect(screen.queryByText("New Person")).toBeNull();
  });

  it("refreshes the library and reopens empty after Escape once done", async () => {
    const { onClose, invalidate, reopen } = setup();
    await choose("name\nNew Person");
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await screen.findByRole("button", { name: "Done" });
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.speakers });
    reopen();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Done" })).toBeNull());
    expect(screen.getByText("Choose CSV file")).toBeInTheDocument();
  });
});
