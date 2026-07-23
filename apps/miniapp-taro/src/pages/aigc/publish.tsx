import { View, Text, Input, Textarea, Button, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { publishAigc, uploadByBase64 } from '@/api'
import { useI18n } from '@/i18n'
import './publish.css'

interface UpFile {
  url: string
  type: 'image' | 'video' | 'audio'
}

const MAX_FILES = 5

/** 解析路由参数(对标原项目 onLoad options:contextId/title/prompt/imgUrlList) */
function parseRouteParams(): {
  contextId: string
  prompt: string
  fileList: UpFile[]
} {
  const router = useRouter()
  const ctxId = (router.params.contextId as string) || ''
  let prompt = ''
  if (router.params.title) prompt = decodeURIComponent(router.params.title)
  if (router.params.prompt) prompt = decodeURIComponent(router.params.prompt)
  const fileList: UpFile[] = []
  if (router.params.imgUrlList) {
    try {
      const arr = JSON.parse(decodeURIComponent(router.params.imgUrlList)) as string[]
      ;(arr || []).forEach((u) => {
        if (u) fileList.push({ url: u, type: 'image' })
      })
    } catch {
      // ignore
    }
  }
  return { contextId: ctxId, prompt, fileList }
}

export default function AigcPublish() {
  const { t } = useI18n()
  const params = useMemo(parseRouteParams, [])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [prompt, setPrompt] = useState(params.prompt)
  const [fileList, setFileList] = useState<UpFile[]>(params.fileList)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const coverUrl = useMemo(() => {
    const img = fileList.find((f) => f.type === 'image')
    return img ? img.url : ''
  }, [fileList])

  const chooseImage = useCallback(async () => {
    if (fileList.length >= MAX_FILES) {
      Taro.showToast({ title: t('aigc.publish.maxFiles'), icon: 'none' })
      return
    }
    try {
      const res = await Taro.chooseImage({ count: 1, sourceType: ['album', 'camera'] })
      const path = res.tempFilePaths[0]
      if (!path) return
      setUploading(true)
      Taro.showLoading({ title: t('common.uploading') })
      const fileRes = (await Taro.getFileSystemManager().readFile({
        filePath: path,
        encoding: 'base64',
      })) as unknown as { data: string }
      const fileName = path.split('/').pop() || 'img.png'
      const upRes = (await uploadByBase64({
        base64: fileRes.data,
        fileName,
      })) as Record<string, unknown>
      const url = (upRes.url as string) || (upRes.data as string) || ''
      if (url) {
        setFileList((prev) => [...prev, { url, type: 'image' }])
        Taro.showToast({ title: t('aigc.publish.uploadOk'), icon: 'success' })
      } else {
        Taro.showToast({ title: t('aigc.publish.uploadFail'), icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: t('aigc.publish.uploadFail'), icon: 'none' })
    } finally {
      setUploading(false)
      Taro.hideLoading()
    }
  }, [fileList.length, t])

  const removeFile = useCallback((idx: number) => {
    setFileList((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const validate = useCallback((): boolean => {
    if (fileList.length === 0) {
      Taro.showToast({ title: t('aigc.publish.needFile'), icon: 'none' })
      return false
    }
    if (!title.trim()) {
      Taro.showToast({ title: t('aigc.publish.titleRequired'), icon: 'none' })
      return false
    }
    if (!desc.trim()) {
      Taro.showToast({ title: t('aigc.publish.descRequired'), icon: 'none' })
      return false
    }
    if (!prompt.trim()) {
      Taro.showToast({ title: t('aigc.publish.promptRequired'), icon: 'none' })
      return false
    }
    return true
  }, [fileList.length, title, desc, prompt, t])

  const onSubmit = useCallback(async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      await publishAigc({
        contextId: params.contextId,
        title: title.trim(),
        subtitle: desc.trim(),
        coverUrl,
        fileUrl: fileList[0]?.url || '',
        problem: prompt.trim(),
      })
      Taro.showToast({ title: t('aigc.publish.published'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch {
      Taro.showToast({ title: t('aigc.publish.publishFail'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [validate, params.contextId, title, desc, coverUrl, fileList, prompt, t])

  return (
    <View className="pub-page">
      <View className="pub-header">
        <Text className="pub-title">{t('aigc.publish.title')}</Text>
      </View>

      <ScrollView scrollY className="pub-body">
        {/* 上传作品 */}
        <View className="pub-section">
          <Text className="pub-label">{t('aigc.publish.workLabel')}</Text>
          <View className="pub-file-list">
            {fileList.map((f, i) => (
              <View key={i} className="pub-file-item">
                <Image className="pub-file-img" src={f.url} mode="aspectFill" />
                <View className="pub-file-del" onClick={() => removeFile(i)}>
                  <Text>×</Text>
                </View>
              </View>
            ))}
            {fileList.length < MAX_FILES ? (
              <View className="pub-file-add" onClick={chooseImage}>
                <Text className="pub-file-add-icon">+</Text>
                <Text className="pub-file-add-text">{t('aigc.publish.addImage')}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 标题 */}
        <View className="pub-section">
          <Text className="pub-label">{t('aigc.publish.titleLabel')}</Text>
          <Input
            className="pub-input"
            maxlength={50}
            placeholder={t('aigc.publish.titlePlaceholder')}
            value={title}
            onInput={(e) => setTitle(e.detail.value)}
          />
        </View>

        {/* 简介 */}
        <View className="pub-section">
          <Text className="pub-label">{t('aigc.publish.descLabel')}</Text>
          <Textarea
            className="pub-textarea"
            placeholder={t('aigc.publish.descPlaceholder')}
            value={desc}
            onInput={(e) => setDesc(e.detail.value)}
          />
        </View>

        {/* 提示词 */}
        <View className="pub-section">
          <Text className="pub-label">{t('aigc.publish.promptLabel')}</Text>
          <Textarea
            className="pub-textarea"
            placeholder={t('aigc.publish.promptPlaceholder')}
            value={prompt}
            onInput={(e) => setPrompt(e.detail.value)}
          />
        </View>

        <Button
          className="pub-submit"
          loading={submitting || uploading}
          disabled={submitting || uploading}
          onClick={onSubmit}
        >
          {t('aigc.publish.publish')}
        </Button>
        <View className="pub-bottom-space" />
      </ScrollView>
    </View>
  )
}
