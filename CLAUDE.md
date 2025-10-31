# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Korean-language Binance Futures automated trading system with advanced condition evaluation, real-time charting, and risk management. Built with Next.js 15, TypeScript, and Zustand. Features a sophisticated execution engine that evaluates tree-based conditions and executes trades automatically.

## Essential Commands

```bash
# Development
npm run dev              # Start dev server on localhost:3000
npm run typecheck        # Check TypeScript types
npm test                 # Run Jest tests

# Production
npm run build            # Build for production (standalone output)
docker-compose up -d     # Deploy with Docker (required for stateful ExecutionEngine)

# Database
npx supabase db push     # Apply migrations
npx supabase gen types   # Generate TypeScript types

# Testing
npm test -- ExecutionEngine  # Test specific module
npm test -- --watch         # Watch mode
```

## Critical Architecture Knowledge

### Execution Engine Flow
The trading system operates through a singleton `ExecutionEngine` that must run in a stateful environment (Docker, not Vercel serverless):

1. **Entry Point**: `/src/lib/trading/execution/ExecutionEngine.ts` (1600+ lines)
2. **Condition Evaluation**: Tree-based recursive evaluation in `/src/lib/trading/evaluation/ConditionEvaluator.ts`
3. **Indicator Calculation**: Streaming calculations in `/src/lib/trading/indicators/IndicatorEngine.ts`
4. **Order Planning**: Converts conditions to orders in `/src/lib/trading/planning/OrderPlanner.ts`
5. **Order Execution**: Binance API calls via `/src/lib/trading/OrderExecutor.ts`

### Condition Tree Structure
Conditions are hierarchical trees with these node types:
- **Groups**: AND/OR logical operators
- **Indicators**: MA, RSI, MACD, Bollinger, DMI leaf nodes
- **Candle**: Price field comparisons (open/high/low/close)
- **Status**: Position metrics (profitRate, margin, buyCount)
- **Action**: Buy/sell/stoploss execution nodes

Evaluation flows bottom-up: leaves → groups → root.

### Path Aliases
The project uses TypeScript path aliases defined in tsconfig.json:
- `@/components/*` → `src/components/*`
- `@/lib/*` → `src/lib/*`
- `@/stores/*` → `src/stores/*`
- `@/hooks/*` → `src/hooks/*`
- `@/types/*` → `src/types/*`
- `@/app/*` → `src/app/*`
- `@/test-utils/*` → `src/test-utils/*`

### Key Directories

**`src/stores/`** - Zustand stores with localStorage persistence
- `chartStore.ts`: Chart symbol, interval, and overlay visibility
- `indicatorConfigStore.ts`: MA/Bollinger/RSI/MACD/DMI configurations with highlight/drawing settings
- `autoTradingSettingsStore.ts`: Auto-trading strategy settings with migration support
- `marketDataStore.ts`: Real-time market data
- `accountStore.ts`: User account and position data
- All stores use Zustand's `persist` middleware with versioning and migration support

**`src/lib/trading/`** - Trading logic and utilities
- `exchange.ts`: CCXT client creation for Binance futures
- `engine/`: Auto-trading engine (conditions, indicators, order planning)
- `validators/`: Auto-trading settings validation
- `migrations/`: Data migration utilities for store upgrades
- `conditionsTree.ts` & `conditionFormatters.ts`: Condition parsing and display logic

**`src/lib/analysis/`** - Technical indicators calculation
- `indicators.ts`: MA, Bollinger Bands, RSI, MACD, DMI calculations
- `metrics.ts`: Trading metrics and analysis

**`src/components/`** - React components organized by feature
- `chart/`: Chart display and control panel components
- `trading/`: Trading UI including automation settings, indicators, order tickets
- `trading/automation/`: Complex auto-trading settings forms with condition editors
- `ui/`: shadcn/ui base components
- `common/`: Shared components (headers, tooltips, modals)

**`src/app/`** - Next.js App Router pages and API routes
- `(auth)/`: Login and registration pages (route group, no auth layout)
- `dashboard/`: Main dashboard
- `trading/`: Trading pages including `/trading/automation`
- `api/`: API routes for Binance proxy, markets, trading, health checks
- `admin/`, `ops/`: Admin and operations pages with role-based access

**`src/types/`** - TypeScript type definitions
- `indicator.ts`: Indicator configurations and highlight settings
- `trading/`: Trading-related types (auto-trading, margin, markets, symbols)
- `chart.ts`: Chart data structures
- `supabase.ts`: Database schema types

## State Management Patterns

### Zustand Store Structure
All persisted stores follow this pattern:
1. Use `persist` middleware with versioning
2. Provide `migrate` function for schema upgrades
3. Use SSR-safe storage (check `typeof window !== 'undefined'`)
4. Include `reset` methods to restore defaults
5. Clone objects with `structuredClone` or JSON parse/stringify before mutations

