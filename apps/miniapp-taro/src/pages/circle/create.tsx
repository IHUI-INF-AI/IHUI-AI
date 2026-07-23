import { logger } from '@/utils/logger'
import { View, Text, Textarea, Image, Button, ScrollView, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { get, post, getTopicList } from '@/api'
import { TOPIC_EVENT } from '@/constants/events'
import { useI18n } from '@/i18n'
import './create.css'

const MAX_CONTENT = 500
const MAX_IMAGES = 9
const DRAFT_KEY = 'circle_create_draft'

type Visibility = 'public' | 'friends' | 'private'

interface AigcWork {
  id: string
  title: string
  coverUrl?: string
}

interface HotTopic {
  id: string
  name: string
}

interface FormState {
  content: string
  images: string[]
  topicId: string
  topicName: string
  aigcWorkId: string
  aigcWorkTitle: string
  visibility: Visibility
  allowComments: boolean
}

const VIS_OPTIONS: Array<{ key: Visibility; label: string; icon: string }> = [
  { key: 'public', label: '公开', icon: '🌍' },
  { key: 'friends', label: '仅好友', icon: '👥' },
  { key: 'private', label: '私密', icon: '🔒' },
]

export default function CircleCreatePage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const [form, setForm] = useState<FormState>({
    content: '',
    images: [],
    topicId: '',
    topicName: '',
    aigcWorkId: '',
    aigcWorkTitle: '',
    visibility: 'public',
    allowComments: true,
  })
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([])
  const [aigcWorks, setAigcWorks] = useState<AigcWork[]>([])
  const [aigcOpen, setAigcOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadHotTopics = useCallback(async () => {
    try {
      const res = await getTopicList({ page: 1, pageSize: 10 })
      setHotTopics((res.list || []).map((x) => ({ id: String(x.id), name: x.name })))
    } catch (e) {
      logger.error('circle/create', '加载热门话题', e)
    }
  }, [])

  const loadAigcWorks = useCallback(async () => {
    try {
      const res = await get<{ list: AigcWork[] }>('/aigc/my-works', { page: 1, pageSize: 20 })
      setAigcWorks(res.list || [])
    } catch (e) {
      logger.error('circle/create', '加载 AIGC 作品', e)
    }
  }, [])

  const restoreDraft = useCallback(() => {
    try {
      const draft = Taro.getStorageSync(DRAFT_KEY) as Partial<FormState> | ''
      if (draft && typeof draft === 'object') {
        setForm((prev) => ({ ...prev, ...draft }))
      }
    } catch (e) {
      logger.error('circle/create', '恢复草稿', e)
    }
  }, [])

  useDidShow(() => {
    loadHotTopics()
    loadAigcWorks()
    restoreDraft()
  })

  // 草稿自动保存(防抖 800ms)
  useEffect(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current)
    if (!form.content && !form.images.length) {
      Taro.removeStorageSync(DRAFT_KEY)
      return
    }
    draftTimer.current = setTimeout(() => {
      try {
        Taro.setStorageSync(DRAFT_KEY, form)
      } catch (e) {
        logger.error('circle/create', '保存草稿', e)
      }
    }, 800)
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current)
    }
  }, [form])

  // 监听从话题选择页选中后触发的事件
  useEffect(() => {
    const handler = (name: string) => {
      if (name) setForm((f) => ({ ...f, topicName: name, topicId: '' }))
    }
    Taro.eventCenter.on(TOPIC_EVENT, handler)
    return () => {
      Taro.eventCenter.off(TOPIC_EVENT, handler)
    }
  }, [])

  const addImg = useCallback(() => {
    if (form.images.length >= MAX_IMAGES) return
    Taro.chooseImage({
      count: MAX_IMAGES - form.images.length,
      sizeType: ['compressed'],
      success: (res) => {
        setForm((f) => ({ ...f, images: [...f.images, ...res.tempFilePaths] }))
      },
    })
  }, [form.images.length])

  const removeImg = useCallback((i: number) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))
  }, [])

  const previewImg = useCallback((i: number) => {
    Taro.previewImage({ urls: form.images, current: form.images[i] })
  }, [form.images])

  const selectTopic = useCallback((topic: HotTopic) => {
    setForm((f) => ({ ...f, topicId: topic.id, topicName: topic.name }))
  }, [])

  const clearTopic = useCallback(() => {
    setForm((f) => ({ ...f, topicId: '', topicName: '' }))
  }, [])

  const goTopicList = useCallback(() => {
    Taro.navigateTo({ url: '/pages/topic/list?from=create' })
  }, [])

  const pickAigc = useCallback((w: AigcWork) => {
    setForm((f) => ({ ...f, aigcWorkId: w.id, aigcWorkTitle: w.title }))
    setAigcOpen(false)
  }, [])

  const clearAigc = useCallback(() => {
    setForm((f) => ({ ...f, aigcWorkId: '', aigcWorkTitle: '' }))
  }, [])

  const onSubmit = useCallback(async () => {
    if (!form.content.trim()) {
      Taro.showToast({ title: tt('circle.create.contentRequired', '请输入动态内容'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await post('/circles', {
        content: form.content,
        images: form.images,
        topicId: form.topicId || undefined,
        topicName: form.topicName || undefined,
        aigcWorkId: form.aigcWorkId || undefined,
        visibility: form.visibility,
        allowComments: form.allowComments,
      })
      Taro.removeStorageSync(DRAFT_KEY)
      Taro.showToast({ title: tt('circle.createForm.published', '发布成功'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1200)
    } catch (e) {
      logger.error('circle/create', '发布动态', e)
    } finally {
      setSubmitting(false)
    }
  }, [form, tt])

  return (
    <View className="cc-page">
      <View className="cc-card cc-main">
        <Textarea
          className="cc-content"
          value={form.content}
          placeholder={tt('circle.createForm.contentPlaceholder', '分享你的想法…')}
          maxlength={MAX_CONTENT}
          onInput={(e) => setForm((f) => ({ ...f, content: e.detail.value }))}
        />
        <View className="cc-counter">
          <Text className="cc-counter-num">{form.content.length}</Text>
          <Text className="cc-counter-max">/{MAX_CONTENT}</Text>
        </View>
      </View>

      <View className="cc-card">
        <Text className="cc-section-title">{tt('circle.create.imagesLabel', '图片')}</Text>
        <View className="cc-images">
          {form.images.map((img, i) => (
            <View key={i} className="cc-img-item">
              <Image className="cc-img" src={img} mode="aspectFill" onClick={() => previewImg(i)} />
              <View className="cc-del" onClick={() => removeImg(i)}>
                <Text className="cc-del-icon">×</Text>
              </View>
            </View>
          ))}
          {form.images.length < MAX_IMAGES ? (
            <View className="cc-add-img" onClick={addImg}>
              <Text className="cc-add-icon">+</Text>
              <Text className="cc-add-tip">
                {form.images.length}/{MAX_IMAGES}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="cc-card">
        <Text className="cc-section-title">{tt('circle.createForm.topicLabel', '话题')}</Text>
        {form.topicName ? (
          <View className="cc-topic-chip cc-topic-chip-active" onClick={clearTopic}>
            <Text>#{form.topicName}</Text>
            <Text className="cc-topic-x">×</Text>
          </View>
        ) : null}
        <ScrollView scrollX enhanced showScrollbar={false} className="cc-topic-scroll">
          <View className="cc-topic-list">
            {hotTopics.map((topic) => (
              <View key={topic.id} className="cc-topic-chip" onClick={() => selectTopic(topic)}>
                <Text>#{topic.name}</Text>
              </View>
            ))}
            <View className="cc-topic-chip cc-topic-more" onClick={goTopicList}>
              <Text>{tt('circle.create.moreTopics', '更多')} ›</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      <View className="cc-card">
        <Text className="cc-section-title">{tt('circle.create.aigcLabel', '关联 AI 作品')}</Text>
        {form.aigcWorkTitle ? (
          <View className="cc-aigc-picked" onClick={clearAigc}>
            <Text className="cc-aigc-picked-title">{form.aigcWorkTitle}</Text>
            <Text className="cc-aigc-x">×</Text>
          </View>
        ) : (
          <View className="cc-aigc-pick" onClick={() => setAigcOpen(true)}>
            <Text>{tt('circle.create.selectAigc', '选择 AI 作品(可选)')} ›</Text>
          </View>
        )}
      </View>

      {aigcOpen ? (
        <View className="cc-mask" onClick={() => setAigcOpen(false)}>
          <View className="cc-sheet" catchMove>
            <View className="cc-sheet-head">
              <Text className="cc-sheet-title">
                {tt('circle.create.selectAigc', '选择 AI 作品')}
              </Text>
              <Text className="cc-sheet-close" onClick={() => setAigcOpen(false)}>
                ×
              </Text>
            </View>
            <ScrollView scrollY className="cc-sheet-list">
              {aigcWorks.length ? (
                aigcWorks.map((w) => (
                  <View key={w.id} className="cc-aigc-option" onClick={() => pickAigc(w)}>
                    {w.coverUrl ? (
                      <Image className="cc-aigc-cover" src={w.coverUrl} mode="aspectFill" />
                    ) : null}
                    <Text className="cc-aigc-option-title">{w.title}</Text>
                  </View>
                ))
              ) : (
                <View className="cc-aigc-empty">
                  <Text>{tt('circle.create.noAigc', '暂无可关联的 AI 作品')}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      ) : null}

      <View className="cc-card">
        <View className="cc-row">
          <Text className="cc-label">{tt('circle.create.visibility', '可见范围')}</Text>
          <View className="cc-vis">
            {VIS_OPTIONS.map((opt) => (
              <View
                key={opt.key}
                className={`cc-vis-chip${form.visibility === opt.key ? ' active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, visibility: opt.key }))}
              >
                <Text className="cc-vis-icon">{opt.icon}</Text>
                <Text className="cc-vis-text">{tt(`circle.create.vis.${opt.key}`, opt.label)}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className="cc-row">
          <Text className="cc-label">{tt('circle.create.allowComments', '允许评论')}</Text>
          <Switch
            checked={form.allowComments}
            color="#07c160"
            onChange={(e) => setForm((f) => ({ ...f, allowComments: e.detail.value }))}
          />
        </View>
      </View>

      <View className="cc-footer">
        <Button
          className="cc-btn"
          loading={submitting}
          disabled={!form.content.trim() || submitting}
          onClick={onSubmit}
        >
          {tt('circle.createForm.publish', '发布')}
        </Button>
      </View>
    </View>
  )
}
