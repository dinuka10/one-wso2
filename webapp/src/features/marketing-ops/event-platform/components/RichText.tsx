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


import { Box } from "@wso2/oxygen-ui";
import type { SxProps, Theme } from "@wso2/oxygen-ui";
import type { ElementType } from "react";
import {
  sanitizeInlineRichText,
  sanitizeRichText,
} from "@features/marketing-ops/event-platform/utils/sanitizeHtml";

// Read-only render of stored rich text. The value is sanitised here, on every
// render, because it comes from the API and this is the only place it meets
// the DOM. `inline` is for titles (no block tags, lines as <br>), `full` for
// descriptions.
export default function RichText({
  html,
  component = "div",
  variant = "full",
  sx,
}: {
  html: string;
  component?: ElementType;
  variant?: "inline" | "full";
  sx?: SxProps<Theme>;
}) {
  const clean = variant === "inline" ? sanitizeInlineRichText(html) : sanitizeRichText(html);

  return (
    <Box
      component={component}
      sx={[
        {
          "& p, & ul, & ol, & blockquote": { my: 0 },
          "& ul, & ol": { pl: 3 },
          "& blockquote": { pl: 1.5, borderLeft: 3, borderColor: "divider", color: "text.secondary" },
          "& a": { color: "primary.main" },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
