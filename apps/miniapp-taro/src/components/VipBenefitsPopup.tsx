import { View, Text, ScrollView } from '@tarojs/components'
import { useI18n } from '@/i18n'

export interface VipBenefit {
  id: string
  title: string
  desc?: string
  icon?: string
}

export interface VipBenefitsPopupProps {
  visible?: boolean
  benefits?: VipBenefit[]
  onUpgrade?: () => void
  onClose?: () => void
}

const DEFAULT_BENEFITS: VipBenefit[] = [
  { id: '1', title: '无限 AI 对话', desc: '畅享 GPT-4 等顶级模型' },
  { id: '2', title: '高清视频生成', desc: '4K 质量无水印' },
  { id: '3', title: '专属客服', desc: '7×24 小时服务' },
  { id: '4', title: '会员专属内容', desc: '解锁全部付费课程' },
]

export default function VipBenefitsPopup({
  visible = false,
  benefits = DEFAULT_BENEFITS,
  onUpgrade,
  onClose,
}: VipBenefitsPopupProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  if (!visible) return null

  return (
    <View className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <View className="absolute inset-0 bg-black/50" />
      <View className="relative bg-card rounded-t-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <View className="flex items-center justify-between px-4 py-3">
          <Text className="text-base font-medium text-[#f59e0b]">{tt('vip.benefitsTitle', '会员权益')}</Text>
          <Text className="text-sm text-muted-foreground" onClick={onClose}>
            关闭
          </Text>
        </View>
        <ScrollView scrollY className="px-4 py-2" style={{ maxHeight: '50vh' }}>
          {benefits.map((b) => (
            <View key={b.id} className="flex items-start py-3 mb-2">
              <View className="flex items-center justify-center w-8 h-8 mr-3 rounded-lg bg-yellow-50">
                <Text className="text-base">★</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-sm font-medium text-foreground">{b.title}</Text>
                {b.desc && <Text className="block text-xs text-muted-foreground mt-0.5">{b.desc}</Text>}
              </View>
            </View>
          ))}
        </ScrollView>
        <View className="px-4 py-3">
          <View
            className="w-full py-3 rounded-md text-center"
            style={{ background: 'linear-gradient(90deg, #fbbf24, #f59e0b)' }}
            onClick={onUpgrade}
          >
            <Text className="text-sm text-white font-medium">{tt('vip.upgradeNow', '立即升级')}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
