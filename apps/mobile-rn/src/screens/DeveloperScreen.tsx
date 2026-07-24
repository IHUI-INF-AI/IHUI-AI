import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'

interface PayPlan {
  type: 'month' | 'year'
  label: string
  price: number
  unit: string
  perks: string[]
}

const PLANS: PayPlan[] = [
  {
    type: 'month',
    label: '开发者包月',
    price: 100,
    unit: '月',
    perks: ['智能体上架 10 个', '收益结算 T+1', '基础数据分析'],
  },
  {
    type: 'year',
    label: '开发者包年',
    price: 1000,
    unit: '年',
    perks: ['智能体上架 100 个', '收益结算 T+0', '高级数据分析', '专属客服'],
  },
]

const FEATURES = [
  { title: '上架智能体', desc: '创建并发布你的 AI 助手' },
  { title: '收益分成', desc: '限时 0 服务费,全额到账' },
  { title: '数据分析', desc: '实时查看调用与收益' },
  { title: 'n8n 工作流', desc: '接入 n8n 自动化能力' },
]

export default function DeveloperScreen() {
  const [selected, setSelected] = useState<PayPlan['type']>('year')
  const [submitting, setSubmitting] = useState(false)

  const handleOpen = () => {
    setSubmitting(true)
    setTimeout(() => setSubmitting(false), 800)
  }

  return (
    <View className="flex-1 bg-card">
      <View className="px-4 py-3">
        <Text className="text-lg font-semibold text-foreground">开发者入口</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="bg-[#F5F3FF] rounded-xl p-4 mb-5">
          <Text className="text-[20px] font-bold text-[#7B61FF]">成为开发者</Text>
          <Text className="mt-1 text-[13px] text-muted-foreground">发布智能体,获取收益</Text>
          <View className="mt-3.5 flex-row flex-wrap gap-2.5">
            {FEATURES.map((f) => (
              <View key={f.title} className="w-[47%] bg-card rounded-lg p-2.5">
                <Text className="text-[13px] font-semibold text-foreground">{f.title}</Text>
                <Text className="mt-0.5 text-[11px] text-[#9CA3AF]" numberOfLines={2}>
                  {f.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text className="text-sm font-semibold text-[#374151] mb-3">请选择所需要的服务</Text>
        <View className="flex-row gap-3">
          {PLANS.map((p) => {
            const active = selected === p.type
            return (
              <TouchableOpacity
                key={p.type}
                className={`flex-1 border rounded-xl p-3.5 bg-card ${active ? 'border-[#7B61FF] bg-[#FAF9FF]' : 'border-border'}`}
                onPress={() => setSelected(p.type)}
                activeOpacity={0.8}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-[#7B61FF]' : 'text-[#374151]'}`}>{p.label}</Text>
                <Text className={`mt-2 ${active ? 'text-[#7B61FF]' : 'text-foreground'}`}>
                  <Text className="text-[24px] font-bold">{p.price}</Text>
                  <Text className="text-xs text-[#9CA3AF]"> / {p.unit}</Text>
                </Text>
                <View className="mt-2.5 gap-1">
                  {p.perks.map((perk) => (
                    <Text
                      key={perk}
                      className={`text-[11px] ${active ? 'text-[#7B61FF]' : 'text-muted-foreground'}`}
                      numberOfLines={1}
                    >
                      · {perk}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          className={`mt-6 h-[46px] rounded-xl bg-[#7B61FF] items-center justify-center ${submitting ? 'opacity-60' : ''}`}
          onPress={handleOpen}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text className="text-[15px] font-semibold text-white">{submitting ? '处理中...' : '一键开通'}</Text>
        </TouchableOpacity>
        <Text className="mt-3 text-center text-[11px] text-[#9CA3AF]">开通即表示同意《开发者服务协议》</Text>
      </ScrollView>
    </View>
  )
}
