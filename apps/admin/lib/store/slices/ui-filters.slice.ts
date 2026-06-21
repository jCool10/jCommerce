import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OrderStatus } from '@jcool/contracts';

export type ProductFilters = {
  search: string;
  categoryId: string | null;
  isActive: boolean | null;
};

export type OrderFilters = {
  status: OrderStatus | null;
};

type UiFiltersState = {
  products: ProductFilters;
  orders: OrderFilters;
};

const initialState: UiFiltersState = {
  products: { search: '', categoryId: null, isActive: null },
  orders: { status: null },
};

export const uiFiltersSlice = createSlice({
  name: 'uiFilters',
  initialState,
  reducers: {
    setProductFilters(state, action: PayloadAction<Partial<ProductFilters>>) {
      Object.assign(state.products, action.payload);
    },
    resetProductFilters(state) {
      state.products = initialState.products;
    },
    setOrderStatus(state, action: PayloadAction<OrderStatus | null>) {
      state.orders.status = action.payload;
    },
  },
});

export const { setProductFilters, resetProductFilters, setOrderStatus } = uiFiltersSlice.actions;
export const uiFiltersReducer = uiFiltersSlice.reducer;
