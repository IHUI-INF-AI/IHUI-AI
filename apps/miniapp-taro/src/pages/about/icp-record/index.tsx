// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, t } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback } from 'react'
import ThemeRoot from '@/components/ThemeRoot'

const ICP_NO = t('aboutIcprecord.p1')

const VALUES = [
  ICP_NO,
  t('aboutIcprecord.r1'),
  t('aboutIcprecord.r2'),
  t('devEnter.modelEdit.targetGroupEnterprise'),
  'aizhs.top',
  '2026-01-15',
]

const QUERY_URL = 'https://beian.miit.gov.cn/'

export default function IcpRecord() {
  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: tt('about.icpRecord.title', 'ICP备案') })
  })
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const labels = [
    tt('about.icpRecord.icpNo', 'ICP 备案号'),
    tt('about.icpRecord.policeNo', '公安备案号'),
    tt('about.icpRecord.subject', '备案主体'),
    tt('about.icpRecord.nature', '备案性质'),
    tt('about.icpRecord.domain', '域名'),
    tt('about.icpRecord.recordDate', '备案日期'),
  ]
  const info = labels.map((label, i) => ({ label, value: VALUES[i] || '' }))

  const onQuery = useCallback(() => {
    Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(QUERY_URL)}` })
  }, [])

  const copyIcpNo = useCallback(() => {
    Taro.setClipboardData({ data: ICP_NO })
  }, [])

  return (
    <ThemeRoot><View className="min-h-screen bg-background pb-[48rpx]">
      <View className="m-[24rpx] py-[32rpx] px-[24rpx] bg-card rounded-[16rpx] flex flex-col items-center gap-[12rpx]">
        <Text className="text-[26rpx] text-muted-foreground">
          {tt('about.icpRecord.icpLabel', 'ICP备案/许可证号')}
        </Text>
        <Text className="text-[34rpx] text-foreground font-semibold" onClick={copyIcpNo}>
          {ICP_NO}
        </Text>
        <Text className="text-[22rpx] text-muted-foreground">
          {tt('about.icpRecord.copyHint', '点击编号可复制')}
        </Text>
      </View>

      <View className="m-[24rpx] px-[32rpx] bg-card rounded-[16rpx] flex flex-col gap-[8rpx]">
        {info.map((item) => (
          <ThemeRoot><View key={item.label} className="flex justify-between items-center py-[28rpx]">
            <Text className="text-[28rpx] text-muted-foreground shrink-0">{item.label}</Text>
            <Text className="text-[28rpx] text-foreground text-right ml-[24rpx] max-w-[60%] break-all">
              {item.value}
            </Text>
          </View>
        </ThemeRoot>))}
      </View>

      <View className="pt-[24rpx] px-[32rpx]">
        <Button
          className="w-full bg-primary text-white rounded-[12rpx] text-[30rpx] leading-[80rpx]"
          onClick={onQuery}
        >
          {tt('about.icpRecord.query', '前往工信部查询')}
        </Button>
      </View>

      <View className="py-[24rpx] px-[32rpx]">
        <Text className="text-[22rpx] text-muted-foreground leading-[1.7]">
          {tt('about.icpRecord.footer', '以上信息来自工信部备案查询系统')}
        </Text>
     </ThemeRoot> </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
