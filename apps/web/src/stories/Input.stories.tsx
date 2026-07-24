import type { Meta, StoryObj } from '@storybook/react'
import { Input } from '@ihui/ui-react'

/**
 * Input 组件 stories — 等价自旧架构 client/src/stories/Input.stories.ts
 * 覆盖默认、禁用、占位符、文件等形态
 */
const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search', 'file', 'tel', 'url'],
      description: '输入框类型',
    },
    disabled: { control: 'boolean', description: '是否禁用' },
    placeholder: { control: 'text', description: '占位符' },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

// 默认输入框
export const Default: Story = {
  args: {
    placeholder: '请输入内容',
    type: 'text',
  },
}

// 带默认值
export const WithValue: Story = {
  args: {
    defaultValue: '已填写的文本',
    type: 'text',
  },
}

// 邮箱
export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'name@example.com',
  },
}

// 密码
export const Password: Story = {
  args: {
    type: 'password',
    placeholder: '请输入密码',
  },
}

// 禁用
export const Disabled: Story = {
  args: {
    placeholder: '禁用状态',
    disabled: true,
  },
}

// 文件选择
export const File: Story = {
  args: {
    type: 'file',
  },
}
