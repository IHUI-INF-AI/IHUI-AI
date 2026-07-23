import { useEffect } from 'react'
import { useI18n } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
}

interface ShortcutItem {
  keys: string
  labelKey: string
}

interface ShortcutGroup {
  titleKey: string
  items: ShortcutItem[]
}

const GROUPS: ShortcutGroup[] = [
  {
    titleKey: 'shortcuts.groupChat',
    items: [
      { keys: 'Ctrl + Enter', labelKey: 'shortcuts.sendMessage' },
      { keys: 'Esc', labelKey: 'shortcuts.closeDialog' },
      { keys: '双击', labelKey: 'shortcuts.renameConversation' },
    ],
  },
  {
    titleKey: 'shortcuts.groupView',
    items: [
      { keys: 'Ctrl + =', labelKey: 'shortcuts.fontZoomIn' },
      { keys: 'Ctrl + -', labelKey: 'shortcuts.fontZoomOut' },
      { keys: 'Ctrl + 0', labelKey: 'shortcuts.fontReset' },
    ],
  },
  {
    titleKey: 'shortcuts.groupSystem',
    items: [
      { keys: 'Ctrl + /', labelKey: 'shortcuts.showHelp' },
      { keys: 'Ctrl + Shift + I', labelKey: 'shortcuts.devTools' },
    ],
  },
]

/** 快捷键帮助模态对话框:Ctrl + / 触发,Esc 关闭。 */
export default function ShortcutHelpDialog({ open, onClose }: Props) {
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="shortcut-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="shortcut-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-header">
          <h3>{t('shortcuts.title')}</h3>
          <button type="button" className="shortcut-close" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>
        <div className="shortcut-body">
          {GROUPS.map((group) => (
            <div key={group.titleKey} className="shortcut-group">
              <div className="shortcut-group-title">{t(group.titleKey)}</div>
              <ul className="shortcut-list">
                {group.items.map((item) => (
                  <li key={item.keys} className="shortcut-item">
                    <span className="shortcut-label">{t(item.labelKey)}</span>
                    <kbd className="shortcut-keys">{item.keys}</kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
