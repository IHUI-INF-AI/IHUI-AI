// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * AiStyleCard — AI 回复风格(2026-11-15 立)
 *
 * 偏好不直接写进 systemPrompt 存储(那会覆盖用户已有自定义提示词),
 * 而是在发送时由 buildAiStyleDirective 编译成一段「风格要求」追加在自定义 prompt 之后。
 * 卡片底部实时展示将要追加的文本 —— 用户看到什么,模型就收到什么。
 */

import { useTranslations } from 'next-intl'
import { Copy, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@ihui/ui-react'
import { buildAiStyleDirective } from '@/lib/ai-style-directive'
import { useAppearanceStore } from '@/stores/appearance-settings'

import { OptionGrid, SectionCard, ToggleField } from './controls'

/** 三处 textarea 共用同一套外观,不重复写 class */
const TEXTAREA_CLASS =
  'w-full resize-y rounded-sm border bg-transparent px-3 py-2 text-body outline-hidden focus-visible:ring-2 focus-visible:ring-ring'

export function AiStyleCard() {
  const t = useTranslations('appearanceSettings')
  const config = useAppearanceStore()
  const directive = buildAiStyleDirective(config)

  return (
    <SectionCard
      icon={Sparkles}
      title={t('aiStyleTitle')}
      desc={t('aiStyleDesc')}
      testId="appearance-ai-style"
    >
      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('tone')}</span>
        <OptionGrid
          value={config.tone}
          onChange={(tone) => config.update({ tone })}
          ariaLabel={t('tone')}
          columns={3}
          testIdPrefix="appearance-tone"
          options={[
            { value: 'default', label: t('toneDefault') },
            { value: 'professional', label: t('toneProfessional') },
            { value: 'friendly', label: t('toneFriendly') },
            { value: 'humorous', label: t('toneHumorous') },
            { value: 'concise', label: t('toneConcise') },
            { value: 'academic', label: t('toneAcademic') },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-body font-medium">{t('aiLanguage')}</span>
          <OptionGrid
            value={config.aiLanguage}
            onChange={(aiLanguage) => config.update({ aiLanguage })}
            ariaLabel={t('aiLanguage')}
            columns={2}
            testIdPrefix="appearance-ai-language"
            options={[
              { value: 'auto', label: t('langAuto') },
              { value: 'zh-CN', label: t('langZhCN') },
              { value: 'en', label: t('langEn') },
              { value: 'zh-TW', label: t('langZhTW') },
              { value: 'ja', label: t('langJa') },
              { value: 'ko', label: t('langKo') },
            ]}
          />
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-body font-medium">{t('aiLength')}</span>
            <OptionGrid
              value={config.aiLength}
              onChange={(aiLength) => config.update({ aiLength })}
              ariaLabel={t('aiLength')}
              columns={3}
              testIdPrefix="appearance-ai-length"
              options={[
                { value: 'short', label: t('lengthShort') },
                { value: 'medium', label: t('lengthMedium') },
                { value: 'long', label: t('lengthLong') },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-body font-medium">{t('explainDepth')}</span>
            <OptionGrid
              value={config.explainDepth}
              onChange={(explainDepth) => config.update({ explainDepth })}
              ariaLabel={t('explainDepth')}
              columns={3}
              testIdPrefix="appearance-explain-depth"
              options={[
                { value: 'beginner', label: t('depthBeginner') },
                { value: 'standard', label: t('depthStandard') },
                { value: 'expert', label: t('depthExpert') },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('aiFormat')}</span>
        <OptionGrid
          value={config.aiFormat}
          onChange={(aiFormat) => config.update({ aiFormat })}
          ariaLabel={t('aiFormat')}
          columns={5}
          testIdPrefix="appearance-ai-format"
          options={[
            { value: 'auto', label: t('formatAuto') },
            { value: 'list', label: t('formatList') },
            { value: 'table', label: t('formatTable') },
            { value: 'paragraph', label: t('formatParagraph') },
            { value: 'minimal', label: t('formatMinimal') },
          ]}
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('emojiPolicy')}</span>
        <OptionGrid
          value={config.emojiPolicy}
          onChange={(emojiPolicy) => config.update({ emojiPolicy })}
          ariaLabel={t('emojiPolicy')}
          columns={3}
          testIdPrefix="appearance-emoji-policy"
          options={[
            { value: 'auto', label: t('emojiAuto') },
            { value: 'none', label: t('emojiNone') },
            { value: 'minimal', label: t('emojiMinimal') },
          ]}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body font-medium">{t('customStyle')}</span>
          <span className="shrink-0 text-label tabular-nums text-muted-foreground">
            {config.customStyle.length}/500
          </span>
        </div>
        <textarea
          value={config.customStyle}
          maxLength={500}
          rows={3}
          placeholder={t('customStylePlaceholder')}
          onChange={(event) => config.update({ customStyle: event.target.value })}
          aria-label={t('customStyle')}
          data-testid="appearance-custom-style"
          className={TEXTAREA_CLASS}
        />
        <p className="text-[11px] leading-snug text-muted-foreground">{t('customStyleHint')}</p>
      </div>

      <div className="space-y-3 border-t pt-3">
        <ToggleField
          label={t('followQuestionLanguage')}
          hint={t('followQuestionLanguageHint')}
          checked={config.followQuestionLanguage}
          onCheckedChange={(followQuestionLanguage) => config.update({ followQuestionLanguage })}
          testId="appearance-follow-question-language"
        />
        <ToggleField
          label={t('chineseSpacing')}
          hint={t('chineseSpacingHint')}
          checked={config.chineseSpacing}
          onCheckedChange={(chineseSpacing) => config.update({ chineseSpacing })}
          testId="appearance-chinese-spacing"
        />
        <ToggleField
          label={t('fullWidthPunctuation')}
          hint={t('fullWidthPunctuationHint')}
          checked={config.fullWidthPunctuation}
          onCheckedChange={(fullWidthPunctuation) => config.update({ fullWidthPunctuation })}
          testId="appearance-full-width-punctuation"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body font-medium">{t('glossary')}</span>
          <span className="shrink-0 text-label tabular-nums text-muted-foreground">
            {config.glossary.length}/800
          </span>
        </div>
        <textarea
          value={config.glossary}
          maxLength={800}
          rows={3}
          placeholder={t('glossaryPlaceholder')}
          onChange={(event) => config.update({ glossary: event.target.value })}
          aria-label={t('glossary')}
          data-testid="appearance-glossary"
          className={TEXTAREA_CLASS}
        />
        <p className="text-[11px] leading-snug text-muted-foreground">{t('glossaryHint')}</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body font-medium">{t('bannedWords')}</span>
          <span className="shrink-0 text-label tabular-nums text-muted-foreground">
            {config.bannedWords.length}/400
          </span>
        </div>
        <textarea
          value={config.bannedWords}
          maxLength={400}
          rows={2}
          placeholder={t('bannedWordsPlaceholder')}
          onChange={(event) => config.update({ bannedWords: event.target.value })}
          aria-label={t('bannedWords')}
          data-testid="appearance-banned-words"
          className={TEXTAREA_CLASS}
        />
        <p className="text-[11px] leading-snug text-muted-foreground">{t('bannedWordsHint')}</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-body font-medium">{t('directivePreview')}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!directive}
            onClick={() => {
              void navigator.clipboard
                .writeText(directive)
                .then(() => toast.success(t('copyDirectiveSuccess')))
                .catch(() => toast.error(t('copyDirectiveFailed')))
            }}
            data-testid="appearance-copy-directive"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('copyDirective')}
          </Button>
        </div>
        <pre
          className="max-h-48 overflow-auto whitespace-pre-wrap rounded-sm border bg-muted/30 p-3 font-mono text-[12px] leading-relaxed text-muted-foreground"
          data-testid="appearance-directive-preview"
        >
          {directive || t('directiveEmpty')}
        </pre>
      </div>
    </SectionCard>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
