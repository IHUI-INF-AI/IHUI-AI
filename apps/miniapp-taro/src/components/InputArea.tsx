import { View, Text, Textarea, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import voiceRecorder from '@/utils/voice-recorder'
import { useI18n } from '@/i18n'

export interface InputAreaProps {
  value?: string
  placeholder?: string
  onSend?: (text: string) => void
  onVoicePress?: () => void
  onVoiceRelease?: (filePath: string) => void
  onUpload?: (files: string[]) => void
  disabled?: boolean
  maxLength?: number
  autoFocus?: boolean
}

const EMOJI_LIST = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '🤔', '😎',
  '😴', '😭', '😡', '👍', '👎', '👏', '🙏', '💪',
  '❤️', '🔥', '✨', '🎉', '🎁', '🌟', '💯', '✅',
]

type Mode = 'text' | 'voice'

export default function InputArea({
  value = '',
  placeholder,
  onSend,
  onVoicePress,
  onVoiceRelease,
  onUpload,
  disabled = false,
  maxLength = 500,
  autoFocus = false,
}: InputAreaProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState(value)
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)

  const handleInput = useCallback(
    (e: { detail: { value?: string } }) => {
      const v = (e.detail.value || '').slice(0, maxLength)
      setText(v)
    },
    [maxLength],
  )

  const handleSend = useCallback(() => {
    const v = text.trim()
    if (!v || disabled) return
    onSend?.(v)
    setText('')
    setShowEmoji(false)
  }, [text, disabled, onSend])

  const handleEmojiPick = useCallback((emoji: string) => {
    setText((prev) => (prev + emoji).slice(0, maxLength))
  }, [maxLength])

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'text' ? 'voice' : 'text'))
    setShowEmoji(false)
  }, [])

  const toggleEmoji = useCallback(() => {
    setShowEmoji((s) => !s)
    Taro.hideKeyboard()
  }, [])

  const handleUpload = useCallback(async () => {
    try {
      const imgRes = await Taro.chooseImage({ count: 9, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const files = Array.isArray(imgRes.tempFilePaths) ? imgRes.tempFilePaths : []
      if (files.length) onUpload?.(files)
    } catch (err) {
      const msg = String((err as { errMsg?: string })?.errMsg || '').toLowerCase()
      if (!msg.includes('cancel')) {
        try {
          const fileRes = await Taro.chooseMessageFile({ count: 9, type: 'file' })
          const files = (fileRes.tempFiles || []).map((f: { path: string }) => f.path)
          if (files.length) onUpload?.(files)
        } catch {
          /* 用户取消 */
        }
      }
    }
  }, [onUpload])

  const handleVoiceStart = useCallback(() => {
    if (disabled) return
    setRecording(true)
    voiceRecorder.init()
    voiceRecorder.startRecording()
    onVoicePress?.()
  }, [disabled, onVoicePress])

  const handleVoiceEnd = useCallback(async () => {
    if (!recording) return
    setRecording(false)
    const filePath = await voiceRecorder.stopRecording()
    onVoiceRelease?.(filePath)
  }, [recording, onVoiceRelease])

  const handleVoiceCancel = useCallback(() => {
    if (!recording) return
    setRecording(false)
    voiceRecorder.cancelRecording()
  }, [recording])

  const canSend = text.trim().length > 0 && !disabled

  return (
    <View className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 safe-area-bottom">
      {showEmoji ? (
        <ScrollView scrollY className="h-48 border-b border-gray-100 dark:border-gray-800">
          <View className="flex flex-wrap p-2">
            {EMOJI_LIST.map((e, i) => (
              <View
                key={i}
                className="w-11 h-11 flex items-center justify-center text-2xl active:bg-gray-100 dark:active:bg-gray-800"
                onClick={() => handleEmojiPick(e)}
              >
                <Text>{e}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      <View className="flex items-end px-3 py-2">
        <View className="flex items-center mr-2">
          <Text
            className={`w-9 h-9 leading-9 text-center text-xl rounded-full active:bg-gray-100 dark:active:bg-gray-800 ${mode === 'voice' ? 'text-green-600' : 'text-gray-500'}`}
            onClick={toggleMode}
          >
            {mode === 'text' ? '🎤' : '⌨️'}
          </Text>
        </View>

        {mode === 'text' ? (
          <View className="flex-1 min-h-10 bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-2">
            <Textarea
              className="w-full text-sm text-gray-800 dark:text-gray-100 bg-transparent"
              style={{ minHeight: '40rpx', maxHeight: '200rpx' }}
              value={text}
              placeholder={placeholder || t('ai.inputArea.placeholder')}
              placeholderClass="text-gray-400"
              maxlength={maxLength}
              autoFocus={autoFocus}
              autoHeight
              onInput={handleInput}
              onConfirm={handleSend}
              confirmType="send"
              cursorSpacing={20}
              adjustPosition
              disabled={disabled}
            />
            <View className="text-right text-xs text-gray-400 mt-1">
              <Text>{text.length}/{maxLength}</Text>
            </View>
          </View>
        ) : (
          <View
            className={`flex-1 min-h-10 mx-2 rounded-2xl flex items-center justify-center text-sm ${recording ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
            onTouchStart={handleVoiceStart}
            onTouchEnd={handleVoiceEnd}
            onTouchCancel={handleVoiceCancel}
          >
            <Text>{recording ? t('ai.inputArea.releaseToSend') : t('ai.inputArea.holdToSpeak')}</Text>
          </View>
        )}

        <View className="flex items-center ml-2">
          {mode === 'text' ? (
            <Text
              className={`w-9 h-9 leading-9 text-center text-xl rounded-full active:bg-gray-100 dark:active:bg-gray-800 ${showEmoji ? 'text-green-600' : 'text-gray-500'}`}
              onClick={toggleEmoji}
            >
              😊
            </Text>
          ) : null}
          <Text
            className="w-9 h-9 leading-9 text-center text-xl rounded-full ml-1 text-gray-500 active:bg-gray-100 dark:active:bg-gray-800"
            onClick={handleUpload}
          >
            📎
          </Text>
        </View>

        {mode === 'text' ? (
          <View
            className={`ml-2 px-4 h-9 leading-9 rounded-full text-sm ${canSend ? 'bg-green-600 text-white active:bg-green-700' : 'bg-gray-200 text-gray-400 dark:bg-gray-700'}`}
            onClick={handleSend}
          >
            <Text>{t('ai.inputArea.send')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
