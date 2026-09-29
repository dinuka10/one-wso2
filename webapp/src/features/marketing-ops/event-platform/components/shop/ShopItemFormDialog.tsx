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

import { Controller, useForm } from "react-hook-form";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@wso2/oxygen-ui";
import type { ShopItem } from "../../types/eventPlatformTypes";
import { useSubmitShortcut } from "../../hooks/useSubmitShortcut";
import {
  checkImageUrl,
  checkLimit,
  checkPrice,
  checkRequired,
  checkStock,
  fromShopItemFormValues,
  toShopItemFormValues,
  type ShopItemFields,
  type ShopItemFormValues,
} from "../../utils/shop";

interface Props {
  open: boolean;
  /** The item being edited; absent to add one. */
  item?: ShopItem | null;
  existingCategories: string[];
  isPending: boolean;
  onSave: (fields: ShopItemFields) => void;
  onClose: () => void;
}

// Add or edit one shop item. Visibility is not on the form: a new item goes
// live, and an edited one keeps whatever the eye button last set.
export default function ShopItemFormDialog({ open, item, ...rest }: Props) {
  return (
    <Dialog open={open} onClose={rest.onClose} fullWidth maxWidth="sm">
      {/* Remounted per item so the form's defaults are the item's — the
          source's `key` trick, kept because useForm reads defaults once. */}
      {open && <ItemForm key={item?.id ?? "new"} item={item} {...rest} />}
    </Dialog>
  );
}

function ItemForm({ item, existingCategories, isPending, onSave, onClose }: Omit<Props, "open">) {
  const { control, handleSubmit } = useForm<ShopItemFormValues>({
    defaultValues: toShopItemFormValues(item),
    mode: "onTouched",
  });
  const submit = handleSubmit((values) => onSave(fromShopItemFormValues(values)));
  const onKeyDown = useSubmitShortcut(() => void submit(), !isPending);

  return (
    <Box component="form" noValidate onSubmit={submit} onKeyDown={onKeyDown}>
      <DialogTitle>{item ? "Edit shop item" : "Add shop item"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        <Controller
          name="name"
          control={control}
          rules={{ validate: checkRequired("Name") }}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label="Name"
              required
              autoFocus
              fullWidth
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({ field }) => <TextField {...field} label="Description" fullWidth multiline rows={3} />}
        />
        <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
          <Controller
            name="price"
            control={control}
            rules={{ validate: checkPrice }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Price (O2C)"
                required
                type="number"
                fullWidth
                slotProps={{ htmlInput: { min: 0 } }}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="availableStock"
            control={control}
            rules={{ validate: checkStock }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                // The source said "Initial Stock" on edit too, where it is the
                // stock left now.
                label={item ? "Stock" : "Initial stock"}
                required
                type="number"
                fullWidth
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </Box>
        <Controller
          name="imageUrl"
          control={control}
          rules={{ validate: checkImageUrl }}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label="Image URL"
              required
              fullWidth
              placeholder="https://"
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message}
            />
          )}
        />
        <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
          <Controller
            name="category"
            control={control}
            rules={{ validate: checkRequired("Category") }}
            render={({ field, fieldState }) => (
              // freeSolo: pick a category already in use, or type a new one.
              <Autocomplete
                freeSolo
                fullWidth
                options={existingCategories}
                value={field.value}
                inputValue={field.value}
                onChange={(_, v) => field.onChange(v ?? "")}
                onInputChange={(_, v) => field.onChange(v)}
                onBlur={field.onBlur}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputRef={field.ref}
                    label="Category"
                    required
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            )}
          />
          <Controller
            name="maxPerUser"
            control={control}
            rules={{ validate: checkLimit }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Max per attendee"
                type="number"
                fullWidth
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                error={Boolean(fieldState.error)}
                helperText={
                  fieldState.error?.message ?? "The most one attendee may buy. Leave empty for no limit."
                }
              />
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={isPending}>
          {isPending ? <CircularProgress size={16} color="inherit" /> : "Save"}
        </Button>
      </DialogActions>
    </Box>
  );
}
