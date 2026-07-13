import { View, Text } from '@tarojs/components'
import './index.css'

const ICP_INFO = [
  { label: '备案号', value: '粤ICP备2026000001号-1' },
  { label: '备案主体', value: '广州智汇科技有限公司' },
  { label: '备案性质', value: '企业' },
  { label: '网站名称', value: '智汇AI' },
  { label: '审核时间', value: '2026-01-15' },
  { label: '管局', value: '广东省通信管理局' },
]

export default function IcpRecord() {
  return (
    <View className="page">
      <View className="card">
        {ICP_INFO.map((item, idx) => (
          <View key={item.label} className={`row${idx === ICP_INFO.length - 1 ? ' last' : ''}`}>
            <Text className="label">{item.label}</Text>
            <Text className="value">{item.value}</Text>
          </View>
        ))}
      </View>
      <View className="tips">
        <Text>
          依据《互联网信息服务管理办法》及《非经营性互联网信息服务备案管理办法》完成备案。
        </Text>
      </View>
    </View>
  )
}
