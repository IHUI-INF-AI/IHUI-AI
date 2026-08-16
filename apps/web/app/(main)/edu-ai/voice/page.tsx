'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Mic, Phone, PhoneOff } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
import { Alert } from '@/components/feedback'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui-react'

interface SessionResponse {
  sessionId: string
  status: string
}

interface SignalResponse {
  sessionId: string
  status?: string
  delivered?: boolean
}

type CallStatus = 'idle' | 'pending' | 'ringing' | 'connected' | 'ended'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function VoicePage() {
  const t = useTranslations('eduAi.voice')

  const [calleeId, setCalleeId] = React.useState('')
  const [status, setStatus] = React.useState<CallStatus>('idle')
  const [errorMsg, setErrorMsg] = React.useState('')

  const audioRef = React.useRef<HTMLAudioElement>(null)
  const pcRef = React.useRef<RTCPeerConnection | null>(null)
  const sessionIdRef = React.useRef<string | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  const cleanup = React.useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    sessionIdRef.current = null
  }, [])

  React.useEffect(() => cleanup, [cleanup])

  const startCall = useMutation({
    mutationFn: async (id: string) => {
      setErrorMsg('')

      // 1. Request microphone access
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        throw new Error(t('microphoneError'))
      }
      streamRef.current = stream

      // 2. Create RTCPeerConnection and wire up handlers
      const pc = new RTCPeerConnection()
      pcRef.current = pc
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      pc.ontrack = (e: RTCTrackEvent) => {
        if (audioRef.current && e.streams[0]) {
          audioRef.current.srcObject = e.streams[0]
        }
      }

      pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
        if (e.candidate && sessionIdRef.current) {
          api<SignalResponse>('/api/webrtc-voice/ice-candidate', {
            method: 'POST',
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              candidate: e.candidate.toJSON(),
            }),
          }).catch(() => {})
        }
      }

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState
        if (state === 'connected') setStatus('connected')
        else if (state === 'disconnected' || state === 'failed') setStatus('ended')
      }

      // 3. Create SDP offer and set as local description
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 4. Create voice session via signaling server
      const session = await api<SessionResponse>('/api/webrtc-voice/session', {
        method: 'POST',
        body: JSON.stringify({ calleeId: id, offer }),
      })
      sessionIdRef.current = session.sessionId
      setStatus('pending')

      // 5. Send offer to signaling server
      const res = await api<SignalResponse>('/api/webrtc-voice/offer', {
        method: 'POST',
        body: JSON.stringify({ sessionId: session.sessionId, offer }),
      })
      if (res.status) setStatus(res.status as CallStatus)

      return session
    },
    onError: (err: Error) => {
      setErrorMsg(err.message)
      cleanup()
      setStatus('idle')
    },
  })

  const endCall = useMutation({
    mutationFn: async () => {
      const sid = sessionIdRef.current
      if (!sid) return
      await api<SignalResponse>('/api/webrtc-voice/end', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sid }),
      })
    },
    onSettled: () => {
      setStatus('ended')
      cleanup()
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const id = calleeId.trim()
    if (!id) return
    startCall.mutate(id)
  }

  const isCallActive = status === 'pending' || status === 'ringing' || status === 'connected'

  const statusText =
    status === 'pending' || status === 'ringing'
      ? t('calling')
      : status === 'connected'
        ? t('connected')
        : status === 'ended'
          ? t('ended')
          : t('noActiveCall')

  return (
    <div className="space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Phone className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4 text-primary" />
            {t('startCall')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calleeId">{t('calleeId')}</Label>
              <Input
                id="calleeId"
                value={calleeId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCalleeId(e.target.value)}
                className="h-9"
                placeholder={t('calleeIdHint')}
                disabled={isCallActive}
              />
            </div>

            {errorMsg && <Alert variant="danger" title={t('callError')} description={errorMsg} />}

            {!isCallActive && (
              <Button type="submit" disabled={startCall.isPending || !calleeId.trim()}>
                {startCall.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {startCall.isPending ? t('calling') : t('submitCall')}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {(isCallActive || status === 'ended') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-primary" />
              {statusText}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- 实时语音流,无预录媒体文件 */}
            <audio ref={audioRef} autoPlay className="hidden" />
            {isCallActive && (
              <Button
                variant="destructive"
                onClick={() => endCall.mutate()}
                disabled={endCall.isPending}
              >
                {endCall.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <PhoneOff className="mr-1.5 h-4 w-4" />
                )}
                {t('endCall')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
