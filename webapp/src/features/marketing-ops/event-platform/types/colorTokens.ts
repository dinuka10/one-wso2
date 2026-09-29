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

// The colour vocabulary a track or a room is assigned — names only. The backend
// enforces exactly these with a CHECK constraint (agenda-organizer migration
// 030_orange_color_token.sql), and every downstream app (the attendee microapp,
// the public agenda stylesheet) owns its own colour for each name, which is what
// lets them theme per appearance. So no hex ever travels over the API, and a
// ninth name needs the constraint changed first.
//
// The swatch hexes below are only for this admin tool's own swatches and board.

export const COLOR_TOKEN_NAMES = [
  "red",
  // Added for a venue's "Orange Room", which had been squatting on "red".
  // Ordered by hue, between the two names it sits between.
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "dark-blue",
  "main",
] as const;

export type ColorToken = (typeof COLOR_TOKEN_NAMES)[number];

// What an unset or unrecognised token resolves to, matching the backend's
// COALESCE(rooms.color_token, tracks.color_token, 'main').
export const DEFAULT_COLOR_TOKEN: ColorToken = "main";

export function isColorToken(value: unknown): value is ColorToken {
  return (COLOR_TOKEN_NAMES as readonly unknown[]).includes(value);
}

export function colorTokenOf(value: string | null | undefined): ColorToken {
  return isColorToken(value) ? value : DEFAULT_COLOR_TOKEN;
}

export type ColorScheme = "light" | "dark";

export interface ColorTokenSwatch {
  label: string;
  light: string;
  dark: string;
}

// Light values are the source's, unchanged, so the board matches what the
// downstream apps draw. Dark values differ only where the light hex would
// vanish against a dark surface: dark-blue is 1.2:1 there, purple 3.2:1.
const SWATCHES: Record<ColorToken, ColorTokenSwatch> = {
  red: { label: "Red", light: "#e0414a", dark: "#e0414a" },
  orange: { label: "Orange", light: "#ee7b30", dark: "#ee7b30" },
  yellow: { label: "Yellow", light: "#d4a900", dark: "#d4a900" },
  green: { label: "Green", light: "#2faf5a", dark: "#2faf5a" },
  blue: { label: "Blue", light: "#08baf6", dark: "#08baf6" },
  purple: { label: "Purple", light: "#9104f5", dark: "#b36bff" },
  "dark-blue": { label: "Dark blue", light: "#1c1565", dark: "#7b72e0" },
  main: { label: "Main", light: "#9297af", dark: "#9297af" },
};

// Ordered for pickers: swatches read left to right in this order everywhere.
export const COLOR_TOKENS: ReadonlyArray<{ token: ColorToken } & ColorTokenSwatch> =
  COLOR_TOKEN_NAMES.map((token) => ({ token, ...SWATCHES[token] }));

export function colorTokenSwatch(value: string | null | undefined): ColorTokenSwatch {
  return SWATCHES[colorTokenOf(value)];
}

// Pick the scheme in `sx` with `theme.applyStyles("dark", …)` rather than
// reading `palette.mode`, which does not follow the CSS-variables scheme switch.
export function colorTokenHex(value: string | null | undefined, scheme: ColorScheme = "light"): string {
  return colorTokenSwatch(value)[scheme];
}

export function colorTokenLabel(value: string | null | undefined): string {
  return colorTokenSwatch(value).label;
}
