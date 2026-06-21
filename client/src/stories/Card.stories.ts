import type { Meta, StoryObj } from '@storybook/vue3'
import { ElCard } from 'element-plus'

const meta: Meta<typeof ElCard> = {
  title: '基础组件/Card',
  component: ElCard,
  tags: ['autodocs'],
  argTypes: {
    header: { control: 'text' },
    shadow: { control: 'select', options: ['always', 'hover', 'never'] },
    bodyStyle: { control: 'object' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    header: '卡片标题',
    default: '这是卡片内容区域，用于展示信息块。',
    shadow: 'always',
  },
}

export const HoverShadow: Story = {
  args: {
    header: '悬浮阴影',
    default: '鼠标悬停时显示阴影效果。',
    shadow: 'hover',
  },
}

export const NoShadow: Story = {
  args: {
    header: '无阴影',
    default: '始终不显示阴影。',
    shadow: 'never',
  },
}