Example from `indicatorConfigStore.ts`:
- Stores configurations for MA (up to 5 lines), Bollinger, RSI, MACD, DMI
- Each indicator has input parameters, style settings, and highlight/drawing conditions
- Highlight conditions define when to draw markers or overlays on the chart based on indicator values
- Version 3 with migrations from v1→v2 (added MACD visibility) and v2→v3 (refactored Bollinger highlight structure)

### Auto-Trading Settings Store
`autoTradingSettingsStore.ts` manages complex nested settings for automated trading strategies:
- Entry/exit conditions for long/short positions using indicator trees
- Scale-in logic, hedge activation, stop-loss configuration
- Symbol selection (whitelist/blacklist) and exclusion rules
- Capital allocation and position sizing
- Uses `normalizeAutoTradingSettings` migration function to handle schema changes
- Provides `updateIndicatorsRaw` to bypass normalization for direct indicator tree updates

## Chart System

### Lightweight Charts Integration
- Main chart component: `src/components/chart/CandlestickChart.tsx`
- Real-time candle updates via WebSocket (see `src/lib/trading/realtime.ts`)
- Overlay system for MA, Bollinger Bands, RSI, MACD, DMI
- Drawing/highlighting system based on indicator conditions:
  - Markers (arrows up/down, circles) when conditions are met
  - Background overlays with configurable opacity
  - Configured via `indicatorConfigStore` highlight settings

### Indicator Configuration UX
Per `docs/indicatorctl.md`, all indicator panels follow consistent patterns:
- Input parameters (periods, lengths, multipliers)
- Style options (colors, line types, line widths)
- Drawing conditions using candle fields (high/open/close/low) and indicator values
- AND/OR/ELSE condition combinations
- Reset buttons restore indicator-specific defaults without affecting others

## Auto-Trading System

### Condition System
The auto-trading engine uses a tree-based condition system:
- **Condition groups**: Logical groups with AND/OR operators
- **Individual conditions**: Compare indicators/candle fields using operators (>, <, >=, <=, ==, !=, crossUp, crossDown)
- **Indicators**: MA, RSI, MACD, Bollinger, DMI, or custom expressions
- **Evaluation**: `src/lib/trading/engine/conditions.ts` evaluates condition trees against market data
- **Status conditions**: Define position entry, scaling, exits, and hedging logic

UI components:
- `ConditionsEditorModal.tsx`: Edit condition groups and individual conditions
- `GroupListPanel.tsx` / `GroupListPanelV2.tsx`: Display condition group summaries
- `ConditionsTrace.tsx`: Debug condition evaluation results
- `ConditionsPreview.tsx`: Visual preview of condition logic flow

### Symbol Selection
Auto-trading supports flexible symbol selection:
- **Whitelist mode**: Manually select symbols from search panel
- **Exclusion rules**: Define patterns to exclude symbols (e.g., all *DOWN, *UP tokens)
- Components: `SymbolSelectionPanelV2.tsx`, `SymbolSearchPanel.tsx`, `ExclusionRulesPanel.tsx`

## Authentication & Authorization

### Supabase Auth
- Client: `src/lib/supabase/client.ts` (browser-side)
- Server: `src/lib/supabase/server.ts` (server-side)
- Auth actions: `src/app/(auth)/actions.ts`
- Role management: `src/lib/auth/roles.ts`

### Role-Based Access
Pages use layout-level protection:
- `src/app/admin/layout.tsx`: Requires admin role
- `src/app/ops/layout.tsx`: Requires ops role
- `src/app/dashboard/layout.tsx`: Requires authenticated user

## API Routes

### Binance Proxy Endpoints
- `GET /api/binance/klines`: Fetch historical candle data
- `GET /api/binance/ticker`: Get current ticker info
- `GET /api/trading/binance/futures-symbols`: List available futures symbols
- `GET /api/trading/binance/account`: Fetch account balance and positions
- `POST /api/trading/binance/place-order`: Place futures order
- `GET/PUT /api/trading/binance/position-mode`: Get/set position mode (one-way/hedge)

### Other API Routes
- `GET /api/markets`: Fetch and cache market data
- `POST /api/markets/validate`: Validate symbol selection
- `GET /api/strategies`: Fetch saved strategies (Supabase)
- `GET /api/health`, `/api/health/supabase`: Health checks
- `GET/PUT /api/profile/credentials`: Manage user API credentials

## Environment Variables

