// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/aigc-publish/AigcPublishScreen.tsx
import { useI18n } from '@/i18n'
import { ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { useUiField } from '@/lib/ui-field-registry'
import { publishAigc, uploadByBase64 } from '@/api'
import { safeDecodeURIComponent } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
import { PublishForm } from './publish-form'
import type { PublishWorkType, UpFile } from './publish-sections'

const MAX_FILES = 5

export default function AigcPublish() {
  const { t } = useI18n()
  const router = useRouter()
  const params = useMemo(() => {
    const ctxId = (router.params.contextId as string) || ''
    let prompt = ''
    if (router.params.title) prompt = safeDecodeURIComponent(router.params.title)
    if (router.params.prompt) prompt = safeDecodeURIComponent(router.params.prompt)
    const fileList: UpFile[] = []
    if (router.params.imgUrlList) {
      try {
        const arr = JSON.parse(safeDecodeURIComponent(router.params.imgUrlList)) as string[]
        ;(arr || []).forEach((u) => {
          if (u) fileList.push({ url: u, type: 'image' })
        })
      } catch {
        // ignore
      }
    }
    return { contextId: ctxId, prompt, fileList }
  }, [router.params.contextId, router.params.title, router.params.prompt, router.params.imgUrlList])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [prompt, setPrompt] = useState(params.prompt)
  const [textContent, setTextContent] = useState('')
  // 类型档:image = 素材上传(既有链路),text = 用户直写正文(对齐共享屏 showTextInput 分支)
  const [workType, setWorkType] = useState<PublishWorkType>('image')
  const [urlInput, setUrlInput] = useState('')
  const [fileList, setFileList] = useState<UpFile[]>(params.fileList)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  // AI 操控通道(2026-09-21):作品发布的三个文本字段(标题/简介/提示词)交出各自 setter。
  // 发布动作本身对外且不可撤回 → 不注册 onPress / submit,由用户自己点。
  useUiField({
    kind: 'input',
    label: t('aigc.publish.titleLabel'),
    placeholder: t('aigcPublish.placeholderTitle'),
    maxLength: 50,
    readValue: () => title,
    setValue: setTitle,
  })
  useUiField({
    kind: 'textarea',
    label: t('aigc.publish.descLabel'),
    placeholder: t('aigcPublish.placeholderDescription'),
    readValue: () => desc,
    setValue: setDesc,
  })
  useUiField({
    kind: 'textarea',
    label: t('aigc.publish.promptLabel'),
    placeholder: t('aigcPublish.placeholderPrompt'),
    readValue: () => prompt,
    setValue: setPrompt,
  })

  const coverUrl = useMemo(() => {
    const img = fileList.find((f) => f.type === 'image')
    return img ? img.url : ''
  }, [fileList])

  /** 单张上传:本地文件读成 base64 → 走端内既有上传接口;失败返回空串由调用方统一记一次 */
  const uploadOne = useCallback(async (path: string): Promise<string> => {
    const fileRes = (await Taro.getFileSystemManager().readFile({
      filePath: path,
      encoding: 'base64',
    })) as unknown as { data: string }
    const fileName = path.split('/').pop() || 'img.png'
    const upRes = (await uploadByBase64({
      base64: fileRes.data,
      fileName,
    })) as Record<string, unknown>
    return (upRes.url as string) || (upRes.data as string) || ''
  }, [])

  const chooseFiles = useCallback(async () => {
    if (uploading) return
    const slots = MAX_FILES - fileList.length
    if (slots <= 0) {
      Taro.showToast({ title: t('aigc.publish.maxFiles'), icon: 'none' })
      return
    }
    try {
      const res = await Taro.chooseImage({ count: slots, sourceType: ['album', 'camera'] })
      const paths = res.tempFilePaths || []
      if (!paths.length) return
      setUploading(true)
      setUploadProgress(0)
      const added: UpFile[] = []
      // 上传中词条带 {progress}:这里取「已完成张数 / 本次选材张数」的真实占比,不做估算动画
      for (let i = 0; i < paths.length; i++) {
        const path = paths[i]
        if (!path) continue
        const url = await uploadOne(path)
        if (url) added.push({ url, type: 'image' })
        setUploadProgress(Math.round(((i + 1) / paths.length) * 100))
      }
      if (added.length) {
        setFileList((prev) => [...prev, ...added])
        Taro.showToast({ title: t('aigc.publish.uploadOk'), icon: 'success' })
      } else {
        Taro.showToast({ title: t('aigc.publish.uploadFail'), icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: t('aigc.publish.uploadFail'), icon: 'none' })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [uploading, fileList.length, uploadOne, t])

  /** 对齐 RN onAddFileByUrl:链接直填进素材位,与选图同一条提交链路 */
  const addByUrl = useCallback(() => {
    const url = urlInput.trim()
    if (!url) {
      Taro.showToast({ title: t('aigcPublish.placeholderUrl'), icon: 'none' })
      return
    }
    if (fileList.length >= MAX_FILES) {
      Taro.showToast({ title: t('aigc.publish.maxFiles'), icon: 'none' })
      return
    }
    setFileList((prev) => [...prev, { url, type: 'image' }])
    setUrlInput('')
  }, [urlInput, fileList.length, t])

  const removeFile = useCallback((idx: number) => {
    setFileList((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const validate = useCallback((): boolean => {
    if (workType === 'text') {
      if (!textContent.trim()) {
        Taro.showToast({ title: t('aigcPublish.placeholderTextContent'), icon: 'none' })
        return false
      }
    } else if (fileList.length === 0) {
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
    if (workType !== 'text' && !prompt.trim()) {
      Taro.showToast({ title: t('aigc.publish.promptRequired'), icon: 'none' })
      return false
    }
    return true
  }, [workType, textContent, fileList.length, title, desc, prompt, t])

  const onSubmit = useCallback(async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      await publishAigc({
        contextId: params.contextId,
        gcType: workType,
        title: title.trim(),
        subtitle: desc.trim(),
        coverUrl,
        fileUrl: fileList[0]?.url || '',
        // 文本作品没有独立的提示词位:正文走 problem 槽。理由是 /aigc/publish 的 zod 白名单只有
        // title/subtitle/coverUrl/fileUrl/problem 五个字符串位(无 textContent 槽),另设提示词
        // 输入口会让用户写下的正文无处落库 —— 宁可少一格输入,不可静默丢内容。
        problem: (workType === 'text' ? textContent : prompt).trim(),
      })
      Taro.showToast({ title: t('aigc.publish.published'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch {
      Taro.showToast({ title: t('aigc.publish.publishFail'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [
    validate,
    workType,
    textContent,
    params.contextId,
    title,
    desc,
    coverUrl,
    fileList,
    prompt,
    t,
  ])

  return (
    /* 对齐 RN shared AigcPublishScreen container(surface.light 明暗恒白在暗色下不可读,
       按语义修正为 var(--color-card);paddingHorizontal 10 → 20rpx) */
    <ThemeRoot className="min-h-screen bg-[var(--color-card)] flex flex-col">
      <ScrollView scrollY className="flex-1 box-border px-[20rpx] pt-[16rpx] pb-[32rpx]">
        <PublishForm
          workType={workType}
          files={fileList}
          maxFiles={MAX_FILES}
          urlInput={urlInput}
          textContent={textContent}
          title={title}
          description={desc}
          prompt={prompt}
          uploading={uploading}
          progress={uploadProgress}
          submitting={submitting}
          onWorkTypeChange={setWorkType}
          onUrlChange={setUrlInput}
          onAddByUrl={addByUrl}
          onPick={chooseFiles}
          onRemove={removeFile}
          onTextContentChange={setTextContent}
          onTitleChange={setTitle}
          onDescriptionChange={setDesc}
          onPromptChange={setPrompt}
          onSubmit={onSubmit}
        />
      </ScrollView>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
