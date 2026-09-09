// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Input, Textarea, Button, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { publishAigc, uploadByBase64 } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

interface UpFile {
  url: string
  type: 'image' | 'video' | 'audio'
}

const MAX_FILES = 5

export default function AigcPublish() {
  const { t } = useI18n()
  const router = useRouter()
  const params = useMemo(() => {
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
  }, [router.params.contextId, router.params.title, router.params.prompt, router.params.imgUrlList])
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
    /* 对齐 RN shared AigcPublishScreen container(surface.light 明暗恒白在暗色下不可读,
       按语义修正为 var(--color-card);paddingHorizontal 10 → 20rpx) */
    <ThemeRoot className="min-h-screen bg-[var(--color-card)] flex flex-col">
      <ScrollView scrollY className="flex-1 box-border px-[20rpx] pt-[16rpx] pb-[32rpx]">
        {/* 对齐 RN title(22dp → 44rpx semibold) */}
        <Text className="block mt-[16rpx] text-[44rpx] font-semibold text-foreground">
          {t('aigc.publish.title')}
        </Text>

        {/* 对齐 RN label(marginTop 14 → 28rpx,14dp → 28rpx,text.secondary,marginBottom 6 → 12rpx) */}
        <Text className="block mt-[28rpx] mb-[12rpx] text-[28rpx] text-muted-foreground">
          {t('aigc.publish.workLabel')}
        </Text>
        {/* 对齐 RN fileGrid(gap 10 → 20rpx) */}
        <View className="flex flex-wrap gap-[20rpx]">
          {fileList.map((f, i) => (
            <View
              key={i}
              className="relative w-[152rpx] h-[152rpx] rounded-[24rpx] overflow-hidden bg-[var(--color-border)]"
            >
              <Image className="w-full h-full" src={f.url} mode="aspectFill" />
              {/* 对齐 RN fileRemove(44rpx 圆形,error 红底白 ×) */}
              <View
                className="absolute -top-[12rpx] -right-[12rpx] w-[44rpx] h-[44rpx] bg-[var(--color-danger)] rounded-full flex items-center justify-center"
                onClick={() => removeFile(i)}
                hoverClass="opacity-60">
                <Text className="text-[var(--color-surface-light)] text-[28rpx] font-bold leading-none">
                  ×
                </Text>
              </View>
            </View>
          ))}
          {fileList.length < MAX_FILES ? (
            /* 对齐 RN fileAdd(76dp → 152rpx,dashed border.light,bg muted) */
            <View
              className="w-[152rpx] h-[152rpx] bg-[var(--color-muted)] border-[2rpx] border-dashed border-[var(--color-border)] rounded-[24rpx] flex flex-col items-center justify-center"
              onClick={chooseImage}
              hoverClass="opacity-60">
              <Text className="text-[48rpx] text-[var(--color-text-tertiary)] leading-[52rpx]">
                +
              </Text>
              <Text className="text-[22rpx] text-[var(--color-text-tertiary)] mt-[16rpx]">
                {t('aigc.publish.addImage')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 标题:对齐 RN input(px 12 → 24rpx,py 10 → 20rpx,radius 24rpx,bg muted,16dp → 32rpx) */}
        <Text className="block mt-[28rpx] mb-[12rpx] text-[28rpx] text-muted-foreground">
          {t('aigc.publish.titleLabel')}
        </Text>
        <Input
          className="w-full h-[84rpx] bg-[var(--color-muted)] rounded-[24rpx] border-[2rpx] border-[var(--color-border)] px-[24rpx] text-[32rpx] text-foreground box-border"
          maxlength={50}
          placeholder={t('aigc.publish.titlePlaceholder')}
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
        />

        {/* 简介:对齐 RN textarea(minHeight 88 → 176rpx) */}
        <Text className="block mt-[28rpx] mb-[12rpx] text-[28rpx] text-muted-foreground">
          {t('aigc.publish.descLabel')}
        </Text>
        <Textarea
          className="w-full min-h-[176rpx] bg-[var(--color-muted)] rounded-[24rpx] border-[2rpx] border-[var(--color-border)] px-[24rpx] py-[20rpx] text-[32rpx] text-foreground box-border"
          placeholder={t('aigc.publish.descPlaceholder')}
          value={desc}
          onInput={(e) => setDesc(e.detail.value)}
        />

        {/* 提示词 */}
        <Text className="block mt-[28rpx] mb-[12rpx] text-[28rpx] text-muted-foreground">
          {t('aigc.publish.promptLabel')}
        </Text>
        <Textarea
          className="w-full min-h-[176rpx] bg-[var(--color-muted)] rounded-[24rpx] border-[2rpx] border-[var(--color-border)] px-[24rpx] py-[20rpx] text-[32rpx] text-foreground box-border"
          placeholder={t('aigc.publish.promptPlaceholder')}
          value={prompt}
          onInput={(e) => setPrompt(e.detail.value)}
        />

        {/* 对齐 RN submitBtn(marginTop 24 → 48rpx,py 14 → 28rpx,radius 24rpx;禁用态 bg text.tertiary) */}
        <Button
          className={`w-full text-[32rpx] font-semibold rounded-[24rpx] mt-[48rpx] ${
            submitting || uploading
              ? 'bg-[var(--color-text-tertiary)] text-[var(--color-surface-light)]'
              : 'bg-primary text-[var(--color-primary-foreground)]'
          }`}
          loading={submitting || uploading}
          disabled={submitting || uploading}
          onClick={onSubmit}
        >
          {t('aigc.publish.publish')}
        </Button>
        {/* 对齐 RN 底部占位(height 32 → 64rpx) */}
        <View className="h-[64rpx]" />
      </ScrollView>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