Required environment variables (set in `.env.local`):
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Binance API (for development; production uses encrypted DB storage)
BINANCE_FUTURES_API_KEY=
BINANCE_FUTURES_API_SECRET=
BINANCE_FUTURES_API_PASSWORD=
```

**Security Note**: Never commit `.env.local` or expose API keys in client-side code. Production API keys should be stored encrypted in Supabase and fetched server-side only.

## Testing Practices

### Test File Locations
- Co-located with source files: `*.test.ts` or `*.test.tsx` next to implementation
- Component snapshot tests: `components/**/__tests__/*.snapshot.test.tsx`
- Store migration tests: `stores/__tests__/*.migration.test.ts`

### Test Utilities
- `src/test-utils/render.tsx`: Custom render with providers (theme, query client)
- `src/test-utils/fixtures/`: Test fixture data (e.g., `autoTradingSettings.ts`)
- Use `@testing-library/react` for component tests
- Use `@testing-library/user-event` for user interactions

## UI/UX Patterns

### Design System
- **Theme**: Dark theme by default (Binance-style), light theme available via `next-themes`
- **Components**: shadcn/ui components in `src/components/ui/`
- **Layout**: Maximize screen space efficiency, responsive for desktop/tablet
- **Language**: Korean UI labels and messages throughout

### Common UI Components
- `SectionFrame.tsx`: Collapsible panel wrapper for settings sections
- `HelpTooltip.tsx` / `HelpModal.tsx`: Contextual help system
- `InfoTip.tsx`: Inline info tooltips
- `Segmented.tsx`: Tab-style segmented control
- `ToastProvider.tsx`: Toast notification system

### Auto-Trading Form UX
The auto-trading settings form (`AutoTradingSettingsForm.tsx`) is a multi-panel interface:
- Capital settings panel
- Symbol selection panel (whitelist or exclusion rules)
- Entry/exit/scale-in condition editors for long/short
- Status condition editor for position states
- Hedge activation settings
- Stop-loss configuration
- Footer with save/reset actions and setup wizard launcher

All panels:
- Show summaries when collapsed
- Have reset buttons for defaults
- Include inline help tooltips
- Persist to Zustand store on change (debounced)

## Code Style & Conventions

### TypeScript
- Strict mode enabled
- No implicit any
- Use type imports: `import type { ... } from '...'`
- Define types in `src/types/` or co-located with components/functions

### React
- Use functional components with hooks
- Prefer named exports for components
- Use `'use client'` directive for client components in App Router
- Server components by default (no directive needed)

### Naming
- Components: PascalCase (e.g., `ChartControlPanel.tsx`)
- Utilities/hooks: camelCase (e.g., `useDebounce.ts`, `conditionFormatters.ts`)
- Stores: camelCase with "Store" suffix (e.g., `chartStore.ts`)
- Types: PascalCase for interfaces/types
- Constants: UPPER_SNAKE_CASE

### File Organization
- Group related functionality in directories
- Keep components focused and single-responsibility
- Extract complex logic to `src/lib/` utilities
- Use barrel exports (`index.ts`) sparingly, only when beneficial

## Important Implementation Details

### Indicator Config Migrations
The `indicatorConfigStore` uses versioned persistence. When adding new fields:
1. Increment version number
2. Add migration logic in `migrate` function
3. Test with `src/stores/__tests__/*.migration.test.ts` pattern
4. Ensure backwards compatibility

### Auto-Trading Settings Normalization
`normalizeAutoTradingSettings` in `src/lib/trading/migrations/autoTrading.ts` ensures all required fields exist with defaults. Call this after loading persisted state or user input to prevent runtime errors from missing fields.

### Condition Evaluation
The condition engine (`src/lib/trading/engine/conditions.ts`) evaluates indicator-based conditions:
- Fetches indicator values from `indicatorSignals.ts`
- Supports cross-up/cross-down operators for signal detection
- Returns boolean results for each condition and group
- Used in `ConditionsTrace.tsx` for debugging and `src/hooks/useConditionsEvaluator.ts` for real-time evaluation

### Drawing/Highlighting System
Chart markers and overlays are drawn based on indicator highlight configs:
- Each indicator config has a `highlight` section defining conditions
- Conditions specify thresholds, candle fields, and marker shapes
- `CandlestickChart.tsx` reads these configs and applies markers via Lightweight Charts API
- Markers include: `arrowUp`, `arrowDown`, `circle`, background overlays with opacity

### Symbol Validation
Use `src/hooks/useSymbolValidation.ts` and `/api/markets/validate` to validate symbol lists:
- Checks if symbols exist on Binance futures
- Validates leverage and margin requirements
- Returns detailed error messages for invalid symbols

## Development Workflow

1. **Start dev server**: `npm run dev`
2. **Check types frequently**: `npm run typecheck` (CI/CD should run this)
3. **Write tests** for complex logic (stores, trading engine, conditions)
4. **Use Storybook** for component development in isolation
5. **Persist user settings** in Zustand stores with versioning
6. **Follow PRD/POD** in `docs/` for feature requirements and architecture decisions

## Common Tasks

### Adding a New Indicator
1. Add calculation logic to `src/lib/analysis/indicators.ts`
2. Define config type in `src/types/indicator.ts`
3. Add state management to `indicatorConfigStore.ts` (with default config, update methods, reset method)
4. Create UI component in `src/components/trading/indicators/`
5. Integrate into `ChartControlPanel.tsx` and `CandlestickChart.tsx`
6. Add to `docs/indicatorctl.md` specification

### Adding a New Auto-Trading Condition Type
1. Update types in `src/types/trading/auto-trading.ts`
2. Add evaluation logic to `src/lib/trading/engine/conditions.ts`
3. Update `ConditionsEditorModal.tsx` UI for new condition type
4. Add formatter to `src/lib/trading/conditionFormatters.ts` for display
5. Write tests in `src/lib/trading/engine/__tests__/`

### Adding an API Route
1. Create route handler in `src/app/api/[path]/route.ts`
2. Use Next.js Route Handlers (export `GET`, `POST`, etc.)
3. Return `Response` or `NextResponse.json()`
4. For authenticated routes, use `src/lib/supabase/server.ts` to check session
5. Add tests if logic is complex (e.g., `route.test.ts`)

## Troubleshooting

### Store Not Persisting
- Check that `typeof window !== 'undefined'` in storage config
- Verify `localStorage` is not disabled
- Check browser console for quota errors
- Clear localStorage and test migration logic

### Indicator Not Rendering
- Verify indicator is enabled in `chartStore.overlays`
- Check indicator config in `indicatorConfigStore`
- Ensure chart data is loaded before rendering indicators
- Check browser console for errors from Lightweight Charts

### Condition Not Evaluating Correctly
- Use `ConditionsTrace.tsx` component to debug evaluation
- Check that all required indicator values are available
- Verify condition operator and threshold values
- Test condition logic in isolation with unit tests

### API Route 401/403 Errors
- Verify Supabase session is valid
- Check role-based permissions in `src/lib/auth/roles.ts`
- Ensure API keys are set in `.env.local` for development
- Check network tab for request/response details

## Common Issues & Solutions

### Issue: "시장데이터 없음" during force evaluation
**Solution**: Fetch from API when WebSocket data unavailable
```typescript
// In ExecutionEngine.evaluateSymbol()
const candles = await this.fetchKlinesFromAPI(symbol, interval, 100);
```

### Issue: DMI indicator returns null
**Solution**: Ensure sufficient historical data (100+ candles) and implement full DMI calculation with Wilder's smoothing in `/src/lib/trading/indicators/IndicatorEngine.ts`

### Issue: Multiple ExecutionEngine instances in Vercel
**Root Cause**: Serverless creates separate processes
**Solution**: Deploy with Docker for stateful singleton pattern

### Issue: Condition path mismatch
**Pattern**: Always use `settings.entry.long.conditions` not `settings.entry.conditions`
```typescript
const longEntryConditions = settings.entry?.long?.conditions;
const shortEntryConditions = settings.entry?.short?.conditions;
```

## Key File Locations

**Trading Engine Core**:
- `/src/lib/trading/execution/ExecutionEngine.ts` - Main engine (1600+ lines)
- `/src/lib/trading/evaluation/ConditionEvaluator.ts` - Condition evaluation
- `/src/lib/trading/indicators/IndicatorEngine.ts` - Indicator calculations
- `/src/lib/trading/planning/OrderPlanner.ts` - Order generation

**API Routes**:
- `/src/app/api/trading/engine/route.ts` - Engine control
- `/src/app/api/trading/binance/*/route.ts` - Binance operations
- `/src/app/api/strategies/route.ts` - Strategy CRUD

**State Management**:
- `/src/stores/autoTradingSettingsStore.ts` - Trading settings with migration support
- `/src/stores/marketDataStore.ts` - Real-time market data cache
- `/src/stores/indicatorConfigStore.ts` - Indicator configurations

## Deployment Notes

### Docker Required for Production
ExecutionEngine requires stateful environment. Vercel serverless will fail because:
- `setInterval` stops after request ends
- Multiple instances break singleton pattern
- WebSocket connections don't persist

Use `docker-compose up -d` with provided `Dockerfile` and `docker-compose.yml`.

## Current Development Focus

Branch: `feature/ui-ux-improvements`

Recent work:
- Korean language condition display improvements
- Debug logging for condition parsing
- Reset buttons and setting summaries in panels
- Symbol selection/exclusion logic fixes
- DMI indicator implementation
- Force evaluation API fetching
