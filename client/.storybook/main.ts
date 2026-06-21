import type { StorybookConfig } from '@storybook/vue3-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  core: {
    builder: '@storybook/builder-vite',
  },
  viteFinal: async (config) => {
    // 复用项目 alias 与全局样式
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          '@': new URL('../src', import.meta.url).pathname,
        },
      },
      css: {
        ...config.css,
        preprocessorOptions: {
          ...config.css?.preprocessorOptions,
          scss: {
            additionalData: `@use "@/styles/variables.scss" as *;`,
          },
        },
      },
    }
  },
}

export default config
