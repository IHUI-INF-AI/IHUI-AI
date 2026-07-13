import { View, Text } from '@tarojs/components'
import './index.css'

const MODEL_INFO = [
  { label: '模型名称', value: '智汇AI对话大模型' },
  { label: '备案编号', value: '粤网信备4401060000001号' },
  { label: '备案主体', value: '广州智汇科技有限公司' },
  { label: '算法类型', value: '生成合成类（深度合成）' },
  { label: '模型类型', value: '语言模型（LLM）' },
  { label: '适用范围', value: '文本对话、内容创作、智能问答' },
  { label: '备案时间', value: '2026-02-20' },
  { label: '有效期', value: '2026-02-20 至 2029-02-19' },
]

export default function ModelRecord() {
  return (
    <View className="page">
      <View className="card">
        {MODEL_INFO.map((item, idx) => (
          <View key={item.label} className={`row${idx === MODEL_INFO.length - 1 ? ' last' : ''}`}>
            <Text className="label">{item.label}</Text>
            <Text className="value">{item.value}</Text>
          </View>
        ))}
      </View>
      <View className="card notice-card">
        <Text className="notice-title">合规说明</Text>
        <Text className="notice-text">
          本模型已依据《互联网信息服务深度合成管理规定》《生成式人工智能服务管理暂行办法》完成备案，持续符合国家相关法律法规要求。
        </Text>
      </View>
      <View className="tips">
        <Text>如对模型备案信息有疑问，请联系客服。</Text>
      </View>
    </View>
  )
}
