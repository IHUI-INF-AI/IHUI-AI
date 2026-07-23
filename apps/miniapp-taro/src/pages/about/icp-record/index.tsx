import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback } from 'react'
import { useI18n } from '@/i18n'
import './index.css'

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
    <View className="page">
      <View className="icp-card">
        <Text className="icp-label">
          {tt('about.icpRecord.icpLabel', 'ICP备案/许可证号')}
        </Text>
        <Text className="icp-value" onClick={copyIcpNo}>
          {ICP_NO}
        </Text>
        <Text className="icp-copy-hint">
          {tt('about.icpRecord.copyHint', '点击编号可复制')}
        </Text>
      </View>

      <View className="card">
        {info.map((item, idx) => (
          <View key={item.label} className={`row${idx === info.length - 1 ? ' last' : ''}`}>
            <Text className="label">{item.label}</Text>
            <Text className="value">{item.value}</Text>
          </View>
        ))}
      </View>

      <View className="query-wrap">
        <Button className="query-btn" onClick={onQuery}>
          {tt('about.icpRecord.query', '前往工信部查询')}
        </Button>
      </View>

      <View className="tips">
        <Text>{tt('about.icpRecord.footer', '以上信息来自工信部备案查询系统')}</Text>
      </View>
    </View>
  )
}
