import { View, Text } from '@tarojs/components'
import './index.css'

interface PermissionItem {
  name: string
  desc: string
  required: boolean
}

const PERMISSIONS: PermissionItem[] = [
  { name: '相机', desc: '用于拍照、视频通话、AI 图像生成等场景', required: true },
  { name: '相册', desc: '用于上传图片、保存 AI 生成结果到本地', required: false },
  { name: '麦克风', desc: '用于语音输入、语音对话、录音功能', required: true },
  { name: '位置信息', desc: '用于推荐附近的学习资源和活动', required: false },
  { name: '消息通知', desc: '用于接收课程更新、订单状态等推送通知', required: false },
  { name: '设备信息', desc: '用于保障账号安全、优化服务体验', required: true },
  { name: '存储权限', desc: '用于缓存课程数据、保存文件到本地', required: false },
  { name: '网络访问', desc: '用于连接服务器、获取 AI 服务和数据', required: true },
]

export default function AppPermission() {
  return (
    <View className="page">
      <View className="intro">
        <Text className="intro-text">
          为保障应用功能正常运行，我们需要在必要时申请以下权限。您可在系统设置中随时管理权限授权。
        </Text>
      </View>

      <View className="card">
        {PERMISSIONS.map((p, idx) => (
          <View key={p.name} className={`row${idx === PERMISSIONS.length - 1 ? ' last' : ''}`}>
            <View className="body">
              <View className="head">
                <Text className="name">{p.name}</Text>
                {p.required ? (
                  <Text className="tag">必要</Text>
                ) : (
                  <Text className="tag opt">可选</Text>
                )}
              </View>
              <Text className="desc">{p.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="tips">
        <Text>必要权限拒绝后可能影响部分功能使用，可选权限拒绝不影响核心功能。</Text>
      </View>
    </View>
  )
}
