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

import { useColorScheme, useTheme } from "@wso2/oxygen-ui";
import type { ColorScheme } from "@features/marketing-ops/event-platform/types/colorTokens";

// The scheme showing right now, for the track and room colours the board
// computes in JS (colorTokenHex needs a concrete scheme, and alpha() needs a
// concrete hex). Oxygen runs MUI on CSS variables, where the toggle switches
// the scheme through a selector and `theme.palette.mode` is not guaranteed to
// follow it — so the colour-scheme hook decides, as in GRC's
// WorkflowFunnelChart, and palette.mode only covers the first render before
// the hook has resolved a mode.
export function useColorSchemeMode(): ColorScheme {
  const { mode, systemMode } = useColorScheme();
  const theme = useTheme();
  if (mode === "dark" || mode === "light") return mode;
  if (mode === "system" && (systemMode === "dark" || systemMode === "light")) return systemMode;
  return theme.palette.mode;
}
