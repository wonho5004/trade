import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type CollapsedSections = Record<string, boolean>;

type SymbolsPickerColumns = {
  vol: boolean;
  val: boolean;
  chg: boolean;
  age: boolean;
};

type SymbolsPickerFilters = {
  filterStable: boolean;
  hideUnknownListing: boolean;
  hideListingDays: number | null;
};

type SymbolsPickerWidths = Record<'vol' | 'val' | 'chg' | 'age', number>;

type AutoTradingUIPreferences = {
  collapsedSections: CollapsedSections;
  symbolsPicker: {
    columns: SymbolsPickerColumns;
    filters: SymbolsPickerFilters;
    columnsOrder: Array<'vol' | 'val' | 'chg' | 'age'>;
    columnsWidth: SymbolsPickerWidths;
  };
};

type UIPreferencesState = {
  autoTrading: AutoTradingUIPreferences;
  isCollapsed: (key: string) => boolean;
  toggleCollapsed: (key: string) => void;
  setCollapsed: (key: string, value: boolean) => void;
  getSymbolsPickerPrefs: () => AutoTradingUIPreferences['symbolsPicker'];
  updateSymbolsPickerPrefs: (patch: Partial<AutoTradingUIPreferences['symbolsPicker']>) => void;
};

const defaultState: UIPreferencesState['autoTrading'] = {
  collapsedSections: {},
  symbolsPicker: {
    columns: { vol: true, val: true, chg: true, age: true },
    filters: { filterStable: true, hideUnknownListing: false, hideListingDays: null },
    columnsOrder: ['vol', 'val', 'chg', 'age'],
    columnsWidth: { vol: 96, val: 96, chg: 96, age: 96 }
  }
};

export const useUIPreferencesStore = create<UIPreferencesState>()(
  persist(
    (set, get) => ({
      autoTrading: defaultState,
      // Default to collapsed unless explicitly set to false
      isCollapsed: (key) => get().autoTrading.collapsedSections[key] !== false,
      toggleCollapsed: (key) =>
        set((state) => {
          const currentlyCollapsed = state.autoTrading.collapsedSections[key] !== false;
          return {
            autoTrading: {
              ...state.autoTrading,
              collapsedSections: {
                ...state.autoTrading.collapsedSections,
                [key]: !currentlyCollapsed
              }
            }
          };
        }),
      setCollapsed: (key, value) =>
        set((state) => ({
          autoTrading: {
            ...state.autoTrading,
            collapsedSections: {
              ...state.autoTrading.collapsedSections,
              [key]: value
            }
          }
        })),
      getSymbolsPickerPrefs: () => {
        const box = get().autoTrading?.symbolsPicker;
        if (box && box.columns && box.filters) return box;
        // hydrate missing prefs with defaults (for older persisted states)
        set((state) => ({
          autoTrading: {
            ...state.autoTrading,
            symbolsPicker: state.autoTrading.symbolsPicker ?? defaultState.symbolsPicker
          }
        }));
        return defaultState.symbolsPicker;
      },
      updateSymbolsPickerPrefs: (patch) =>
        set((state) => {
          const base = state.autoTrading.symbolsPicker ?? defaultState.symbolsPicker;
          return {
            autoTrading: {
              ...state.autoTrading,
              symbolsPicker: {
                columns: { ...base.columns, ...(patch.columns ?? {}) },
                filters: { ...base.filters, ...(patch.filters ?? {}) },
                columnsOrder: (patch as any).columnsOrder ? ([...((patch as any).columnsOrder)] as any) : base.columnsOrder,
                columnsWidth: (patch as any).columnsWidth ? ({ ...base.columnsWidth, ...((patch as any).columnsWidth) } as any) : base.columnsWidth
              }
            }
          };
        })
    }),
    {
      name: 'ui-preferences-v1',
      version: 4,
      migrate: (persisted) => {
        try {
          const p = persisted as any;
          const auto = (p?.autoTrading ?? {}) as any;
          const merged = {
            autoTrading: {
              collapsedSections: auto?.collapsedSections ?? {},
              symbolsPicker: {
                columns: { vol: true, val: true, chg: true, age: true, ...(auto?.symbolsPicker?.columns ?? {}) },
                filters: { filterStable: true, hideUnknownListing: false, hideListingDays: null, ...(auto?.symbolsPicker?.filters ?? {}) },
                columnsOrder: Array.isArray(auto?.symbolsPicker?.columnsOrder) && auto.symbolsPicker.columnsOrder.length === 4
                  ? auto.symbolsPicker.columnsOrder
                  : (['vol', 'val', 'chg', 'age'] as Array<'vol' | 'val' | 'chg' | 'age'>),
                columnsWidth: {
                  vol: 96,
                  val: 96,
                  chg: 96,
                  age: 96,
                  ...(auto?.symbolsPicker?.columnsWidth ?? {})
                }
              }
            }
          };
          return { ...p, ...merged };
        } catch {
          return { autoTrading: defaultState } as any;
        }
      }
    }
  )
);
