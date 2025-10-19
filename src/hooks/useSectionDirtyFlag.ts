import { useMemo } from 'react';

import { hasChanges } from '@/lib/common/diff';

export function useSectionDirtyFlag<T>(prev: T, next: T) {
  return useMemo(() => hasChanges(prev, next), [prev, next]);
}

