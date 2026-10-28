// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  ImageGenTemplatesScreen as SharedImageGenTemplatesScreen,
  type ImageTemplateItem,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { useClipboard } from '../hooks/use-clipboard'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 提示词模板 —— 对齐 web `/image-gen/templates`。
 *
 * 〔门 39 六屏共享化第二批 2026-10-22〕UI 已下沉到共享层 `@ihui/rn-app` 的
 * ImageGenTemplatesScreen —— 本文件改成 wrapper,只留平台侧:API 调用、导航、剪贴板、
 * i18n/日期格式化/主题注入。**不准**靠"补一条 import"或塞白名单消门 39 的红。
 *
 * 契约(按 apps/api/src/routes/other/image-gen-routes.ts 与 content_generation_templates 表实读):
 *  - `GET /api/image-gen/templates` 返回 `{ list }`(无 categories 键,也不分页);
 *  - 行字段是 id/name/description/prompt/category/status/createdAt,
 *    web 页假设的 title/categoryId/previewUrl 三个字段在响应里都不存在;
 *  - 因此分类筛选从 list 自身的 category 值派生,标题取 name,且不渲染预览图(无预览字段)。
 *
 * 使用动线:RN 的 `ImageGenCreate` 路由声明为 `undefined`(不吃 params),不能把模板 id/提示词
 * 作为导航参数硬塞进去;改为「预览 + 复制 + 去生成」,复制后进入生成页粘贴。
 */
interface ImageTemplate {
  id: string
  name: string
  description: string | null
  prompt: string | null
  category: string | null
  status: number
  createdAt: string
}

interface TemplatesData {
  list: ImageTemplate[]
}

export default function ImageGenTemplatesScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { copy } = useClipboard()

  const [templates, setTemplates] = useState<ImageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [activeCat, setActiveCat] = useState('all')
  const [preview, setPreview] = useState<ImageTemplateItem | null>(null)
  const [notice, setNotice] = useState('')

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [locale],
  )

  const load = useCallback(async () => {
    setErrorText('')
    try {
      const res = await fetchApi<TemplatesData>('/api/image-gen/templates')
      if (!res.success) {
        setErrorText(t('imageGenTemplates.loadFailed'))
        return
      }
      setTemplates(res.data.list)
    } catch {
      setErrorText(t('imageGenTemplates.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  /** 分类字典:端点不返回 categories,从行上的 category 值派生(保序去重) */
  const categories = useMemo(() => {
    const seen: string[] = []
    for (const tpl of templates) {
      const c = tpl.category?.trim()
      if (c && !seen.includes(c)) seen.push(c)
    }
    return seen
  }, [templates])

  const visible = useMemo(
    () =>
      activeCat === 'all'
        ? templates
        : templates.filter((tpl) => (tpl.category?.trim() ?? '') === activeCat),
    [templates, activeCat],
  )

  const items: ImageTemplateItem[] = useMemo(
    () =>
      visible.map((tpl) => ({
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        prompt: tpl.prompt,
        category: tpl.category,
        createdAtText: Number.isNaN(new Date(tpl.createdAt).getTime())
          ? '—'
          : dateFmt.format(new Date(tpl.createdAt)),
      })),
    [visible, dateFmt],
  )

  const onCopy = async (text: string) => {
    const ok = await copy(text)
    setNotice(ok ? t('imageGenTemplates.copied') : t('imageGenTemplates.copyFailed'))
  }

  const copyAndCreate = async (tpl: ImageTemplateItem) => {
    if (!tpl.prompt) return
    const ok = await copy(tpl.prompt)
    if (!ok) {
      setNotice(t('imageGenTemplates.copyFailed'))
      return
    }
    setPreview(null)
    navigation.navigate('ImageGenCreate')
    appAlert(t('common.ok'), t('imageGenTemplates.copied'))
  }

  return (
    <SharedImageGenTemplatesScreen
      t={t}
      items={items}
      categories={categories}
      activeCategory={activeCat}
      loading={loading}
      refreshing={refreshing}
      errorText={errorText}
      preview={preview}
      notice={notice}
      onCategoryChange={setActiveCat}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onRetry={() => {
        setLoading(true)
        void load()
      }}
      onOpenPreview={(item) => {
        setNotice('')
        setPreview(item)
      }}
      onClosePreview={() => {
        setPreview(null)
        setNotice('')
      }}
      onCopy={(prompt) => void onCopy(prompt)}
      onCopyAndCreate={(item) => void copyAndCreate(item)}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
