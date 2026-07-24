'use client'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from '@ihui/ui-react'
import type { SpecTemplate } from '@ihui/shared/spec/index'

interface TemplateCardProps {
  template: SpecTemplate
  onUse?: (template: SpecTemplate) => void
  used?: boolean
}

/** 模板卡片:展示 name + description + sections badges + 使用按钮 */
export function TemplateCard({ template, onUse, used }: TemplateCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{template.name}</CardTitle>
        <CardDescription className="text-xs">{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex flex-wrap gap-1.5">
          {template.sections.map((s) => (
            <span
              key={s}
              className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          variant={used ? 'default' : 'outline'}
          size="sm"
          className="w-full"
          onClick={() => onUse?.(template)}
        >
          {used ? '已选择' : '使用此模板'}
        </Button>
      </CardFooter>
    </Card>
  )
}
