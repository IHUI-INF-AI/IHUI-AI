import type { Meta, StoryObj } from '@storybook/vue3'
import { ElButton } from 'element-plus'

const meta: Meta<typeof ElButton> = {
  title: '基础组件/Button',
  component: ElButton,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: ['primary', 'success', 'warning', 'danger', 'info', 'text'] },
    size: { control: 'select', options: ['large', 'default', 'small'] },
    plain: { control: 'boolean' },
    round: { control: 'boolean' },
    circle: { control: 'boolean' },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: { type: 'primary', default: '主要按钮' },
}

export const Plain: Story = {
  args: { type: 'primary', plain: true, default: '朴素按钮' },
}

export const Round: Story = {
  args: { type: 'success', round: true, default: '圆角按钮' },
}

export const Small: Story = {
  args: { size: 'small', default: '小按钮' },
}

export const Loading: Story = {
  args: { loading: true, default: '加载中' },
}

export const Disabled: Story = {
  args: { disabled: true, default: '禁用' },
}
