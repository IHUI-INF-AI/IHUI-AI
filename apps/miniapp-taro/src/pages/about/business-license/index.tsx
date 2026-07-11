import { View, Text } from '@tarojs/components'
import './index.css'

export default function BusinessLicense() {
  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">营业执照</Text>
      </View>
      <View className="page-content">
        <Text className="info-text">营业执照信息展示</Text>
      </View>
    </View>
  )
}
