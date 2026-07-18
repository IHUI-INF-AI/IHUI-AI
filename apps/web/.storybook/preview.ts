import type { Preview } from '@storybook/react'
import '../app/globals.css'

/**
 * Storybook 预览配置 — 等价自旧架构 client/.storybook/preview.ts
 * 引入项目全局样式（Tailwind），使 stories 视觉与真实应用一致
 */
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'centered',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0a0a0a' },
      ],
    },
  },
}

export default preview
