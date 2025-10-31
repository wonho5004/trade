/**
 * ExecutionEngine - 자동매매 실시간 실행 엔진
 *
 * 활성화된 전략들을 모니터링하고, 조건이 충족되면 주문을 실행합니다.
 *
 * ⚠️ SERVERLESS LIMITATION:
 * This engine uses setInterval for continuous polling, which won't persist
 * in serverless environments like Vercel. For production:
 * 1. Deploy to a long-running Node.js server (e.g., Railway, Render)
 * 2. Use a separate worker process with PM2 or similar
 * 3. Use scheduled jobs (Vercel Cron, AWS Lambda with EventBridge)
 * 4. Implement client-side execution (browser-based, for testing only)
 */

import type { Strategy } from '@/types/trading/strategy';
import type { Position } from '@/types/trading/monitoring';
import { evaluateConditions, collectExecutableLeaves } from '../engine/conditions';
import type { EvaluationContext, IndicatorSignalMap } from '../engine/conditions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMarketDataService } from '../market-data/MarketDataService';
import { getIndicatorCalculator } from '../evaluation/IndicatorCalculator';
import { getOrderExecutor } from './OrderExecutor';
import { getPositionTracker } from './PositionTracker';
import type { IndicatorLeafNode } from '@/types/trading/auto-trading';
import type { Candle } from '@/types/chart';
import { addEngineLog } from './logger';

interface EngineConfig {
  pollingInterval: number; // 조건 평가 주기 (ms)
  maxConcurrentStrategies: number;
  enableSafetyChecks: boolean;
}

interface StrategyRuntime {
  strategy: Strategy;
  lastEvaluationTime: number;
  evaluationCount: number;
  errorCount: number;
  lastError?: string;
}

interface SimulationConfig {
  sessionId?: string; // DB session ID
  initialCapital: number;
  currentCapital: number;
  totalPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  durationHours?: number; // 시뮬레이션 기간 (시간)
  startTime: number; // 시작 시간
}

export class ExecutionEngine {
  private isRunning = false;
  private mode: 'idle' | 'monitoring' | 'simulation' | 'trading' = 'idle';
  private strategies = new Map<string, StrategyRuntime>();
  private positions = new Map<string, Position>();
  private intervalId?: NodeJS.Timeout;

  // 시뮬레이션 모드 전용
  private simulationConfig: SimulationConfig | null = null;
  private virtualPositions = new Map<string, Position>();

  // 타임프레임별 마지막 평가 캔들 시간 추적
  private lastEvaluatedCandleTime = new Map<string, number>(); // key: symbol_interval

  private marketData = getMarketDataService();
  private indicatorCalculator = getIndicatorCalculator();
  private orderExecutor = getOrderExecutor();
  private positionTracker = getPositionTracker();

  private credentials: { apiKey: string; apiSecret: string } | null = null;
  private userId: string | null = null;

  private config: EngineConfig = {
    pollingInterval: 5000, // 5초마다 체크 (실제 평가는 새 캔들일 때만)
    maxConcurrentStrategies: 10,
    enableSafetyChecks: true
  };

  private safetyState = {
    circuitBreakerOpen: false,
    consecutiveFailures: 0,
    maxConsecutiveFailures: 5,
    lastResetTime: Date.now()
  };

