import type { Preview } from '@storybook/vue3'
import '../src/styles/index.scss'

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    chromatic: {
      // 视觉回归基线参数
      viewports: [375, 1280],
      delay: 300,
      diffThreshold: 0.05,
    },
  },
}

export default preview
