'use client'

import * as React from 'react'
import { Wrench, Info, RefreshCw, Trash2, Copy, Check, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'

/**
 * 判断当前访问是否处于"开发/内网"环境。
 * 用 hostname 而非 process.env.NODE_ENV 判定的原因:
 *   - Next.js 15 + Turbopack 在 dev 模式下仍会把 process.env.NODE_ENV 替换为 'production',
 *     导致客户端拿到的总是 true,失去判定意义;
 *   - hostname 是浏览器端真实运行环境的稳定信号,不依赖构建变量。
 *
 * 判定范围(2026-07-21):
 *   - localhost / 127.0.0.1 / 0.0.0.0
 *   - 内网 IPv4: 10.x / 192.168.x / 172.16-31.x
 */
function detectDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  if (!h) return false
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  return false
}

/**
 * 悬浮式开发者工具侧栏 (2026-07-21 重设计)
 *
 * 与第一版的差异:
 *   - 第一版:26×26 按钮塞在主侧边栏底部,Modal 弹窗。挡内容、全英文、与主侧边栏耦合。
 *   - 当前版:独立于主侧边栏的悬浮抽屉,固定在视口**最右侧**。
 *     平时仅露一条 10px 细把手 + 竖排"开发者工具"小字标签;
 *     鼠标移上去自动从右往左拉出 320px 宽面板(200ms ease-out 过渡);
 *     鼠标移出后延迟 300ms 自动收回(防止误触路过立即消失)。
 *     整个组件用 fixed 定位,不挤占主侧边栏 / 内容区 / AI 面板的布局空间。
 *
 * 面板内容:
 *   - dev 模式 (localhost / 内网): 环境信息(路径/视口/时间) + 快捷工具(刷新/清缓存/复制)
 *   - prod 模式 (公网域名):      显示"仅开发模式可用"说明,不暴露任何工具
 *
 * 国际化:全部从 i18n 读取,默认中文(用户偏好)
 */
