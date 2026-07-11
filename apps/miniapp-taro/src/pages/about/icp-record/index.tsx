import { View, Text } from '@tarojs/components'
import './index.css'

export default function IcpRecord() {
  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">ICP备案</Text>
      </View>
      <View className="page-content">
        <Text className="info-text">ICP备案信息展示</Text>
      </View>
    </View>
  )
}
