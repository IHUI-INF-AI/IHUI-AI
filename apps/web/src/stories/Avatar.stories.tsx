import type { Meta, StoryObj } from '@storybook/react'
import { Avatar } from '@/components/data/Avatar'

/**
 * Avatar 组件 stories — 迁移自旧架构 client/src/stories/Avatar.stories.ts
 * 覆盖 5 种 size + 2 种 shape + 图片回退
 */
const meta = {
  title: 'Data/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: '头像尺寸',
    },
    shape: {
      control: 'select',
      options: ['circle', 'square'],
      description: '头像形状',
    },
    src: { control: 'text', description: '图片地址' },
    fallback: { control: 'text', description: '图片加载失败时的回退文本' },
    name: { control: 'text', description: '名称（用于生成首字母回退）' },
  },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

// 默认头像（首字母回退）
export const Default: Story = {
  args: {
    name: '张三',
    size: 'md',
    shape: 'circle',
  },
}

// 带图片
export const WithImage: Story = {
  args: {
    src: 'https://i.pravatar.cc/100?img=12',
    name: '李四',
    size: 'md',
  },
}

// 图片加载失败回退
export const Fallback: Story = {
  args: {
    src: 'https://invalid.example.com/broken.jpg',
    fallback: 'WX',
    size: 'md',
  },
}

// 尺寸对比
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-3">
      <Avatar name="超小" size="xs" />
      <Avatar name="小" size="sm" />
      <Avatar name="中" size="md" />
      <Avatar name="大" size="lg" />
      <Avatar name="超大" size="xl" />
    </div>
  ),
}

// 方形头像
export const Square: Story = {
  args: {
    name: '王五',
    shape: 'square',
    size: 'lg',
  },
}
