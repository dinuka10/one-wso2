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

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Speaker } from "../../types/eventPlatformTypes";
import SpeakerCard from "./SpeakerCard";

const SPEAKER: Speaker = {
  id: "42",
  name: "Speaker One",
  title: "Engineer",
  bio: "A long bio.",
  photoUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  speakerType: "keynote",
  company: null,
  companyLogoUrl: null,
  companyLogoSize: null,
  modalCompanyLogoSize: null,
  linkedinUrl: "https://www.example.com/in/speaker-one",
  visible: true,
};

describe("SpeakerCard", () => {
  it("opens the preview from the keyboard as well as the mouse", () => {
    const onPreview = vi.fn();
    render(<SpeakerCard speaker={SPEAKER} onPreview={onPreview} />);
    const card = screen.getByRole("button", { name: "Preview Speaker One" });
    expect(card).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    fireEvent.click(card);
    expect(onPreview).toHaveBeenCalledTimes(3);
    expect(onPreview).toHaveBeenCalledWith(SPEAKER);
    fireEvent.keyDown(card, { key: "a" });
    expect(onPreview).toHaveBeenCalledTimes(3);
  });
});
