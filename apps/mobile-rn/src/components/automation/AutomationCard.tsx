// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Pressable, Text, View } from 'react-native'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@ihui/ui-native'
import type { BadgeVariant } from '@ihui/design-tokens'
import type { UserAutomation, AutomationStatus } from '@ihui/api-client'
import {
  deriveAutomationTerminalReason,
  type AutomationTerminalReason,
  type AutomationTerminalTone,
} from '@ihui/shared/utils/automation-terminal-reason'
import { useI18n } from '../../i18n'

export interface AutomationCardProps {
  item: UserAutomation
  onSelect?: (item: UserAutomation) => void
}

/**
 * G-241 终态徽章的色调档 → @ihui/ui-native Badge 档名。
 * 档名集合(neutral/danger/warning/success)归 @ihui/shared 的判据单源,
 * 色值留 nativewind token(同 badge-spec 规则 6:色值不下沉,允许两端不同形)。
 */
const TERMINAL_BADGE_VARIANT: Record<AutomationTerminalTone, BadgeVariant> = {
  neutral: 'secondary',
  danger: 'destructive',
  warning: 'outline',
  success: 'default',
}

function StatusBadge({ status }: { status: AutomationStatus }) {
  const { t } = useI18n()
  const isActive = status === 'active'
  return (
    <Badge
      variant={isActive ? 'default' : 'secondary'}
      label={isActive ? t('automations.active') : t('automations.paused')}
    />
  )
}

/**
 * G-241 终态徽章:「为什么这个自动化不再跑了」。
 * 无终态(null / 取值不在封闭集内)⇒ 整块不渲染,保持原状。
 */
function TerminalBadge({ reason }: { reason: AutomationTerminalReason | null }) {
  const { t } = useI18n()
  const terminal = deriveAutomationTerminalReason(reason)
  if (!terminal) return null
  return (
    <Badge
      variant={TERMINAL_BADGE_VARIANT[terminal.tone]}
      label={t(`automations.terminalReason.${terminal.i18nSuffix}`)}
      testID={`automation-terminal-${terminal.i18nSuffix}`}
    />
  )
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

/**
 * 只读自动化卡片:展示名称、状态、调度方式与下次运行时间。点击回调交给父屏决定跳转。
 */
export function AutomationCard({ item, onSelect }: AutomationCardProps) {
  const { t } = useI18n()
  const scheduleLabel =
    item.scheduleType === 'recurring'
      ? t('automations.scheduleRecurring')
      : t('automations.scheduleOnce')

  return (
    <Card className="mb-3">
      <Pressable
        onPress={() => onSelect?.(item)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex-1 pr-2" numberOfLines={1}>
            {item.name}
          </CardTitle>
          <View className="flex-row items-center gap-2">
            <StatusBadge status={item.status} />
            <TerminalBadge reason={item.terminalReason} />
          </View>
        </CardHeader>
        <CardContent>
          <View className="mb-1 flex-row items-center gap-2">
            <Text className="text-xs text-muted-foreground">{t('automations.schedule')}:</Text>
            <Text className="text-xs text-foreground">{scheduleLabel}</Text>
          </View>
          <View className="mb-1 flex-row items-center gap-2">
            <Text className="text-xs text-muted-foreground">{t('automations.nextRun')}:</Text>
            <Text className="text-xs text-foreground">{formatDateTime(item.nextRunAt)}</Text>
          </View>
          {item.lastResult ? (
            <Text numberOfLines={2} className="text-xs text-muted-foreground">
              {t('automations.lastRun')}: {item.lastResult.summary}
            </Text>
          ) : (
            <Text className="text-xs text-muted-foreground">{t('automations.noResult')}</Text>
          )}
        </CardContent>
      </Pressable>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
