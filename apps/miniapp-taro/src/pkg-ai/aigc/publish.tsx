// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/aigc-publish/AigcPublishScreen.tsx
// 薄壳化:页面只保留「状态 + 平台能力(选图/上传/提交)」,渲染统一走共享屏 AigcPublishScreen。
// 形制锁:渲染对齐共享屏 AigcPublishScreen(本页只做参数解析与平台能力注入,不另绘 UI)。
// 本端作品类型档收敛为 image/text 两档(视频/音频无选材与预览链路,不摆设);
// 文本档隐藏提示词输入 —— 本端文本正文走 problem 槽,再摆提示词口会让用户写下后无处落库。
// 平台事实 3 项(全部在宿主层,共享屏内零平台 API):
//   ① 选图 Taro.chooseImage  ② 读取本地文件 + 上传 uploadByBase64  ③ 提交 publishAigc

import { useI18n } from '@/i18n'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback, useMemo, useRef } from 'react'
import { useUiField } from '@/lib/ui-field-registry'
import { publishAigc, uploadByBase64 } from '@/api'
import { safeDecodeURIComponent } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
import { onToast } from '@/host/on-toast'
import { useTheme } from '@/rn-compat/theme'
import { AigcPublishScreen as SharedAigcPublishScreen } from '@ihui/rn-app/features/aigc-publish/AigcPublishScreen'
import type { AigcPublishFile, AigcPublishWorkType } from '@ihui/types'

const MAX_FILES = 5

/** 本端可用类型档:仅图片(素材上传链路)与文本(直写正文链路) */
const PUBLISH_WORK_TYPES: readonly AigcPublishWorkType[] = ['image', 'text']

export default function AigcPublish() {
  const { t } = useI18n()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const params = useMemo(() => {
    const ctxId = (router.params.contextId as string) || ''
    let prompt = ''
    if (router.params.title) prompt = safeDecodeURIComponent(router.params.title)
    if (router.params.prompt) prompt = safeDecodeURIComponent(router.params.prompt)
    const files: AigcPublishFile[] = []
    if (router.params.imgUrlList) {
      try {
        const arr = JSON.parse(safeDecodeURIComponent(router.params.imgUrlList)) as string[]
        ;(arr || []).forEach((u, i) => {
          if (u) files.push({ id: `param-${i}`, url: u })
        })
      } catch {
        // ignore
      }
    }
    return { contextId: ctxId, prompt, files }
  }, [router.params.contextId, router.params.title, router.params.prompt, router.params.imgUrlList])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [prompt, setPrompt] = useState(params.prompt)
  const [textContent, setTextContent] = useState('')
  // 类型档:image = 素材上传(既有链路),text = 用户直写正文(对齐共享屏 showTextInput 分支)
  const [workType, setWorkType] = useState<AigcPublishWorkType>('image')
  const [urlInput, setUrlInput] = useState('')
  const [fileList, setFileList] = useState<AigcPublishFile[]>(params.files)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  // XUI-066:发布失败曾被写死为空串传进共享屏,只剩一次性 toast,屏内无失败留痕。
  const [submitError, setSubmitError] = useState('')
  const seqRef = useRef(0)
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

  const makeFileId = useCallback((): string => {
    seqRef.current += 1
    return `up-${seqRef.current}`
  }, [])

  const coverUrl = useMemo(() => fileList[0]?.url || '', [fileList])

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
      onToast(t('aigc.publish.maxFiles'), { kind: 'info' })
      return
    }
    try {
      const res = await Taro.chooseImage({ count: slots, sourceType: ['album', 'camera'] })
      const paths = res.tempFilePaths || []
      if (!paths.length) return
      setUploading(true)
      setUploadProgress(0)
      const added: AigcPublishFile[] = []
      // 上传中词条带 {progress}:这里取「已完成张数 / 本次选材张数」的真实占比,不做估算动画
      for (let i = 0; i < paths.length; i++) {
        const path = paths[i]
        if (!path) continue
        const url = await uploadOne(path)
        if (url) added.push({ id: makeFileId(), url })
        setUploadProgress(Math.round(((i + 1) / paths.length) * 100))
      }
      if (added.length) {
        setFileList((prev) => [...prev, ...added])
        onToast(t('aigc.publish.uploadOk'), { kind: 'success' })
      } else {
        onToast(t('aigc.publish.uploadFail'), { kind: 'error' })
      }
    } catch {
      onToast(t('aigc.publish.uploadFail'), { kind: 'error' })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [uploading, fileList.length, uploadOne, makeFileId, t])

  /** 对齐 RN onAddFileByUrl:链接直填进素材位,与选图同一条提交链路 */
  const addByUrl = useCallback(() => {
    const url = urlInput.trim()
    if (!url) {
      onToast(t('aigcPublish.placeholderUrl'), { kind: 'info' })
      return
    }
    if (fileList.length >= MAX_FILES) {
      onToast(t('aigc.publish.maxFiles'), { kind: 'info' })
      return
    }
    setFileList((prev) => [...prev, { id: makeFileId(), url }])
    setUrlInput('')
  }, [urlInput, fileList.length, makeFileId, t])

  const removeFile = useCallback((id: string) => {
    setFileList((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const validate = useCallback((): boolean => {
    if (workType === 'text') {
      if (!textContent.trim()) {
        onToast(t('aigcPublish.placeholderTextContent'), { kind: 'info' })
        return false
      }
    } else if (fileList.length === 0) {
      onToast(t('aigc.publish.needFile'), { kind: 'info' })
      return false
    }
    if (!title.trim()) {
      onToast(t('aigc.publish.titleRequired'), { kind: 'info' })
      return false
    }
    if (!desc.trim()) {
      onToast(t('aigc.publish.descRequired'), { kind: 'info' })
      return false
    }
    if (workType !== 'text' && !prompt.trim()) {
      onToast(t('aigc.publish.promptRequired'), { kind: 'info' })
      return false
    }
    return true
  }, [workType, textContent, fileList.length, title, desc, prompt, t])

  const onSubmit = useCallback(async () => {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
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
      onToast(t('aigc.publish.published'), { kind: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch {
      setSubmitError(t('aigc.publish.publishFail'))
      onToast(t('aigc.publish.publishFail'), { kind: 'error' })
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
    <ThemeRoot className="min-h-screen bg-[var(--color-card)] flex flex-col">
      <SharedAigcPublishScreen
        t={t}
        workType={workType}
        files={fileList}
        textContent={textContent}
        title={title}
        description={desc}
        prompt={prompt}
        urlInput={urlInput}
        saving={submitting}
        uploading={uploading}
        uploadProgress={uploadProgress}
        error={submitError}
        onWorkTypeChange={setWorkType}
        onTextContentChange={setTextContent}
        onTitleChange={setTitle}
        onDescriptionChange={setDesc}
        onPromptChange={setPrompt}
        onUrlInputChange={setUrlInput}
        onAddFileByUrl={addByUrl}
        onPickImage={chooseFiles}
        onRemoveFile={removeFile}
        onSubmit={onSubmit}
        onBack={() => void Taro.navigateBack()}
        colorScheme={resolvedTheme}
        onToast={onToast}
        workTypes={PUBLISH_WORK_TYPES}
        showPromptField={workType !== 'text'}
      />
    </ThemeRoot>
  )
}
