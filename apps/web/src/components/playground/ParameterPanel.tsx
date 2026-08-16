'use client'

/**
 * 参数调节面板:模型选择 + temperature/maxTokens/topP 滑块 + stream 开关 + API Key 输入。
 */

import * as React from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ihui/ui-react'
import { fetchPlaygroundModels } from '@/lib/playground-api'
import type { PlaygroundParams } from './PlaygroundTypes'

interface ParameterPanelProps {
  params: PlaygroundParams
  onParamsChange: (patch: Partial<PlaygroundParams>) => void
  apiKey: string
  onApiKeyChange: (key: string) => void
  disabled?: boolean
}

const API_KEY_STORAGE_KEY = 'ihui-playground-api-key'

export function ParameterPanel({
  params,
  onParamsChange,
  apiKey,
  onApiKeyChange,
  disabled,
}: ParameterPanelProps) {
  const [models, setModels] = React.useState<string[]>([])
  const [loadingModels, setLoadingModels] = React.useState(false)
  const [modelsError, setModelsError] = React.useState<string | null>(null)

  // 首次挂载从 localStorage 读取 apiKey
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(API_KEY_STORAGE_KEY)
      if (saved) onApiKeyChange(saved)
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // apiKey 变化时持久化
  const handleApiKeyChange = React.useCallback(
    (key: string) => {
      onApiKeyChange(key)
      try {
        window.localStorage.setItem(API_KEY_STORAGE_KEY, key)
      } catch {
        // ignore
      }
    },
    [onApiKeyChange],
  )

  const loadModels = React.useCallback(async () => {
    if (!apiKey.trim()) {
      setModelsError('请先填写 API Key')
      return
    }
    setLoadingModels(true)
    setModelsError(null)
    try {
      const list = await fetchPlaygroundModels(apiKey.trim())
      setModels(list)
      // 若当前未选模型或选中模型不在列表中,默认选第一个
      if (list.length > 0 && !list.includes(params.model)) {
        onParamsChange({ model: list[0] })
      }
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : '获取模型列表失败')
      setModels([])
    } finally {
      setLoadingModels(false)
    }
  }, [apiKey, params.model, onParamsChange])

  // 首次有 apiKey 时自动加载一次
  React.useEffect(() => {
    if (apiKey.trim() && models.length === 0 && !loadingModels) {
      void loadModels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* API Key */}
        <div className="space-y-1.5">
          <Label htmlFor="pg-api-key" className="text-xs font-medium">
            API Key
          </Label>
          <Input
            id="pg-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="ihui_xxx"
            disabled={disabled}
            className="h-8 text-xs"
          />
          <p className="text-[11px] text-muted-foreground">本地存储,仅用于本次调用</p>
        </div>

        {/* 模型选择 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">模型</Label>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={loadModels}
              disabled={disabled || loadingModels || !apiKey.trim()}
              aria-label="刷新模型列表"
            >
              {loadingModels ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
          {models.length > 0 ? (
            <Select
              value={params.model}
              onValueChange={(v) => onParamsChange({ model: v })}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={params.model}
              onChange={(e) => onParamsChange({ model: e.target.value })}
              placeholder={modelsError ?? '输入模型名或刷新列表'}
              disabled={disabled}
              className="h-8 text-xs"
            />
          )}
          {modelsError && <p className="text-[11px] text-destructive">{modelsError}</p>}
        </div>

        {/* temperature */}
        <SliderField
          label="temperature"
          value={params.temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => onParamsChange({ temperature: v })}
          disabled={disabled}
        />

        {/* max_tokens */}
        <SliderField
          label="max_tokens"
          value={params.maxTokens}
          min={1}
          max={8192}
          step={100}
          onChange={(v) => onParamsChange({ maxTokens: v })}
          disabled={disabled}
        />

        {/* top_p */}
        <SliderField
          label="top_p"
          value={params.topP}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onParamsChange({ topP: v })}
          disabled={disabled}
        />

        {/* stream 开关 */}
        <div className="flex items-center justify-between">
          <Label htmlFor="pg-stream" className="text-xs font-medium">
            stream(流式)
          </Label>
          <Switch
            id="pg-stream"
            checked={params.stream}
            onCheckedChange={(v) => onParamsChange({ stream: v })}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  )
}

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  disabled?: boolean
}

function SliderField({ label, value, min, max, step, onChange, disabled }: SliderFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
      </div>
      <Input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="h-4 cursor-pointer p-0"
      />
    </div>
  )
}
