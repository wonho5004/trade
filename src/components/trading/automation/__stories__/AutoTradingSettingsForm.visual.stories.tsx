// @ts-nocheck
import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { AutoTradingSettingsForm } from '../AutoTradingSettingsForm';
import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';
import type { AutoTradingSettings } from '@/types/trading/auto-trading';
import {
  createHedgeBalancedSettings,
  createLongOnlySettings,
  createShortOnlySettings
} from '@/test-utils/fixtures/autoTradingSettings';

type ScenarioKey = 'longOnly' | 'shortOnly' | 'hedgeBalanced';

type StoryArgs = {
  scenario: ScenarioKey;
};

const scenarioFactories: Record<ScenarioKey, () => AutoTradingSettings> = {
  longOnly: createLongOnlySettings,
  shortOnly: createShortOnlySettings,
  hedgeBalanced: createHedgeBalancedSettings
};

const cloneSettings = <T,>(value: T): T =>
  typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);

const ensureScenarioState = (scenario: ScenarioKey) => {
  const store = useAutoTradingSettingsStore;
  const { settings: current } = store.getState();
  const fallback = cloneSettings(current);
  const next = scenarioFactories[scenario]();
  store.setState({ settings: next });
  return () => {
    store.setState({ settings: fallback });
  };
};

const StoryContainer = ({ scenario }: StoryArgs) => {
  useEffect(() => {
    return ensureScenarioState(scenario);
  }, [scenario]);
  return (
    <div className="mx-auto max-w-6xl bg-zinc-950 px-6 py-8 text-zinc-100">
      <AutoTradingSettingsForm />
    </div>
  );
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const clickAllTabs = async (root: HTMLElement) => {
  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
  for (const tab of tabs) {
    tab.click();
    await wait(80);
  }
};

const toggleHedgeSection = async (root: HTMLElement) => {
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement>('label'));
  const hedgeLabel = labels.find((label) => label.textContent?.includes('헤지 활성 조건 사용'));
  const checkbox = hedgeLabel?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (checkbox) {
    checkbox.click();
    await wait(80);
    checkbox.click();
  }
};

const adjustProfitTargetInputs = async (root: HTMLElement) => {
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="number"]')).slice(0, 3);
  inputs.forEach((input, index) => {
    const baseValue = Number.parseFloat(input.value);
    input.value = `${baseValue + (index + 1) * 0.1}`;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await wait(60);
};

const verifyVisualStates = async (root: HTMLElement) => {
  await clickAllTabs(root);
  await toggleHedgeSection(root);
  await adjustProfitTargetInputs(root);
};

const meta: Meta<typeof StoryContainer> = {
  title: 'Trading/AutoTradingSettingsForm/Visual States',
  component: StoryContainer,
  parameters: {
    layout: 'fullscreen',
    chromatic: { pauseAnimationAtEnd: true },
    backgrounds: {
      default: 'dark'
    }
  },
  argTypes: {
    scenario: {
      control: 'select',
      options: ['longOnly', 'shortOnly', 'hedgeBalanced'],
      description: '시각 검증을 위한 샘플 상태 선택'
    }
  },
  args: {
    scenario: 'longOnly'
  },
  tags: ['visual-test']
};

export default meta;

type Story = StoryObj<typeof meta>;

export const VisualMatrix: Story = {
  name: '롱/숏/헤지 시나리오',
  render: (args) => <StoryContainer {...args} />,
  play: async ({ canvasElement, args }) => {
    const cleanup = ensureScenarioState(args.scenario);
    try {
      await wait(120);
      await verifyVisualStates(canvasElement);
    } finally {
      cleanup();
    }
  }
};

export const LongOnlyShowcase: Story = {
  args: { scenario: 'longOnly' },
  play: async ({ canvasElement }) => {
    await wait(120);
    await verifyVisualStates(canvasElement);
  }
};

export const ShortOnlyShowcase: Story = {
  args: { scenario: 'shortOnly' },
  play: async ({ canvasElement }) => {
    await wait(120);
    await verifyVisualStates(canvasElement);
  }
};

export const HedgeBalancedShowcase: Story = {
  args: { scenario: 'hedgeBalanced' },
  play: async ({ canvasElement }) => {
    await wait(120);
    await verifyVisualStates(canvasElement);
  }
};
// @ts-nocheck
