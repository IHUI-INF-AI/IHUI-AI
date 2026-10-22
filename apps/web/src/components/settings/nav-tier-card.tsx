// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * NavTierCard — 设置页「侧边栏简洁模式」卡片(2026-10-20 立)
 *
 * 一个总闸 + 四个分档开关,覆盖侧边栏里那 60 项「用户看得见但实际用不到」的入口:
 * 开发者工具 / 模型中转站运营后台 / 高级 AI 工具 / 实验性功能。
 *
 * 为什么不是"从侧边栏右键隐藏某一项":那要给 100+ 项逐个维护隐藏状态,用户在没有
 * 心智模型的清单里做逐项决策;分档则是一次决策解决 60 项,默认值(全隐藏)对九成
 * 用户就是终态。真有需要的人按档打开即可 —— 四档的说明文字就是他的心智模型。
 *
 * 状态统一走 `useNavVisibilityStore`,本卡片不含任何读 localStorage / 调接口的代码:
 * 持久化与跨设备同步是 store 的职责,UI 只负责发出意图。这样将来换成别的载体
 * (比如命令面板 / 桌面端设置)不需要复制一遍副作用。
 */

import { useTranslations } from 'next-intl'
import { EyeOff } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui-react'

import { ALL_NAV_TIERS, useNavVisibilityStore } from '@/stores/nav-visibility'
import type { NavAdvancedTier } from '@/components/sidebar/types'

export function NavTierCard() {
  const t = useTranslations('settings.navTiers')
  const hiddenTiers = useNavVisibilityStore((s) => s.hiddenTiers)
  const setTier = useNavVisibilityStore((s) => s.setTier)
  const setAllTiers = useNavVisibilityStore((s) => s.setAllTiers)

  // 总闸判据 = 四档全隐藏。不用单独存一个 simpleMode 布尔:
  // 存布尔会与四个分档构成同一事实的两份表示,两者必然漂移(§0.6 单一真相源)。
  const simpleMode = ALL_NAV_TIERS.every((tier) => hiddenTiers.includes(tier))

  return (
    <Card data-testid="nav-tier-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <EyeOff className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">{t('title')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('desc')}</p>

        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm">{t('simpleMode')}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('simpleModeDesc')}
            </span>
          </span>
          <Switch
            checked={simpleMode}
            onCheckedChange={setAllTiers}
            aria-label={t('simpleMode')}
            data-testid="nav-tier-simple-mode"
            className="shrink-0"
          />
        </div>

        <div className="space-y-1 pt-3">
          {ALL_NAV_TIERS.map((tier) => (
            <div key={tier} className="flex items-start justify-between gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{t(tier)}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(`${tier as NavAdvancedTier}Desc`)}
                </span>
              </span>
              <Switch
                checked={!hiddenTiers.includes(tier)}
                onCheckedChange={(v) => setTier(tier, !v)}
                aria-label={t(tier)}
                data-testid={`nav-tier-${tier}`}
                className="shrink-0"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
