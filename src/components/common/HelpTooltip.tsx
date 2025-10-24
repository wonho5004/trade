'use client';

import React, { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
  /** 도움말 ID (help-content.ts에 정의된 ID) */
  id: string;
  /** 도움말 제목 */
  title?: string;
  /** 도움말 내용 (짧은 요약) */
  content: string;
  /** 상세 내용 (선택사항) */
  details?: string;
  /** 예시 목록 (선택사항) */
  examples?: string[];
  /** 경고 메시지 (선택사항) */
  warnings?: string[];
  /** 관련 주제 (선택사항) */
  relatedTopics?: Array<{ id: string; label: string }>;
  /** 표시 위치 */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** 최대 너비 */
  maxWidth?: number;
  /** 커스텀 클래스 */
  className?: string;
}

/**
 * 인라인 도움말 툴팁
 * - 호버 또는 클릭 시 도움말 표시
 * - 마크다운 지원
 * - 예시, 경고, 관련 주제 표시
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  id,
  title,
  content,
  details,
  examples,
  warnings,
  relatedTopics,
  position = 'top',
  maxWidth = 320,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
        setShowDetails(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVisible]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-zinc-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-zinc-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-zinc-800'
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* 트리거 아이콘 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsVisible(!isVisible)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => {
          // 클릭으로 열린 경우는 호버 아웃 시 닫지 않음
          if (!showDetails) {
            setTimeout(() => setIsVisible(false), 200);
          }
        }}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 transition-colors"
        aria-label={`${title || id} 도움말`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* 툴팁 */}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 ${positionClasses[position]}`}
          style={{ maxWidth: `${maxWidth}px` }}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => {
            if (!showDetails) {
              setIsVisible(false);
            }
          }}
        >
          {/* 화살표 */}
          <div className={`absolute w-0 h-0 border-4 border-transparent ${arrowClasses[position]}`} />

          {/* 컨텐츠 */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-800 shadow-lg">
            {/* 헤더 */}
            {title && (
              <div className="border-b border-zinc-700 px-3 py-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
                </div>
              </div>
            )}

            {/* 본문 */}
            <div className="px-3 py-2">
              <p className="text-xs text-zinc-300 leading-relaxed">{content}</p>

              {/* 상세 내용 */}
              {details && (
                <div className="mt-2">
                  {!showDetails ? (
                    <button
                      onClick={() => setShowDetails(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      자세히 보기 →
                    </button>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-zinc-400 leading-relaxed">{details}</p>
                      <button
                        onClick={() => setShowDetails(false)}
                        className="text-xs text-zinc-500 hover:text-zinc-400"
                      >
                        간략히 보기 ←
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 예시 */}
              {examples && examples.length > 0 && (
                <div className="mt-3 rounded border border-green-500/30 bg-green-500/10 p-2">
                  <p className="text-xs font-medium text-green-300 mb-1">💡 예시</p>
                  <ul className="space-y-1 text-xs text-green-200">
                    {examples.map((example, index) => (
                      <li key={index}>• {example}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 경고 */}
              {warnings && warnings.length > 0 && (
                <div className="mt-3 rounded border border-yellow-500/30 bg-yellow-500/10 p-2">
                  <p className="text-xs font-medium text-yellow-300 mb-1">⚠️ 주의</p>
                  <ul className="space-y-1 text-xs text-yellow-200">
                    {warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 관련 주제 */}
              {relatedTopics && relatedTopics.length > 0 && (
                <div className="mt-3 pt-2 border-t border-zinc-700">
                  <p className="text-xs font-medium text-zinc-400 mb-1">관련 주제</p>
                  <div className="flex flex-wrap gap-1">
                    {relatedTopics.map((topic) => (
                      <button
                        key={topic.id}
                        className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-600 transition-colors"
                      >
                        {topic.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
