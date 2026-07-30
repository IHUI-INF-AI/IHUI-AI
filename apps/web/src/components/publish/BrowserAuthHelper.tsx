'use client'

/**
 * 浏览器辅助引导组件(针对 browser_cookie 类型平台)
 * 4 步图文引导:打开官网 → F12 开发者工具 → 找 Cookie → 粘贴到表单
 * 小白友好:每步有 lucide Icon 占位 + 平台官网直达链接
 * AGENTS.md §4:无 rounded-full / 无渐变遮罩 / 无分割线 / 中文字体垂直对齐
 */

import * as React from 'react'
import {
  Globe,
  Keyboard,
  Cookie,
  ClipboardPaste,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'

interface CookieFieldHint {
  readonly name: string
  readonly label: string
}

interface BrowserAuthHelperProps {
  platformName: string
  platformUrl: string
  cookieFields: ReadonlyArray<CookieFieldHint>
}

interface Step {
  readonly icon: React.ComponentType<{ className?: string }>
  readonly title: string
  readonly body: React.ReactNode
}

export function BrowserAuthHelper({
  platformName,
  platformUrl,
  cookieFields,
}: BrowserAuthHelperProps) {
  const steps: readonly Step[] = React.useMemo(
    () => [
      {
        icon: Globe,
        title: '打开官网并登录',
        body: (
          <>
            用浏览器访问{' '}
            <a
              href={platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-2 hover:underline"
            >
              {platformName} 官网
              <ExternalLink className="h-3 w-3" />
            </a>
            ,按正常流程登录账号(建议扫码或手机验证登录,避免密码登录留痕)。
          </>
        ),
      },
      {
        icon: Keyboard,
        title: '按 F12 打开开发者工具',
        body: (
          <>
            登录后停留在该平台页面,按键盘 <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">F12</kbd> 打开开发者工具,
            切换到 <span className="font-medium">Application</span>(中文版叫"应用程序")→ 左侧 <span className="font-medium">Cookies</span> → 选中平台域名。
          </>
        ),
      },
      {
        icon: Cookie,
        title: '找到对应 Cookie 并复制值',
        body: (
          <>
            在 Cookie 列表中查找以下名称,双击 <span className="font-medium">Value</span> 列 → 全选(<kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">Ctrl+A</kbd>)→ 复制(<kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">Ctrl+C</kbd>):
            <ul className="mt-1.5 space-y-1">
              {cookieFields.map((f) => (
                <li key={f.name} className="flex items-center gap-1.5">
                  <Cookie className="h-3 w-3 text-orange-500" />
                  <code className="rounded bg-orange-500/10 px-1 py-0.5 text-[11px] font-mono text-orange-600 dark:text-orange-400">
                    {f.name}
                  </code>
                  <span className="text-muted-foreground">— {f.label}</span>
                </li>
              ))}
            </ul>
          </>
        ),
      },
      {
        icon: ClipboardPaste,
        title: '粘贴到下方表单对应字段',
        body: <>点击下方每个字段右侧的「粘贴」按钮,或手动 <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">Ctrl+V</kbd> 粘贴 Cookie 值,完成后点击「保存凭据」。</>,
      },
    ],
    [platformName, platformUrl, cookieFields],
  )

  return (
    <div className="space-y-2.5 rounded-md border border-orange-500/20 bg-orange-500/5 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
        <Cookie className="h-3.5 w-3.5" />
        Cookie 获取教程(4 步)
      </div>
      <ol className="space-y-2">
        {steps.map((step, idx) => {
          const Icon = step.icon
          return (
            <li key={idx} className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-orange-500/10 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
                <div className="flex items-center gap-1 text-xs font-medium">
                  <Icon className="h-3 w-3 text-orange-500" />
                  {step.title}
                </div>
                <div className="text-xs leading-relaxed text-muted-foreground">
                  {step.body}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="flex items-start gap-1.5 rounded bg-orange-500/10 p-2 text-[11px] leading-relaxed text-orange-700 dark:text-orange-300">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Cookie 有效期约 <span className="font-medium">7-30 天</span>,过期后需重新登录并复制新 Cookie。
          建议在私密/无痕窗口登录,避免其他插件干扰;不要把 Cookie 分享给他人(等同账号密码)。
        </span>
      </div>
    </div>
  )
}
