// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/finance-ai/FinanceAiHubScreen.tsx

import { useI18n } from '@/i18n'
import { View, Text, ScrollView } from '@tarojs/components'
import ThemeRoot from '@/components/ThemeRoot'

// 由 scripts/gen-miniapp-mirror.mjs 依首例 aa4c418bff1a 形制生成:文案骨架镜像自共享屏的 i18n 键,
// 值逐语取自 mobile-rn 词包(零新译)。交互与数据钩子(列表/请求/跳转)按共享屏的实际字段/端点核实后再补 ——
// 本稿先钉死「镜像声明 + 路由在册 + 词包同键」的声明链;**本头注不声明任何待办**:这一页的功能对齐
// 状态由判定台账的 evidence 分桶单源给出(report-rn-miniapp-gaps.mjs 文末),不在这里各写一份。
const PAIR_KEYS: readonly (readonly [string, string])[] = []
const SINGLE_KEYS: readonly string[] = [
  'financeAi.automationPrompt',
  'financeAi.promptBookkeeping',
  'financeAi.promptWithPayload',
  'financeAi.promptAskUpload',
  'financeAi.phaseBookkeeping',
  'financeAi.promptTaxFiling',
  'financeAi.phaseTaxFiling',
  'financeAi.promptTaxDraftNote',
  'financeAi.fieldPeriod',
  'financeAi.fieldSales',
  'financeAi.fieldOutputTax',
  'financeAi.fieldInputTax',
  'financeAi.fieldProfit',
  'financeAi.taxpayerGeneral',
  'financeAi.taxpayerSmall',
  'financeAi.fieldWages',
]

export default function FinanceAiHub() {
  const { t } = useI18n()

  return (
    <ThemeRoot>
      <ScrollView className="h-screen bg-background" scrollY>
        <View className="px-[28rpx] pt-[28rpx] pb-[64rpx] flex flex-col gap-[24rpx]">
          {PAIR_KEYS.map(([titleKey, bodyKey]) => (
            <View key={titleKey} className="bg-card rounded-lg border border-border p-[28rpx]">
              <Text className="block text-[length:36rpx] font-semibold text-foreground leading-[44rpx] mb-[24rpx]">
                {t(titleKey)}
              </Text>
              <Text className="block text-[length:28rpx] text-muted-foreground leading-[44rpx] text-justify">
                {t(bodyKey)}
              </Text>
            </View>
          ))}
          {SINGLE_KEYS.map((bodyKey) => (
            <View key={bodyKey} className="bg-card rounded-lg border border-border p-[28rpx]">
              <Text className="block text-[length:28rpx] text-muted-foreground leading-[44rpx] text-justify">
                {t(bodyKey)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
