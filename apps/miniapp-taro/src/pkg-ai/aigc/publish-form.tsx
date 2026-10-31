// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/aigc-publish/AigcPublishScreen.tsx
// 发布页的表单体(title → subtitle → 类型 → 内容区 → 标题/简介/提示词 → 提交),
// 顺序与共享屏同一层级;状态与提交仍归宿主页,这里只负责渲染。
import { View, Text, Button } from '@tarojs/components'
import { useI18n } from '@/i18n'
import { FocusInput, FocusTextarea } from '@/components/FocusField'
import {
  PublishTypeChips,
  PublishTextSection,
  PublishMediaSection,
  LABEL_CLASS,
  FIELD_CLASS,
  type PublishWorkType,
  type UpFile,
} from './publish-sections'

interface PublishFormProps {
  workType: PublishWorkType
  files: UpFile[]
  maxFiles: number
  urlInput: string
  textContent: string
  title: string
  description: string
  prompt: string
  uploading: boolean
  progress: number
  submitting: boolean
  onWorkTypeChange: (next: PublishWorkType) => void
  onUrlChange: (next: string) => void
  onAddByUrl: () => void
  onPick: () => void
  onRemove: (index: number) => void
  onTextContentChange: (next: string) => void
  onTitleChange: (next: string) => void
  onDescriptionChange: (next: string) => void
  onPromptChange: (next: string) => void
  onSubmit: () => void
}

export function PublishForm(props: PublishFormProps) {
  const { t } = useI18n()
  const busy = props.submitting || props.uploading
  return (
    <>
      {/* 对齐 RN title(22dp → 44rpx semibold)/ subtitle(body,text.secondary) */}
      <Text className="block mt-[16rpx] text-[length:44rpx] font-semibold text-foreground">
        {t('aigc.publish.title')}
      </Text>
      <Text className="block mt-[16rpx] text-body text-muted-foreground">
        {t('aigcPublish.subtitle')}
      </Text>

      <PublishTypeChips workType={props.workType} onChange={props.onWorkTypeChange} />

      {props.workType === 'text' ? (
        <PublishTextSection value={props.textContent} onChange={props.onTextContentChange} />
      ) : (
        <PublishMediaSection
          files={props.files}
          maxFiles={props.maxFiles}
          urlInput={props.urlInput}
          uploading={props.uploading}
          progress={props.progress}
          onUrlChange={props.onUrlChange}
          onAddByUrl={props.onAddByUrl}
          onPick={props.onPick}
          onRemove={props.onRemove}
        />
      )}

      {/* 标题:对齐 RN input(px 12 → 24rpx,py 10 → 20rpx,radius 24rpx,bg muted,16dp → 32rpx) */}
      <Text className={LABEL_CLASS}>{t('aigc.publish.titleLabel')}</Text>
      <FocusInput
        className={`${FIELD_CLASS} h-[84rpx]`}
        maxlength={50}
        placeholder={t('aigcPublish.placeholderTitle')}
        value={props.title}
        onInput={(e) => props.onTitleChange(e.detail.value)}
      />

      {/* 简介:对齐 RN textarea(minHeight 88 → 176rpx) */}
      <Text className={LABEL_CLASS}>{t('aigc.publish.descLabel')}</Text>
      <FocusTextarea
        className={`${FIELD_CLASS} min-h-[176rpx] py-[20rpx]`}
        placeholder={t('aigcPublish.placeholderDescription')}
        value={props.description}
        onInput={(e) => props.onDescriptionChange(e.detail.value)}
      />

      {/* 提示词(仅素材档;文本档的正文即作品本身,提交映射见宿主页 onSubmit) */}
      {props.workType === 'text' ? null : (
        <>
          <Text className={LABEL_CLASS}>{t('aigc.publish.promptLabel')}</Text>
          <FocusTextarea
            className={`${FIELD_CLASS} min-h-[176rpx] py-[20rpx]`}
            placeholder={t('aigcPublish.placeholderPrompt')}
            value={props.prompt}
            onInput={(e) => props.onPromptChange(e.detail.value)}
          />
        </>
      )}

      {/* 对齐 RN submitBtn(marginTop 24 → 48rpx,py 14 → 28rpx,radius 24rpx;禁用态 bg text.tertiary) */}
      <Button
        className={`w-full text-[length:32rpx] font-semibold rounded-sm mt-[48rpx] ${
          busy
            ? 'bg-[var(--color-text-tertiary)] text-[var(--color-surface-light)]'
            : 'bg-primary text-[var(--color-primary-foreground)]'
        }`}
        loading={busy}
        disabled={busy}
        onClick={props.onSubmit}
      >
        {t('aigc.publish.publish')}
      </Button>
      {/* 对齐 RN 底部占位(height 32 → 64rpx) */}
      <View className="h-[64rpx]" />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
