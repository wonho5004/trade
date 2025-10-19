import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type CollapsedSections = Record<string, boolean>;

type AutoTradingUIPreferences = {
  collapsedSections: CollapsedSections;
};

type UIPreferencesState = {
  autoTrading: AutoTradingUIPreferences;
  isCollapsed: (key: string) => boolean;
  toggleCollapsed: (key: string) => void;
  setCollapsed: (key: string, value: boolean) => void;
};

const defaultState: UIPreferencesState['autoTrading'] = {
  collapsedSections: {}
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
        }))
    }),
    {
      name: 'ui-preferences-v1'
    }
  )
);
