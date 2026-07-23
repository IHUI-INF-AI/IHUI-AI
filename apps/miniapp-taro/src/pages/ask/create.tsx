import { logger } from '@/utils/logger'
import { View, Text, Input, Textarea, Button, Image, Switch, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createAsk } from '@/api'
import { NavBar } from '@/components'
import { useI18n } from '@/i18n'
import './create.css'

interface FormState {
  title: string
  content: string
  reward: number
  category: string
  images: string[]
  anonymous: boolean
}

const TITLE_MAX = 50
const CONTENT_MAX = 500
const IMAGE_MAX = 3
const DRAFT_KEY = 'ask_create_draft'

const CATEGORIES = [
  { key: 'tech', labelKey: 'ask.create.categoryTech', fb: '技术' },
  { key: 'product', labelKey: 'ask.create.categoryProduct', fb: '产品' },
  { key: 'design', labelKey: 'ask.create.categoryDesign', fb: '设计' },
  { key: 'operation', labelKey: 'ask.create.categoryOperation', fb: '运营' },
  { key: 'other', labelKey: 'ask.create.categoryOther', fb: '其他' },
]

const REWARDS = [0, 5, 10, 20, 50]

export default function AskCreatePage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string, params?: Record<string, string | number>) => {
    const v = params ? t(k, params) : t(k)
    if (v !== k) return v
    if (!params) return fb
    return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
  }

  const [form, setForm] = useState<FormState>({
    title: '',
    content: '',
    reward: 0,
    category: '',
    images: [],
    anonymous: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [showCategorySheet, setShowCategorySheet] = useState(false)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 草稿恢复
  useEffect(() => {
    try {
      const raw = Taro.getStorageSync(DRAFT_KEY)
      if (raw) {
        const saved = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (saved && (saved.title || saved.content)) {
          setForm({
            title: saved.title || '',
            content: saved.content || '',
            reward: Number(saved.reward) || 0,
            category: saved.category || '',
            images: Array.isArray(saved.images) ? saved.images : [],
            anonymous: !!saved.anonymous,
          })
          Taro.showToast({ title: tt('ask.create.draftRestored', '草稿已恢复'), icon: 'none' })
        }
      }
    } catch {
      // ignore
    }
  }, [tt])

  // 草稿自动保存(防抖 800ms)
  const saveDraft = useCallback((data: FormState) => {
    if (draftTimer.current) clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      try {
        Taro.setStorageSync(DRAFT_KEY, JSON.stringify(data))
      } catch {
        // ignore
      }
    }, 800)
  }, [])

  const updateForm = useCallback(
    (patch: Partial<FormState>) => {
      setForm((f) => {
        const next = { ...f, ...patch }
        saveDraft(next)
        return next
      })
    },
    [saveDraft],
  )

  const addImage = useCallback(() => {
    if (form.images.length >= IMAGE_MAX) {
      Taro.showToast({ title: tt('ask.create.maxImages', '最多 3 张'), icon: 'none' })
      return
    }
    Taro.chooseImage({
      count: IMAGE_MAX - form.images.length,
      sizeType: ['compressed'],
      success: (res) => {
        updateForm({ images: [...form.images, ...res.tempFilePaths] })
      },
    })
  }, [form.images, updateForm, tt])

  const removeImage = useCallback(
    (idx: number) => {
      updateForm({ images: form.images.filter((_, i) => i !== idx) })
    },
    [form.images, updateForm],
  )

  const pickCategory = useCallback(
    (key: string) => {
      updateForm({ category: key })
      setShowCategorySheet(false)
    },
    [updateForm],
  )

  const getCategoryLabel = useCallback(
    (key: string) => {
      const item = CATEGORIES.find((c) => c.key === key)
      return item ? tt(item.labelKey, item.fb) : ''
    },
    [tt],
  )

  const onSubmit = useCallback(async () => {
    if (!form.title.trim()) {
      Taro.showToast({ title: tt('ask.create.titleRequired', '请输入标题'), icon: 'none' })
      return
    }
    if (!form.content.trim()) {
      Taro.showToast({ title: tt('ask.create.contentRequired', '请输入问题描述'), icon: 'none' })
      return
    }
    if (form.content.trim().length < 5) {
      Taro.showToast({ title: tt('ask.create.contentTooShort', '描述至少 5 个字'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await createAsk({
        title: form.title.trim(),
        content: form.content.trim(),
      } as { title: string; content: string })
      Taro.removeStorageSync(DRAFT_KEY)
      Taro.showToast({ title: tt('ask.create.published', '问题已发布'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (e) {
      logger.error('ask/create', '发布问题', e)
      Taro.showToast({ title: tt('ask.create.failed', '发布失败,请重试'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [form.title, form.content, tt])

  const canSubmit = form.title.trim().length > 0 && form.content.trim().length >= 5

  return (
    <View className="ask-create-page">
      <NavBar title={tt('ask.create.pageTitle', '提问')} showBack />
      <ScrollView scrollY className="ask-create-body">
        {/* 标题 */}
        <View className="ask-create-card">
          <View className="ask-create-label-row">
            <Text className="ask-create-label">{tt('ask.create.titleLabel', '标题')}</Text>
            <Text className="ask-create-counter">
              {tt('ask.create.titleCount', '{n}/50', { n: form.title.length })}
            </Text>
          </View>
          <Input
            className="ask-create-input"
            value={form.title}
            placeholder={tt('ask.create.titlePlaceholder', '一句话描述你的问题')}
            maxlength={TITLE_MAX}
            onInput={(e) => updateForm({ title: e.detail.value })}
          />
        </View>

        {/* 详细描述 */}
        <View className="ask-create-card">
          <View className="ask-create-label-row">
            <Text className="ask-create-label">{tt('ask.create.detailLabel', '详细描述')}</Text>
            <Text className="ask-create-counter">
              {tt('ask.create.contentCount', '{n}/500', { n: form.content.length })}
            </Text>
          </View>
          <Textarea
            className="ask-create-textarea"
            value={form.content}
            placeholder={tt('ask.create.detailPlaceholder', '详细描述你的问题,越详细越容易得到回答')}
            maxlength={CONTENT_MAX}
            onInput={(e) => updateForm({ content: e.detail.value })}
          />
        </View>

        {/* 分类选择 */}
        <View className="ask-create-card">
          <Text className="ask-create-label">{tt('ask.create.categoryLabel', '分类')}</Text>
          <View className="ask-create-picker" onClick={() => setShowCategorySheet(true)}>
            <Text
              className={`ask-create-picker-value${form.category ? '' : ' ask-create-picker-placeholder'}`}
            >
              {form.category
                ? getCategoryLabel(form.category)
                : tt('ask.create.categoryPlaceholder', '选择分类')}
            </Text>
            <Text className="ask-create-picker-arrow">›</Text>
          </View>
        </View>

        {/* 悬赏积分 */}
        <View className="ask-create-card">
          <Text className="ask-create-label">{tt('ask.create.rewardLabel', '悬赏积分')}</Text>
          <View className="ask-create-rewards">
            {REWARDS.map((r) => (
              <View
                key={r}
                className={`ask-create-reward${form.reward === r ? ' active' : ''}`}
                onClick={() => updateForm({ reward: r })}
              >
                <Text>{r}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 配图 */}
        <View className="ask-create-card">
          <Text className="ask-create-label">{tt('ask.create.imageLabel', '配图')}</Text>
          <View className="ask-create-images">
            {form.images.map((img, i) => (
              <View key={i} className="ask-create-img-item">
                <Image className="ask-create-img" src={img} mode="aspectFill" />
                <View className="ask-create-img-del" onClick={() => removeImage(i)}>
                  <Text>×</Text>
                </View>
              </View>
            ))}
            {form.images.length < IMAGE_MAX ? (
              <View className="ask-create-img-add" onClick={addImage}>
                <Text className="ask-create-img-add-icon">+</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 匿名发布 */}
        <View className="ask-create-card ask-create-switch-row">
          <View className="ask-create-switch-info">
            <Text className="ask-create-label">{tt('ask.create.anonymousLabel', '匿名发布')}</Text>
            <Text className="ask-create-switch-desc">
              {tt('ask.create.anonymousDesc', '不显示你的昵称')}
            </Text>
          </View>
          <Switch
            checked={form.anonymous}
            color="#00f2ff"
            onChange={(e) => updateForm({ anonymous: e.detail.value })}
          />
        </View>
      </ScrollView>

      {/* 提交按钮 */}
      <View className="ask-create-footer">
        <Button
          className="ask-create-submit"
          loading={submitting}
          disabled={!canSubmit || submitting}
          onClick={onSubmit}
        >
          {submitting
            ? tt('ask.create.submitting', '发布中…')
            : tt('ask.create.submit', '发布问题')}
        </Button>
      </View>

      {/* 分类选择弹层 */}
      {showCategorySheet ? (
        <View className="ask-create-mask" onClick={() => setShowCategorySheet(false)}>
          <View className="ask-create-sheet" catchMove onClick={(e) => e.stopPropagation()}>
            <View className="ask-create-sheet-header">
              <Text className="ask-create-sheet-title">
                {tt('ask.create.categoryLabel', '分类')}
              </Text>
              <Text
                className="ask-create-sheet-close"
                onClick={() => setShowCategorySheet(false)}
              >
                ×
              </Text>
            </View>
            {CATEGORIES.map((c) => (
              <View
                key={c.key}
                className={`ask-create-sheet-item${form.category === c.key ? ' active' : ''}`}
                onClick={() => pickCategory(c.key)}
              >
                <Text>{tt(c.labelKey, c.fb)}</Text>
                {form.category === c.key ? <Text className="ask-create-sheet-check">✓</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}
