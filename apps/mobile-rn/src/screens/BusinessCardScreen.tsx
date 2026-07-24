import { useState } from 'react'
import { Share, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Avatar, Card } from '@ihui/ui-native'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface BusinessCard {
  name: string
  position: string
  company: string
  phone: string
  wechat: string
  email: string
  location: string
  bio: string
}

const MOCK_CARD: BusinessCard = {
  name: '李智汇',
  position: '创始人 · CEO',
  company: 'AI智汇社',
  phone: '138-0000-0000',
  wechat: 'ai-zhs-li',
  email: 'li@ai-zhs.com',
  location: '上海 · 浦东新区',
  bio: '专注 AI 智能体研发与社区运营,致力于打造开放共享的 AI 创新生态。',
}

/** 电子名片:展示个人信息 / 公司 / 职位 / 联系方式 / 二维码,支持分享与保存。 */
export default function BusinessCardScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [card] = useState<BusinessCard>(MOCK_CARD)
  const [saved, setSaved] = useState(false)

  const onShare = async () => {
    try {
      await Share.share({
        message: `${card.name} · ${card.position}\n${card.company}\n电话:${card.phone}  微信:${card.wechat}`,
      })
    } catch {
      // ignore share errors
    }
  }

  const onSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const contacts = [
    { label: '电话', value: card.phone },
    { label: '微信', value: card.wechat },
    { label: '邮箱', value: card.email },
    { label: '地区', value: card.location },
  ]

  return (
    <View className="flex-1 bg-card">
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-12">
        <TouchableOpacity onPress={() => navigation.goBack()} className="py-1">
          <Text className="text-sm text-muted-foreground">返回</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">电子名片</Text>
      </View>

      <Card className="mx-4 p-4">
        <View className="flex-row items-center">
          <Avatar name={card.name} size="lg" shape="rounded" className="bg-primary/10" />
          <View className="ml-3 flex-1">
            <Text className="text-lg font-semibold text-foreground">{card.name}</Text>
            <Text className="mt-0.5 text-xs text-primary">{card.position}</Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">{card.company}</Text>
          </View>
        </View>
        <Text className="mt-3 text-[13px] leading-5 text-foreground/80">{card.bio}</Text>

        <View className="mt-3 rounded-md bg-muted p-3">
          {contacts.map((c) => (
            <View key={c.label} className="flex-row items-center py-1">
              <Text className="w-10 text-[11px] text-muted-foreground">{c.label}</Text>
              <Text className="flex-1 text-[13px] text-foreground">{c.value}</Text>
            </View>
          ))}
        </View>

        <View className="mt-4 items-center">
          <View className="h-[140px] w-[140px] items-center justify-center rounded-md bg-muted">
            <Text className="text-2xl font-bold tracking-widest text-muted-foreground">QR</Text>
          </View>
          <Text className="mt-2 text-[11px] text-muted-foreground">扫码添加名片</Text>
        </View>
      </Card>

      <View className="flex-row gap-2 px-4 py-4">
        <TouchableOpacity className="flex-1 items-center rounded-md border border-border py-2.5">
          <Text className="text-[13px] text-foreground/80">发送好友</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 items-center rounded-md border border-border py-2.5">
          <Text className="text-[13px] text-foreground/80">{saved ? '已保存' : '保存相册'}</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 items-center rounded-md bg-primary py-2.5">
          <Text className="text-[13px] font-semibold text-primary-foreground">编辑名片</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
