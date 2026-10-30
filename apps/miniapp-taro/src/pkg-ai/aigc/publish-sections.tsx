// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/aigc-publish/AigcPublishScreen.tsx
// 发布页拆出的展示块(类型选择 / 素材区 / 文本区)。文案一律取共享屏那套键(aigcPublish.*),
// 取词都落在本文件的 t('…') 字面量里,宿主页只负责状态与提交。
import { View, Text, Image } from '@tarojs/components'
import { useI18n } from '@/i18n'
import { FocusInput, FocusTextarea } from '@/components/FocusField'

/** 作品类型:本端只提供「图片」与「文本」两档 —— 前者走既有素材上传链路,
    后者由用户直写正文(见宿主页 onSubmit 的 problem 映射);视频/音频本端无选材与预览链路,不摆设。 */
export type PublishWorkType = 'image' | 'text'

export interface UpFile {
  url: string
  type: 'image' | 'video' | 'audio'
}

/** 标签 / 输入框的类名:同页三处表单块共用一份,避免各写一份字面量 */
export const LABEL_CLASS = 'block mt-[28rpx] mb-[12rpx] text-[length:28rpx] text-muted-foreground'
export const FIELD_CLASS =
  'w-full bg-[var(--color-muted)] rounded-sm border-[length:2rpx] border-[var(--color-border)] px-[24rpx] text-[length:32rpx] text-foreground box-border'

/** 对齐 RN typeRow:类型 chips(共享屏四档,本端只给可用的两档,档名复用端内既有的作品分类词条) */
export function PublishTypeChips({
  workType,
  onChange,
}: {
  workType: PublishWorkType
  onChange: (next: PublishWorkType) => void
}) {
  const { t } = useI18n()
  const options: { key: PublishWorkType; label: string }[] = [
    { key: 'image', label: t('aigc.list.catImage') },
    { key: 'text', label: t('aigc.list.catText') },
  ]
  return (
    <View>
      <Text className={LABEL_CLASS}>{t('aigcPublish.labelType')}</Text>
      <View className="flex flex-row gap-[16rpx]">
        {options.map((opt) => (
          <View
            key={opt.key}
            className={`flex-1 h-[72rpx] rounded-sm flex items-center justify-center ${
              workType === opt.key
                ? 'bg-primary text-[var(--color-primary-foreground)]'
                : 'bg-[var(--color-muted)] text-foreground'
            }`}
            onClick={() => onChange(opt.key)}
            hoverClass="opacity-60"
          >
            <Text className="text-[length:28rpx] font-semibold">{opt.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/** 文本作品正文(对齐 RN showTextInput 分支:labelTextContent + placeholderTextContent) */
export function PublishTextSection({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const { t } = useI18n()
  return (
    <View>
      <Text className={LABEL_CLASS}>{t('aigcPublish.labelTextContent')}</Text>
      <FocusTextarea
        className={`${FIELD_CLASS} min-h-[240rpx] py-[20rpx]`}
        maxlength={2000}
        placeholder={t('aigcPublish.placeholderTextContent')}
        value={value}
        onInput={(e) => onChange(e.detail.value)}
      />
    </View>
  )
}

interface MediaSectionProps {
  files: UpFile[]
  maxFiles: number
  urlInput: string
  uploading: boolean
  /** 已完成的文件数占比(真实进度:选材总数 → 逐个上传完成),上传中按此渲染 uploading 词条 */
  progress: number
  onUrlChange: (next: string) => void
  onAddByUrl: () => void
  onPick: () => void
  onRemove: (index: number) => void
}

/**
 * 素材区(对齐 RN labelUpload / urlRow / pickerBtn / fileGrid 四块)。
 * 描边一律取中性档(border-border),品牌色只做实底 —— §4「描边不得取墨档」。
 */
export function PublishMediaSection({
  files,
  maxFiles,
  urlInput,
  uploading,
  progress,
  onUrlChange,
  onAddByUrl,
  onPick,
  onRemove,
}: MediaSectionProps) {
  const { t } = useI18n()
  return (
    <View>
      <Text className={LABEL_CLASS}>{t('aigcPublish.labelUpload', { count: files.length })}</Text>
      <View className="flex flex-row items-center gap-[16rpx] mb-[20rpx]">
        <FocusInput
          className={`${FIELD_CLASS} flex-1 h-[76rpx]`}
          placeholder={t('aigcPublish.placeholderUrl')}
          value={urlInput}
          onInput={(e) => onUrlChange(e.detail.value)}
        />
        <View
          className="h-[76rpx] px-[24rpx] bg-primary rounded-sm flex items-center justify-center"
          onClick={onAddByUrl}
          hoverClass="opacity-60"
        >
          <Text className="text-[length:28rpx] font-semibold text-[var(--color-primary-foreground)]">
            {t('aigcPublish.urlAddBtn')}
          </Text>
        </View>
      </View>
      <View
        className="h-[84rpx] rounded-sm border-[length:2rpx] border-[var(--color-border)] bg-card flex items-center justify-center mb-[20rpx]"
        onClick={onPick}
        hoverClass="opacity-60"
      >
        <Text className="text-[length:28rpx] font-semibold text-foreground">
          {uploading ? t('aigcPublish.uploading', { progress }) : t('aigcPublish.pickFromAlbum')}
        </Text>
      </View>
      <View className="flex flex-wrap gap-[20rpx]">
        {files.map((f, i) => (
          <View
            key={`${f.url}-${i}`}
            className="relative w-[152rpx] h-[152rpx] rounded-xl overflow-hidden bg-[var(--color-border)]"
          >
            <Image className="w-full h-full" src={f.url} mode="aspectFill" />
            {/* 对齐 RN fileRemove(44rpx 圆形,error 红底白 ×) */}
            <View
              className="absolute -top-[12rpx] -right-[12rpx] w-[44rpx] h-[44rpx] bg-[var(--color-danger)] rounded-full flex items-center justify-center"
              onClick={() => onRemove(i)}
              hoverClass="opacity-60"
            >
              <Text className="text-[var(--color-surface-light)] text-[length:28rpx] font-bold leading-none">
                ×
              </Text>
            </View>
          </View>
        ))}
        {files.length < maxFiles ? (
          /* 对齐 RN fileAdd(76dp → 152rpx,dashed 中性描边,bg muted) */
          <View
            className="w-[152rpx] h-[152rpx] bg-[var(--color-muted)] border-[length:2rpx] border-dashed border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center"
            onClick={onPick}
            hoverClass="opacity-60"
          >
            <Text className="text-[length:48rpx] text-[var(--color-text-tertiary)] leading-[52rpx]">
              +
            </Text>
            <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)] mt-[16rpx]">
              {uploading ? t('aigcPublish.uploadingShort') : t('aigcPublish.fileAddText')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
