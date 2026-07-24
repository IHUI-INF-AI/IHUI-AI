'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Bell, Check, Info, Sparkles } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ihui/ui-react'
import { Avatar, Badge } from '@/components/data'
import { Textarea } from '@/components/form'
import { Container } from '@/components/layout'

const COLORS: { name: string; token: string; className: string }[] = [
  { name: 'Primary', token: 'bg-primary text-primary-foreground', className: 'bg-primary' },
  { name: 'Secondary', token: 'bg-secondary text-secondary-foreground', className: 'bg-secondary' },
  { name: 'Accent', token: 'bg-accent text-accent-foreground', className: 'bg-accent' },
  {
    name: 'Destructive',
    token: 'bg-destructive text-destructive-foreground',
    className: 'bg-destructive',
  },
  { name: 'Muted', token: 'bg-muted text-muted-foreground', className: 'bg-muted' },
  { name: 'Border', token: 'border', className: 'bg-border' },
  { name: 'Background', token: 'bg-background', className: 'bg-background border' },
  { name: 'Foreground', token: 'text-foreground', className: 'bg-foreground' },
]

const SPACINGS: { name: string; className: string; px: string }[] = [
  { name: 'sm', className: 'h-2 w-2', px: '0.5rem (8px)' },
  { name: 'md', className: 'h-4 w-4', px: '1rem (16px)' },
  { name: 'lg', className: 'h-6 w-6', px: '1.5rem (24px)' },
  { name: 'xl', className: 'h-8 w-8', px: '2rem (32px)' },
]

const BUTTON_VARIANTS: Array<
  'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
> = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']

const BUTTON_SIZES: Array<'default' | 'sm' | 'lg' | 'icon'> = ['default', 'sm', 'lg', 'icon']

const BADGE_VARIANTS: Array<'default' | 'primary' | 'success' | 'warning' | 'danger'> = [
  'default',
  'primary',
  'success',
  'warning',
  'danger',
]

const BADGE_VARIANT_LABEL: Record<(typeof BADGE_VARIANTS)[number], string> = {
  default: '默认',
  primary: '主要',
  success: '成功',
  warning: '警告',
  danger: '危险',
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <Card>
        <CardContent className="p-5">{children}</CardContent>
      </Card>
    </section>
  )
}

export function DesignSystemDemoContent() {
  return (
    <Container maxWidth="xl" padding={false} className="space-y-6 py-6">
      <header className="space-y-1 px-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Sparkles className="h-7 w-7 text-primary" />
          设计系统演示
        </h1>
        <p className="text-sm text-muted-foreground">
          统一展示项目的颜色、字体、间距、按钮、卡片、表单、徽章、头像、标签页与 Toast 等 Design
          Token。
        </p>
      </header>

      {/* 颜色 Token */}
      <Section
        title="颜色 Token"
        description="primary / secondary / accent / destructive / muted 等核心色板。"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLORS.map(({ name, token, className }) => (
            <div key={name} className="space-y-2">
              <div
                className={`h-14 w-full rounded-md border border-border ${className}`}
                aria-hidden
              />
              <div className="text-xs">
                <div className="font-medium text-foreground">{name}</div>
                <code className="text-muted-foreground">{token}</code>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 间距 Token */}
      <Section title="间距 Token" description="sm / md / lg / xl 等基础间距单位。">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SPACINGS.map(({ name, className, px }) => (
            <div key={name} className="space-y-2">
              <div className="flex h-12 items-end">
                <div className={`rounded-sm bg-primary/80 ${className}`} />
              </div>
              <div className="text-xs">
                <div className="font-medium text-foreground">{name}</div>
                <code className="text-muted-foreground">{px}</code>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 按钮 Variants */}
      <Section title="按钮 Variant" description="Button 的所有 variant 样式。">
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
      </Section>

      {/* 按钮 Sizes */}
      <Section title="按钮 Size" description="Button 的所有 size 尺寸。">
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_SIZES.map((size) => (
            <Button key={size} size={size} variant="outline">
              {size === 'icon' ? <Check className="h-4 w-4" /> : size}
            </Button>
          ))}
        </div>
      </Section>

      {/* 卡片 */}
      <Section
        title="卡片组件"
        description="Card / CardHeader / CardContent / CardFooter 完整结构。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>卡片标题</CardTitle>
              <CardDescription>这是卡片描述，用于补充说明标题内容。</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              卡片正文区域，可放置任意内容。
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">确认</Button>
              <Button size="sm" variant="ghost">
                取消
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>简洁卡片</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              仅包含标题与正文的简化版卡片。
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* 表单 */}
      <Section title="表单组件" description="Input / Label / Textarea 基础表单元素。">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ds-input">用户名</Label>
            <Input id="ds-input" placeholder="请输入用户名" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-input-disabled">禁用输入框</Label>
            <Input id="ds-input-disabled" placeholder="不可编辑" disabled />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="ds-textarea">备注</Label>
            <Textarea id="ds-textarea" placeholder="请输入备注信息" />
          </div>
        </div>
      </Section>

      {/* 徽章 */}
      <Section title="徽章 Badge" description="Badge 的所有 variant 状态。">
        <div className="flex flex-wrap items-center gap-2">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {BADGE_VARIANT_LABEL[variant]}
            </Badge>
          ))}
        </div>
      </Section>

      {/* 头像 */}
      <Section title="头像 Avatar" description="不同尺寸与形状的头像组件。">
        <div className="flex flex-wrap items-end gap-6">
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <div key={size} className="space-y-1.5 text-center">
              <Avatar name={`用户 ${size}`} size={size} />
              <div className="text-xs text-muted-foreground">{size}</div>
            </div>
          ))}
          <div className="space-y-1.5 text-center">
            <Avatar name="方形头像" shape="square" size="lg" />
            <div className="text-xs text-muted-foreground">square</div>
          </div>
        </div>
      </Section>

      {/* 标签页 */}
      <Section title="标签页 Tabs" description="切换不同视图内容。">
        <Tabs defaultValue="account" className="w-full">
          <TabsList>
            <TabsTrigger value="account">账户</TabsTrigger>
            <TabsTrigger value="password">密码</TabsTrigger>
            <TabsTrigger value="notify">通知</TabsTrigger>
          </TabsList>
          <TabsContent value="account" className="text-sm text-muted-foreground">
            账户设置：管理用户名、头像与基础信息。
          </TabsContent>
          <TabsContent value="password" className="text-sm text-muted-foreground">
            密码设置：定期更换密码以保障账户安全。
          </TabsContent>
          <TabsContent value="notify" className="text-sm text-muted-foreground">
            通知设置：自定义消息、邮件与推送偏好。
          </TabsContent>
        </Tabs>
      </Section>

      {/* Toast */}
      <Section title="Toast 触发" description="点击按钮触发不同类型的 Toast 通知。">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => toast.success('操作成功完成', { description: '数据已保存到服务器。' })}
          >
            <Check className="h-4 w-4" />
            成功 Toast
          </Button>
          <Button
            variant="destructive"
            onClick={() => toast.error('操作失败', { description: '网络异常，请稍后重试。' })}
          >
            错误 Toast
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.info('提示信息', { description: '这是一条普通提示消息。' })}
          >
            <Info className="h-4 w-4" />
            信息 Toast
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast('默认 Toast', { description: '不带类型的默认样式。' })}
          >
            <Bell className="h-4 w-4" />
            默认 Toast
          </Button>
        </div>
      </Section>
    </Container>
  )
}
