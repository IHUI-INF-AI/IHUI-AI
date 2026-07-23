import { logger } from '@/utils/logger'
import { View, Text, Image, Button, Switch } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'
import './subscribe.css'

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
    <View className="page">
      <View className="dev-header">
        <View className="dev-avatar-wrap">
          {dev.avatar ? (
            <Image className="dev-avatar" src={dev.avatar} mode="aspectFill" />
          ) : (
            <View className="dev-avatar dev-avatar-fallback">
              <Text className="dev-avatar-text">{dev.name.charAt(0) || '?'}</Text>
            </View>
          )}
        </View>
        <View className="dev-info">
          <Text className="dev-name">{dev.name}</Text>
          <Text className="dev-bio">
            {dev.bio || tt('developer.subscribe.bioDefault', '暂无简介')}
          </Text>
          <Button
            className={`dev-sub-btn${dev.subscribed ? ' dev-sub-btn-active' : ''}`}
            disabled={subscribing}
            onClick={toggleSubscribe}
          >
            {dev.subscribed
              ? tt('developer.subscribe.subscribedBtn', '已关注')
              : tt('developer.subscribe.subscribeBtn', '+ 关注')}
          </Button>
        </View>
      </View>

      <View className="dev-stats">
        <View className="dev-stat">
          <Text className="dev-stat-num">{stats.subscribers}</Text>
          <Text className="dev-stat-label">
            {tt('developer.subscribe.statSubscribers', '订阅人数')}
          </Text>
        </View>
        <View className="dev-stat">
          <Text className="dev-stat-num">{stats.modelCount}</Text>
          <Text className="dev-stat-label">{tt('developer.subscribe.statModels', '模型数')}</Text>
        </View>
        <View className="dev-stat">
          <Text className="dev-stat-num">{stats.totalUses}</Text>
          <Text className="dev-stat-label">
            {tt('developer.subscribe.statUses', '总使用次数')}
          </Text>
        </View>
      </View>

      <View className="dev-section">
        <Text className="dev-section-title">
          {tt('developer.subscribe.modelsTitle', '开发者模型')}
        </Text>
        {models.length > 0 ? (
          <View className="dev-model-list">
            {models.map((m) => (
              <View key={m.id} className="dev-model-card">
                <View className="dev-model-left">
                  {m.icon ? (
                    <Image className="dev-model-icon" src={m.icon} mode="aspectFill" />
                  ) : (
                    <View className="dev-model-icon dev-model-icon-fallback">
                      <Text>{m.name.charAt(0) || '?'}</Text>
                    </View>
                  )}
                </View>
                <View className="dev-model-info">
                  <View className="dev-model-head">
                    <Text className="dev-model-name">{m.name}</Text>
                    <Text className="dev-model-uses">
                      {tt('developer.subscribe.uses', '使用')} {m.uses}
                    </Text>
                  </View>
                  <Text className="dev-model-desc">
                    {m.description || tt('developer.subscribe.noDesc', '暂无描述')}
                  </Text>
                </View>
                <Text className="dev-model-btn" onClick={() => useModel(m)}>
                  {tt('developer.subscribe.use', '使用')}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="dev-empty">{tt('developer.subscribe.noModels', '暂无模型')}</Text>
        )}
      </View>

      <View className="dev-section">
        <Text className="dev-section-title">
          {tt('developer.subscribe.notifyTitle', '通知设置')}
        </Text>
        <View className="dev-notify-row">
          <Text className="dev-notify-label">
            {tt('developer.subscribe.notifyNew', '新模型发布提醒')}
          </Text>
          <Switch
            checked={notifyNew}
            onChange={(e) => setNotifyNew(e.detail.value)}
            color="#00f2ff"
          />
        </View>
        <View className="dev-notify-row">
          <Text className="dev-notify-label">
            {tt('developer.subscribe.notifyUpdate', '模型更新提醒')}
          </Text>
          <Switch
            checked={notifyUpdate}
            onChange={(e) => setNotifyUpdate(e.detail.value)}
            color="#00f2ff"
          />
        </View>
      </View>

      <View className="dev-section">
        <Text className="dev-section-title">
          {tt('developer.subscribe.postsTitle', '开发者动态')}
        </Text>
        {posts.length > 0 ? (
          <View className="dev-post-list">
            {posts.map((p) => (
              <View key={p.id} className="dev-post-card">
                <Text className="dev-post-title">{p.title}</Text>
                <Text className="dev-post-content">{p.content}</Text>
                <Text className="dev-post-time">{p.createTime}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="dev-empty">{tt('developer.subscribe.noPosts', '暂无动态')}</Text>
        )}
      </View>

      <Button className="dev-contact-btn" onClick={contactDev}>
        {tt('developer.subscribe.contact', '联系开发者')}
      </Button>

      {loading && <Text className="dev-loading">{tt('common.loading', '加载中…')}</Text>}
    </View>
  )
}
