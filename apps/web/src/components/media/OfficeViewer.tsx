// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Download, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OfficeViewerProps {
  url: string
  fileName?: string
  className?: string
}

export function OfficeViewer({ url, fileName, className }: OfficeViewerProps) {
  const t = useTranslations('a11y')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) setError(true)
        return prev
      })
    }, 12000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={cn('relative flex h-full w-full flex-col', className)}>
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5">
        <span className="text-xs text-muted-foreground">{t('officePreviewLabel')}</span>
        <a
          href={url}
          download={fileName}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          <Download className="h-3 w-3" />
          {t('download')}
        </a>
      </div>
      <div className="relative flex-1 min-w-0">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm">{t('previewTimeout')}</p>
            <a
              href={url}
              download={fileName}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Download className="h-4 w-4" />
              {t('downloadFile')}
            </a>
          </div>
        ) : (
          <iframe
            src={src}
            title={fileName ?? 'Office preview'}
            /* P2 加固(对齐 2026-09-09 第九轮 iframe sandbox 治理):Office 预览
               仅需文档渲染,禁表单提交与顶层导航,阻断嵌入页恶意交互 */
            /* iframe-sandbox-relax: 全仓最宽的一档,带理由声明(2026-09-27 沙箱严档缺省票)。
               帧内文档是 **Microsoft 的源** `view.officeapps.live.com`(见上面 src 拼接),
               不是本站源 —— 所以 `allow-scripts` + `allow-same-origin` 同时给在这里
               **不构成**该组合的经典危害(帧内脚本摘掉自身 sandbox、回读父文档/本站
               Cookie),那条攻击要求帧与原站同源,而这里跨源。它拿到的是 officeapps.live.com
               自己的会话 Cookie,预览会话依赖它。
               残余风险如实写:① 文档正文的隔离是**委托给微软查看器**的,不是我们兜的;
               ② 被预览的 office 文件本身来自用户 URL,内容可信度为零,一旦微软查看器有 XSS,
               受影响的是它的源而不是本站;③ 没有 allow-forms / allow-top-navigation,
               这两档刻意保持禁止。
               想收紧到"去掉 allow-same-origin"必须先拿真机验证查看器还渲不渲染得出
               (会话 Cookie 大概率是必需的)——本机 dev server 未起、jsdom 也测不出第三方
               查看器行为,所以本票**不**顺手收紧,登记为待人工拍板项。 */
            sandbox="allow-scripts allow-same-origin allow-popups"
            onLoad={() => setLoading(false)}
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
