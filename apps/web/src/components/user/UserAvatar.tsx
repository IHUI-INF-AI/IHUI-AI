'use client'

import * as React from 'react'
import Image from 'next/image'
import { Camera, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UserAvatarProps {
  src?: string
  name?: string
  size?: number
  editable?: boolean
  uploading?: boolean
  onUpload?: (file: File) => void | Promise<void>
  className?: string
}

export default function UserAvatar({
  src,
  name,
  size = 80,
  editable = false,
  uploading = false,
  onUpload,
  className,
}: UserAvatarProps): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onUpload) void onUpload(file)
    e.target.value = ''
  }

  return (
    <div
      className={cn('group relative inline-block overflow-hidden rounded-full bg-muted', className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={name ?? 'avatar'}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-muted-foreground"
          style={{ fontSize: size / 3 }}
        >
          {name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
      )}
      {editable && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="上传头像"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </div>
  )
}
