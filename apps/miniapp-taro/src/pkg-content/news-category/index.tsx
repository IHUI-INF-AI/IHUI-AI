// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/news/NewsCategoryScreen.tsx

import { useI18n } from '@/i18n'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import ThemeRoot from '@/components/ThemeRoot'

// 由 scripts/gen-miniapp-mirror.mjs 依首例 aa4c418bff1a 形制生成:文案骨架镜像自共享屏的 i18n 键,
// 值逐语取自 mobile-rn 词包(零新译)。交互与数据钩子(列表/请求/跳转)需按共享屏人工补齐 ——
// 本稿先钉死「镜像声明 + 路由在册 + 词包同键」的声明链,页面级还原度由后续人工轮提升。
const PAIR_KEYS: readonly (readonly [string, string])[] = []
const SINGLE_KEYS: readonly string[] = [
  'news.categoryBackToList',
  'news.categoryNotFound',
  'news.categoryEmpty',
  'news.categoryPinned',
  'news.categorySubtitle',
  'news.categoryLoadFailed',
  'news.categoryTotal',
  'news.categoryPublishedAt',
  'news.categoryViewCount',
]

export default function NewsCategory() {
  const { t } = useI18n()
  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: t('news.title') })
  })

  return (
    <ThemeRoot>
      <ScrollView className="h-screen bg-background" scrollY>
        <View className="px-[28rpx] pt-[28rpx] pb-[64rpx] flex flex-col gap-[24rpx]">
          <View className="bg-card rounded-lg border border-border p-[28rpx]">
            <Text className="block text-[length:36rpx] font-semibold text-foreground leading-[44rpx] mb-[12rpx]">
              {t('news.title')}
            </Text>
          </View>

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
