import { View, Text } from '@tarojs/components'
import './index.css'

export default function SetNeed() {
  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">设置需求</Text>
      </View>
      <View className="page-content">
        <Text className="info-text">设置您的需求偏好</Text>
      </View>
    </View>
  )
}