  constructor(config?: Partial<EngineConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Set user ID for database operations
   */
  setUserId(userId: string): void {
    this.userId = userId;
    console.log('[ExecutionEngine] User ID set:', userId);
  }

  /**
   * 타임프레임을 밀리초로 변환
   */
  private getTimeframeMs(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return map[interval] || 60 * 1000; // 기본값 1분
  }

  /**
   * 현재 캔들의 시작 시간 계산
   */
  private getCurrentCandleTime(interval: string): number {
    const now = Date.now();
    const intervalMs = this.getTimeframeMs(interval);
    return Math.floor(now / intervalMs) * intervalMs;
  }

  /**
   * 새로운 캔들인지 확인
   */
  private isNewCandle(symbol: string, interval: string): boolean {
    const key = `${symbol}_${interval}`;
    const currentCandleTime = this.getCurrentCandleTime(interval);
    const lastTime = this.lastEvaluatedCandleTime.get(key);

    if (!lastTime || currentCandleTime > lastTime) {
      this.lastEvaluatedCandleTime.set(key, currentCandleTime);
      return true;
    }
    return false;
  }

  /**
   * 데이터베이스에서 엔진 상태 로드
   */
  private async loadStateFromDB(): Promise<void> {
    try {
      const supabase = createSupabaseServerClient('service');

      const { data, error } = await supabase
        .from('engine_state')
        .select('*')
        .eq('id', 'singleton')
        .single();

      if (!error && data) {
        this.isRunning = data.is_running;

        // 모드 복구
        if (data.mode && ['idle', 'monitoring', 'simulation', 'trading'].includes(data.mode)) {
          this.mode = data.mode as 'idle' | 'monitoring' | 'simulation' | 'trading';
        }

        // 시뮬레이션 설정 복구
        if (data.simulation_config && typeof data.simulation_config === 'object') {
          this.simulationConfig = data.simulation_config as SimulationConfig;
          console.log('[loadStateFromDB] Restored simulation config:', this.simulationConfig);
        }

        // 가상 포지션 복구
        if (data.virtual_positions && Array.isArray(data.virtual_positions)) {
          this.virtualPositions.clear();
          for (const pos of data.virtual_positions) {
            const key = `${pos.symbol}_${pos.direction}`;
            this.virtualPositions.set(key, pos as Position);
          }
          console.log(`[loadStateFromDB] Restored ${this.virtualPositions.size} virtual positions`);
        }

        // 사용자 ID 복구
        if (data.user_id) {
          this.userId = data.user_id;
        }
      } else if (error) {
        // 테이블이 없거나 레코드가 없으면 생성 시도
        console.log('Engine state not found, initializing...', error.message);
        await this.initializeEngineState();
      }
    } catch (error) {
      console.error('Failed to load engine state from DB:', error);
    }
  }

  /**
   * 엔진 상태 테이블 초기화
   */
  private async initializeEngineState(): Promise<void> {
    try {
      const supabase = createSupabaseServerClient('service');

      // 기본 레코드 생성 시도
      const { error } = await supabase
        .from('engine_state')
        .upsert({
          id: 'singleton',
          is_running: false,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Failed to initialize engine state:', error);
      } else {
        console.log('✅ Engine state initialized');
      }
    } catch (error) {
      console.error('Failed to initialize engine state:', error);
    }
  }

  /**
   * 데이터베이스에 엔진 상태 저장
   */
  /**
   * 시뮬레이션 세션 생성 (DB)
   */
  private async createSimulationSession(initialCapital: number, durationHours?: number): Promise<string> {
    try {
      const supabase = createSupabaseServerClient('service');

      // 현재 사용자 정보 가져오기 (임시: 첫 번째 사용자 사용)
      const { data: users } = await supabase.from('profiles').select('id').limit(1).single();
      if (!users) {
        throw new Error('User not found for simulation session');
      }

      const { data, error } = await supabase
        .from('simulation_sessions')
        .insert({
          user_id: users.id,
          strategy_id: this.strategies.size > 0 ? Array.from(this.strategies.keys())[0] : null,
          name: `Simulation ${new Date().toLocaleString('ko-KR')}`,
          initial_capital: initialCapital,
          current_capital: initialCapital,
          duration_hours: durationHours,
          status: 'RUNNING',
          mode: 'SIMULATION'
        })
        .select('id')
        .single();

      if (error) throw error;

      console.log(`✅ Simulation session created: ${data.id}`);
      return data.id;
    } catch (error) {
      console.error('Failed to create simulation session:', error);
      throw error;
    }
  }

  /**
   * 시뮬레이션 세션 업데이트 (DB)
   */
  private async updateSimulationSession(): Promise<void> {
    if (!this.simulationConfig?.sessionId) return;

    try {
      const supabase = createSupabaseServerClient('service');

      const winRate = this.simulationConfig.totalTrades > 0
        ? (this.simulationConfig.winningTrades / this.simulationConfig.totalTrades) * 100
        : 0;

      const roi = ((this.simulationConfig.totalPnL / this.simulationConfig.initialCapital) * 100);

      // 일평균 수익률 계산
      const durationMs = Date.now() - this.simulationConfig.startTime;
      const durationDays = durationMs / (1000 * 60 * 60 * 24);
      const dailyAvgRoi = durationDays > 0 ? roi / durationDays : 0;

      const { error } = await supabase
        .from('simulation_sessions')
        .update({
          current_capital: this.simulationConfig.currentCapital,
          total_pnl: this.simulationConfig.totalPnL,
          total_trades: this.simulationConfig.totalTrades,
          winning_trades: this.simulationConfig.winningTrades,
          losing_trades: this.simulationConfig.losingTrades,
          win_rate: winRate,
          roi: roi,
          daily_avg_roi: dailyAvgRoi
        })
        .eq('id', this.simulationConfig.sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update simulation session:', error);
    }
  }

  /**
   * 시뮬레이션 세션 완료 처리 (DB)
   */
  private async completeSimulationSession(): Promise<void> {
    if (!this.simulationConfig?.sessionId) return;

    try {
      await this.updateSimulationSession(); // 최종 통계 업데이트

      const supabase = createSupabaseServerClient('service');

      const { error } = await supabase
        .from('simulation_sessions')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', this.simulationConfig.sessionId);

      if (error) throw error;

      console.log(`✅ Simulation session completed: ${this.simulationConfig.sessionId}`);
    } catch (error) {
      console.error('Failed to complete simulation session:', error);
    }
  }

  /**
   * 시뮬레이션 거래 저장 (DB)
   */
  private async saveSimulationTrade(
    symbol: string,
    action: 'ENTRY' | 'EXIT',
    side: 'LONG' | 'SHORT',
    price: number,
    quantity: number,
    pnl?: number,
    indicators?: Record<string, number>
  ): Promise<void> {
    if (!this.simulationConfig?.sessionId) return;

    try {
      const supabase = createSupabaseServerClient('service');

      const { data: users } = await supabase.from('profiles').select('id').limit(1).single();
      if (!users) return;

      const tradeData: any = {
        session_id: this.simulationConfig.sessionId,
        user_id: users.id,
        strategy_id: this.strategies.size > 0 ? Array.from(this.strategies.keys())[0] : null,
        symbol,
        side,
        action,
        quantity,
        indicators: indicators || {}
      };

      if (action === 'ENTRY') {
        tradeData.entry_price = price;
        tradeData.entry_time = new Date().toISOString();
      } else {
        tradeData.exit_price = price;
        tradeData.exit_time = new Date().toISOString();
        if (pnl !== undefined) {
          tradeData.pnl = pnl;
          tradeData.pnl_percentage = (pnl / this.simulationConfig.initialCapital) * 100;
        }
      }

      const { error } = await supabase
        .from('simulation_trades')
        .insert(tradeData);

      if (error) throw error;

      console.log(`💾 Simulation trade saved: ${symbol} ${action}`);
    } catch (error) {
      console.error('Failed to save simulation trade:', error);
    }
  }

  /**
   * 조건 평가 결과 저장 (DB)
   */
  private async saveConditionEvaluation(
    strategyId: string,
    symbol: string,
    conditionType: 'ENTRY' | 'EXIT' | 'SCALE_IN' | 'HEDGE',
    evaluationResult: boolean,
    details?: any
  ): Promise<void> {
    try {
      console.log('[saveConditionEvaluation] Starting save:', {
        strategyId,
        symbol,
        conditionType,
        evaluationResult,
        hasDetails: !!details,
        indicatorDetailsCount: details?.indicatorDetails?.length || 0,
        userId: this.userId
      });

      // userId가 없으면 profiles 테이블에서 가져오기
      let userId = this.userId;
      if (!userId) {
        const supabase = createSupabaseServerClient('service');
        const { data: users } = await supabase.from('profiles').select('id').limit(1).single();
        if (!users) {
          console.warn('[saveConditionEvaluation] No user found for saving condition evaluation');
          return;
        }
        userId = users.id;
        console.log('[saveConditionEvaluation] Fetched userId from profiles:', userId);
      }

      const supabase = createSupabaseServerClient('service');
      const dataToInsert = {
        user_id: userId,
        strategy_id: strategyId,
        symbol,
        condition_type: conditionType,
        evaluation_result: evaluationResult,
        details: details || {},
        evaluated_at: new Date().toISOString()
      };

      console.log('[saveConditionEvaluation] Inserting data:', JSON.stringify(dataToInsert, null, 2));

      const { error, data } = await supabase
        .from('condition_evaluations')
        .insert(dataToInsert)
        .select();

      if (error) {
        console.error('[saveConditionEvaluation] Database error:', error);
      } else {
        console.log('[saveConditionEvaluation] Successfully saved:', data);
      }
    } catch (error) {
      console.error('[saveConditionEvaluation] Unexpected error:', error);
    }
  }

  private async saveStateToDB(isRunning: boolean): Promise<void> {
    try {
      const supabase = createSupabaseServerClient('service');

      // 가상 포지션을 배열로 변환
      const virtualPositionsArray = Array.from(this.virtualPositions.values());

      const stateData = {
        id: 'singleton',
        is_running: isRunning,
        mode: this.mode,
        simulation_config: this.simulationConfig,
        virtual_positions: virtualPositionsArray,
        user_id: this.userId,
        [isRunning ? 'started_at' : 'stopped_at']: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('engine_state')
        .upsert(stateData);

      if (error) {
        console.error('Failed to save engine state to DB:', error);
      } else {
        console.log(`[saveStateToDB] Saved state: mode=${this.mode}, virtualPositions=${virtualPositionsArray.length}`);
      }
    } catch (error) {
      console.error('Failed to save engine state to DB:', error);
    }
  }

  /**
   * 엔진 시작
   * @param mode - 'monitoring' (조건 계산만), 'simulation' (가상 거래), 'trading' (실제 주문 실행)
   * @param simulationCapital - 시뮬레이션 모드 시작 자본금 (simulation 모드에서만 필요)
   */
  async start(mode: 'monitoring' | 'simulation' | 'trading' = 'monitoring', simulationCapital?: number, durationHours?: number): Promise<void> {
    // DB에서 현재 상태 로드
    await this.loadStateFromDB();

    if (this.isRunning) {
      addEngineLog({
        level: 'warning',
        category: '엔진',
        message: '엔진이 이미 실행 중입니다.'
      });
      console.warn('ExecutionEngine is already running');
      return;
    }

    // 시뮬레이션 모드 검증 및 DB 세션 생성
    if (mode === 'simulation') {
      if (!simulationCapital || simulationCapital <= 0) {
        throw new Error('시뮬레이션 모드는 초기 자본금이 필요합니다.');
      }

      const sessionId = await this.createSimulationSession(simulationCapital, durationHours);

      this.simulationConfig = {
        sessionId,
        initialCapital: simulationCapital,
        currentCapital: simulationCapital,
        totalPnL: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        durationHours,
        startTime: Date.now()
      };
      this.virtualPositions.clear();
    }

    const modeText = mode === 'monitoring' ? '모니터링' : mode === 'simulation' ? '시뮬레이션' : '실시간 거래';

    addEngineLog({
      level: 'info',
      category: '엔진',
      message: `실행 엔진을 시작합니다 (모드: ${modeText})...`,
      details: mode === 'simulation' ? {
        action: 'Simulation Start',
        indicators: { 'Initial Capital': simulationCapital! }
      } : undefined
    });
    console.log(`🚀 ExecutionEngine starting in ${mode} mode...`);
    this.isRunning = true;
    this.mode = mode;

    // DB에 상태 저장
    await this.saveStateToDB(true);

    // 활성 전략 로드
    await this.loadActiveStrategies();

    // 사용자 인증 정보 로드
    await this.loadCredentials();

    // 오픈 포지션 로드
    await this.loadOpenPositions();

    // 마켓 데이터 스트림 시작
    await this.startMarketDataStreams();

    // ⚠️ SERVERLESS WARNING: setInterval won't persist after request ends
    // For production, use a separate long-running worker or scheduled jobs
    this.intervalId = setInterval(() => {
      this.evaluationLoop().catch(err => {
        console.error('Error in evaluation loop:', err);
        this.handleLoopError(err);
      });
    }, this.config.pollingInterval);

    addEngineLog({
      level: 'success',
      category: '엔진',
      message: `실행 엔진이 성공적으로 시작되었습니다 (${modeText} 모드).`,
      details: {
        action: 'Engine Started',
        indicators: {
          'Mode': mode,
          ...(mode === 'simulation' && this.simulationConfig ? {
            'Initial Capital': this.simulationConfig.initialCapital
          } : {}),
          'Active Strategies': this.strategies.size,
          'Polling Interval': this.config.pollingInterval,
          'Safety Checks': this.config.enableSafetyChecks
        }
      }
    });
    console.log(`✅ ExecutionEngine started in ${mode} mode (Note: will stop after request ends in serverless)`);
  }

  /**
   * 엔진 중지
   */
  async stop(): Promise<void> {
    // DB에서 현재 상태 로드
    await this.loadStateFromDB();

    if (!this.isRunning) {
      addEngineLog({
        level: 'warning',
        category: '엔진',
        message: '엔진이 이미 중지되어 있습니다.'
      });
      return;
    }

    // 시뮬레이션 결과 로그 및 DB 완료 처리
    if (this.mode === 'simulation' && this.simulationConfig) {
      const winRate = this.simulationConfig.totalTrades > 0
        ? (this.simulationConfig.winningTrades / this.simulationConfig.totalTrades * 100).toFixed(2)
        : '0.00';
      const roi = ((this.simulationConfig.totalPnL / this.simulationConfig.initialCapital) * 100).toFixed(2);

      addEngineLog({
        level: 'info',
        category: '시뮬레이션',
        message: '시뮬레이션 결과',
        details: {
          action: 'Simulation Results',
          indicators: {
            'Initial Capital': this.simulationConfig.initialCapital,
            'Final Capital': this.simulationConfig.currentCapital,
            'Total PnL': this.simulationConfig.totalPnL,
            'ROI (%)': parseFloat(roi),
            'Total Trades': this.simulationConfig.totalTrades,
            'Win Rate (%)': parseFloat(winRate),
            'Winning Trades': this.simulationConfig.winningTrades,
            'Losing Trades': this.simulationConfig.losingTrades
          }
        }
      });

      // DB에 시뮬레이션 세션 완료 처리
      await this.completeSimulationSession();
    }

    addEngineLog({
      level: 'info',
      category: '엔진',
      message: '실행 엔진을 중지합니다...'
    });
    console.log('🛑 ExecutionEngine stopping...');
    this.isRunning = false;
    this.mode = 'idle';
    this.simulationConfig = null;
    this.virtualPositions.clear();

    // DB에 상태 저장
    await this.saveStateToDB(false);

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // 마켓 데이터 스트림 중지
    this.marketData.stopAllStreams();

    addEngineLog({
      level: 'success',
      category: '엔진',
      message: '실행 엔진이 중지되었습니다.'
    });
    console.log('✅ ExecutionEngine stopped');
  }

  /**
   * 모니터링 모드에서 실시간 거래 모드로 전환
   */
  async enableTrading(): Promise<void> {
    if (!this.isRunning) {
      addEngineLog({
        level: 'warning',
        category: '엔진',
        message: '엔진이 실행 중이 아닙니다.'
      });
      throw new Error('Engine is not running');
    }

    if (this.mode === 'trading') {
      addEngineLog({
        level: 'warning',
        category: '엔진',
        message: '이미 실시간 거래 모드입니다.'
      });
      return;
    }

    addEngineLog({
      level: 'info',
      category: '엔진',
      message: '모니터링 모드에서 실시간 거래 모드로 전환합니다...'
    });
    console.log('🔄 Switching from monitoring to trading mode...');

    this.mode = 'trading';

    addEngineLog({
      level: 'success',
      category: '엔진',
      message: '실시간 거래 모드가 활성화되었습니다. 이제 주문이 실행됩니다.',
      details: {
        action: 'Trading Mode Enabled',
        indicators: { 'Mode': 'trading' }
      }
    });
    console.log('✅ Trading mode enabled');
  }

  /**
   * 전략 데이터 정규화 및 검증
   */
  private normalizeStrategy(strategy: any): Strategy {
    // settings가 문자열로 저장되어 있다면 파싱
    let settings = strategy.settings;
    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch (error) {
        console.error(`Failed to parse settings for strategy ${strategy.id}:`, error);
        settings = {};
      }
    }

    // symbolSelection.manualSymbols를 settings.symbols로 복사 (ExecutionEngine 호환성)
    if (!Array.isArray(settings.symbols) || settings.symbols.length === 0) {
      if (settings.symbolSelection?.manualSymbols && Array.isArray(settings.symbolSelection.manualSymbols)) {
        settings.symbols = settings.symbolSelection.manualSymbols;
        console.log(`[Strategy ${strategy.id}] Copied ${settings.symbols.length} symbols from symbolSelection.manualSymbols to settings.symbols`);
      } else {
        console.warn(`Strategy ${strategy.id} has invalid symbols field, using empty array`);
        settings.symbols = [];
      }
    }

    // indicators 필드를 conditions 필드로 변환 (ExecutionEngine 호환성)
    if (settings.entry) {
      if (settings.entry.long?.indicators && !settings.entry.long.conditions) {
        settings.entry.long.conditions = settings.entry.long.indicators;
        console.log(`[Strategy ${strategy.id}] Converted entry.long.indicators to conditions`);
      }
      if (settings.entry.short?.indicators && !settings.entry.short.conditions) {
        settings.entry.short.conditions = settings.entry.short.indicators;
        console.log(`[Strategy ${strategy.id}] Converted entry.short.indicators to conditions`);
      }
    } else {
      // entry 필드가 없으면 기본값 추가
      console.warn(`[Strategy ${strategy.id}] No entry conditions found, creating empty entry structure`);
      settings.entry = {
        long: { enabled: false, conditions: null },
        short: { enabled: false, conditions: null }
      };
    }

    if (settings.exit) {
      if (settings.exit.long?.indicators && !settings.exit.long.conditions) {
        settings.exit.long.conditions = settings.exit.long.indicators;
        console.log(`[Strategy ${strategy.id}] Converted exit.long.indicators to conditions`);
      }
      if (settings.exit.short?.indicators && !settings.exit.short.conditions) {
        settings.exit.short.conditions = settings.exit.short.indicators;
        console.log(`[Strategy ${strategy.id}] Converted exit.short.indicators to conditions`);
      }
    } else {
      // exit 필드가 없으면 기본값 추가
      console.warn(`[Strategy ${strategy.id}] No exit conditions found, creating empty exit structure`);
      settings.exit = {
        long: { enabled: false, conditions: null },
        short: { enabled: false, conditions: null }
      };
    }

    // 기타 필수 필드 검증
    if (!settings.timeframe) {
      settings.timeframe = '5m'; // 기본값
    }

    if (!settings.leverage) {
      settings.leverage = { mode: 'uniform', value: 1 };
    }

    if (!settings.initialMarginMode) {
      settings.initialMarginMode = 'usdt_amount';
      settings.initialMarginValue = 100;
    }

    if (!settings.positionMode) {
      settings.positionMode = 'one-way';
    }

    return {
      ...strategy,
      settings
    };
  }

  /**
   * 활성 전략 로드
   */
  private async loadActiveStrategies(): Promise<void> {
    try {
      addEngineLog({
        level: 'debug',
        category: '전략',
        message: '활성 전략을 로드합니다...'
      });

      const supabase = createSupabaseServerClient('service');

      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to load strategies: ${error.message}`);
      }

      const activeStrategies: Strategy[] = strategies || [];

      this.strategies.clear();
      for (const strategy of activeStrategies) {
        // Validate and normalize strategy data
        const normalizedStrategy = this.normalizeStrategy(strategy);

        this.strategies.set(normalizedStrategy.id, {
          strategy: normalizedStrategy,
          lastEvaluationTime: 0,
          evaluationCount: 0,
          errorCount: 0
        });
      }

      addEngineLog({
        level: 'success',
        category: '전략',
        message: `활성 전략 ${this.strategies.size}개를 로드했습니다.`,
        details: {
          action: 'Strategies Loaded',
          indicators: {
            'Strategy Count': this.strategies.size
          }
        }
      });
      console.log(`📋 Loaded ${this.strategies.size} active strategies`);
    } catch (error) {
      addEngineLog({
        level: 'error',
        category: '전략',
        message: '활성 전략 로드 실패',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
      console.error('Failed to load active strategies:', error);
      throw error;
    }
  }

  /**
   * 사용자 인증 정보 로드
   */
  private async loadCredentials(): Promise<void> {
    try {
      addEngineLog({
        level: 'debug',
        category: '시스템',
        message: 'API 인증 정보를 로드합니다...'
      });

      const supabase = createSupabaseServerClient('service');

      // TODO: 실제로는 특정 사용자의 credentials를 로드해야 함
      // 현재는 임시로 첫 번째 credential 사용
      const { data, error } = await supabase
        .from('credentials')
        .select('*')
        .limit(1)
        .single();

      if (error || !data) {
        addEngineLog({
          level: 'warning',
          category: '시스템',
          message: 'API 인증 정보를 찾을 수 없습니다. 주문이 실행되지 않습니다.'
        });
        console.warn('⚠️ No credentials found - orders will not be executed');
        this.credentials = null;
        return;
      }

      this.credentials = {
        apiKey: data.api_key,
        apiSecret: data.api_secret
      };

      addEngineLog({
        level: 'success',
        category: '시스템',
        message: 'API 인증 정보를 로드했습니다.'
      });
      console.log('✅ Credentials loaded');
    } catch (error) {
      addEngineLog({
        level: 'error',
        category: '시스템',
        message: 'API 인증 정보 로드 실패',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
      console.error('Failed to load credentials:', error);
      this.credentials = null;
    }
  }

  /**
   * 오픈 포지션 로드
   */
  private async loadOpenPositions(): Promise<void> {
    try {
      const positions = await this.positionTracker.getOpenPositions();

      this.positions.clear();

      for (const pos of positions) {
        const key = `${pos.symbol}_${pos.direction}`;
        this.positions.set(key, {
          symbol: pos.symbol,
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          quantity: pos.quantity,
          leverage: pos.leverage,
          unrealizedPnl: pos.unrealizedPnl,
          notional: pos.entryPrice * pos.quantity,
          entryTime: pos.entryTime
        });
      }

      console.log(`📊 Loaded ${this.positions.size} open positions`);
    } catch (error) {
      console.error('Failed to load open positions:', error);
    }
  }

  /**
   * 마켓 데이터 스트림 시작
   */
  private async startMarketDataStreams(): Promise<void> {
    const symbolIntervalPairs = new Set<string>();

    // 모든 활성 전략에서 심볼/간격 쌍 수집
    for (const runtime of this.strategies.values()) {
      const { settings } = runtime.strategy;
      const interval = settings.timeframe;

      // symbols가 배열인지 재확인
      if (!Array.isArray(settings.symbols)) {
        console.warn(`Strategy ${runtime.strategy.id} has invalid symbols, skipping...`);
        continue;
      }

      for (const symbol of settings.symbols) {
        if (symbol && typeof symbol === 'string') {
          symbolIntervalPairs.add(`${symbol}_${interval}`);
        }
      }
    }

    if (symbolIntervalPairs.size === 0) {
      console.log('⚠️ No symbols to stream, skipping market data initialization');
      return;
    }

    console.log(`📡 Starting market data streams for ${symbolIntervalPairs.size} symbol/interval pairs...`);

    // 각 심볼/간격에 대해 스트림 시작
    for (const pair of symbolIntervalPairs) {
      const [symbol, interval] = pair.split('_');
      try {
        await this.marketData.startStream(symbol, interval, true);
      } catch (error) {
        console.error(`Failed to start stream for ${symbol} ${interval}:`, error);
      }
    }

    console.log(`✅ Market data streams started`);
  }

  /**
   * 메인 평가 루프
   */
  private async evaluationLoop(): Promise<void> {
    if (!this.isRunning) return;

    // Circuit breaker 체크
    if (this.safetyState.circuitBreakerOpen) {
      console.warn('⚠️ Circuit breaker is open, skipping evaluation');
      this.checkCircuitBreakerReset();
      return;
    }

    const now = Date.now();

    for (const [strategyId, runtime] of this.strategies) {
      try {
        await this.evaluateStrategy(strategyId, runtime, now);
      } catch (error) {
        console.error(`Error evaluating strategy ${strategyId}:`, error);
        runtime.errorCount++;
        runtime.lastError = error instanceof Error ? error.message : String(error);

        this.safetyState.consecutiveFailures++;
        if (this.safetyState.consecutiveFailures >= this.safetyState.maxConsecutiveFailures) {
          this.openCircuitBreaker();
        }
      }
    }

    // 상태를 주기적으로 DB에 저장 (30초마다)
    const lastSaveTime = (this as any).lastStateSaveTime || 0;
    if (now - lastSaveTime > 30000) {
      await this.saveStateToDB(true);
      (this as any).lastStateSaveTime = now;
    }
  }

  /**
   * 개별 전략 평가
   */
  private async evaluateStrategy(
    strategyId: string,
    runtime: StrategyRuntime,
    now: number
  ): Promise<void> {
    const { strategy } = runtime;
    const settings = strategy.settings;

    console.log(`\n📊 Evaluating strategy: ${strategy.name}`);

    // symbols 배열 검증
    if (!Array.isArray(settings.symbols) || settings.symbols.length === 0) {
      console.warn(`Strategy ${strategyId} has no valid symbols to evaluate`);
      console.warn(`  settings.symbols: ${JSON.stringify(settings.symbols)}`);
      console.warn(`  settings.symbolSelection: ${JSON.stringify(settings.symbolSelection)}`);
      console.warn(`  this.strategies.size: ${this.strategies.size}`);

      // 전략을 다시 로드 시도
      console.log(`  Attempting to reload strategies...`);
      try {
        await this.loadActiveStrategies();
        console.log(`  ✓ Strategies reloaded successfully`);
        return; // 다음 루프에서 재평가
      } catch (error) {
        console.error(`  ✗ Failed to reload strategies:`, error);
      }
      return;
    }

    // 각 심볼에 대해 조건 평가
    for (const symbol of settings.symbols) {
      if (!symbol || typeof symbol !== 'string') {
        console.warn(`Invalid symbol in strategy ${strategyId}: ${symbol}`);
        continue;
      }

      try {
        await this.evaluateSymbol(symbol, strategy, runtime);
      } catch (error) {
        console.error(`Error evaluating symbol ${symbol}:`, error);
      }
    }

    runtime.lastEvaluationTime = now;
    runtime.evaluationCount++;

    // 성공 시 consecutive failures 리셋
    this.safetyState.consecutiveFailures = 0;

    console.log(`✓ Evaluated strategy ${strategyId} (count: ${runtime.evaluationCount})`);
  }

  /**
   * Binance API에서 직접 캔들 데이터 가져오기 (forceEvaluation용)
   * 가져온 데이터를 MarketDataService 캐시에도 저장하여 지표 계산에 사용
   */
  private async fetchKlinesFromAPI(symbol: string, interval: string, limit: number = 100): Promise<Candle[]> {
    try {
      const baseUrl = 'https://api.binance.com';
      const endpoint = '/api/v3/klines';
      const url = `${baseUrl}${endpoint}?symbol=${symbol}&interval=${interval}&limit=${limit}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Convert to Candle format
      const candles: Candle[] = data.map((k: any) => ({
        time: k[0] / 1000,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      // Also populate the MarketDataService cache for indicator calculations
      // We need to convert to KlineData format
      const { getKlineCache } = await import('../market-data/KlineCache');
      const cache = getKlineCache();

      for (const k of data) {
        const klineData = {
          symbol,
          interval,
          openTime: k[0],
          closeTime: k[6],
          open: k[1],
          high: k[2],
          low: k[3],
          close: k[4],
          volume: k[5],
          isClosed: true
        };
        cache.addKline(klineData);
      }

      console.log(`    ✓ Populated cache with ${candles.length} candles for ${symbol} ${interval}`);

      return candles;
    } catch (error) {
      console.error(`Failed to fetch klines from Binance API for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * 심볼별 조건 평가
   */
  private async evaluateSymbol(
    symbol: string,
    strategy: Strategy,
    runtime: StrategyRuntime
  ): Promise<void> {
    const settings = strategy.settings;
    const interval = settings.timeframe;

    // 0. 새로운 캔들인지 확인 (타임프레임 기반 평가)
    if (!this.isNewCandle(symbol, interval)) {
      // 같은 캔들 내에서는 평가하지 않음
      return;
    }

    const candleTime = new Date(this.getCurrentCandleTime(interval)).toISOString();
    console.log(`\n  ✨ [새 캔들] Symbol: ${symbol} (${interval}) - ${candleTime}`);

    addEngineLog({
      level: 'debug',
      category: '시스템',
      message: `새 캔들 평가 시작: ${symbol} (${interval})`,
      details: {
        symbol,
        timeframe: interval,
        candleTime
      }
    });

    // 1. 캔들 데이터 가져오기 (marketData 또는 API에서 직접)
    let candleCurrent: Candle | undefined;
    let candlePrevious: Candle | undefined;
    let currentPrice: number | null = null;

    // marketData에서 먼저 시도
    const klinesFromCache = this.marketData.getKlines(symbol, interval, 2);
    if (klinesFromCache.length > 0) {
      // 캐시에 데이터가 있으면 사용
      candleCurrent = klinesFromCache.length > 0 ? this.toCandleFormat(klinesFromCache[klinesFromCache.length - 1]) : undefined;
      candlePrevious = klinesFromCache.length > 1 ? this.toCandleFormat(klinesFromCache[klinesFromCache.length - 2]) : undefined;
      currentPrice = this.marketData.getCurrentPrice(symbol, interval);
      console.log(`    ✓ Using cached market data`);
    } else {
      // 캐시에 데이터가 없으면 API에서 직접 가져오기
      console.log(`    ℹ️ No cached data, fetching from Binance API...`);
      const klinesFromAPI = await this.fetchKlinesFromAPI(symbol, interval); // Fetch 100 candles for indicator calculations

      if (klinesFromAPI.length === 0) {
        console.log(`    ⚠️ Failed to fetch market data from API`);
        addEngineLog({
          level: 'warning',
          category: '가격',
          message: `시장 데이터 없음: ${symbol}`,
          details: { symbol, interval }
        });
        return;
      }

      candleCurrent = klinesFromAPI[klinesFromAPI.length - 1];
      candlePrevious = klinesFromAPI.length > 1 ? klinesFromAPI[klinesFromAPI.length - 2] : undefined;
      currentPrice = candleCurrent.close;
      console.log(`    ✓ Fetched ${klinesFromAPI.length} candles from API`);
    }

    if (!currentPrice || !candleCurrent) {
      console.log(`    ⚠️ No market data available`);
      return;
    }

    console.log(`    Current Price: ${currentPrice}`);

    // 3. 포지션 확인 (시뮬레이션 모드에서는 가상 포지션 사용)
    const positionKey = `${symbol}_long`; // TODO: hedge mode에서는 direction 별로
    const position = this.mode === 'simulation'
      ? this.virtualPositions.get(positionKey)
      : this.positions.get(positionKey);
    const hasPosition = !!position;

    console.log(`    Position: ${hasPosition ? 'YES' : 'NO'}`);

    // 4. 진입 조건 평가 (포지션이 없을 때)
    if (!hasPosition) {
      // Check if entry conditions exist for long or short
      const longEntryConditions = settings.entry?.long?.conditions;
      const shortEntryConditions = settings.entry?.short?.conditions;

      // 롱 진입 조건 평가
      if (longEntryConditions) {
        console.log(`    📋 [LONG] Entry conditions evaluation...`);
        const entryResult = await this.evaluateConditions(
          symbol,
          interval,
          longEntryConditions,
          'long',
          candleCurrent,
          candlePrevious
        );

        console.log(`    [LONG] Entry Signal: ${entryResult.signal ? '✅ TRUE' : '❌ FALSE'}`);

        if (entryResult.signal) {
          console.log(`    🎯 [LONG] ENTRY SIGNAL DETECTED for ${symbol}!`);

          if (this.mode === 'trading') {
            // 실제 주문 실행
            if (this.credentials) {
              await this.executeEntry(symbol, 'long', strategy, currentPrice);
            } else {
              console.warn('    ⚠️ No credentials - skipping order execution');
            }
          } else if (this.mode === 'simulation') {
            // 가상 주문 실행
            await this.executeVirtualEntry(symbol, 'long', strategy, currentPrice);
          } else {
            // 모니터링 모드
            console.log('    ℹ️ Monitoring mode - order execution skipped');
            addEngineLog({
              level: 'info',
              category: '조건',
              message: `[롱] 진입 시그널 감지 (모니터링 모드 - 주문 미실행)`,
              details: {
                symbol,
                action: '[LONG] Entry Signal Detected (Monitoring Mode)',
                price: currentPrice,
                direction: 'long'
              }
            });
          }
        }

        // 진입 조건 평가 결과 로그 및 DB 저장
        this.logEvaluationDetails(symbol, 'ENTRY', entryResult, 'LONG');

        // indicatorDetails를 배열로 변환
        const indicatorDetailsArray: any[] = [];
        if (entryResult.indicatorDetails && entryResult.indicatorDetails.size > 0) {
          entryResult.indicatorDetails.forEach((detail, id) => {
            const value = entryResult.indicators.get(id) || 0;
            const indicatorDetail: any = {
              id,
              type: detail.type,
              value: value,
              signal: detail.signal,
              config: detail.config,
              comparison: {
                operator: detail.comparisonOperator || detail.comparison?.operator || 'none',
                value: detail.comparisonValue || detail.comparison?.value,
                target: detail.comparisonTarget || detail.comparison?.target
              },
              metric: detail.metric,
              description: `[LONG] ${detail.type.toUpperCase()}(${JSON.stringify(detail.config)}) = ${value.toFixed(4)} ${detail.comparisonOperator || 'none'} ${detail.comparisonValue || detail.comparisonTarget || 'N/A'} => ${detail.signal ? '✅' : '❌'}`
            };

            // DMI의 경우 상세 정보 추가
            if (detail.type === 'dmi' && detail.details) {
              indicatorDetail.details = detail.details;
            }

            indicatorDetailsArray.push(indicatorDetail);
          });
        }

        await this.saveConditionEvaluation(
          strategy.id,
          symbol,
          'ENTRY', // direction: long은 details에 포함
          entryResult.signal,
          {
            indicators: Object.fromEntries(entryResult.indicators),
            indicatorDetails: indicatorDetailsArray,
            context: {
              currentPrice: entryResult.context.candleCurrent?.close,
              direction: 'long'
            }
          }
        );
      }

      // 숏 진입 조건 평가
      if (shortEntryConditions) {
        console.log(`    📋 [SHORT] Entry conditions evaluation...`);
        const entryResult = await this.evaluateConditions(
          symbol,
          interval,
          shortEntryConditions,
          'short',
          candleCurrent,
          candlePrevious
        );

        console.log(`    [SHORT] Entry Signal: ${entryResult.signal ? '✅ TRUE' : '❌ FALSE'}`);

        if (entryResult.signal) {
          console.log(`    🎯 [SHORT] ENTRY SIGNAL DETECTED for ${symbol}!`);

          if (this.mode === 'trading') {
            // 실제 주문 실행
            if (this.credentials) {
              await this.executeEntry(symbol, 'short', strategy, currentPrice);
            } else {
              console.warn('    ⚠️ No credentials - skipping order execution');
            }
          } else if (this.mode === 'simulation') {
            // 가상 주문 실행
            await this.executeVirtualEntry(symbol, 'short', strategy, currentPrice);
          } else {
            // 모니터링 모드
            console.log('    ℹ️ Monitoring mode - order execution skipped');
            addEngineLog({
              level: 'info',
              category: '조건',
              message: `[숏] 진입 시그널 감지 (모니터링 모드 - 주문 미실행)`,
              details: {
                symbol,
                action: '[SHORT] Entry Signal Detected (Monitoring Mode)',
                price: currentPrice,
                direction: 'short'
              }
            });
          }
        }

        // 진입 조건 평가 결과 로그 및 DB 저장
        this.logEvaluationDetails(symbol, 'ENTRY', entryResult, 'SHORT');

        // indicatorDetails를 배열로 변환
        const indicatorDetailsArray: any[] = [];
        if (entryResult.indicatorDetails && entryResult.indicatorDetails.size > 0) {
          entryResult.indicatorDetails.forEach((detail, id) => {
            const value = entryResult.indicators.get(id) || 0;
            const indicatorDetail: any = {
              id,
              type: detail.type,
              value: value,
              signal: detail.signal,
              config: detail.config,
              comparison: {
                operator: detail.comparisonOperator || detail.comparison?.operator || 'none',
                value: detail.comparisonValue || detail.comparison?.value,
                target: detail.comparisonTarget || detail.comparison?.target
              },
              metric: detail.metric,
              description: `[SHORT] ${detail.type.toUpperCase()}(${JSON.stringify(detail.config)}) = ${value.toFixed(4)} ${detail.comparisonOperator || 'none'} ${detail.comparisonValue || detail.comparisonTarget || 'N/A'} => ${detail.signal ? '✅' : '❌'}`
            };

            // DMI의 경우 상세 정보 추가
            if (detail.type === 'dmi' && detail.details) {
              indicatorDetail.details = detail.details;
            }

            indicatorDetailsArray.push(indicatorDetail);
          });
        }

        await this.saveConditionEvaluation(
          strategy.id,
          symbol,
          'ENTRY', // direction: short는 details에 포함
          entryResult.signal,
          {
            indicators: Object.fromEntries(entryResult.indicators),
            indicatorDetails: indicatorDetailsArray,
            context: {
              currentPrice: entryResult.context.candleCurrent?.close,
              direction: 'short'
            }
          }
        );
      }

      // Warning if no entry conditions at all
      if (!longEntryConditions && !shortEntryConditions) {
        console.log(`    ⚠️ Entry conditions not configured`);
        addEngineLog({
          level: 'warning',
          category: '조건',
          message: `진입 조건 미설정: ${symbol}`,
          details: {
            symbol,
            message: '전략에 진입 조건이 설정되지 않았습니다. 자동매매 설정에서 진입 조건을 추가하세요.'
          }
        });
      }
    }

    // 5. 청산 조건 평가 (포지션이 있을 때, 또는 테스트를 위해 포지션 없어도 평가)
    // Check if exit conditions exist for long or short
    const exitConditions = settings.exit?.long?.conditions || settings.exit?.short?.conditions;

    if (exitConditions) {
      // Determine which direction's conditions to use
      const direction = hasPosition ? position.direction : 'long';
      const directionExitConditions = direction === 'long'
        ? settings.exit?.long?.conditions
        : settings.exit?.short?.conditions;

      if (directionExitConditions) {
        if (hasPosition) {
          const exitContext = this.buildExitContext(symbol, position, candleCurrent, candlePrevious);

          const exitResult = await this.evaluateConditions(
            symbol,
            interval,
            directionExitConditions,
            position.direction,
            candleCurrent,
            candlePrevious,
            exitContext
          );

          console.log(`    Exit Signal: ${exitResult.signal ? '✅ TRUE' : '❌ FALSE'}`);

          if (exitResult.signal) {
            console.log(`    🎯 EXIT SIGNAL DETECTED for ${symbol}!`);

            if (this.mode === 'trading') {
              // 실제 청산 주문 실행
              if (this.credentials) {
                await this.executeExit(symbol, position.direction, strategy);
              } else {
                console.warn('    ⚠️ No credentials - skipping order execution');
              }
            } else if (this.mode === 'simulation') {
              // 가상 청산 주문 실행
              await this.executeVirtualExit(symbol, position.direction, currentPrice || candleCurrent?.close || 0);
            } else {
              // 모니터링 모드
              console.log('    ℹ️ Monitoring mode - order execution skipped');
              addEngineLog({
                level: 'info',
                category: '조건',
                message: `청산 시그널 감지 (모니터링 모드 - 주문 미실행)`,
                details: {
                  symbol,
                  action: 'Exit Signal Detected (Monitoring Mode)',
                  price: candleCurrent?.close
                }
              });
            }
          }

          // 청산 조건 평가 결과 로그 및 DB 저장
          this.logEvaluationDetails(symbol, 'EXIT', exitResult);

          // indicatorDetails를 배열로 변환
          const exitIndicatorDetailsArray: any[] = [];
          if (exitResult.indicatorDetails) {
            exitResult.indicatorDetails.forEach((detail, id) => {
              const value = exitResult.indicators.get(id) || 0;
              const indicatorDetail: any = {
                id,
                type: detail.type,
                value: value,
                signal: detail.signal,
                config: detail.config,
                comparison: {
                  operator: detail.comparisonOperator || detail.comparison?.operator || 'none',
                  value: detail.comparisonValue || detail.comparison?.value,
                  target: detail.comparisonTarget || detail.comparison?.target
                },
                metric: detail.metric,
                description: `${detail.type.toUpperCase()}(${JSON.stringify(detail.config)}) = ${value.toFixed(4)} ${detail.comparisonOperator || 'none'} ${detail.comparisonValue || detail.comparisonTarget || 'N/A'} => ${detail.signal ? '✅' : '❌'}`
              };

              // DMI의 경우 상세 정보 추가
              if (detail.type === 'dmi' && detail.details) {
                indicatorDetail.details = detail.details;
              }

              exitIndicatorDetailsArray.push(indicatorDetail);
            });
          }

          await this.saveConditionEvaluation(
            strategy.id,
            symbol,
            'EXIT',
            exitResult.signal,
            {
              indicators: Object.fromEntries(exitResult.indicators),
              indicatorDetails: exitIndicatorDetailsArray,
              context: {
                currentPrice: exitResult.context.candleCurrent?.close,
                profitRatePct: exitResult.context.profitRatePct,
                direction: exitResult.context.direction
              }
            }
          );
        } else {
          // 포지션이 없어도 테스트를 위해 청산 조건 평가 (지표 계산 확인용)
          console.log(`    ℹ️ Evaluating exit conditions without position (test mode)`);
          console.log(`    📋 Exit conditions structure:`, JSON.stringify(directionExitConditions, null, 2).substring(0, 500));
          const exitResult = await this.evaluateConditions(
            symbol,
            interval,
            directionExitConditions,
            'long', // 기본값
            candleCurrent,
            candlePrevious
          );

          console.log(`    Exit Signal (test): ${exitResult.signal ? '✅ TRUE' : '❌ FALSE'}`);

          // 청산 조건 평가 결과 로그만 저장 (DB 저장은 스킵)
          this.logEvaluationDetails(symbol, 'EXIT', exitResult);
        }
      }
    } else if (hasPosition) {
      console.log(`    ⚠️ Exit conditions not configured (but position exists!)`);
      addEngineLog({
        level: 'warning',
        category: '조건',
        message: `청산 조건 미설정 (포지션 있음): ${symbol}`,
        details: {
          symbol,
          message: '포지션이 있지만 청산 조건이 설정되지 않았습니다.'
        }
      });
    }
  }

  /**
   * 조건 평가 실행
   */
  private async evaluateConditions(
    symbol: string,
    interval: string,
    conditions: any,
    direction: 'long' | 'short',
    candleCurrent?: Candle,
    candlePrevious?: Candle,
    contextOverride?: Partial<EvaluationContext>
  ): Promise<{
    signal: boolean;
    indicators: Map<string, number>;
    indicatorDetails: Map<string, any>;
    context: EvaluationContext;
  }> {
    // 1. 조건에서 모든 지표 노드 추출
    console.log(`      🔎 Collecting indicator nodes from conditions...`);
    const { indicators: indicatorNodes } = collectExecutableLeaves(conditions.root);
    console.log(`      📊 Found ${indicatorNodes.length} indicator nodes`);

    // 2. 지표 계산
    const indicatorSignals: IndicatorSignalMap = {};
    const indicatorValues = new Map<string, number>();
    const indicatorDetails = new Map<string, any>();

    for (const node of indicatorNodes as IndicatorLeafNode[]) {
      console.log(`      🧮 Evaluating indicator: ${node.indicator.type} (${node.id}) for ${direction}`);
      const result = await this.indicatorCalculator.evaluateIndicator(
        node,
        symbol,
        interval,
        candleCurrent,
        candlePrevious,
        indicatorValues,
        direction // DMI diComparison 설정을 위해 direction 전달
      );

      console.log(`        Result: signal=${result.signal}, value=${result.value}`);
      indicatorSignals[node.id] = result.signal;

      if (result.value !== null) {
        indicatorValues.set(node.id, result.value);

        // 지표 상세 정보 저장 (DMI details 포함)
        indicatorDetails.set(node.id, {
          type: node.indicator.type,
          config: node.indicator.config,
          comparison: node.comparison,
          metric: node.metric,
          value: result.value,
          signal: result.signal,
          // 비교 조건 상세
          comparisonTarget: node.comparison?.target,
          comparisonValue: node.comparison?.value,
          comparisonOperator: node.comparison?.operator || 'none',
          // DMI 등 지표의 상세 정보 추가
          details: result.details || {}
        });
      }
    }

    console.log(`      ✅ Indicator calculation complete: ${indicatorValues.size} values`);
    if (indicatorValues.size > 0) {
      indicatorValues.forEach((value, id) => {
        console.log(`        ${id}: ${value.toFixed(4)}`);
      });
    }

    // 3. EvaluationContext 구성
    const context: EvaluationContext = {
      symbol,
      direction,
      candleCurrent,
      candlePrevious,
      ...contextOverride
    };

    // 4. 조건 평가
    const signal = evaluateConditions(conditions, context, { indicatorSignals });

    return { signal, indicators: indicatorValues, indicatorDetails, context };
  }

  /**
   * 청산 컨텍스트 구성
   */
  private buildExitContext(
    symbol: string,
    position: Position,
    candleCurrent?: Candle,
    candlePrevious?: Candle
  ): Partial<EvaluationContext> {
    const currentPrice = candleCurrent?.close || 0;
    const entryPrice = position.entryPrice || 0;

    // 수익률 계산
    const profitRatePct = entryPrice > 0
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : 0;

    // 진입 후 경과 시간 계산
    const entryTime = position.entryTime ? new Date(position.entryTime).getTime() : Date.now();
    const ageMs = Date.now() - entryTime;
    const entryAgeDays = ageMs / (1000 * 60 * 60 * 24);
    const entryAgeHours = ageMs / (1000 * 60 * 60);
    const entryAgeMinutes = ageMs / (1000 * 60);

    return {
      profitRatePct,
      entryAgeDays,
      entryAgeHours,
      entryAgeMinutes,
      unrealizedPnl: { asset: 'USDT', value: position.unrealizedPnl || 0 },
      positionSize: { asset: 'USDT', value: position.notional || 0 }
    };
  }

  /**
   * 캔들 포맷 변환
   */
  private toCandleFormat(kline: any): Candle {
    return {
      timestamp: kline.openTime,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
      volume: kline.volume
    };
  }

  /**
   * 진입 주문 실행
   */
  private async executeEntry(
    symbol: string,
    direction: 'long' | 'short',
    strategy: Strategy,
    currentPrice: number
  ): Promise<void> {
    if (!this.credentials) {
      console.error('No credentials available for order execution');
      return;
    }

    try {
      console.log(`\n🚀 Executing entry order...`);

      // 1. 주문 실행
      const orderResult = await this.orderExecutor.executeEntry(
        symbol,
        direction,
        strategy.settings,
        currentPrice,
        this.credentials
      );

      if (!orderResult.success) {
        console.error(`❌ Entry order failed:`, orderResult.error);
        return;
      }

      console.log(`✅ Entry order successful:`, orderResult);

      // 2. 포지션 추적
      const leverage = strategy.settings.leverage.mode === 'uniform'
        ? strategy.settings.leverage.value
        : (strategy.settings.leverage.custom?.[symbol] || strategy.settings.leverage.value);

      const trackedPosition = await this.positionTracker.trackEntry(
        strategy.id,
        symbol,
        direction,
        orderResult,
        leverage
      );

      if (trackedPosition) {
        // 3. 메모리에 포지션 추가
        const positionKey = `${symbol}_${direction}`;
        this.positions.set(positionKey, {
          symbol,
          direction,
          entryPrice: orderResult.price,
          quantity: orderResult.quantity,
          leverage,
          unrealizedPnl: 0,
          notional: orderResult.price * orderResult.quantity,
          entryTime: trackedPosition.entryTime
        });

        // 4. 거래 이력 기록
        await this.positionTracker.recordTrade(
          strategy.id,
          trackedPosition.id,
          symbol,
          'entry',
          orderResult
        );

        console.log(`✅ Position tracked: ${positionKey}`);
      }
    } catch (error) {
      console.error('Failed to execute entry:', error);
    }
  }

  /**
   * 청산 주문 실행
   */
  private async executeExit(
    symbol: string,
    direction: 'long' | 'short',
    strategy: Strategy
  ): Promise<void> {
    if (!this.credentials) {
      console.error('No credentials available for order execution');
      return;
    }

    try {
      console.log(`\n🚀 Executing exit order...`);

      // 1. DB에서 오픈 포지션 조회
      const trackedPosition = await this.positionTracker.getOpenPositionBySymbol(symbol, direction);

      if (!trackedPosition) {
        console.error(`❌ No open position found for ${symbol} ${direction}`);
        return;
      }

      // 2. 주문 실행
      const orderResult = await this.orderExecutor.executeExit(
        symbol,
        direction,
        strategy.settings,
        this.credentials
      );

      if (!orderResult.success) {
        console.error(`❌ Exit order failed:`, orderResult.error);
        return;
      }

      console.log(`✅ Exit order successful:`, orderResult);

      // 3. 포지션 청산 추적
      await this.positionTracker.trackExit(
        trackedPosition.id,
        orderResult,
        orderResult.price
      );

      // 4. 거래 이력 기록
      await this.positionTracker.recordTrade(
        strategy.id,
        trackedPosition.id,
        symbol,
        'exit',
        orderResult
      );

      // 5. 메모리에서 포지션 제거
      const positionKey = `${symbol}_${direction}`;
      this.positions.delete(positionKey);

      console.log(`✅ Position closed: ${positionKey}`);
    } catch (error) {
      console.error('Failed to execute exit:', error);
    }
  }

  /**
   * 평가 상세 로그
   */
  private logEvaluationDetails(
    symbol: string,
    type: 'ENTRY' | 'EXIT',
    result: {
      signal: boolean;
      indicators: Map<string, number>;
      indicatorDetails?: Map<string, any>;
      context: EvaluationContext;
    },
    direction?: 'LONG' | 'SHORT'
  ): void {
    const dirLabel = direction ? `[${direction}]` : '';
    console.log(`\n    📝 [${type}]${dirLabel} Evaluation Details:`);
    console.log(`      Symbol: ${symbol}`);
    console.log(`      Signal: ${result.signal ? '✅ TRUE' : '❌ FALSE'}`);

    // 지표 계산 결과를 객체로 변환
    const indicatorValues: Record<string, number> = {};
    const indicatorFullDetails: Array<any> = [];

    if (result.indicators.size > 0) {
      console.log(`      Indicators:`);
      result.indicators.forEach((value, id) => {
        console.log(`        ${id}: ${value.toFixed(4)}`);
        indicatorValues[id] = value;

        // 상세 정보가 있으면 추가
        if (result.indicatorDetails?.has(id)) {
          const detail = result.indicatorDetails.get(id);
          const fullDetail = {
            id,
            type: detail.type,
            value: value,
            signal: detail.signal,
            config: detail.config,
            comparison: {
              operator: detail.comparisonOperator,
              target: detail.comparisonTarget,
              value: detail.comparisonValue
            },
            metric: detail.metric,
            // 설명 문자열 생성
            description: `${dirLabel ? dirLabel + ' ' : ''}${detail.type.toUpperCase()}(${JSON.stringify(detail.config)}) = ${value.toFixed(4)} ${detail.comparisonOperator} ${detail.comparisonValue || detail.comparisonTarget || 'N/A'} => ${detail.signal ? '✅' : '❌'}`
          };
          indicatorFullDetails.push(fullDetail);

          console.log(`          - Type: ${detail.type}, Config: ${JSON.stringify(detail.config)}`);
          console.log(`          - Comparison: ${value.toFixed(4)} ${detail.comparisonOperator} ${detail.comparisonValue || detail.comparisonTarget || 'N/A'}`);
          console.log(`          - Result: ${detail.signal ? '✅ TRUE' : '❌ FALSE'}`);
        }
      });
    }

    if (result.context.profitRatePct !== undefined) {
      console.log(`      Profit Rate: ${result.context.profitRatePct.toFixed(2)}%`);
    }

    // 상세 로그를 addEngineLog로 저장
    addEngineLog({
      level: result.signal ? 'success' : 'debug',
      category: '조건',
      message: `${type === 'ENTRY' ? '진입' : '청산'} 조건 평가: ${symbol} - ${result.signal ? '충족' : '미충족'}`,
      details: {
        symbol,
        type,
        signal: result.signal,
        indicators: indicatorValues,
        indicatorDetails: indicatorFullDetails, // 완전한 상세 정보 추가
        context: {
          currentPrice: result.context.candleCurrent?.close,
          profitRatePct: result.context.profitRatePct,
          direction: result.context.direction
        }
      }
    });
  }

  /**
   * Circuit Breaker 열기
   */
  private openCircuitBreaker(): void {
    this.safetyState.circuitBreakerOpen = true;
    this.safetyState.lastResetTime = Date.now();
    console.error('🔴 Circuit breaker opened due to consecutive failures');

    // TODO: 알림 발송
  }

  /**
   * Circuit Breaker 리셋 체크
   */
  private checkCircuitBreakerReset(): void {
    const resetTimeout = 60000; // 1분 후 자동 리셋
    if (Date.now() - this.safetyState.lastResetTime > resetTimeout) {
      this.safetyState.circuitBreakerOpen = false;
      this.safetyState.consecutiveFailures = 0;
      console.log('🟢 Circuit breaker reset');
    }
  }

  /**
   * 루프 에러 핸들링
   */
  private handleLoopError(error: unknown): void {
    console.error('Critical error in evaluation loop:', error);

    // 너무 많은 에러가 발생하면 엔진 중지
    this.safetyState.consecutiveFailures++;
    if (this.safetyState.consecutiveFailures >= this.safetyState.maxConsecutiveFailures * 2) {
      console.error('🛑 Too many errors, stopping engine');
      this.stop();
    }
  }

  /**
   * 가상 진입 주문 실행 (시뮬레이션 모드)
   */
  private async executeVirtualEntry(
    symbol: string,
    direction: 'long' | 'short',
    strategy: Strategy,
    entryPrice: number
  ): Promise<void> {
    try {
      if (!this.simulationConfig) {
        throw new Error('Simulation config not initialized');
      }

      // 포지션 크기 계산 (자본금의 1% 리스크)
      const riskPerTrade = this.simulationConfig.currentCapital * 0.01;
      const quantity = riskPerTrade / entryPrice;

      const positionKey = `${symbol}_${direction}`;

      // 가상 포지션 생성
      const virtualPosition: Position = {
        symbol,
        direction,
        entryPrice,
        quantity,
        unrealizedPnL: 0,
        realizedPnL: 0,
        strategyId: strategy.id,
        strategyName: strategy.name,
        openTime: Date.now()
      };

      this.virtualPositions.set(positionKey, virtualPosition);

      // DB에 거래 저장
      await this.saveSimulationTrade(symbol, 'ENTRY', direction.toUpperCase() as 'LONG' | 'SHORT', entryPrice, quantity);

      // 엔진 상태 저장 (가상 포지션 포함)
      await this.saveStateToDB(true);

      addEngineLog({
        level: 'success',
        category: '시뮬레이션',
        message: `가상 진입 주문 실행: ${symbol}`,
        details: {
          symbol,
          action: 'Virtual Entry',
          price: entryPrice,
          indicators: {
            'Entry Price': entryPrice,
            'Quantity': quantity,
            'Position Value': entryPrice * quantity,
            'Direction': direction
          }
        }
      });

      console.log(`✅ Virtual position opened: ${positionKey} at ${entryPrice}`);
    } catch (error) {
      console.error('Failed to execute virtual entry:', error);
      addEngineLog({
        level: 'error',
        category: '시뮬레이션',
        message: `가상 진입 주문 실패: ${symbol}`,
        details: {
          symbol,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * 가상 청산 주문 실행 (시뮬레이션 모드)
   */
  private async executeVirtualExit(
    symbol: string,
    direction: 'long' | 'short',
    exitPrice: number
  ): Promise<void> {
    try {
      if (!this.simulationConfig) {
        throw new Error('Simulation config not initialized');
      }

      const positionKey = `${symbol}_${direction}`;
      const position = this.virtualPositions.get(positionKey);

      if (!position) {
        console.warn(`No virtual position found: ${positionKey}`);
        return;
      }

      // 손익 계산
      const pnl = direction === 'long'
        ? (exitPrice - position.entryPrice) * position.quantity
        : (position.entryPrice - exitPrice) * position.quantity;

      // 시뮬레이션 설정 업데이트
      this.simulationConfig.currentCapital += pnl;
      this.simulationConfig.totalPnL += pnl;
      this.simulationConfig.totalTrades++;

      if (pnl > 0) {
        this.simulationConfig.winningTrades++;
      } else {
        this.simulationConfig.losingTrades++;
      }

      // 가상 포지션 제거
      this.virtualPositions.delete(positionKey);

      const roi = ((pnl / (position.entryPrice * position.quantity)) * 100).toFixed(2);

      // DB에 청산 거래 저장
      await this.saveSimulationTrade(
        symbol,
        'EXIT',
        direction.toUpperCase() as 'LONG' | 'SHORT',
        exitPrice,
        position.quantity,
        pnl,
        {
          'Entry Price': position.entryPrice,
          'Exit Price': exitPrice,
          'PnL': pnl,
          'ROI (%)': parseFloat(roi)
        }
      );

      // 세션 통계 업데이트
      await this.updateSimulationSession();

      // 엔진 상태 저장 (가상 포지션 및 시뮬레이션 설정 포함)
      await this.saveStateToDB(true);

      addEngineLog({
        level: pnl > 0 ? 'success' : 'warning',
        category: '시뮬레이션',
        message: `가상 청산 주문 실행: ${symbol} (${pnl > 0 ? '수익' : '손실'})`,
        details: {
          symbol,
          action: 'Virtual Exit',
          price: exitPrice,
          indicators: {
            'Entry Price': position.entryPrice,
            'Exit Price': exitPrice,
            'PnL': pnl,
            'ROI (%)': parseFloat(roi),
            'Current Capital': this.simulationConfig.currentCapital,
            'Total PnL': this.simulationConfig.totalPnL
          }
        }
      });

      console.log(`✅ Virtual position closed: ${positionKey} - PnL: ${pnl.toFixed(2)}`);
    } catch (error) {
      console.error('Failed to execute virtual exit:', error);
      addEngineLog({
        level: 'error',
        category: '시뮬레이션',
        message: `가상 청산 주문 실패: ${symbol}`,
        details: {
          symbol,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * 강제 평가 실행 (테스트용)
   * 엔진 실행 여부와 무관하게 평가만 실행
   */
  async forceEvaluation(): Promise<{ success: boolean; message: string; evaluatedSymbols: number }> {
    try {
      console.log('🔄 강제 평가 실행 시작...');

      // 전략 로드
      await this.loadActiveStrategies();

      if (this.strategies.size === 0) {
        return {
          success: false,
          message: '활성 전략이 없습니다.',
          evaluatedSymbols: 0
        };
      }

      // 모든 심볼의 캔들 타임을 초기화하여 강제 평가 가능하게 함
      this.lastEvaluatedCandleTime.clear();

      let totalSymbols = 0;

      for (const [strategyId, runtime] of this.strategies) {
        const { strategy } = runtime;
        const settings = strategy.settings;

        if (!Array.isArray(settings.symbols) || settings.symbols.length === 0) {
          console.warn(`Strategy ${strategyId} has no valid symbols to evaluate`);
          continue;
        }

        for (const symbol of settings.symbols) {
          if (!symbol || typeof symbol !== 'string') {
            continue;
          }

          try {
            await this.evaluateSymbol(symbol, strategy, runtime);
            totalSymbols++;
          } catch (error) {
            console.error(`Error evaluating symbol ${symbol}:`, error);
          }
        }
      }

      addEngineLog({
        level: 'info',
        category: '엔진',
        message: `강제 평가 완료 (${totalSymbols}개 심볼 평가됨)`
      });

      return {
        success: true,
        message: `${totalSymbols}개 심볼 평가 완료`,
        evaluatedSymbols: totalSymbols
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('강제 평가 실패:', errorMessage);
      return {
        success: false,
        message: `평가 실패: ${errorMessage}`,
        evaluatedSymbols: 0
      };
    }
  }

  /**
   * 가상 포지션 조회 (시뮬레이션 모드용)
   */
  getVirtualPositions() {
    if (this.mode !== 'simulation' || !this.simulationConfig) {
      return [];
    }

    const positions = [];

    for (const [key, position] of this.virtualPositions.entries()) {
      // 현재가 가져오기
      const currentPrice = this.marketData.getCurrentPrice(
        position.symbol,
        this.strategies.values().next().value?.strategy.settings.timeframe || '1h'
      );

      if (!currentPrice) continue;

      // 미실현 손익 계산
      const pnlMultiplier = position.direction === 'long' ? 1 : -1;
      const unrealizedPnL = (currentPrice - position.entryPrice) * position.quantity * pnlMultiplier;

      positions.push({
        id: key, // Use position key as ID (e.g., "BTCUSDT_long")
        symbol: position.symbol,
        side: position.direction.toUpperCase() as 'LONG' | 'SHORT',
        entry_price: position.entryPrice,
        current_price: currentPrice,
        quantity: position.quantity,
        leverage: position.leverage || 1,
        unrealized_pnl: unrealizedPnL,
        strategy_id: position.strategyId,
        strategy_name: position.strategyName,
        opened_at: new Date(position.openTime || Date.now()).toISOString(),
        updated_at: new Date().toISOString(),
        user_id: null // Will be filled by API
      });
    }

    return positions;
  }

  /**
   * 엔진 상태 조회
   */
  async getStatus() {
    // DB에서 최신 상태 로드
    await this.loadStateFromDB();

    return {
      isRunning: this.isRunning,
      mode: this.mode,
      activeStrategies: this.strategies.size,
      circuitBreakerOpen: this.safetyState.circuitBreakerOpen,
      consecutiveFailures: this.safetyState.consecutiveFailures,
      simulation: this.simulationConfig ? {
        sessionId: this.simulationConfig.sessionId,
        initialCapital: this.simulationConfig.initialCapital,
        currentCapital: this.simulationConfig.currentCapital,
        totalPnL: this.simulationConfig.totalPnL,
        totalTrades: this.simulationConfig.totalTrades,
        winningTrades: this.simulationConfig.winningTrades,
        losingTrades: this.simulationConfig.losingTrades,
        winRate: this.simulationConfig.totalTrades > 0
          ? (this.simulationConfig.winningTrades / this.simulationConfig.totalTrades * 100)
          : 0,
        roi: ((this.simulationConfig.totalPnL / this.simulationConfig.initialCapital) * 100),
        startTime: this.simulationConfig.startTime,
        durationHours: this.simulationConfig.durationHours
      } : null,
      strategies: Array.from(this.strategies.values()).map(runtime => ({
        id: runtime.strategy.id,
        name: runtime.strategy.name,
        evaluationCount: runtime.evaluationCount,
        errorCount: runtime.errorCount,
        lastError: runtime.lastError,
        lastEvaluationTime: runtime.lastEvaluationTime
      }))
    };
  }
}

// Singleton instance
let engineInstance: ExecutionEngine | null = null;

export function getExecutionEngine(): ExecutionEngine {
  if (!engineInstance) {
    engineInstance = new ExecutionEngine();
  }
  return engineInstance;
}