export function DevToolsTrigger() {
  const t = useTranslations('devTools')
  const [hover, setHover] = React.useState(false)
  // 用 state 缓存首屏判断结果,避免 hydration 时 hostname 还在变化
  const [isDev, setIsDev] = React.useState(false)
  const [now, setNow] = React.useState('')
  const [path, setPath] = React.useState('')
  const [viewport, setViewport] = React.useState('')
  const [copied, setCopied] = React.useState(false)
  // 关闭定时器 ref(延迟收起)
  const closeTimer = React.useRef<number | null>(null)

  React.useEffect(() => {
    setIsDev(detectDevEnvironment())
  }, [])

  // dev 态下面板打开时,持续刷新环境信息(让"当前路径""当前时间"始终是最新)
  React.useEffect(() => {
    if (!hover || !isDev) return
    const refresh = () => {
      setNow(new Date().toLocaleString('zh-CN'))
      setPath(typeof window !== 'undefined' ? window.location.pathname : '')
      setViewport(
        typeof window !== 'undefined'
          ? `${window.innerWidth} × ${window.innerHeight}`
          : '',
      )
    }
    refresh()
    const id = window.setInterval(refresh, 1000)
    return () => window.clearInterval(id)
  }, [hover, isDev])

  // 鼠标进入 → 取消关闭定时器,显示面板
  const handleMouseEnter = React.useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setHover(true)
  }, [])

  // 鼠标离开 → 延迟 300ms 收起(防止用户只是路过立刻消失)
  const handleMouseLeave = React.useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setHover(false)
      closeTimer.current = null
    }, 300)
  }, [])

  // 卸载时清理定时器
  React.useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  const handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  const handleClearStorage = () => {
    if (typeof window === 'undefined') return
    try {
      // 只清理项目自身产生的 localStorage 键(以 ihui- 开头),保留用户偏好
      const keys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && k.startsWith('ihui-')) keys.push(k)
      }
      keys.forEach((k) => window.localStorage.removeItem(k))
      const sKeys: string[] = []
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i)
        if (k && k.startsWith('ihui-')) sKeys.push(k)
      }
      sKeys.forEach((k) => window.sessionStorage.removeItem(k))
    } catch {
      // 忽略隐私模式下的 QuotaExceeded 等异常
    }
  }

  const handleCopyInfo = async () => {
    if (typeof window === 'undefined') return
    const info = {
      path: window.location.pathname,
      url: window.location.href,
      host: window.location.host,
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      ua: navigator.userAgent,
      now: new Date().toISOString(),
      lang: navigator.language,
    }
    const text = JSON.stringify(info, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // 剪贴板权限被拒时降级为选中文本
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      } catch {
        /* noop */
      } finally {
        document.body.removeChild(ta)
      }
    }
  }

  return (
    /**
     * 整体外层:
     * - fixed right-0 top-0 bottom-0:固定在视口右侧全高
     * - z-50:高于内容层(留 z-modal 给对话框)
     * - 用 onMouseEnter/Leave 统一管理 hover 状态,把手和面板视为同一悬停区
     * - 平时面板用 translate-x-full 隐藏在视口外,hover 时回到 translate-x-0
     *
     * 把手(handle)宽 10px,半透明深色背景 + 竖排标签,
     * 即使面板收起时也能看到并被悬停触发。
     */
    <div
      className="fixed right-0 top-0 z-50 h-screen w-[10px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={t('trigger')}
    >
      {/* 拉出的面板 - 320px 宽,从右往左滑入 */}
      <div
        className={[
          'absolute right-full top-0 flex h-full w-80 flex-col border-l bg-background shadow-xl',
          'transition-transform duration-200 ease-out',
          // 收起时 translate-x-full 把自己推到视口外,只露把手
        ].join(' ')}
        // 收起时不接收 pointer events,避免挡住下方页面元素;展开时正常接收
        style={{ pointerEvents: hover ? 'auto' : 'none', transform: hover ? 'translateX(0)' : 'translateX(100%)' }}
        aria-hidden={!hover}
      >
        {/* 面板头部 */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="h-4 w-4" />
            {t('title')}
          </span>
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>

        {/* 面板正文 - 可滚动 */}
        <div className="flex-1 overflow-y-auto p-4">
          {isDev ? (
            <div className="space-y-4">
              {/* 环境信息区 */}
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('envSection')}
                </h4>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">{t('path')}</dt>
                  <dd className="break-all font-mono text-xs">{path || '-'}</dd>
                  <dt className="text-muted-foreground">{t('viewport')}</dt>
                  <dd className="font-mono text-xs">{viewport || '-'}</dd>
                  <dt className="text-muted-foreground">{t('now')}</dt>
                  <dd className="font-mono text-xs">{now || '-'}</dd>
                </dl>
              </section>

              {/* 快捷工具区 */}
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('toolsSection')}
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReload}
                    className="justify-start"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('reload')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearStorage}
                    className="justify-start"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('clearStorage')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyInfo}
                    className="justify-start"
                  >
                    {copied ? (
                      <Check className="mr-2 h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copied ? t('copied') : t('copyInfo')}
                  </Button>
                </div>
              </section>

              <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {t('tip')}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-4 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <p className="font-medium">{t('prodModeTitle')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('prodModeHint')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 把手 - 10px 宽,全高,固定贴在视口最右边 */}
      {/* 收起时也保持可见,作为悬停触发器 */}
      <div
        className={[
          'flex h-full w-full flex-col items-center justify-center',
          'border-l border-border/60 bg-foreground/5',
          'transition-colors duration-150',
          hover ? 'bg-foreground/15' : 'hover:bg-foreground/10',
        ].join(' ')}
        role="presentation"
      >
        {/* 竖排小字标签 - 用 writing-mode 旋转 90° */}
        <span
          className="select-none whitespace-nowrap text-[10px] font-medium tracking-widest text-muted-foreground"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {t('trigger')}
        </span>
      </div>
    </div>
  )
}
