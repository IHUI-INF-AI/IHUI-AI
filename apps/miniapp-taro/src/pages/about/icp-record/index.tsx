import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback } from 'react'
import { useI18n } from '@/i18n'

const ICP_NO = '吉ICP备2025027274号-7A'

const VALUES = [
  ICP_NO,
  '粤公网安备44010602000001号',
  '广州智汇科技有限公司',
  '企业',
  'ihui.ai',
  '2026-01-15',
]

const QUERY_URL = 'https://beian.miit.gov.cn/'

export default function IcpRecord() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: tt('about.icpRecord.title', 'ICP备案') })
  })

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
    <View className="min-h-screen bg-background pb-[48rpx]">
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
          <View key={item.label} className="flex justify-between items-center py-[28rpx]">
            <Text className="text-[28rpx] text-muted-foreground shrink-0">{item.label}</Text>
            <Text className="text-[28rpx] text-foreground text-right ml-[24rpx] max-w-[60%] break-all">{item.value}</Text>
          </View>
        ))}
      </View>

      <View className="pt-[24rpx] px-[32rpx]">
        <Button className="w-full bg-primary text-white rounded-[12rpx] text-[30rpx] leading-[80rpx]" onClick={onQuery}>
          {tt('about.icpRecord.query', '前往工信部查询')}
        </Button>
      </View>

      <View className="py-[24rpx] px-[32rpx]">
        <Text className="text-[22rpx] text-muted-foreground leading-[1.7]">{tt('about.icpRecord.footer', '以上信息来自工信部备案查询系统')}</Text>
      </View>
    </View>
  )
}
