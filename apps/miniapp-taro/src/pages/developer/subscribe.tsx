import { logger } from '@/utils/logger'
import { View, Text, Image, Button, Switch } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'

interface DevInfo {
  id: string
  name: string
  avatar: string
  bio: string
  subscribed: boolean
  contact: string
}
interface DevStats {
  subscribers: number
  modelCount: number
  totalUses: number
}
interface DevModel {
  id: string
  name: string
  description: string
  icon: string
  uses: number
}
interface DevPost {
  id: string
  title: string
  content: string
  createTime: string
}

const toStr = (v: unknown, fb = '') => (v == null ? fb : String(v))
const toNum = (v: unknown) => Number(v) || 0

export default function DeveloperSubscribePage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const router = useRouter()
  const devId = toStr(router.params.id || router.params.developerId, '')

  const [dev, setDev] = useState<DevInfo>({
    id: devId,
    name: tt('developer.subscribe.devName', '开发者'),
    avatar: '',
    bio: '',
    subscribed: false,
    contact: '',
  })
  const [stats, setStats] = useState<DevStats>({ subscribers: 0, modelCount: 0, totalUses: 0 })
  const [models, setModels] = useState<DevModel[]>([])
  const [posts, setPosts] = useState<DevPost[]>([])
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [notifyNew, setNotifyNew] = useState(true)
  const [notifyUpdate, setNotifyUpdate] = useState(false)

  const load = useCallback(async () => {
    if (!devId) {
      setLoading(false)
      return
    }
    const tf = (k: string, fb: string) => (t(k) === k ? fb : t(k))
    try {
      const [profileRes, modelsRes, postsRes] = await Promise.all([
        get<Record<string, unknown>>(`/developer/${devId}/profile`).catch(() => null),
        get<{ list?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
          '/developer/agents',
        ).catch(() => null),
        get<{ list?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
          `/developer/${devId}/posts`,
        ).catch(() => null),
      ])
      if (profileRes) {
        setDev({
          id: devId,
          name: toStr(profileRes.name ?? profileRes.nickname, tf('developer.subscribe.devName', '开发者')),
          avatar: toStr(profileRes.avatar),
          bio: toStr(profileRes.bio ?? profileRes.description),
          subscribed: Boolean(profileRes.subscribed ?? profileRes.isSubscribed),
          contact: toStr(profileRes.contact ?? profileRes.wechat ?? profileRes.phone),
        })
        setStats({
          subscribers: toNum(profileRes.subscribers ?? profileRes.subscriberCount),
          modelCount: toNum(profileRes.modelCount ?? profileRes.models),
          totalUses: toNum(profileRes.totalUses ?? profileRes.usageCount),
        })
      }
      const modelRows = Array.isArray(modelsRes) ? modelsRes : modelsRes?.list || []
      setModels(
        modelRows.map((u) => ({
          id: toStr(u.id ?? u.agentId),
          name: toStr(u.name ?? u.agentName, tf('developer.subscribe.modelDefault', '模型')),
          description: toStr(u.description ?? u.desc),
          icon: toStr(u.icon ?? u.avatar),
          uses: toNum(u.uses ?? u.usageCount),
        })),
      )
      const postRows = Array.isArray(postsRes) ? postsRes : postsRes?.list || []
      setPosts(
        postRows.map((u) => ({
          id: toStr(u.id),
          title: toStr(u.title, tf('developer.subscribe.postDefault', '动态')),
          content: toStr(u.content),
          createTime: toStr(u.createTime ?? u.createdAt),
        })),
      )
    } catch (e) {
      logger.error('developer/subscribe', '加载数据', e)
    } finally {
      setLoading(false)
    }
  }, [devId, t])

  useDidShow(load)

  const toggleSubscribe = useCallback(async () => {
    if (subscribing) return
    setSubscribing(true)
    try {
      if (dev.subscribed) {
        await post(`/developer/${devId}/unsubscribe`, {})
        setDev((d) => ({ ...d, subscribed: false }))
        Taro.showToast({ title: tt('developer.subscribe.unfollowed', '已取消关注'), icon: 'none' })
      } else {
        await post(`/developer/${devId}/subscribe`, {})
        setDev((d) => ({ ...d, subscribed: true }))
        Taro.showToast({ title: tt('developer.subscribe.subscribed', '已关注'), icon: 'none' })
      }
    } catch (e) {
      logger.error('developer/subscribe', '关注操作', e)
      Taro.showToast({ title: tt('common.failed', '操作失败'), icon: 'none' })
    } finally {
      setSubscribing(false)
    }
  }, [subscribing, dev.subscribed, devId, t])

  const useModel = (m: DevModel) => {
    Taro.navigateTo({ url: `/pages/ai/agent-detail?id=${m.id}` })
  }

  const contactDev = () => {
    if (!dev.contact) {
      Taro.showToast({ title: tt('developer.subscribe.noContact', '暂无联系方式'), icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: dev.contact,
      success: () => Taro.showToast({ title: tt('developer.subscribe.copied', '已复制联系方式') }),
    })
  }

  return (
    <View className="min-h-screen bg-background pb-[60rpx]">
      <View className="flex items-start gap-[24rpx] px-[28rpx] py-[32rpx] m-[24rpx] bg-[linear-gradient(135deg,rgba(0,242,255,0.12),rgba(0,242,255,0.03))] border-[2rpx] border-[rgba(0,242,255,0.15)] rounded-[12rpx]">
        <View className="flex-shrink-0">
          {dev.avatar ? (
            <Image className="w-[112rpx] h-[112rpx] rounded-[12rpx] bg-muted" src={dev.avatar} mode="aspectFill" />
          ) : (
            <View className="w-[112rpx] h-[112rpx] rounded-[12rpx] bg-muted flex items-center justify-center">
              <Text className="text-[40rpx] font-bold text-primary">{dev.name.charAt(0) || '?'}</Text>
            </View>
          )}
        </View>
        <View className="flex-1 min-w-0 flex flex-col gap-[8rpx]">
          <Text className="text-[34rpx] font-bold text-foreground">{dev.name}</Text>
          <Text className="text-[24rpx] text-muted-foreground leading-[1.5]">
            {dev.bio || tt('developer.subscribe.bioDefault', '暂无简介')}
          </Text>
          <Button
            className={`self-start mt-[8rpx] px-[28rpx] h-[60rpx] leading-[60rpx] text-[26rpx] text-foreground bg-primary rounded-[8rpx] border-none disabled:opacity-60${dev.subscribed ? ' bg-card text-muted-foreground border-[2rpx] border-[rgba(0,242,255,0.2)]' : ''}`}
            disabled={subscribing}
            onClick={toggleSubscribe}
          >
            {dev.subscribed
              ? tt('developer.subscribe.subscribedBtn', '已关注')
              : tt('developer.subscribe.subscribeBtn', '+ 关注')}
          </Button>
        </View>
      </View>

      <View className="flex mx-[24rpx] py-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx]">
        <View className="flex-1 flex flex-col items-center gap-[8rpx]">
          <Text className="text-[36rpx] font-bold text-primary">{stats.subscribers}</Text>
          <Text className="text-[22rpx] text-muted-foreground">
            {tt('developer.subscribe.statSubscribers', '订阅人数')}
          </Text>
        </View>
        <View className="flex-1 flex flex-col items-center gap-[8rpx]">
          <Text className="text-[36rpx] font-bold text-primary">{stats.modelCount}</Text>
          <Text className="text-[22rpx] text-muted-foreground">{tt('developer.subscribe.statModels', '模型数')}</Text>
        </View>
        <View className="flex-1 flex flex-col items-center gap-[8rpx]">
          <Text className="text-[36rpx] font-bold text-primary">{stats.totalUses}</Text>
          <Text className="text-[22rpx] text-muted-foreground">
            {tt('developer.subscribe.statUses', '总使用次数')}
          </Text>
        </View>
      </View>

      <View className="m-[24rpx]">
        <Text className="block text-[30rpx] font-semibold text-foreground mb-[16rpx]">
          {tt('developer.subscribe.modelsTitle', '开发者模型')}
        </Text>
        {models.length > 0 ? (
          <View className="flex flex-col gap-[16rpx]">
            {models.map((m) => (
              <View key={m.id} className="flex items-center gap-[20rpx] p-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx]">
                <View className="flex-shrink-0">
                  {m.icon ? (
                    <Image className="w-[88rpx] h-[88rpx] rounded-[10rpx] bg-muted" src={m.icon} mode="aspectFill" />
                  ) : (
                    <View className="w-[88rpx] h-[88rpx] rounded-[10rpx] bg-muted flex items-center justify-center text-[32rpx] font-semibold text-primary">
                      <Text>{m.name.charAt(0) || '?'}</Text>
                    </View>
                  )}
                </View>
                <View className="flex-1 min-w-0 flex flex-col gap-[8rpx]">
                  <View className="flex items-baseline justify-between gap-[12rpx]">
                    <Text className="text-[28rpx] font-semibold text-foreground">{m.name}</Text>
                    <Text className="text-[22rpx] text-muted-foreground flex-shrink-0">
                      {tt('developer.subscribe.uses', '使用')} {m.uses}
                    </Text>
                  </View>
                  <Text className="text-[24rpx] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                    {m.description || tt('developer.subscribe.noDesc', '暂无描述')}
                  </Text>
                </View>
                <Text className="flex-shrink-0 px-[24rpx] py-[10rpx] text-[24rpx] text-primary bg-[rgba(0,242,255,0.1)] border-[2rpx] border-[rgba(0,242,255,0.3)] rounded-[8rpx]" onClick={() => useModel(m)}>
                  {tt('developer.subscribe.use', '使用')}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="block text-center text-[26rpx] text-muted-foreground py-[60rpx]">{tt('developer.subscribe.noModels', '暂无模型')}</Text>
        )}
      </View>

      <View className="m-[24rpx]">
        <Text className="block text-[30rpx] font-semibold text-foreground mb-[16rpx]">
          {tt('developer.subscribe.notifyTitle', '通知设置')}
        </Text>
        <View className="flex items-center justify-between p-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[10rpx] mb-[16rpx]">
          <Text className="text-[28rpx] text-foreground">
            {tt('developer.subscribe.notifyNew', '新模型发布提醒')}
          </Text>
          <Switch
            checked={notifyNew}
            onChange={(e) => setNotifyNew(e.detail.value)}
            color="#00f2ff"
          />
        </View>
        <View className="flex items-center justify-between p-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[10rpx] mb-[16rpx]">
          <Text className="text-[28rpx] text-foreground">
            {tt('developer.subscribe.notifyUpdate', '模型更新提醒')}
          </Text>
          <Switch
            checked={notifyUpdate}
            onChange={(e) => setNotifyUpdate(e.detail.value)}
            color="#00f2ff"
          />
        </View>
      </View>

      <View className="m-[24rpx]">
        <Text className="block text-[30rpx] font-semibold text-foreground mb-[16rpx]">
          {tt('developer.subscribe.postsTitle', '开发者动态')}
        </Text>
        {posts.length > 0 ? (
          <View className="flex flex-col gap-[16rpx]">
            {posts.map((p) => (
              <View key={p.id} className="p-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[10rpx]">
                <Text className="block text-[28rpx] font-semibold text-foreground">{p.title}</Text>
                <Text className="block mt-[8rpx] text-[24rpx] text-muted-foreground leading-[1.5]">{p.content}</Text>
                <Text className="block mt-[12rpx] text-[22rpx] text-muted-foreground">{p.createTime}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="block text-center text-[26rpx] text-muted-foreground py-[60rpx]">{tt('developer.subscribe.noPosts', '暂无动态')}</Text>
        )}
      </View>

      <Button className="m-[24rpx] h-[84rpx] leading-[84rpx] text-[30rpx] text-foreground bg-primary rounded-[10rpx] border-none" onClick={contactDev}>
        {tt('developer.subscribe.contact', '联系开发者')}
      </Button>

      {loading && <Text className="block text-center text-[26rpx] text-muted-foreground py-[40rpx]">{tt('common.loading', '加载中…')}</Text>}
    </View>
  )
}
