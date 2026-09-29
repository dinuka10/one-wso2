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

import type { KeyboardEvent } from "react";

// Fires `onSubmit` on Cmd+Enter (mac) or Ctrl+Enter (elsewhere). Attach the
// returned handler to a dialog's onKeyDown so it works whichever field has
// focus. Plain Enter is left alone so multiline fields still take newlines.
export function useSubmitShortcut(onSubmit: () => void, enabled = true) {
  return (e: KeyboardEvent) => {
    if (!enabled) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };
}
