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
import {
  colorTokenHex,
  colorTokenLabel,
  colorTokenOf,
  COLOR_TOKEN_NAMES,
  COLOR_TOKENS,
  DEFAULT_COLOR_TOKEN,
  isColorToken,
} from "./colorTokens";

describe("the colour token vocabulary", () => {
  // The backend's CHECK constraint allows exactly these; a change here without
  // a migration there is a 400 on every save that uses the new name.
  it("is the eight names the backend accepts", () => {
    expect(COLOR_TOKEN_NAMES).toEqual([
      "red",
      "orange",
      "yellow",
      "green",
      "blue",
      "purple",
      "dark-blue",
      "main",
    ]);
  });

  it("recognises only those names", () => {
    expect(isColorToken("dark-blue")).toBe(true);
    expect(isColorToken("#ff0000")).toBe(false);
    expect(isColorToken(null)).toBe(false);
  });

  it("resolves an unset or unknown token to main, as the backend does", () => {
    expect(DEFAULT_COLOR_TOKEN).toBe("main");
    expect(colorTokenOf(null)).toBe("main");
    expect(colorTokenOf("teal")).toBe("main");
    expect(colorTokenOf("blue")).toBe("blue");
  });
});

describe("the colour token swatches", () => {
  it("has one swatch per name, in picker order", () => {
    expect(COLOR_TOKENS.map((t) => t.token)).toEqual([...COLOR_TOKEN_NAMES]);
  });

  it("falls back to the main swatch for an unknown token", () => {
    expect(colorTokenHex("teal")).toBe(colorTokenHex("main"));
    expect(colorTokenLabel(undefined)).toBe("Main");
  });

  it("lightens dark-blue for the dark scheme, where the light hex vanishes", () => {
    expect(colorTokenHex("dark-blue", "dark")).not.toBe(colorTokenHex("dark-blue"));
    expect(colorTokenHex("red", "dark")).toBe(colorTokenHex("red", "light"));
  });
});
