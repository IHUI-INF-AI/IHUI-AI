'use client'

/**
 * 各平台动态凭据表单
 * 从 platform-schemas 取 schema,动态渲染字段(text/password/textarea/select)
 * password 字段有显示/隐藏切换 + 粘贴按钮(小白友好)
 * browser_cookie 类型平台显示 BrowserAuthHelper 引导
 * 表单值用 Record<string, string> 精确类型(禁 any)
 */

import * as React from 'react'
import { Eye, EyeOff, ClipboardPaste, Eraser, Info } from 'lucide-react'
import {
  Input,
  Label,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import {
  getPlatformSchema,
  type PlatformCredentialField,
} from '@/lib/publish/platform-schemas'
import { BrowserAuthHelper } from './BrowserAuthHelper'

interface PlatformCredentialFormProps {
  platformId: string
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  disabled?: boolean
}

export function PlatformCredentialForm({
  platformId,
  value,
  onChange,
  disabled,
}: PlatformCredentialFormProps) {
  const schema = getPlatformSchema(platformId)

  if (!schema) {
    return (
      <p className="text-xs text-muted-foreground">
        暂不支持该平台的可视化配置,请使用 JSON 模式或联系管理员补 schema。
      </p>
    )
  }

  const isBrowserCookie = schema.authType === 'browser_cookie'
  const cookieFields = isBrowserCookie
    ? schema.fields.map((f) => ({ name: f.name, label: f.label }))
    : []

  function setField(name: string, v: string): void {
    onChange({ ...value, [name]: v })
  }

  async function pasteField(name: string): Promise<void> {
    try {
      const text = await navigator.clipboard.readText()
      setField(name, text.trim())
    } catch {
      // 剪贴板权限被拒(如非 HTTPS / iframe 沙箱),忽略静默
    }
  }

  function clearField(name: string): void {
    setField(name, '')
  }

  return (
    <div className="space-y-3">
      {isBrowserCookie && cookieFields.length > 0 && (
        <BrowserAuthHelper
          platformName={schema.platformName}
          platformUrl={schema.setupGuideUrl}
          cookieFields={cookieFields}
        />
      )}
      <div className="space-y-2.5">
        {schema.fields.map((field) => (
          <FieldRenderer
            key={field.name}
            field={field}
            value={value[field.name] ?? ''}
            onChange={(v) => setField(field.name, v)}
            onPaste={() => void pasteField(field.name)}
            onClear={() => clearField(field.name)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}

interface FieldRendererProps {
  field: PlatformCredentialField
  value: string
  onChange: (v: string) => void
  onPaste: () => void
  onClear: () => void
  disabled?: boolean
}

function FieldRenderer({
  field,
  value,
  onChange,
  onPaste,
  onClear,
  disabled,
}: FieldRendererProps) {
  const [show, setShow] = React.useState(false)
  const isPassword = field.type === 'password'
  const isTextarea = field.type === 'textarea'
  const isSelect = field.type === 'select'
  const hasValue = value.length > 0

  const labelEl = (
    <div className="flex items-center gap-1">
      <Label className="text-xs">
        {field.label}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {field.helpText && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`帮助:${field.label}`}
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              {field.helpText}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )

  if (isSelect) {
    return (
      <div className="space-y-1">
        {labelEl}
        <Select
          value={value}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={field.placeholder ?? '请选择'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (isTextarea) {
    return (
      <div className="space-y-1">
        {labelEl}
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder={field.placeholder}
            className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 pr-20 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              onClick={onPaste}
              disabled={disabled}
              aria-label="粘贴"
            >
              <ClipboardPaste className="h-3 w-3" />
            </Button>
            {hasValue && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={onClear}
                disabled={disabled}
                aria-label="清空"
              >
                <Eraser className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {labelEl}
      <div className="relative">
        <Input
          type={isPassword && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder}
          className={cn('h-8 text-xs', isPassword && 'pr-16', hasValue && 'pr-20')}
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5">
          {isPassword && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              onClick={() => setShow((s) => !s)}
              disabled={disabled}
              aria-label={show ? '隐藏' : '显示'}
            >
              {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            onClick={onPaste}
            disabled={disabled}
            aria-label="粘贴"
          >
            <ClipboardPaste className="h-3 w-3" />
          </Button>
          {hasValue && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              onClick={onClear}
              disabled={disabled}
              aria-label="清空"
            >
              <Eraser className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
