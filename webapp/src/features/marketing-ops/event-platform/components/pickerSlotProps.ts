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


// Shared `slotProps` for Oxygen's pickers, kept out of DatePickerProvider.tsx
// so that file exports only a component (react-refresh).

// Same fix as GRC's DateRangeFilter: the calendar popper otherwise picks up
// backdrop blur and transparency from its portal context, and turns
// see-through against the page behind it.
export const PICKER_PAPER_SX = {
  backdropFilter: "none",
  backgroundColor: "var(--oxygen-palette-background-default)",
};

/** Spread into a DatePicker/TimePicker/DateTimePicker's `slotProps`: opaque popper, small full-width field. */
export const PICKER_SLOT_PROPS = {
  desktopPaper: { sx: PICKER_PAPER_SX },
  textField: { size: "small", fullWidth: true },
} as const;
