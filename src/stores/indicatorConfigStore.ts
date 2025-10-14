import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  BollingerConfig,
  BollingerHighlightConfig,
  DmiDominanceHighlightConfig,
  DmiHighlightConfig,
  DmiVisibilityConfig,
  HighlightThresholdSetting,
  IndicatorConfigState,
  LineStyleSetting,
  MacdHighlightConfig,
  MacdVisibilityConfig,
  MaConfig,
  MaHighlightConfig,
  RsiHighlightConfig,
  ValueHighlightSetting
} from '@/types/indicator';

const createId = () => Math.random().toString(36).slice(2, 10);

const clone = <T>(value: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

const defaultLineStyle = (color: string, lineWidth = 2): LineStyleSetting => ({
  color,
  lineWidth,
  lineStyle: 'solid'
});

const createHighlightThreshold = (
  color: string,
  label: string,
  markerShape: HighlightThresholdSetting['markerShape']
): HighlightThresholdSetting => ({
  enabled: false,
  color,
  label,
  markerShape
});

const createValueHighlight = (
  color: string,
  label: string,
  threshold: number,
  markerShape: HighlightThresholdSetting['markerShape']
): ValueHighlightSetting => ({
  ...createHighlightThreshold(color, label, markerShape),
  threshold
});

const createDefaultMaHighlight = (length: number): MaHighlightConfig => ({
  candleField: 'close',
  opacity: 0.12,
  over: createHighlightThreshold('#22c55e', '', 'arrowUp'),
  under: createHighlightThreshold('#ef4444', '', 'arrowDown')
});

const createMaConfig = (length: number, color: string, lineWidth = 2): MaConfig => ({
  id: createId(),
  length,
  color,
  lineWidth,
  lineStyle: 'solid',
  highlight: createDefaultMaHighlight(length)
});

const createDefaultMaConfigs = () => [createMaConfig(20, '#fde047', 2), createMaConfig(120, '#22d3ee', 2)];

const defaultRsiHighlight = (): RsiHighlightConfig => ({
  overbought: createHighlightThreshold('#ef4444', '', 'arrowDown'),
  oversold: createHighlightThreshold('#22c55e', '', 'arrowUp')
});

const defaultBollingerHighlight = (): BollingerHighlightConfig => ({
  candleField: 'close',
  upper: createHighlightThreshold('#f97316', '', 'arrowDown'),
  lower: createHighlightThreshold('#38bdf8', '', 'arrowUp')
});

const defaultDmiHighlight = (): DmiHighlightConfig => ({
  dominance: {
    candleField: 'close',
    plusOverMinus: createHighlightThreshold('#34d399', '', 'arrowUp'),
    minusOverPlus: createHighlightThreshold('#f87171', '', 'arrowDown')
  },
  adx: {
    over: createValueHighlight('#a855f7', '', 0, 'arrowUp'),
    under: { ...createValueHighlight('#a855f7', '', 0, 'arrowDown'), enabled: false }
  },
  adxr: {
    over: createValueHighlight('#38bdf8', '', 0, 'arrowUp'),
    under: { ...createValueHighlight('#38bdf8', '', 0, 'arrowDown'), enabled: false }
  }
});

const defaultDmiVisibility = (): DmiVisibilityConfig => ({
  plusDI: true,
  minusDI: true,
  dx: false,
  adx: true,
  adxr: true
});

const defaultMacdVisibility = (): MacdVisibilityConfig => ({
  macdLine: true,
  signalLine: true,
  histogram: true
});

const defaultMacdHighlight = (): MacdHighlightConfig => ({
  histogram: {
    turnUp: createHighlightThreshold('#22c55e', '', 'arrowUp'),
    turnDown: createHighlightThreshold('#ef4444', '', 'arrowDown')
  },
  crossover: {
    bullish: createHighlightThreshold('#facc15', '', 'arrowUp'),
    bearish: createHighlightThreshold('#22d3ee', '', 'arrowDown')
  }
});

const defaultBollingerConfig: BollingerConfig = {
  period: 20,
  multiplier: 2,
  offset: 0,
  median: defaultLineStyle('#f97316', 2),
  upper: defaultLineStyle('#f97316', 1),
  lower: defaultLineStyle('#f97316', 1),
  backgroundOpacity: 0.05,
  highlight: defaultBollingerHighlight()
};

const defaultRsiConfig = {
  period: 14,
  upperLimit: 70,
  middleLimit: 50,
  lowerLimit: 30,
  plot: defaultLineStyle('#60a5fa', 2),
  upper: defaultLineStyle('#ef4444', 1),
  middle: defaultLineStyle('#d4d4d8', 1),
  lower: defaultLineStyle('#22c55e', 1),
  backgroundOpacity: 0.1,
  highlight: defaultRsiHighlight()
};

const defaultMacdConfig = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  source: 'close' as const,
  oscillatorType: 'ema' as const,
  signalType: 'ema' as const,
  histogram: {
    colors: ['#f97316', '#f97316', '#22c55e', '#22c55e'] as [string, string, string, string]
  },
  macdLine: defaultLineStyle('#facc15', 2),
  signalLine: defaultLineStyle('#22d3ee', 2),
  highlight: defaultMacdHighlight(),
  visibility: defaultMacdVisibility()
};

