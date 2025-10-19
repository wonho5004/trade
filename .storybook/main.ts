import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions'
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {}
  },
  staticDirs: ['../public'],
  docs: {
    autodocs: 'tag'
  },
  webpackFinal: async (baseConfig) => {
    class CacheShutdownFallbackPlugin {
      apply(compiler: import('webpack').Compiler) {
        compiler.hooks.environment.tap('CacheShutdownFallbackPlugin', () => {
          const cache = compiler.cache as { hooks?: Record<string, { tap?: (...args: unknown[]) => void; tapAsync?: (...args: unknown[]) => void; tapPromise?: (...args: unknown[]) => void }> } | undefined;
          if (cache && cache.hooks?.shutdown?.tap) {
            return;
          }
          const noop = () => {};
          const hook = {
            tap: noop,
            tapAsync: noop,
            tapPromise: noop
          };
          if (cache) {
            cache.hooks = {
              ...cache.hooks,
              shutdown: cache.hooks?.shutdown ?? hook
            };
          } else {
            (compiler as unknown as { cache: typeof cache }).cache = {
              hooks: {
                shutdown: hook
              }
            };
          }
        });
      }
    }

    const filteredPlugins = (baseConfig.plugins ?? []).filter((plugin) => {
      const name = plugin?.constructor?.name ?? '';
      return name !== 'IdleFileCachePlugin' && name !== 'MemoryCachePlugin';
    });
    return {
      ...baseConfig,
      cache: false,
      plugins: [...filteredPlugins, new CacheShutdownFallbackPlugin()]
    };
  }
};

export default config;
