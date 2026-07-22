'use client'
import * as React from 'react'
import { GitBranch, RefreshCw, AlertCircle, AlertTriangle, Bell, Sun, Moon, ChevronUp, Check } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

type GitSyncState = 'synced' | 'unsynced' | 'conflict'

const GIT_SYNC_META: Record<GitSyncState, { dot: string; tip: string }> = {
  synced: { dot: 'bg-green-500', tip: '已同步' },
  unsynced: { dot: 'bg-amber-500', tip: '未同步' },
  conflict: { dot: 'bg-red-500', tip: '有冲突' },
}

export function StatusBar() {
  const { resolvedTheme, setTheme } = useTheme()
  const [themeAnim, setThemeAnim] = React.useState(false)
  const errors = 0
  const warnings = 0
  const cursor = { line: 12, col: 34 }
  const selection = 8
  const indent = 'Spaces: 2'
  const gitSync: GitSyncState = 'unsynced'
  const notifications = 3

  const switchTheme = () => {
    setThemeAnim(true)
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    window.setTimeout(() => setThemeAnim(false), 300)
  }

  const syncMeta = GIT_SYNC_META[gitSync]

  return (
    <div className="flex h-6 shrink-0 items-center gap-3 bg-foreground px-3 text-xs text-background">
      <button className="flex items-center gap-1 hover:opacity-80">
        <GitBranch className="h-3 w-3" />
        <span>main</span>
        <span className={cn('h-2 w-2 rounded', syncMeta.dot)} aria-label={syncMeta.tip} title={syncMeta.tip} />
      </button>
      <button className="flex items-center gap-1 hover:opacity-80">
        <RefreshCw className="h-3 w-3" />
        <span>同步</span>
      </button>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-0.5 hover:opacity-80">
          <AlertCircle className="h-3 w-3" />
          <span>{errors}</span>
        </button>
        <button className="flex items-center gap-0.5 hover:opacity-80">
          <AlertTriangle className="h-3 w-3" />
          <span>{warnings}</span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-3 transition-opacity duration-300" style={{ opacity: themeAnim ? 0.5 : 1 }}>
        <span>{cursor.line}:{cursor.col}</span>
        {selection > 0 && (
          <span className="flex items-center gap-0.5">
            <ChevronUp className="h-3 w-3" />
            <span>{selection}</span>
          </span>
        )}
        <span>{indent}</span>
        <span>UTF-8</span>
        <span>LF</span>
        <span>TypeScript</span>
        <button className="flex items-center gap-0.5 hover:opacity-80">
          <Check className="h-3 w-3" />
        </button>
        <button className="relative flex items-center gap-0.5 hover:opacity-80">
          <Bell className="h-3 w-3" />
          {notifications > 0 && (
            <span className="ml-0.5 rounded bg-background px-1 text-[10px] leading-tight text-foreground">
              {notifications}
            </span>
          )}
        </button>
        <button
          onClick={switchTheme}
          className="flex items-center gap-0.5 hover:opacity-80"
          aria-label="切换主题"
        >
          <span className={cn('transition-transform duration-300', themeAnim && 'rotate-180')}>
            {resolvedTheme === 'dark' ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          </span>
        </button>
      </div>
    </div>
  )
}
