import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@ihui/ui'
import { Button } from '@ihui/ui'

/**
 * Card 组件 stories — 等价自旧架构 client/src/stories/Card.stories.ts
 * 展示 Card 各子组件组合形态
 */
const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

// 标准卡片：标题 + 描述 + 内容 + 底部操作
export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>卡片标题</CardTitle>
        <CardDescription>卡片描述文本，用于补充说明</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">这是卡片正文内容区域，可放置任意子元素。</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" size="sm">
          取消
        </Button>
        <Button size="sm">确认</Button>
      </CardFooter>
    </Card>
  ),
}

// 仅标题与内容
export const Simple: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>简单卡片</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm">无描述、无底部操作的精简形态。</p>
      </CardContent>
    </Card>
  ),
}

// 无头卡片：仅内容
export const ContentOnly: Story = {
  render: () => (
    <Card className="w-80 p-6">
      <p className="text-sm">无 Header/Footer 的纯内容卡片。</p>
    </Card>
  ),
}
