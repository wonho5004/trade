import type { Preview } from '@storybook/react';

import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#09090b'
        },
        {
          name: 'light',
          value: '#ffffff'
        }
      ]
    }
  }
};

export default preview;
