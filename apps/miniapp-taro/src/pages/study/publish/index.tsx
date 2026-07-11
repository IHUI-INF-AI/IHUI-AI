import { View, Text } from '@tarojs/components'
import './index.css'

export default function StudyPublish() {
  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">发布学习内容</Text>
      </View>
      <View className="page-content">
        <Text className="info-text">发布您的学习内容</Text>
      </View>
    </View>
  )
}
