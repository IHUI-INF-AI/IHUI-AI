// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import {
  gateAllowsAction,
  subscribeAppVersionGate,
  type AppVersionGateDecision,
  type AppVersionGateUiState,
} from '@/lib/app-version-gate'
import { UpdateNoticeCard } from './UpdateNoticeCard'

/**
 * app-version 闸门的**渲染端**(2026-10-27 立)。
 *
 * 此前链路只造了一半:lib/app-version-gate.ts 的六终态机、动作锁、fail-open 判定全写好了,
 * GlobalHooksProvider 也真的在启动时拉 /api/app-version/check-update 并广播决策 ——
 * 但全仓没有一个 UI 订阅者(只有测试在听)⇒ 服务端把 force_update 打开,用户端什么都不会发生。
 * 本组件就是那个缺失的订阅者。
 *
 * 两种形态:
 *   - 强更(decision.required)= 阻塞弹窗,没有关闭 X,skip/cancel 侧门按 gateAllowsAction 锁死,
 *     只留 manual(立即更新)与 quit(关闭页面)两个恒可用动作;
 *   - 普通更新(有更新但未标 force_update)= 右下角卡片,与 PWA 更新提示同一视觉与文案,
 *     用户可关闭(即 skip 侧门可用)。
 *
 * web 与桌面的终态映射(如实登记,不假装有):
 *   - checking    —— 瞬时态:决策到达时检查已完成,直接落 ready;
 *   - downloading —— web 端**不可达**:静态资源由浏览器/SW 自己取,没有本地下载进度;
 *   - installing  —— 点了「立即更新」到整页重载之间的窗口;
 *   - error       —— 取不到决策时由 lib fail-open 给出,此形态不拦用户(不渲染);
 *   - dev-skipped —— 桌面 dev 专用,web 不产生。
 */
export function AppVersionGatePrompt(): React.JSX.Element | null {
  const t = useTranslations('appUpdate')
  const [decision, setDecision] = React.useState<AppVersionGateDecision | null>(null)
  const [state, setState] = React.useState<AppVersionGateUiState>('idle')
  const [dismissed, setDismissed] = React.useState(false)
  const [confirmQuit, setConfirmQuit] = React.useState(false)

  React.useEffect(
    () =>
      subscribeAppVersionGate((next) => {
        setDecision(next)
        // 订阅即刻回放最新决策(免疫"广播早于挂载"的时序竞争)。
        setState(next.required ? 'ready' : next.kind)
        setConfirmQuit(false)
      }),
    [],
  )

  const required = decision?.required === true
  const hasUpdate = decision !== null && decision.latestVersion !== null

  const handleUpdate = React.useCallback(() => {
    if (!decision) return
    const verdict = gateAllowsAction(state, decision, 'manual')
    if (!verdict.allowed) {
      // manual 是恒可用动作,被拒 = 判据自身坏了,不静默吞(留痕便于发现回归)
      toast.error(verdict.reason)
      return
    }
    if (decision.downloadUrl) {
      // 服务端给了下载地址(安装包/商店):以它为准,不动当前页面
      window.open(decision.downloadUrl, '_blank', 'noopener,noreferrer')
      return
    }
    // 没有下载地址 = 本站新构建:整页重载即拿到新 bundle(SW 已 skipWaiting 接管)
    setState('installing')
    window.location.reload()
  }, [decision, state])

  const doQuit = React.useCallback(() => {
    window.close()
    // window.close() 对非脚本打开的标签页无效且不抛错 ⇒ 用"仍在运行"判失败并如实告知,
    // 而不是留一个点了没反应、也没人知道为什么的按钮。
    window.setTimeout(() => toast.error(t('gateQuitFailed')), 300)
  }, [t])

  const handleQuit = React.useCallback(() => {
    if (!decision) return
    const verdict = gateAllowsAction(state, decision, 'quit')
    if (!verdict.allowed) {
      toast.error(verdict.reason)
      return
    }
    if (verdict.confirmFirst && !confirmQuit) {
      setConfirmQuit(true)
      return
    }
    doQuit()
  }, [confirmQuit, decision, doQuit, state])

  // 无决策 / 判定失败(fail-open)/ 无更新 ⇒ 不渲染
  if (!decision || (!required && !hasUpdate)) return null
  if (!required && dismissed) return null

  if (!required) {
    return (
      <UpdateNoticeCard
        title={t('title')}
        body={t('body')}
        actionLabel={t('action')}
        closeLabel={t('close')}
        onAction={handleUpdate}
        onClose={() => setDismissed(true)}
        busy={state === 'installing'}
      />
    )
  }

  const latest = decision.latestVersion ?? ''
  const bodyText =
    decision.cause === 'minimum-version'
      ? t('gateBody', { version: decision.currentVersion, latest })
      : t('gateForceBody', { latest })
  const releaseNotes = decision.releaseNotes?.trim() ?? ''
  const skip = gateAllowsAction(state, decision, 'skip')
  const cancel = gateAllowsAction(state, decision, 'cancel')

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-version-gate-title"
      aria-describedby="app-version-gate-body"
      data-gate-state={state}
    >
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 id="app-version-gate-title" className="text-base font-semibold">
              {t('gateTitle')}
            </h2>
            <p id="app-version-gate-body" className="mt-1 text-sm text-muted-foreground">
              {bodyText}
            </p>
            {releaseNotes ? (
              <div className="mt-3 rounded-lg bg-muted p-3">
                <p className="text-xs font-medium">{t('gateReleaseNotes')}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                  {releaseNotes}
                </p>
              </div>
            ) : null}
            {confirmQuit ? (
              <p className="mt-3 text-xs text-warning-text">{t('gateQuitConfirm')}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          {/*
            skip / cancel 侧门:强更会话里 gateAllowsAction 恒返回 allowed=false。
            锁死就**不渲染** —— 给一个点了没反应的按钮等于骗人
            (本仓铁律:失效方向只能是"多要一次定向说明",不能是"多放一次跳门")。
          */}
          {skip.allowed ? (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-sm px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              {t('gateLater')}
            </button>
          ) : null}
          {cancel.allowed ? (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-sm px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              {t('close')}
            </button>
          ) : null}
          {confirmQuit ? (
            <button
              type="button"
              onClick={() => setConfirmQuit(false)}
              className="rounded-sm px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              {t('close')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleQuit}
            className="rounded-sm px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            {t('gateQuit')}
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={state === 'installing'}
            className="rounded-sm bg-cta px-4 py-1.5 text-sm font-medium text-cta-foreground hover:bg-cta/90 disabled:opacity-60"
          >
            {t('gateUpdateNow')}
          </button>
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
