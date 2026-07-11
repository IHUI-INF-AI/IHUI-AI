import { View, Text } from '@tarojs/components'
import './index.css'

export default function ApiSettings() {
  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">API设置</Text>
      </View>
      <View className="page-content">
        <Text className="info-text">API接口设置</Text>
      </View>
    </View>
  )
}
