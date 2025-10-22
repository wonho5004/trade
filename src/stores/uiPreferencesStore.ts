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
        // 렌더 중 set() 호출을 피하기 위해 기본값만 반환하고,
        // 실제 저장은 updateSymbolsPickerPrefs 경로에서 처리한다.
        return defaultState.symbolsPicker;
      },
      updateSymbolsPickerPrefs: (patch) => {
        const state = get();
        const base = state.autoTrading.symbolsPicker ?? defaultState.symbolsPicker;
        const next = {
          columns: { ...base.columns, ...(patch.columns ?? {}) },
          filters: { ...base.filters, ...(patch.filters ?? {}) },
          columnsOrder: (patch as any).columnsOrder ? ([...((patch as any).columnsOrder)] as any) : base.columnsOrder,
          columnsWidth: (patch as any).columnsWidth ? ({ ...base.columnsWidth, ...((patch as any).columnsWidth) } as any) : base.columnsWidth
        } as AutoTradingUIPreferences['symbolsPicker'];

        const eqObj = (a: any, b: any) => {
          const ak = Object.keys(a);
          const bk = Object.keys(b);
          if (ak.length !== bk.length) return false;
          for (const k of ak) if (a[k] !== (b as any)[k]) return false;
          return true;
        };
        const eqArr = (a: any[], b: any[]) => a.length === b.length && a.every((v, i) => v === b[i]);
        const unchanged =
          eqObj(base.columns, next.columns) &&
          eqObj(base.filters, next.filters) &&
          eqArr(base.columnsOrder as any, next.columnsOrder as any) &&
          eqObj(base.columnsWidth, next.columnsWidth);
        if (unchanged) return; // do not call set

        set({
          autoTrading: {
            ...state.autoTrading,
            symbolsPicker: next
          }
        } as any);
      }
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
