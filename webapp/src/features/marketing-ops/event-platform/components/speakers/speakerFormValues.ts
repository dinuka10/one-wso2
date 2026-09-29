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


import type { SpeakerInput } from "../../api/speakers";
import type { Speaker, SpeakerType } from "../../types/eventPlatformTypes";
import { SPEAKER_TYPES } from "./speakerTypes";

// The speaker form's values and how they become a request body. Pure, so the
// trimming and empty-to-null rules are tested without rendering the dialog.

export interface SpeakerFormValues {
  name: string;
  title: string;
  bio: string;
  photoUrl: string;
  // "" until one is picked; the form cannot be saved without one.
  speakerType: SpeakerType | "";
  company: string;
  companyLogoUrl: string;
  // Free-form CSS the public agenda applies to the logo (card and modal).
  companyLogoSize: string;
  modalCompanyLogoSize: string;
  linkedinUrl: string;
}

// What an internal speaker's empty company field is filled with when the type
// is picked — they all work for the organiser.
export const INTERNAL_COMPANY_NAME = "WSO2";

export function speakerFormValues(speaker: Speaker | null): SpeakerFormValues {
  return {
    name: speaker?.name ?? "",
    title: speaker?.title ?? "",
    bio: speaker?.bio ?? "",
    photoUrl: speaker?.photoUrl ?? "",
    speakerType: speaker?.speakerType ?? "",
    company: speaker?.company ?? "",
    companyLogoUrl: speaker?.companyLogoUrl ?? "",
    companyLogoSize: speaker?.companyLogoSize ?? "",
    modalCompanyLogoSize: speaker?.modalCompanyLogoSize ?? "",
    linkedinUrl: speaker?.linkedinUrl ?? "",
  };
}

/** Name, title and type are required — the source's rule, not the backend's. */
export function isSpeakerFormValid(values: Pick<SpeakerFormValues, "name" | "title" | "speakerType">) {
  return values.name.trim().length > 0 && values.title.trim().length > 0 && values.speakerType !== "";
}

/**
 * The create/replace body. As in the source: the bio is sent as typed, company
 * and LinkedIn go as (possibly empty) strings, and the URL and logo-style
 * fields become null when blank so the agenda falls back to its defaults.
 */
export function toSpeakerInput(values: SpeakerFormValues): SpeakerInput {
  if (values.speakerType === "") throw new Error("A speaker type is required.");
  return {
    name: values.name.trim(),
    title: values.title.trim(),
    bio: values.bio,
    speakerType: values.speakerType,
    company: values.company.trim(),
    linkedinUrl: values.linkedinUrl.trim(),
    photoUrl: values.photoUrl.trim() || null,
    companyLogoUrl: values.companyLogoUrl.trim() || null,
    companyLogoSize: values.companyLogoSize.trim() || null,
    modalCompanyLogoSize: values.modalCompanyLogoSize.trim() || null,
  };
}

/**
 * The types the Select offers: `allowed` (all four when omitted), plus the
 * speaker's current type if `allowed` leaves it out — otherwise editing a
 * keynote from a page that offers only internal/external would show a blank
 * Select and save a type the person never chose.
 */
export function speakerTypeChoices(
  allowed: readonly SpeakerType[] | undefined,
  current: SpeakerType | "",
): SpeakerType[] {
  return SPEAKER_TYPES.filter((t) => !allowed || allowed.includes(t) || t === current);
}
