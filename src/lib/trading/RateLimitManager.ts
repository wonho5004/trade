/**
 * API Rate Limit 관리 시스템
 *
 * Binance API 제한:
 * - 1200 requests per minute (weight)
 * - 50 orders per 10 seconds
 * - 160,000 orders per 24 hours
 */

import { EventEmitter } from 'events';

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxOrdersPer10Seconds: number;
  maxOrdersPerDay: number;
  maxWeight: number;
}

interface QueuedRequest {
  id: string;
  userId: string;
  endpoint: string;
  weight: number;
  priority: number;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  execute: () => Promise<any>;
}

interface UserQuota {
  userId: string;
  requestsThisMinute: number;
  ordersThisInterval: number;
  ordersToday: number;
  weightUsed: number;
  lastReset: number;
  tier: 'free' | 'basic' | 'pro' | 'enterprise';
}

export class RateLimitManager extends EventEmitter {
  private static instance: RateLimitManager;

  private config: RateLimitConfig = {
    maxRequestsPerMinute: 1200,
    maxOrdersPer10Seconds: 50,
    maxOrdersPerDay: 160000,
    maxWeight: 1200
  };

  private requestQueue: QueuedRequest[] = [];
  private processingQueue = false;
  private userQuotas = new Map<string, UserQuota>();

  // 프록시 풀 (여러 API 키 관리)
  private apiKeyPool: Array<{
    key: string;
    secret: string;
    weight: number;
    lastUsed: number;
    available: boolean;
  }> = [];

  // 캐시 시스템
  private cache = new Map<string, {
    data: any;
    expiry: number;
  }>();

  private constructor() {
    super();
    this.initializeRateLimitReset();
  }

  public static getInstance(): RateLimitManager {
    if (!RateLimitManager.instance) {
      RateLimitManager.instance = new RateLimitManager();
    }
    return RateLimitManager.instance;
  }

  /**
   * API 키 풀에 키 추가
   */
  public addApiKey(key: string, secret: string): void {
    this.apiKeyPool.push({
      key,
      secret,
      weight: 0,
      lastUsed: 0,
      available: true
    });
  }

  /**
   * 사용자별 티어 설정
   */
  public setUserTier(userId: string, tier: UserQuota['tier']): void {
    const quota = this.getUserQuota(userId);
    quota.tier = tier;
  }

  /**
   * API 요청 큐에 추가
   */
  public async queueRequest<T>(
    userId: string,
    endpoint: string,
    execute: () => Promise<T>,
    options: {
      weight?: number;
      priority?: number;
      cacheDuration?: number;
    } = {}
  ): Promise<T> {
    const { weight = 1, priority = 0, cacheDuration = 0 } = options;

    // 캐시 확인
    const cacheKey = `${userId}:${endpoint}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      console.log(`[RateLimit] Cache hit for ${endpoint}`);
      return cached.data;
    }

    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${Date.now()}-${Math.random()}`,
        userId,
        endpoint,
        weight,
        priority,
        timestamp: Date.now(),
        resolve: (data) => {
          // 캐시 저장
          if (cacheDuration > 0) {
            this.cache.set(cacheKey, {
              data,
              expiry: Date.now() + cacheDuration * 1000
            });
          }
          resolve(data);
        },
        reject,
        execute
      };

      this.requestQueue.push(request);
      this.requestQueue.sort((a, b) => b.priority - a.priority);

