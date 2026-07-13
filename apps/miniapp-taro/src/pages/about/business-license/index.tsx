import { View, Text } from '@tarojs/components'
import './index.css'

const LICENSE_INFO = [
  { label: '统一社会信用代码', value: '91440101MA9X0000X1' },
  { label: '企业名称', value: '广州智汇科技有限公司' },
  { label: '法定代表人', value: '张三' },
  { label: '注册资本', value: '1000万元人民币' },
  { label: '成立日期', value: '2023-06-15' },
  { label: '营业期限', value: '2023-06-15 至 长期' },
  { label: '企业类型', value: '有限责任公司' },
  { label: '登记机关', value: '广州市市场监督管理局' },
]

const SCOPE =
  '技术服务、技术开发、技术咨询、技术交流、技术转让、技术推广；软件开发；信息系统集成服务；信息技术咨询服务；互联网信息服务。'

export default function BusinessLicense() {
  return (
    <View className="page">
      <View className="card">
        {LICENSE_INFO.map((item, idx) => (
          <View key={item.label} className={`row${idx === LICENSE_INFO.length - 1 ? ' last' : ''}`}>
            <Text className="label">{item.label}</Text>
            <Text className="value">{item.value}</Text>
          </View>
        ))}
      </View>
      <View className="card scope-card">
        <Text className="scope-title">经营范围</Text>
        <Text className="scope-text">{SCOPE}</Text>
      </View>
      <View className="tips">
        <Text>以上信息依据《公司法》及《公司登记管理条例》依法登记。</Text>
      </View>
    </View>
  )
}
