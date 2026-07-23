import { View, Text, Textarea } from '@tarojs/components'
import { useState } from 'react'
import { useI18n } from '@/i18n'

export interface NoteEditorProps {
  visible?: boolean
  initialContent?: string
  title?: string
  onSave?: (content: string) => void
  onCancel?: () => void
}

export default function NoteEditor({
  visible = false,
  initialContent = '',
  title = '学习笔记',
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent)

  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  if (!visible) return null

  return (
    <View className="fixed inset-0 z-50 flex items-end" onClick={onCancel}>
      <View className="absolute inset-0 bg-black/40" />
      <View
        className="relative bg-card rounded-t-2xl w-full px-4 pb-6 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <View className="flex items-center justify-between mb-3">
          <Text className="text-sm font-medium text-foreground">{tt('study.noteTitle', title)}</Text>
          <Text className="text-sm text-muted-foreground" onClick={onCancel}>
            {tt('study.noteClose', '关闭')}
          </Text>
        </View>

        <Textarea
          className="w-full px-3 py-2 text-sm bg-muted rounded-lg"
          style={{ minHeight: '180px' }}
          placeholder={tt('study.notePlaceholder', '记录你的学习心得...')}
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          maxlength={-1}
        />

        <View className="flex justify-between items-center mt-3">
          <Text className="text-xs text-muted-foreground">{content.length} {tt('study.noteCountUnit', '字')}</Text>
          <View className="flex space-x-2">
            <View className="px-4 py-2 rounded-md bg-muted" onClick={onCancel}>
              <Text className="text-sm text-foreground">{tt('common.cancel', '取消')}</Text>
            </View>
            <View className="px-4 py-2 rounded-md bg-primary" onClick={() => onSave?.(content)}>
              <Text className="text-sm text-white">{tt('common.save', '保存')}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