      if (!this.processingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * 큐 처리
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        // Rate limit 확인
        if (!this.canMakeRequest(request.userId, request.weight)) {
          // 대기 후 재시도
          this.requestQueue.unshift(request);
          await this.delay(1000);
          continue;
        }

        // API 키 선택
        const apiKey = this.selectApiKey();
        if (!apiKey) {
          // 사용 가능한 API 키 없음
          this.requestQueue.unshift(request);
          await this.delay(5000);
          continue;
        }

        // 요청 실행
        console.log(`[RateLimit] Processing request ${request.id} for user ${request.userId}`);
        this.updateQuota(request.userId, request.weight);
        apiKey.weight += request.weight;
        apiKey.lastUsed = Date.now();

        const result = await request.execute();
        request.resolve(result);

        this.emit('request:success', {
          userId: request.userId,
          endpoint: request.endpoint,
          weight: request.weight
        });

        // 요청 간 최소 딜레이
        await this.delay(50);
      } catch (error: any) {
        console.error(`[RateLimit] Request failed:`, error);

        // 429 에러 (Rate limit)
        if (error.code === 429 || error.message?.includes('Too many requests')) {
          // 큐 맨 앞으로 다시 추가
          this.requestQueue.unshift(request);

          // 백오프 전략
          const backoffTime = this.calculateBackoff(request.userId);
          console.log(`[RateLimit] Rate limited. Backing off for ${backoffTime}ms`);

          await this.delay(backoffTime);
        } else {
          request.reject(error);
          this.emit('request:error', {
            userId: request.userId,
            endpoint: request.endpoint,
            error: error.message
          });
        }
      }
    }

    this.processingQueue = false;
  }

  /**
   * 요청 가능 여부 확인
   */
  private canMakeRequest(userId: string, weight: number): boolean {
    const quota = this.getUserQuota(userId);

    // 티어별 제한 적용
    const limits = this.getTierLimits(quota.tier);

    if (quota.requestsThisMinute >= limits.maxRequestsPerMinute) {
      return false;
    }

    if (quota.weightUsed + weight > limits.maxWeight) {
      return false;
    }

    return true;
  }

  /**
   * 사용자 쿼터 가져오기
   */
  private getUserQuota(userId: string): UserQuota {
    if (!this.userQuotas.has(userId)) {
      this.userQuotas.set(userId, {
        userId,
        requestsThisMinute: 0,
        ordersThisInterval: 0,
        ordersToday: 0,
        weightUsed: 0,
        lastReset: Date.now(),
        tier: 'free'
      });
    }
    return this.userQuotas.get(userId)!;
  }

  /**
   * 티어별 제한 가져오기
   */
  private getTierLimits(tier: UserQuota['tier']): RateLimitConfig {
    switch (tier) {
      case 'enterprise':
        return {
          maxRequestsPerMinute: 6000,
          maxOrdersPer10Seconds: 200,
          maxOrdersPerDay: 500000,
          maxWeight: 6000
        };
      case 'pro':
        return {
          maxRequestsPerMinute: 3000,
          maxOrdersPer10Seconds: 100,
          maxOrdersPerDay: 300000,
          maxWeight: 3000
        };
      case 'basic':
        return {
          maxRequestsPerMinute: 1200,
          maxOrdersPer10Seconds: 50,
          maxOrdersPerDay: 160000,
          maxWeight: 1200
        };
      case 'free':
      default:
        return {
          maxRequestsPerMinute: 300,
          maxOrdersPer10Seconds: 10,
          maxOrdersPerDay: 10000,
          maxWeight: 300
        };
    }
  }

  /**
   * 쿼터 업데이트
   */
  private updateQuota(userId: string, weight: number): void {
    const quota = this.getUserQuota(userId);
    quota.requestsThisMinute++;
    quota.weightUsed += weight;
  }

  /**
   * API 키 선택 (라운드 로빈)
   */
  private selectApiKey() {
    const now = Date.now();
    const availableKeys = this.apiKeyPool.filter(key => {
      // 1분 이내 사용한 weight가 1200 미만인 키
      if (now - key.lastUsed > 60000) {
        key.weight = 0; // 1분 지나면 리셋
      }
      return key.available && key.weight < 1000;
    });

    if (availableKeys.length === 0) return null;

    // 가장 적게 사용된 키 선택
    return availableKeys.reduce((min, key) =>
      key.weight < min.weight ? key : min
    );
  }

  /**
   * 백오프 시간 계산
   */
  private calculateBackoff(userId: string): number {
    const quota = this.getUserQuota(userId);
    const baseBackoff = 1000; // 1초
    const attempts = Math.min(quota.requestsThisMinute / 10, 10);
    return baseBackoff * Math.pow(2, attempts); // 지수 백오프
  }

  /**
   * Rate limit 리셋
   */
  private initializeRateLimitReset(): void {
    // 매분 리셋
    setInterval(() => {
      for (const [_, quota] of this.userQuotas) {
        quota.requestsThisMinute = 0;
        quota.weightUsed = 0;
      }

      // API 키 weight 리셋
      for (const key of this.apiKeyPool) {
        key.weight = 0;
      }

      console.log('[RateLimit] Minute quota reset');
    }, 60000);

    // 10초마다 주문 카운터 리셋
    setInterval(() => {
      for (const [_, quota] of this.userQuotas) {
        quota.ordersThisInterval = 0;
      }
    }, 10000);

    // 매일 자정 리셋
    const resetDaily = () => {
      for (const [_, quota] of this.userQuotas) {
        quota.ordersToday = 0;
      }
      console.log('[RateLimit] Daily quota reset');
    };

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      resetDaily();
      setInterval(resetDaily, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    // 캐시 정리 (10분마다)
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache) {
        if (value.expiry < now) {
          this.cache.delete(key);
        }
      }
    }, 600000);
  }

  /**
   * 딜레이 헬퍼
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 통계 가져오기
   */
  public getStats(userId?: string): any {
    if (userId) {
      const quota = this.getUserQuota(userId);
      const limits = this.getTierLimits(quota.tier);
      return {
        user: {
          ...quota,
          limits
        },
        queue: {
          length: this.requestQueue.filter(r => r.userId === userId).length,
          processing: this.processingQueue
        }
      };
    }

    return {
      totalUsers: this.userQuotas.size,
      queueLength: this.requestQueue.length,
      processing: this.processingQueue,
      apiKeys: this.apiKeyPool.length,
      cacheSize: this.cache.size
    };
  }
}