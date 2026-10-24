// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text, Input } from '@tarojs/components'

/** 与 apps/api 的 RELAY_PROVIDERS 同集(codearts 无每日签到引擎,如实列出) */
export const PROVIDERS = ['trae', 'workbuddy', 'qoder', 'codearts'] as const

export interface PoolDraft {
  providerCode: string
  name: string
  token: string
  refreshToken: string
}

type Tx = (key: string, vars?: Record<string, string | number>) => string

export interface AddFormProps {
  t: Tx
  draft: PoolDraft
  busy: boolean
  onChange: (patch: Partial<PoolDraft>) => void
  onSave: () => void
  onCancel: () => void
}

// 圆角走档(见 §4 守门 77)；其余尺寸用 var 派生态
const INPUT_STYLE = `height:88rpx;background:var(--color-muted);padding:0 24rpx;font-size:28rpx;color:var(--color-foreground);width:100%;box-sizing:border-box;`

const labelCls = 'mt-[20rpx] block text-[length:24rpx] text-muted-foreground'
const firstLabelCls = 'block text-[length:24rpx] text-muted-foreground'
const pillCls = 'rounded-md px-[20rpx] py-[10rpx] text-[length:24rpx]'

/** 号池录入表单:平台 chip + 名称 + Token + 可选 Refresh Token(web 端同一组字段) */
export function AddForm({ t, draft, busy, onChange, onSave, onCancel }: AddFormProps) {
  const canSave = draft.name.trim() !== '' && draft.token.trim() !== '' && !busy
  return (
    <View className="mt-[24rpx] rounded-lg border border-border bg-card p-[28rpx]">
      <Text className={firstLabelCls}>{t('accountPool.provider')}</Text>
      <View className="mt-[12rpx] flex flex-wrap gap-[12rpx]">
        {PROVIDERS.map((p) => (
          <Text
            key={p}
            className={`${pillCls} ${
              draft.providerCode === p
                ? 'bg-[var(--color-cta)] text-[var(--color-cta-foreground)]'
                : 'bg-muted text-muted-foreground'
            }`}
            onClick={() => onChange({ providerCode: p })}
          >
            {p}
          </Text>
        ))}
      </View>
      <Text className={labelCls}>{t('accountPool.name')}</Text>
      <Input
        className="mt-[12rpx] rounded-sm"
        style={INPUT_STYLE}
        value={draft.name}
        placeholder={t('accountPool.namePlaceholder')}
        onInput={(e) => onChange({ name: e.detail.value })}
      />
      <Text className={labelCls}>{t('accountPool.token')}</Text>
      <Input
        className="mt-[12rpx] rounded-sm"
        style={INPUT_STYLE}
        value={draft.token}
        placeholder={t('accountPool.token')}
        onInput={(e) => onChange({ token: e.detail.value })}
      />
      <Text className={labelCls}>
        {t('accountPool.refreshToken')}（{t('accountPool.optional')}）
      </Text>
      <Input
        className="mt-[12rpx] rounded-sm"
        style={INPUT_STYLE}
        value={draft.refreshToken}
        placeholder={t('accountPool.optional')}
        onInput={(e) => onChange({ refreshToken: e.detail.value })}
      />
      <View className="mt-[24rpx] flex gap-[16rpx]">
        <Text
          className="rounded-md px-[24rpx] py-[14rpx] text-[length:26rpx] text-muted-foreground"
          onClick={onCancel}
        >
          {t('accountPool.cancel')}
        </Text>
        <View
          className={`flex h-[64rpx] flex-1 items-center justify-center rounded-md bg-[var(--color-cta)] ${
            canSave ? '' : 'opacity-60'
          }`}
          onClick={() => {
            if (canSave) onSave()
          }}
        >
          <Text className="text-[length:26rpx] font-semibold text-[var(--color-cta-foreground)]">
            {busy ? t('accountPool.adding') : t('accountPool.save')}
          </Text>
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
