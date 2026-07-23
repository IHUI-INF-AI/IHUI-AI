import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'

interface Props {
  /** 选择短语后回调,把短语内容插入到输入框 */
  onPick: (text: string) => void
  /** 是否禁用(流式生成时禁用) */
  disabled?: boolean
}

interface PromptItem {
  /** i18n key,值是短语内容 */
  contentKey: string
  /** i18n key,值是短语标题 */
  labelKey: string
}

interface PromptGroup {
  /** i18n key,值是分组标题 */
  titleKey: string
  items: PromptItem[]
}

const GROUPS: PromptGroup[] = [
  {
    titleKey: 'prompts.groupStart',
    items: [
      { labelKey: 'prompts.greetLabel', contentKey: 'prompts.greetContent' },
      { labelKey: 'prompts.introduceLabel', contentKey: 'prompts.introduceContent' },
    ],
  },
  {
    titleKey: 'prompts.groupCode',
    items: [
      { labelKey: 'prompts.explainCodeLabel', contentKey: 'prompts.explainCodeContent' },
      { labelKey: 'prompts.reviewCodeLabel', contentKey: 'prompts.reviewCodeContent' },
      { labelKey: 'prompts.refactorLabel', contentKey: 'prompts.refactorContent' },
    ],
  },
  {
    titleKey: 'prompts.groupWrite',
    items: [
      { labelKey: 'prompts.summarizeLabel', contentKey: 'prompts.summarizeContent' },
      { labelKey: 'prompts.translateLabel', contentKey: 'prompts.translateContent' },
      { labelKey: 'prompts.expandLabel', contentKey: 'prompts.expandContent' },
    ],
  },
]

export default function PromptTemplates({ onPick, disabled }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const onPickItem = (contentKey: string) => {
    const text = t(contentKey)
    onPick(text)
    setOpen(false)
  }

  return (
    <div className="prompt-templates" ref={wrapRef}>
      <button
        type="button"
        className="prompt-templates-btn"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label={t('prompts.title')}
        title={t('prompts.title')}
      >
        ✨
      </button>
      {open ? (
        <div className="prompt-templates-menu" onClick={(e) => e.stopPropagation()}>
          <div className="prompt-templates-header">{t('prompts.title')}</div>
          {GROUPS.map((g) => (
            <div key={g.titleKey} className="prompt-templates-group">
              <div className="prompt-templates-group-title">{t(g.titleKey)}</div>
              <ul className="prompt-templates-list">
                {g.items.map((item) => (
                  <li key={item.labelKey}>
                    <button
                      type="button"
                      className="prompt-templates-item"
                      onClick={() => onPickItem(item.contentKey)}
                    >
                      <span className="prompt-templates-item-label">{t(item.labelKey)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
