// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/ask-create/AskCreateScreen.tsx
// 共享段(两端真消费): packages/app/src/features/ask-create/AskImageField.tsx —— 选图
// 共享钩子(两端真消费): packages/app/src/features/ask-create/ask-draft.tsx —— 草稿存储
//
// 缺段说明(单端段留页内,不给共享屏加"只有小程序会传"的槽 —— 那是搬码):
// - 分类(选择器 + 分类弹层): AskCreateScreenProps 无 category,RN 端无对应控件;
// - 悬赏积分(REWARDS 五档): 同上,RN props 无 reward;
// - 匿名发布(Switch): 同上,RN props 无 anonymous。
//   这三段要等共享屏接通对应数据面才收;本笔只把"配图 + 草稿"两段做成双端共享。
//
// 页面仍是本地布局(未渲染共享屏入口): 上述三段无 RN 对应实现,整屏 adoption 会丢功能,
// 故本页只做到"部分收敛",渲染型 JSX ≤2 不可达 —— 这是结论,不是欠账。
import { useTt, t } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Button, Switch, ScrollView } from '@tarojs/components'
import { FocusInput, FocusTextarea } from '@/components/FocusField'
import LineIcon from '@/components/LineIcon'
import Taro from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { AskImageField } from '@ihui/rn-app/features/ask-create/AskImageField'
import { useAskDraft } from '@ihui/rn-app/features/ask-create/ask-draft'
import { createAskDraftPort, createAskMediaPort } from '@/host/ask-create-ports'
import { createAsk } from '@ihui/api-client'
import { unwrapApi } from '@/utils/api-bridge'
import { NavBar } from '@/components'
import ThemeRoot from '@/components/ThemeRoot'
import { getRnTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import './create.css'
import { onToast } from '@/host/on-toast'

interface FormState {
  title: string
  content: string
  tags: string
  reward: number
  category: string
  images: string[]
  anonymous: boolean
}

const TITLE_MAX = 50
const CONTENT_MAX = 500

const CATEGORIES = [
  { key: 'tech', labelKey: 'askCreate.d1', fb: t('askCreate.d1') },
  { key: 'product', labelKey: 'askCreate.d2', fb: t('askCreate.d2') },
  { key: 'design', labelKey: 'pagesindexindex.d11', fb: t('pagesindexindex.d11') },
  { key: 'operation', labelKey: 'askCreate.d4', fb: t('askCreate.d4') },
  { key: 'other', labelKey: 'setting.other', fb: t('setting.other') },
]

const REWARDS = [0, 5, 10, 20, 50]

export default function AskCreatePage() {
  const tt = useTt()
  /* 微信 <switch color> 走 wxml 原生属性位、不解析 CSS 变量 ⇒ 必须 JS 派生 hex。
     取墨档 brand.DEFAULT(亮 #000000 / 暗 #FFFFFF,随主题翻转),与 RN trackColor.true 同档。 */
  const { resolved } = useAppTheme()
  const switchInk = getRnTokens(resolved).brand.DEFAULT

  const [form, setForm] = useState<FormState>({
    title: '',
    content: '',
    tags: '',
    reward: 0,
    category: '',
    images: [],
    anonymous: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [showCategorySheet, setShowCategorySheet] = useState(false)

  // 端口实现只在本端文件里(Taro API 全部落 apps/miniapp-taro/src/host/ask-create-ports.ts)
  const media = useMemo(() => createAskMediaPort(), [])
  const draft = useMemo(() => createAskDraftPort(), [])

  // 草稿读写走共享钩子:挂载恢复一次 + 防抖 800ms + 提交后清除,与 RN 同一份实现
  const { save: saveDraft, clear: clearDraft } = useAskDraft<FormState>({
    draft,
    onRestore: (saved) =>
      setForm({
        title: typeof saved.title === 'string' ? saved.title : '',
        content: typeof saved.content === 'string' ? saved.content : '',
        tags: typeof saved.tags === 'string' ? saved.tags : '',
        reward: Number(saved.reward) || 0,
        category: typeof saved.category === 'string' ? saved.category : '',
        images: Array.isArray(saved.images)
          ? saved.images.filter((uri): uri is string => typeof uri === 'string')
          : [],
        anonymous: !!saved.anonymous,
      }),
    restoredMessage: tt('ask.create.draftRestored', '草稿已恢复'),
    onToast,
  })

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
      onToast(tt('ask.create.titleRequired', '请输入标题'), { kind: 'info' })
      return
    }
    if (!form.content.trim()) {
      onToast(tt('ask.create.contentRequired', '请输入问题描述'), { kind: 'info' })
      return
    }
    if (form.content.trim().length < 5) {
      onToast(tt('ask.create.contentTooShort', '描述至少 5 个字'), { kind: 'error' })
      return
    }
    setSubmitting(true)
    try {
      // 标签按逗号(中英文)切分去空;后端 POST /asks 的 tags 为可选字符串数组
      const tags = form.tags
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
      // 端点单一真相源:POST /api/asks 的封装住在 @ihui/api-client 的 createAsk
      // (packages/api-client/src/endpoints/community.ts:171),web 与 RN 同屏早已是这一份;
      // 端内那份同名薄封装随本笔退役(§3 共享层优先)。解包与失败提示仍走端内唯一出口
      // unwrapApi(与 pkg-learn/live/host 同写法)⇒ 错误处理逐字不变;tags 由共享签名
      // 原生承接,故原先掩盖签名缺口的 `as { title; content }` 断言一并去掉。
      await unwrapApi(
        createAsk({
          title: form.title.trim(),
          content: form.content.trim(),
          tags,
        }),
      )
      // 草稿清除走共享钩子(取消待写定时器 + 删 key),与 RN 同一份实现
      await clearDraft()
      onToast(tt('ask.create.published', '问题已发布'), { kind: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (e) {
      logger.error('ask/create', t('ask.create.submit'), e)
      onToast(tt('ask.create.failed', '发布失败,请重试'), { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [form.title, form.content, form.tags, tt, clearDraft])

  const canSubmit = form.title.trim().length > 0 && form.content.trim().length >= 5

  return (
    <ThemeRoot>
      <View className="ask-create-page">
        <NavBar title={tt('askCreate.title', '发布提问')} showBack />
        <ScrollView scrollY className="ask-create-body">
          {/* 标题 */}
          <View className="ask-create-card">
            <View className="ask-create-label-row">
              <Text className="ask-create-label">{tt('ask.create.titleLabel', '标题')}</Text>
              <Text className="ask-create-counter">
                {tt('ask.create.titleCount', '{n}/50', { n: form.title.length })}
              </Text>
            </View>
            <FocusInput
              className="ask-create-input"
              value={form.title}
              placeholder={tt('askCreate.titlePlaceholder', '一句话概括你的问题')}
              maxlength={TITLE_MAX}
              onInput={(e) => updateForm({ title: e.detail.value })}
            />
          </View>

          {/* 详细描述 */}
          <View className="ask-create-card">
            <View className="ask-create-label-row">
              <Text className="ask-create-label">{tt('askCreate.contentLabel', '内容')}</Text>
              <Text className="ask-create-counter">
                {tt('ask.create.contentCount', '{n}/500', { n: form.content.length })}
              </Text>
            </View>
            <FocusTextarea
              className="ask-create-textarea"
              value={form.content}
              placeholder={tt('askCreate.contentPlaceholder', '详细描述你的问题')}
              maxlength={CONTENT_MAX}
              onInput={(e) => updateForm({ content: e.detail.value })}
            />
          </View>

          {/* 标签(对齐 RN tags 输入:逗号分隔,提交时转数组走 POST /asks 的 tags 字段) */}
          <View className="ask-create-card">
            <Text className="ask-create-label">{tt('askCreate.tagsLabel', '标签')}</Text>
            <FocusInput
              className="ask-create-input"
              value={form.tags}
              placeholder={tt('askCreate.tagsPlaceholder', '多个标签用逗号分隔')}
              maxlength={100}
              onInput={(e) => updateForm({ tags: e.detail.value })}
            />
          </View>

          {/* 分类选择 */}
          <View className="ask-create-card">
            <Text className="ask-create-label">{tt('ask.create.categoryLabel', '分类')}</Text>
            <View
              className="ask-create-picker"
              onClick={() => setShowCategorySheet(true)}
              hoverClass="opacity-60"
            >
              <Text
                className={`ask-create-picker-value${form.category ? '' : ' ask-create-picker-placeholder'}`}
              >
                {form.category
                  ? getCategoryLabel(form.category)
                  : tt('ask.create.categoryPlaceholder', '选择分类')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
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
                  hoverClass="opacity-60"
                >
                  <Text>{r}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 配图:网格 + 选图 + 删除全部下沉到共享段,选图经 media 端口(Taro.chooseImage) */}
          <View className="ask-create-card">
            <Text className="ask-create-label">{tt('ask.create.imageLabel', '配图')}</Text>
            <AskImageField
              colorScheme={resolved}
              images={form.images}
              media={media}
              onToast={onToast}
              maxToast={tt('ask.create.maxImages', '最多 3 张')}
              onAdd={(uris) => updateForm({ images: [...form.images, ...uris] })}
              onRemove={(index) =>
                updateForm({ images: form.images.filter((_, i) => i !== index) })
              }
            />
          </View>

          {/* 匿名发布 */}
          <View className="ask-create-card ask-create-switch-row">
            <View className="ask-create-switch-info">
              <Text className="ask-create-label">
                {tt('ask.create.anonymousLabel', '匿名发布')}
              </Text>
              <Text className="ask-create-switch-desc">
                {tt('ask.create.anonymousDesc', '不显示你的昵称')}
              </Text>
            </View>
            <Switch
              checked={form.anonymous}
              color={switchInk}
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
            {submitting ? tt('ask.create.submitting', '发布中…') : tt('askCreate.submit', '发布')}
          </Button>
        </View>

        {/* 分类选择弹层 */}
        {showCategorySheet ? (
          <View className="ask-create-mask" onClick={() => setShowCategorySheet(false)}>
            <View
              className="ask-create-sheet"
              catchMove
              onClick={(e) => e.stopPropagation()}
              hoverClass="opacity-60"
            >
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
                  hoverClass="opacity-60"
                >
                  <Text>{tt(c.labelKey, c.fb)}</Text>
                  {form.category === c.key ? (
                    <LineIcon
                      className="ask-create-sheet-check"
                      name="check"
                      size={28}
                      color="var(--color-brand)"
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
