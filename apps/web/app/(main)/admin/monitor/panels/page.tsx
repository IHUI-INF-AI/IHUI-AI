// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 监控面板(/admin/monitor/panels)—— Grafana 21 张监控大屏的项目内入口。
 *
 * 背景(2026-10-18):Grafana 原生(127.0.0.1:8816)承载 21 张监控盘的详细面板;
 * 本页把它们嵌进管理后台(管理 → 数据看板 → 监控面板),与自研 HUD 页
 * /admin/monitor/wallboard(生产监控大屏)互补:wallboard 是单页总览,
 * 本页是全量明细下钻。
 *
 * 数据面:iframe 内嵌 Grafana kiosk 模式(只读,匿名 Viewer 已在
 * D:/DevEnv/monitor/grafana/grafana.ini 开启 enabled + allow_embedding)。
 * Grafana 地址解析优先级:NEXT_PUBLIC_GRAFANA_BASE 环境变量 > 当前页面
 * hostname + :8816(同机与 LAN 访问均成立,依赖 Grafana 监听 0.0.0.0)。
 */
import * as React from 'react'
import { ExternalLink, PanelLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

interface PanelDef {
  uid: string
  title: string
  group: string
}

const PANELS: PanelDef[] = [
  { uid: 'ihui-ai-overview', title: 'AI 运行全景', group: 'AI 可观测' },
  { uid: 'ihui-ai-ai-agent', title: 'Agent 与工具链路', group: 'AI 可观测' },
  { uid: 'ihui-ai-ai-cost', title: '模型成本与用量', group: 'AI 可观测' },
  { uid: 'ihui-ai-ai-latency', title: '模型延迟分布', group: 'AI 可观测' },
  { uid: 'ihui-ai-ai-logs', title: '智能体与模型日志', group: 'AI 可观测' },
  { uid: 'ihui-ai-alert-history', title: '告警历史与趋势', group: 'AI 可观测' },
  { uid: 'ihui-ai-business-funnel', title: '业务漏斗', group: '业务' },
  { uid: 'ihui-ai-payment-flow', title: '支付漏斗监控', group: '业务' },
  { uid: 'ihui-ai-tenant-usage', title: '多租户业务监控', group: '业务' },
  { uid: 'ihui-ai-exam-usage', title: '考试业务监控', group: '业务' },
  { uid: 'ihui-ai-live-room', title: '直播业务监控', group: '业务' },
  { uid: 'ihui-ai-auth-security', title: '认证安全监控', group: '业务' },
  { uid: 'ihui-ai-ws', title: 'WebSocket 监控', group: '业务' },
  { uid: 'ihui-ai-bullmq', title: '任务队列监控', group: '基础设施' },
  { uid: 'ihui-ai-cache', title: '缓存监控', group: '基础设施' },
  { uid: 'ihui-ai-hls', title: 'HLS 直播流监控', group: '基础设施' },
  { uid: 'ihui-ai-oss-storage', title: '对象存储监控', group: '基础设施' },
  { uid: 'ihui-ai-postgresql', title: 'PostgreSQL 监控', group: '基础设施' },
  { uid: 'ihui-ai-pg-deploy', title: '数据库运行态', group: '基础设施' },
  { uid: 'ihui-ai-redis-cluster', title: 'Redis 实例监控', group: '基础设施' },
  { uid: 'ihui-ai-monitor-health', title: '监控系统健康', group: '基础设施' },
]

const GROUPS = Array.from(new Set(PANELS.map((p) => p.group)))

export default function MonitorPanelsPage() {
  const [base, setBase] = React.useState('')
  const [activeUid, setActiveUid] = React.useState<string>(PANELS[0]!.uid)
  const [navOpen, setNavOpen] = React.useState(true)

  React.useEffect(() => {
    setBase(
      process.env.NEXT_PUBLIC_GRAFANA_BASE ||
        `${window.location.protocol}//${window.location.hostname}:8816`,
    )
  }, [])

  const active = PANELS.find((p) => p.uid === activeUid) ?? PANELS[0]!
  const iframeSrc = base ? `${base}/d/${active.uid}/?kiosk&theme=dark&refresh=30s` : undefined

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0b1220] text-slate-100">
      {/* 顶栏 */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <PanelLeft
          className="size-4 cursor-pointer text-slate-400 hover:text-slate-100"
          onClick={() => setNavOpen((v) => !v)}
        />
        <h1 className="text-sm font-semibold tracking-wide">监控面板 · {active.title}</h1>
        <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-[11px] text-cyan-300">
          Grafana 只读
        </span>
        <div className="flex-1" />
        {iframeSrc ? (
          <a
            href={`${base}/d/${active.uid}/`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-100"
          >
            <ExternalLink className="size-3.5" />
            新窗口打开
          </a>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 左侧盘面选择 */}
        {navOpen ? (
          <nav className="w-56 shrink-0 overflow-y-auto border-r border-white/10 p-2">
            {GROUPS.map((group) => (
              <div key={group} className="mb-3">
                <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {group}
                </div>
                {PANELS.filter((p) => p.group === group).map((p) => (
                  <button
                    key={p.uid}
                    type="button"
                    onClick={() => setActiveUid(p.uid)}
                    className={cn(
                      'block w-full rounded px-2 py-1.5 text-left text-[13px] transition-colors',
                      p.uid === activeUid
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-slate-300 hover:bg-white/5',
                    )}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        ) : null}

        {/* Grafana kiosk 内嵌 */}
        <main className="min-h-0 min-w-0 flex-1">
          {iframeSrc ? (
            <iframe
              key={activeUid}
              src={iframeSrc}
              title={`Grafana - ${active.title}`}
              className="size-full border-0"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-slate-500">
              正在连接 Grafana…
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
