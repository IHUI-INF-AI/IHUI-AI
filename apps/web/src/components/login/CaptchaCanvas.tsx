'use client'

import * as React from 'react'
import { RefreshCw } from 'lucide-react'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * 图形验证码：纯前端 Canvas 绘制随机字符 + 干扰线/点。
 * 通过 onVerify 回调把「输入是否匹配」同步给父组件。
 */
export function CaptchaCanvas({
  value,
  onVerify,
  width = 120,
  height = 40,
}: {
  value: string
  onVerify: (ok: boolean) => void
  width?: number
  height?: number
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const answerRef = React.useRef('')

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 生成 4 位验证码
    let code = ''
    for (let i = 0; i < 4; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
    answerRef.current = code

    // 背景
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, width, height)

    // 干扰线
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `hsl(${Math.random() * 360}, 60%, 70%)`
      ctx.beginPath()
      ctx.moveTo(Math.random() * width, Math.random() * height)
      ctx.lineTo(Math.random() * width, Math.random() * height)
      ctx.stroke()
    }

    // 字符
    const colors = ['#2563eb', '#db2777', '#7c3aed', '#ea580c', '#16a34a']
    for (let i = 0; i < code.length; i++) {
      ctx.save()
      ctx.fillStyle = colors[i % colors.length] ?? '#000'
      ctx.font = `bold ${20 + Math.random() * 6}px sans-serif`
      const x = 12 + i * (width - 24) / code.length
      const y = height / 2 + 6
      ctx.translate(x, y)
      ctx.rotate((Math.random() - 0.5) * 0.5)
      ctx.fillText(code[i] ?? '', 0, 0)
      ctx.restore()
    }

    // 干扰点
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `hsl(${Math.random() * 360}, 50%, 60%)`
      ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5)
    }
  }, [width, height])

  React.useEffect(() => {
    draw()
  }, [draw])

  // 校验输入（忽略大小写）
  React.useEffect(() => {
    onVerify(value.trim().length >= 4 && value.trim().toUpperCase() === answerRef.current)
  }, [value, onVerify])

  return (
    <button
      type="button"
      onClick={draw}
      title="点击刷新验证码"
      className="relative shrink-0 overflow-hidden rounded-md border"
      style={{ width, height }}
    >
      <canvas ref={canvasRef} width={width} height={height} className="block" />
      <span className="absolute right-0.5 top-0.5 text-muted-foreground/60">
        <RefreshCw className="h-3 w-3" />
      </span>
    </button>
  )
}
