import type { StorybookConfig } from '@storybook/nextjs'

/**
 * Storybook 主配置 — 迁移自旧架构 client/.storybook/main.ts
 * 框架：@storybook/nextjs（基于 webpack5，适配 Next.js 15 + React 19）
 * stories glob 覆盖 src 下所有 .stories 文件
 *
 * 说明：早期迁移草稿误用 @storybook/nextjs-vite，但该包未在 package.json 声明，
 * 也未安装。@storybook/nextjs 已内置读取 next.config.ts / tsconfig.json 的能力，
 * 因此 @ alias 与全局样式无需在 storybook 侧重复配置。
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx|mdx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
}

export default config
