// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { getCircles, submitCirclePost, uploadFileMultipart } from '@ihui/api-client'
import { CirclePostScreen as SharedCirclePostScreen, type CircleOption } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 与 web ImageUpload 同上限(circles/post/page.tsx:115 maxCount=9)与同分页(circles 拉取 page=1&pageSize=100) */
const MAX_IMAGES = 9

/** 相对路径 → 可渲染绝对 URL(后端 path 已是 /uploads/<id> 或 CDN 绝对 URL;提交仍用原相对值,与 web 同口径) */
function toAbsolute(uri: string): string {
  if (/^https?:\/\//i.test(uri)) return uri
  return `${API_BASE_URL.replace(/\/$/, '')}${uri.startsWith('/') ? '' : '/'}${uri}`
}

/**
 * RN 端「圈子发帖」薄壳 —— 承载 web /circles/post。渲染全部委托共享屏,本文件只管:
 * 圈子列表取数(GET /api/circles?page=1&pageSize=100,与 web 同参)、相册选图 +
 * multipart 上传(POST /api/files/upload/form,与 web ImageUpload 同端点)、
 * 发帖(POST /api/circles/:id/posts,成功跳 CircleDetail,与 web router.push('/circles/'+id) 同口径)。
 */
export function CirclePostScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [circles, setCircles] = useState<CircleOption[]>([])
  const [circlesLoading, setCirclesLoading] = useState(true)
  const [selectedCircleId, setSelectedCircleId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<{ key: string; value: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await getCircles({ page: 1, pageSize: 100 })
        if (alive && res.success && res.data) {
          setCircles((res.data.list ?? []).map((c) => ({ id: c.id, name: c.name })))
        }
      } finally {
        if (alive) setCirclesLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const pickImage = useCallback(async () => {
    setError(null)
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      })
      if (picked.canceled) return
      const assets = (picked.assets ?? []).slice(0, MAX_IMAGES - images.length)
      if (assets.length === 0) return
      setUploading(true)
      for (const asset of assets) {
        if (!asset?.uri) continue
        const up = await uploadFileMultipart({
          uri: asset.uri,
          type: asset.mimeType ?? 'image/jpeg',
          name: asset.fileName ?? `image-${Date.now()}.jpg`,
        })
        if (up.success && up.data?.path) {
          const value = up.data.path
          setImages((prev) =>
            prev.length >= MAX_IMAGES ? prev : [...prev, { key: `${value}-${prev.length}`, value }],
          )
        } else {
          setError(up.error ?? t('circlePostPage.uploadFailed'))
        }
      }
    } catch {
      setError(t('circlePostPage.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }, [images.length, t])

  const removeImage = useCallback((key: string) => {
    setImages((prev) => prev.filter((img) => img.key !== key))
  }, [])

  const submit = useCallback(async () => {
    setError(null)
    // 校验文案与逐条次序与 web createMut 完全一致(先圈后标题/正文)
    if (!selectedCircleId) {
      setError(t('circlePostPage.errorCircleRequired'))
      return
    }
    if (!title.trim() || !content.trim()) {
      setError(t('circlePostPage.errorTitleContentRequired'))
      return
    }
    setSubmitting(true)
    try {
      const res = await submitCirclePost(selectedCircleId, {
        title: title.trim(),
        content: content.trim(),
        images: images.length > 0 ? images.map((img) => img.value) : undefined,
      })
      if (!res.success) {
        setError(res.error ?? t('circlePostPage.error'))
        return
      }
      navigation.navigate('CircleDetail', { id: selectedCircleId })
    } catch {
      setError(t('circlePostPage.error'))
    } finally {
      setSubmitting(false)
    }
  }, [selectedCircleId, title, content, images, navigation, t])

  return (
    <SharedCirclePostScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      circles={circles}
      circlesLoading={circlesLoading}
      selectedCircleId={selectedCircleId}
      onSelectCircle={setSelectedCircleId}
      title={title}
      onTitleChange={setTitle}
      content={content}
      onContentChange={setContent}
      images={images.map((img) => ({ key: img.key, uri: toAbsolute(img.value) }))}
      onPickImage={() => void pickImage()}
      onRemoveImage={removeImage}
      uploading={uploading}
      error={error}
      submitting={submitting}
      onSubmit={() => void submit()}
      onCancel={() => navigation.goBack()}
    />
  )
}

export default CirclePostScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
