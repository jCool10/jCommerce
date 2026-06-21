import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type ModalsState = {
  productForm: { open: boolean; productId: string | null };
  bulkDeleteConfirm: { open: boolean };
  orderDetailDrawer: { open: boolean; orderId: string | null };
};

const initialState: ModalsState = {
  productForm: { open: false, productId: null },
  bulkDeleteConfirm: { open: false },
  orderDetailDrawer: { open: false, orderId: null },
};

export const modalsSlice = createSlice({
  name: 'modals',
  initialState,
  reducers: {
    openProductForm(state, action: PayloadAction<{ productId: string | null }>) {
      state.productForm = { open: true, productId: action.payload.productId };
    },
    closeProductForm(state) {
      state.productForm = { open: false, productId: null };
    },
    openBulkDeleteConfirm(state) {
      state.bulkDeleteConfirm.open = true;
    },
    closeBulkDeleteConfirm(state) {
      state.bulkDeleteConfirm.open = false;
    },
    openOrderDrawer(state, action: PayloadAction<{ orderId: string }>) {
      state.orderDetailDrawer = { open: true, orderId: action.payload.orderId };
    },
    closeOrderDrawer(state) {
      state.orderDetailDrawer = { open: false, orderId: null };
    },
  },
});

export const {
  openProductForm,
  closeProductForm,
  openBulkDeleteConfirm,
  closeBulkDeleteConfirm,
  openOrderDrawer,
  closeOrderDrawer,
} = modalsSlice.actions;
export const modalsReducer = modalsSlice.reducer;
