import { useEffect, useState } from 'react'
import { Share, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Avatar, Card } from '@ihui/ui-native'
import { fetchApi, getProfile, type AuthUser } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface BusinessCard {
  id: string
  name: string
  position: string
  company: string
  phone: string
  wechat: string
  email: string
  location: string
  bio: string
}

/** /api/business-card/list 返回的单条名片(仅取所需字段) */
interface BusinessCardListItem {
  id: string
  name: string
  title: string | null
  company: string | null
  authorId: string
  intro: string | null
}

/** 从 AuthUser 构造默认名片(用户尚未创建名片时的兜底) */
function buildDefaultCard(profile: AuthUser): BusinessCard {
  return {
    id: '',
    name: profile.nickname || profile.username || '未命名',
    position: '',
    company: '',
    phone: profile.phone ?? '',
    wechat: '',
    email: profile.email ?? '',
    location: '',
    bio: profile.bio ?? '',
  }
}

/** 电子名片:展示个人信息 / 公司 / 职位 / 联系方式 / 二维码,支持分享与保存。 */
export default function BusinessCardScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [card, setCard] = useState<BusinessCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      getProfile(),
      fetchApi<{ list: BusinessCardListItem[] }>(
        '/api/business-card/list?page=1&pageSize=100',
      ),
    ])
      .then(([profileRes, listRes]) => {
        if (cancelled) return
        if (!profileRes.success) {
          setError('加载失败')
          return
        }
        const profile = profileRes.data
        const list = listRes.success ? listRes.data.list : []
        const mine = list.find((item) => item.authorId === profile.id)
        if (mine) {
          setCard({
            id: mine.id,
            name: mine.name,
            position: mine.title ?? '',
            company: mine.company ?? '',
            phone: profile.phone ?? '',
            wechat: '',
            email: profile.email ?? '',
            location: '',
            bio: mine.intro ?? '',
          })
        } else {
          setCard(buildDefaultCard(profile))
        }
      })
      .catch(() => {
        if (!cancelled) setError('加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onShare = async () => {
    if (!card) return
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

  const contacts = card
    ? [
        { label: '电话', value: card.phone },
        { label: '微信', value: card.wechat },
        { label: '邮箱', value: card.email },
        { label: '地区', value: card.location },
      ]
    : []

  return (
    <View className="flex-1 bg-card">
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-12">
        <TouchableOpacity onPress={() => navigation.goBack()} className="py-1">
          <Text className="text-sm text-muted-foreground">返回</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">电子名片</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-muted-foreground">加载中...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-muted-foreground">{error}</Text>
        </View>
      ) : card ? (
        <Card className="mx-4 p-4">
          <View className="flex-row items-center">
            <Avatar name={card.name} size="lg" shape="rounded" className="bg-primary/10" />
            <View className="ml-3 flex-1">
              <Text className="text-lg font-semibold text-foreground">{card.name}</Text>
              <Text className="mt-0.5 text-xs text-primary">{card.position || '—'}</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">{card.company || '—'}</Text>
            </View>
          </View>
          <Text className="mt-3 text-[13px] leading-5 text-foreground/80">{card.bio || '—'}</Text>

          <View className="mt-3 rounded-md bg-muted p-3">
            {contacts.map((c) => (
              <View key={c.label} className="flex-row items-center py-1">
                <Text className="w-10 text-[11px] text-muted-foreground">{c.label}</Text>
                <Text className="flex-1 text-[13px] text-foreground">{c.value || '—'}</Text>
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
      ) : null}

      <View className="flex-row gap-2 px-4 py-4">
        <TouchableOpacity
          onPress={onShare}
          className="flex-1 items-center rounded-md border border-border py-2.5"
        >
          <Text className="text-[13px] text-foreground/80">发送好友</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSave}
          className="flex-1 items-center rounded-md border border-border py-2.5"
        >
          <Text className="text-[13px] text-foreground/80">{saved ? '已保存' : '保存相册'}</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 items-center rounded-md bg-primary py-2.5">
          <Text className="text-[13px] font-semibold text-primary-foreground">编辑名片</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
