"use client";

import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import type { QuoteCurrency, TickerInfo } from '@/types/assets';

export function useSymbolValidation(input: string, quote: QuoteCurrency) {
  const [valid, setValid] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(input.trim(), 200);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    const run = async () => {
      const q = debounced;
      if (!q) {
        setValid(null);
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ quote, sort: 'alphabet', limit: '20' });
        params.set('search', q);
        const res = await fetch(`/api/markets?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error('fetch failed');
        const json = (await res.json()) as { items: TickerInfo[] };
        const items = json.items ?? [];
        const list = items
          .filter((it) => it.quote === quote)
          .map((it) => `${it.base}/${it.quote}`);
        if (!aborted) {
          setSuggestions(list);
          const norm = normalizeCandidate(q, quote);
          setValid(list.some((s) => s.replace('/', '') === norm));
        }
      } catch {
        if (!aborted) {
          setSuggestions([]);
          setValid(null);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    };
    run();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [debounced, quote]);

  return useMemo(() => ({ valid, suggestions, loading }), [valid, suggestions, loading]);
}

function normalizeCandidate(text: string, quote: QuoteCurrency) {
  const t = (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!t) return '';
  if (t.endsWith(quote)) return t;
  return `${t}${quote}`;
}

