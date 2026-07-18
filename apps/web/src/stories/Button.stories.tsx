import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '@ihui/ui'

/**
 * Button 组件 stories — 等价自旧架构 client/src/stories/Button.stories.ts
 * 覆盖 6 种 variant + 4 种 size
 */
const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: '按钮样式变体',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: '按钮尺寸',
    },
    disabled: { control: 'boolean', description: '是否禁用' },
    asChild: { control: 'boolean', description: '是否作为子组件渲染' },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

// 默认按钮
export const Default: Story = {
  args: {
    children: '按钮',
    variant: 'default',
    size: 'default',
  },
}

// 危险操作
export const Destructive: Story = {
  args: { children: '删除', variant: 'destructive' },
}

// 描边
export const Outline: Story = {
  args: { children: '取消', variant: 'outline' },
}

// 次要
export const Secondary: Story = {
  args: { children: '次要操作', variant: 'secondary' },
}

// 幽灵
export const Ghost: Story = {
  args: { children: '幽灵按钮', variant: 'ghost' },
}

// 链接
export const Link: Story = {
  args: { children: '查看更多', variant: 'link' },
}

// 小尺寸
export const Small: Story = {
  args: { children: '小按钮', size: 'sm' },
}

// 大尺寸
export const Large: Story = {
  args: { children: '大按钮', size: 'lg' },
}

// 禁用
export const Disabled: Story = {
  args: { children: '禁用按钮', disabled: true },
}
