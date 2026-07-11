import { View, Text } from '@tarojs/components'
import './index.css'

export default function AppPermission() {
  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">应用权限</Text>
      </View>
      <View className="page-content">
        <Text className="info-text">应用权限说明</Text>
      </View>
    </View>
  )
}
