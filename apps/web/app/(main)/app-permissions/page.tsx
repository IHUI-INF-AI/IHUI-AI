'use client'

import { useTranslations } from 'next-intl'
import { Camera, FileText, Globe, Lock, Mic, Phone, Bell, Folder } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui-react'
import { BackButton } from '@/components/common'

const PERMISSIONS: { icon: LucideIcon; name: string; desc: string }[] = [
  {
    icon: Camera,
    name: '相机',
    desc: '用于拍摄照片、录制视频、扫描二维码、AI 图像识别与上传头像等场景。您可随时在系统设置中关闭该权限，关闭后相关功能将无法使用。',
  },
  {
    icon: FileText,
    name: '相册(照片/视频)',
    desc: '用于从相册选择图片或视频进行上传、发布内容、更换头像、AI 创作素材等。您可随时在系统设置中关闭该权限。',
  },
  {
    icon: Globe,
    name: '位置信息',
    desc: '用于提供基于地理位置的附近内容推荐、活动定位、打卡等功能。您可选择仅在使用期间允许或始终拒绝，关闭后不影响其他功能。',
  },
  {
    icon: Bell,
    name: '通知(推送)',
    desc: '用于接收订单状态、系统消息、课程更新、互动提醒等推送通知。您可在系统设置中按类别开启或关闭，关闭后将无法及时收到相关提醒。',
  },
  {
    icon: Mic,
    name: '麦克风',
    desc: '用于语音输入、AI 语音对话、录音、直播连麦等场景。您可随时在系统设置中关闭该权限，关闭后语音相关功能将无法使用。',
  },
  {
    icon: Folder,
    name: '存储(文件读取)',
    desc: '用于读取或保存文件、缓存图片与视频、离线课程资料等。您可随时在系统设置中关闭该权限，关闭后部分离线功能将受限。',
  },
  {
    icon: Phone,
    name: '通讯录',
    desc: '用于查找通讯录中的好友、邀请好友、便捷登录等场景(仅在您主动操作时触发)。您可随时在系统设置中关闭该权限。',
  },
]

export default function AppPermissionPage() {
  const t = useTranslations('appPermission')
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <BackButton fallbackHref="/settings" />
        <h1 className="text-lg font-medium">{t('title')}</h1>
        <div className="w-10" />
      </div>
      <p className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        {t('subtitle')}
      </p>

      <div className="space-y-3">
        {PERMISSIONS.map((p) => (
          <Card key={p.name}>
            <CardContent className="flex gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <p.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
