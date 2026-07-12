import { View, Text, Input } from '@tarojs/components'
import { useState, useCallback } from 'react'

export interface InputAreaProps {
  value?: string
  placeholder?: string
  onSend?: (text: string) => void
  onVoicePress?: () => void
  onVoiceRelease?: () => void
  disabled?: boolean
  maxLength?: number
}

export default function InputArea({
  value: propValue = '',
  placeholder = '输入消息...',
  onSend,
  onVoicePress,
  onVoiceRelease,
  disabled = false,
  maxLength = 500,
}: InputAreaProps) {
  const [value, setValue] = useState(propValue)
  const [mode, setMode] = useState<'text' | 'voice'>('text')
  const [recording, setRecording] = useState(false)

  const handleInput = useCallback((e: { detail: { value: string } }) => {
    setValue(e.detail.value)
  }, [])

  const handleSend = useCallback(() => {
    const text = value.trim()
    if (!text || disabled) return
    onSend?.(text)
    setValue('')
  }, [value, disabled, onSend])

  const handleVoiceStart = useCallback(() => {
    if (disabled) return
    setRecording(true)
    onVoicePress?.()
  }, [disabled, onVoicePress])

  const handleVoiceEnd = useCallback(() => {
    setRecording(false)
    onVoiceRelease?.()
  }, [onVoiceRelease])

  const canSend = value.trim().length > 0 && !disabled

  return (
    <View className="flex items-end px-3 py-2 bg-white border-t border-gray-100">
      <View
        className="flex items-center justify-center w-9 h-9 mr-2 rounded-full bg-gray-50"
        onClick={() => setMode(mode === 'text' ? 'voice' : 'text')}
      >
        <Text className="text-lg">{mode === 'text' ? '🎤' : '⌨️'}</Text>
      </View>

      {mode === 'text' ? (
        <Input
          className="flex-1 min-h-[36px] px-3 py-1.5 text-sm rounded-lg bg-gray-50"
          type="text"
          value={value}
          placeholder={placeholder}
          maxlength={maxLength}
          disabled={disabled}
          onInput={handleInput}
          onConfirm={handleSend}
          confirmType="send"
        />
      ) : (
        <View
          className={`flex-1 h-9 flex items-center justify-center rounded-lg text-sm ${
            recording ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-600'
          }`}
          onTouchStart={handleVoiceStart}
          onTouchEnd={handleVoiceEnd}
          onTouchCancel={handleVoiceEnd}
        >
          <Text>{recording ? '松开 发送' : '按住 说话'}</Text>
        </View>
      )}

      {mode === 'text' && (
        <View
          className={`flex items-center justify-center w-9 h-9 ml-2 rounded-full ${
            canSend ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'
          }`}
          onClick={handleSend}
        >
          <Text className="text-sm">发送</Text>
        </View>
      )}
    </View>
  )
}