const defaultDmiConfig = {
  diLength: 14,
  adxSmoothing: 14,
  plusDI: defaultLineStyle('#34d399', 2),
  minusDI: defaultLineStyle('#f87171', 2),
  dx: defaultLineStyle('#facc15', 2),
  adx: defaultLineStyle('#a855f7', 2),
  adxr: defaultLineStyle('#38bdf8', 2),
  highlight: defaultDmiHighlight(),
  visibility: defaultDmiVisibility()
};

const emptyStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0
};

const createDefaultState = () => ({
  ma: createDefaultMaConfigs(),
  bollinger: clone(defaultBollingerConfig),
  rsi: clone(defaultRsiConfig),
  macd: clone(defaultMacdConfig),
  dmi: clone(defaultDmiConfig)
});

export const useIndicatorConfigStore = create<IndicatorConfigState>()(
  persist(
    (set, get) => ({
      ...createDefaultState(),
      addMa: () =>
        set((state) => {
          if (state.ma.length >= 5) {
            return state;
          }
          const nextColorPalette = ['#facc15', '#22c55e', '#38bdf8', '#a855f7', '#f97316'];
          const color = nextColorPalette[state.ma.length % nextColorPalette.length];
          const next = createMaConfig(50, color);
          return { ma: [...state.ma, next] };
        }),
      updateMa: (id, partial) =>
        set((state) => ({
          ma: state.ma.map((item) => (item.id === id ? { ...item, ...partial } : item))
        })),
      removeMa: (id) =>
        set((state) => ({
          ma: state.ma.filter((item) => item.id !== id)
        })),
      refreshMa: () =>
        set((state) => ({
          ma: state.ma.map((item) => ({
            ...item,
            id: createId()
          }))
        })),
      updateMaHighlight: (id, partial) =>
        set((state) => ({
          ma: state.ma.map((item) =>
            item.id === id ? { ...item, highlight: { ...item.highlight, ...partial } } : item
          )
        })),
      updateMaHighlightThreshold: (id, key, partial) =>
        set((state) => ({
          ma: state.ma.map((item) =>
            item.id === id
              ? {
                  ...item,
                  highlight: {
                    ...item.highlight,
                    [key]: { ...item.highlight[key], ...partial }
                  }
                }
              : item
          )
        })),
      updateBollinger: (partial) =>
        set((state) => ({
          bollinger: { ...state.bollinger, ...partial }
        })),
      updateBollingerStyle: (key, partial) =>
        set((state) => ({
          bollinger: {
            ...state.bollinger,
            [key]: { ...state.bollinger[key], ...partial }
          }
        })),
      updateBollingerHighlight: (partial) =>
        set((state) => ({
          bollinger: {
            ...state.bollinger,
            highlight: { ...state.bollinger.highlight, ...partial }
          }
        })),
      updateBollingerHighlightThreshold: (key, partial) =>
        set((state) => ({
          bollinger: {
            ...state.bollinger,
            highlight: {
              ...state.bollinger.highlight,
              [key]: { ...state.bollinger.highlight[key], ...partial }
            }
          }
        })),
      updateRsi: (partial) =>
        set((state) => ({
          rsi: { ...state.rsi, ...partial }
        })),
      updateRsiStyle: (key, partial) =>
        set((state) => ({
          rsi: {
            ...state.rsi,
            [key]: { ...state.rsi[key], ...partial }
          }
        })),
      updateRsiHighlight: (partial) =>
        set((state) => ({
          rsi: {
            ...state.rsi,
            highlight: { ...state.rsi.highlight, ...partial }
          }
        })),
      updateRsiHighlightThreshold: (key, partial) =>
        set((state) => ({
          rsi: {
            ...state.rsi,
            highlight: {
              ...state.rsi.highlight,
              [key]: { ...state.rsi.highlight[key], ...partial }
            }
          }
        })),
      updateMacd: (partial) =>
        set((state) => ({
          macd: { ...state.macd, ...partial }
        })),
      updateMacdLine: (key, partial) =>
        set((state) => ({
          macd: {
            ...state.macd,
            [key]: { ...state.macd[key], ...partial }
          }
        })),
      updateMacdHighlightThreshold: (section, key, partial) =>
        set((state) => {
          if (section === 'histogram') {
            const typedKey = key as 'turnUp' | 'turnDown';
            return {
              macd: {
                ...state.macd,
                highlight: {
                  ...state.macd.highlight,
                  histogram: {
                    ...state.macd.highlight.histogram,
                    [typedKey]: {
                      ...state.macd.highlight.histogram[typedKey],
                      ...partial
                    }
                  }
                }
              }
            };
          }
          const typedKey = key as 'bullish' | 'bearish';
          return {
            macd: {
              ...state.macd,
              highlight: {
                ...state.macd.highlight,
                crossover: {
                  ...state.macd.highlight.crossover,
                  [typedKey]: {
                    ...state.macd.highlight.crossover[typedKey],
                    ...partial
                  }
                }
              }
            }
          };
        }),
      updateMacdHistogramColor: (index, color) =>
        set((state) => {
          const next = [...state.macd.histogram.colors] as [string, string, string, string];
          next[index] = color;
          return {
            macd: {
              ...state.macd,
              histogram: {
                ...state.macd.histogram,
                colors: next
              }
            }
          };
        }),
      updateMacdVisibility: (partial) =>
        set((state) => ({
          macd: {
            ...state.macd,
            visibility: { ...state.macd.visibility, ...partial }
          }
        })),
      updateDmi: (partial) =>
        set((state) => ({
          dmi: { ...state.dmi, ...partial }
        })),
      updateDmiStyle: (key, partial) =>
        set((state) => ({
          dmi: {
            ...state.dmi,
            [key]: { ...state.dmi[key], ...partial }
          }
        })),
      updateDmiVisibility: (partial) =>
        set((state) => ({
          dmi: {
            ...state.dmi,
            visibility: { ...state.dmi.visibility, ...partial }
          }
        })),
      updateDmiHighlight: (partial) =>
        set((state) => ({
          dmi: {
            ...state.dmi,
            highlight: { ...state.dmi.highlight, ...partial }
          }
        })),
      updateDmiDominanceHighlight: (partial) =>
        set((state) => ({
          dmi: {
            ...state.dmi,
            highlight: {
              ...state.dmi.highlight,
              dominance: { ...state.dmi.highlight.dominance, ...partial }
            }
          }
        })),
      updateDmiDominanceThreshold: (key, partial) =>
        set((state) => ({
          dmi: {
            ...state.dmi,
            highlight: {
              ...state.dmi.highlight,
              dominance: {
                ...state.dmi.highlight.dominance,
                [key]: { ...state.dmi.highlight.dominance[key], ...partial }
              }
            }
          }
        })),
      updateDmiValueHighlight: (key, target, partial) =>
        set((state) => ({
          dmi: {
            ...state.dmi,
            highlight: {
              ...state.dmi.highlight,
              [key]: {
                ...state.dmi.highlight[key],
                [target]: { ...state.dmi.highlight[key][target], ...partial }
              }
            }
          }
        })),
      resetMa: () =>
        set({
          ma: createDefaultMaConfigs()
        }),
      resetBollinger: () =>
        set({
          bollinger: clone(defaultBollingerConfig)
        }),
      resetRsi: () =>
        set({
          rsi: clone(defaultRsiConfig)
        }),
      resetMacd: () =>
        set({
          macd: clone(defaultMacdConfig)
        }),
      resetDmi: () =>
        set({
          dmi: clone(defaultDmiConfig)
        }),
      resetHighlights: () =>
        set((state) => ({
          ma: state.ma.map((item) => ({
            ...item,
            highlight: createDefaultMaHighlight(item.length)
          })),
          bollinger: {
            ...state.bollinger,
            highlight: defaultBollingerHighlight()
          },
          rsi: {
            ...state.rsi,
            highlight: defaultRsiHighlight()
          },
          macd: {
            ...state.macd,
            highlight: defaultMacdHighlight()
          },
          dmi: {
            ...state.dmi,
            highlight: defaultDmiHighlight()
          }
        })),
      reset: () => set(createDefaultState())
    }),
    {
      name: 'indicator-config',
      version: 2,
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : emptyStorage
      ),
      partialize: (state) => ({
        ma: state.ma,
        bollinger: state.bollinger,
        rsi: state.rsi,
        macd: state.macd,
        dmi: state.dmi
      }),
      migrate: (persistedState, version) => {
        const typed = persistedState as Partial<
          Pick<IndicatorConfigState, 'ma' | 'bollinger' | 'rsi' | 'macd' | 'dmi'>
        >;
        if (version < 2 && typed.macd) {
          return {
            ...typed,
            macd: {
              ...typed.macd,
              visibility: typed.macd.visibility ?? defaultMacdVisibility()
            }
          };
        }
        return typed;
      }
    }
  )
);
