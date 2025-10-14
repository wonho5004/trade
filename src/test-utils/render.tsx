import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { ThemeProvider } from '@/components/ui/theme-provider';

export function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}
