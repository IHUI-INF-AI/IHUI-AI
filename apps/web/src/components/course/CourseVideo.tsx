'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { PlayCircle } from 'lucide-react'
import Image from 'next/image'
import { LivePlayer } from '@/components/media/LivePlayer'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

interface CourseVideoProps {
  src?: string
  poster?: string
  title?: string
  courseId?: string
  chapterId?: string
  className?: string
}

const UPLOAD_INTERVAL_MS = 5000

export function CourseVideo({
  src,
  poster,
  title,
  courseId,
  chapterId,
  className,
}: CourseVideoProps) {
  const t = useTranslations('course.video')
  const latestRef = React.useRef<{ currentTime: number; duration: number }>({
    currentTime: 0,
    duration: 0,
  })

  const handleTimeUpdate = React.useCallback((currentTime: number, duration: number) => {
    latestRef.current = { currentTime, duration }
  }, [])

  React.useEffect(() => {
    if (!src || !courseId || !chapterId) return
    const timer = setInterval(() => {
      const { currentTime, duration } = latestRef.current
      void fetchApi('/api/edu/learn-record', {
        method: 'POST',
        body: JSON.stringify({ courseId, chapterId, currentTime, duration }),
      })
    }, UPLOAD_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [src, courseId, chapterId])

  if (src) {
    return (
      <div className={cn('overflow-hidden rounded-lg bg-black', className)}>
        <LivePlayer
          src={src}
          poster={poster}
          className="aspect-video w-full"
          onTimeUpdate={handleTimeUpdate}
        />
      </div>
    )
  }
  return (
    <div
      className={cn(
        'relative flex aspect-video flex-col items-center justify-center gap-3 overflow-hidden rounded-lg bg-gradient-to-br from-primary/15 to-primary/5',
        className,
      )}
    >
      {poster && (
        <Image src={poster} alt={title ?? t('cover')} fill className="object-cover opacity-50" />
      )}
      <PlayCircle className="relative h-16 w-16 text-primary/50" />
      <p className="relative text-sm text-white/90 drop-shadow">{t('selectChapter')}</p>
    </div>
  )
}
