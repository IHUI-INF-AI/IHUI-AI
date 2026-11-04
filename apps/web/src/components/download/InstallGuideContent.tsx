// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { Button } from '@ihui/ui-react'
import type { DownloadPlatform } from '@/config/downloads.config'

/**
 * CLI 的 npm 安装命令。
 * 包名是 unscoped 的 `ihui-cli`(apps/cli/package.json),不是 `@ihui/cli` ——
 * 该 scope 在 npm 上属于第三方,写成 scoped 会让用户装到别人的包。
 * 复制按钮与代码块共用此常量,避免两处漂移。
 */
export const CLI_INSTALL_COMMAND = 'npm install -g ihui-cli'

/**
 * 安装指南内容(基于 platform 渲染不同形式):
 *  - cli:显示 npm install 命令(可复制)
 *  - extension:显示加载步骤 + 命令
 *  - 其他:显示纯文本指南
 */
export function InstallGuideContent({
  platform,
  t,
  guideKey,
}: {
  platform: DownloadPlatform
  t: (key: string) => string
  guideKey: string
}) {
  const guideText = t(guideKey)
  // 2026-08-06 修复:copied state 从 cli 分支内提升到组件顶层——原实现
  // `if (platform === 'cli')` 块内调用 useState,违反 Rules of Hooks(条件 Hook),
  // 平台切换时 Hook 顺序变化会导致 React 运行时崩溃。
  const [copied, setCopied] = React.useState(false)

  // CLI:渲染 npm 命令块(可复制)
  if (platform === 'cli') {
    const handleCopy = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(CLI_INSTALL_COMMAND)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    }
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-line text-body text-muted-foreground">{guideText}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-body text-foreground">
            {CLI_INSTALL_COMMAND}
          </code>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? t('downloadCopied') : t('downloadCopy')}
          </Button>
        </div>
        <p className="text-label text-muted-foreground">
          {t('downloadCliUsageHint')} <code className="font-mono">ihui --help</code>
        </p>
      </div>
    )
  }

  // Extension:渲染加载步骤 + 命令
  if (platform === 'extension') {
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-line text-body text-muted-foreground">{guideText}</p>
        <ol className="ml-4 list-decimal space-y-1 text-body text-muted-foreground">
          <li>{t('downloadExtensionStep1')}</li>
          <li>{t('downloadExtensionStep2')}</li>
          <li>{t('downloadExtensionStep3')}</li>
          <li>{t('downloadExtensionStep4')}</li>
        </ol>
      </div>
    )
  }

  // 其他:纯文本
  return (
    <p className="px-4 py-4 whitespace-pre-line text-body text-muted-foreground">{guideText}</p>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
