import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type SelectionState = {
  products: string[];
};

const initialState: SelectionState = { products: [] };

export const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    toggleProduct(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.products.indexOf(id);
      if (idx >= 0) state.products.splice(idx, 1);
      else state.products.push(id);
    },
    setProductSelection(state, action: PayloadAction<string[]>) {
      state.products = action.payload;
    },
    clearProductSelection(state) {
      state.products = [];
    },
  },
});

export const { toggleProduct, setProductSelection, clearProductSelection } = selectionSlice.actions;
export const selectionReducer = selectionSlice.reducer;
