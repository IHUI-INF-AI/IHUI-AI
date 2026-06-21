import type { Meta, StoryObj } from '@storybook/vue3'
import LanguageSwitcher from '@/components/header/parts/LanguageSwitcher.vue'

const meta: Meta<typeof LanguageSwitcher> = {
  title: '基础组件/LanguageSwitcher',
  component: LanguageSwitcher,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '顶部导航栏语言切换器。支持中/英/日/韩 4 种语言,鼠标悬停或点击展开下拉面板。下拉面板通过 Teleport 渲染到 body。',
      },
    },
  },
  decorators: [
    () => ({
      template: `
        <div style="padding: 80px 40px; display: flex; justify-content: flex-end; background: var(--el-bg-color-page); min-height: 200px;">
          <story />
        </div>
      `,
    }),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

/* ═══ 默认(中文) ═══ */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: '默认中文状态。鼠标悬停或点击展开下拉菜单。',
      },
    },
  },
}

/* ═══ 暗色模式背景 ═══ */
export const DarkBackground: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    () => ({
      template: `
        <div style="padding: 80px 40px; display: flex; justify-content: flex-end; background: #1a1a1a; min-height: 200px; color: #fff;">
          <story />
        </div>
      `,
    }),
  ],
}
