'use client'

import * as React from 'react'
import { Mic } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
}

function getRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const t = useTranslations('chat')
  const [recording, setRecording] = React.useState(false)
  const [supported, setSupported] = React.useState(true)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = React.useRef('')

  React.useEffect(() => {
    const Ctor = getRecognitionConstructor()
    if (!Ctor) {
      setSupported(false)
      return
    }
    const recognition = new Ctor()
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i]?.[0]?.transcript ?? ''
      }
      transcriptRef.current = text
    }
    recognition.onerror = () => {
      setRecording(false)
    }
    recognition.onend = () => {
      setRecording(false)
      if (transcriptRef.current) {
        onTranscript(transcriptRef.current)
        transcriptRef.current = ''
      }
    }
    recognitionRef.current = recognition
    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.stop()
      } catch {
        // ignore
      }
    }
  }, [onTranscript])

  const toggle = () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (recording) {
      recognition.stop()
      setRecording(false)
    } else {
      transcriptRef.current = ''
      recognition.start()
      setRecording(true)
    }
  }

  if (!supported) return null

  return (
    <>
      <style>{`
        @keyframes voice-wave {
          from { transform: scaleY(0.3); }
          to { transform: scaleY(1); }
        }
      `}</style>
      <Tooltip content={recording ? t('voiceInputStop') : t('voiceInputStart')}>
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-label={recording ? t('voiceInputStop') : t('voiceInputStart')}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
            recording
              ? 'bg-red-500 text-white hover:bg-red-500/90'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {recording ? (
            <span className="flex h-4 items-center gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={`bar-${i}`}
                  className="w-0.5 rounded-full bg-white"
                  style={{
                    height: '100%',
                    transformOrigin: 'center',
                    animation: `voice-wave 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                  }}
                />
              ))}
            </span>
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>
      </Tooltip>
    </>
  )
}

export default VoiceInput
