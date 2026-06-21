import { configureStore } from '@reduxjs/toolkit';
import { uiFiltersReducer } from './slices/ui-filters.slice';
import { selectionReducer } from './slices/selection.slice';
import { modalsReducer } from './slices/modals.slice';

export const makeStore = () =>
  configureStore({
    reducer: {
      uiFilters: uiFiltersReducer,
      selection: selectionReducer,
      modals: modalsReducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
