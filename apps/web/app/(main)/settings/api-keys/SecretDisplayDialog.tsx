'use client'

import * as React from 'react'
import { AlertTriangle, Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'

interface Props {
  open: boolean
  secret: string
  title?: string
  onClose: () => void
}

/**
 * 一次性 Secret 展示弹窗(关键安全组件)。
 *
 * 强制安全 UX:
 * - 顶部醒目警告:仅显示一次,关闭后无法再次查看。
 * - secret 用 monospace 展示 + 复制按钮(navigator.clipboard)。
 * - "我已保存,关闭"按钮 disabled 2 秒,防止误触立即关闭。
 * - overlay/ESC 关闭同样受 2s 限制。
 */
export function SecretDisplayDialog({ open, secret, title = '密钥已创建', onClose }: Props) {
  const [copied, setCopied] = React.useState(false)
  const [canClose, setCanClose] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setCopied(false)
      setCanClose(false)
      return
    }
    const timer = setTimeout(() => setCanClose(true), 2000)
    return () => clearTimeout(timer)
  }, [open, secret])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      toast.success('密钥已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败,请手动选择文本复制')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : canClose && onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>此密钥仅显示一次,请立即复制保存,关闭后无法再次查看。妥善保管,切勿泄露给他人。</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Secret</p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
              <code className="flex-1 break-all font-mono text-xs">{secret}</code>
              <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? '已复制' : '复制'}</span>
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} disabled={!canClose} className="w-full sm:w-auto">
            <span>我已保存,关闭</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
