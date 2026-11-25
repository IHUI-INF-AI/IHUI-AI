// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import {
  BadgeCheck,
  Check,
  ChevronDown,
  Clock3,
  Info,
  LockKeyhole,
  MousePointerClick,
  ShieldAlert,
} from 'lucide-react'

/**
 * Windows 首次运行引导(2026-11-25)。
 *
 * 背景:桌面安装包没有购买商业 Authenticode 代码签名证书,终端用户首次双击时
 * 必然看到 SmartScreen 的「Windows 已保护你的电脑 / 未知发布者」。这个弹窗由
 * Windows 在应用代码运行之前弹出,**程序自身无法隐藏或美化**;唯一正当的解法
 * 是在下载页提前讲清楚,并给出「更多信息 → 仍要运行」的真实点法。
 *
 * 底线(修改本组件前先读):
 *  - 只教用户在当前这一个安装包上继续,绝不教关闭 SmartScreen、改注册表、
 *    去 Mark-of-the-Web、伪装发布者或借别人的证书;
 *  - 不声称「已签名 / 官方认证」——安装包当前就是 NotSigned,文案必须诚实;
 *  - 弹窗示意图用 CSS 画,不引入截图,免得看起来像真实系统提示的伪造件。
 */
export function WindowsFirstRunGuide({ t }: { t: (key: string) => string }) {
  const steps = [
    {
      title: t('downloadWinStep1Title'),
      desc: t('downloadWinStep1Desc'),
    },
    {
      title: t('downloadWinStep2Title'),
      desc: t('downloadWinStep2Desc'),
    },
    {
      title: t('downloadWinStep3Title'),
      desc: t('downloadWinStep3Desc'),
    },
  ]

  return (
    <section
      id="windows-first-run"
      aria-labelledby="windows-first-run-title"
      className="mb-6 scroll-mt-24"
    >
      <div className="overflow-hidden rounded-lg border border-sky-500/25 bg-card text-card-foreground dark:border-sky-400/25">
        {/* 顶部色带:把这一段和普通安装指南区分开,但只用 4px,不抢标题 */}
        <div
          aria-hidden="true"
          className="h-1 w-full bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400"
        />

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                {t('downloadWinGuideEyebrow')}
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-sky-500/60" />
                {t('downloadWinBadge')}
              </span>
              <h2
                id="windows-first-run-title"
                className="mt-3 text-lg font-semibold text-foreground sm:text-xl"
              >
                {t('downloadWinGuideTitle')}
              </h2>
              <p className="mt-1.5 max-w-2xl text-body leading-relaxed text-muted-foreground">
                {t('downloadWinGuideIntro')}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-label text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('downloadWinGuideTime')}
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            {/* 左:SmartScreen 弹窗示意图(真实控件位置,非伪造截图) */}
            <div className="rounded-lg border border-black/10 bg-white p-3 text-slate-900 dark:border-white/15">
              <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  Windows SmartScreen
                </span>
                {/* Windows 标题栏按钮:刻意用极简字形,不画 macOS 红绿灯 */}
                <span
                  aria-hidden="true"
                  className="inline-flex items-center gap-2 text-[10px] text-slate-400"
                >
                  <span className="inline-block h-px w-2 bg-slate-400" />
                  <span className="inline-block h-1.5 w-1.5 border border-slate-400" />
                  <span className="text-[11px] leading-none">×</span>
                </span>
              </div>

              <div className="px-1 pt-3 pb-1">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0067c0] text-white">
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold leading-snug">
                      {t('downloadWinDialogTitle')}
                      <Marker n={1} />
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                      {t('downloadWinDialogBody')}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded border border-black/10 bg-[#f8fafc] px-2 py-1.5 text-[11px] leading-relaxed text-slate-500">
                  <p className="truncate">{t('downloadWinDialogApp')}</p>
                  <p className="truncate">{t('downloadWinDialogPublisher')}</p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0067c0] underline decoration-dotted underline-offset-2">
                    <Marker n={2} />
                    {t('downloadWinDialogMore')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded border border-black/15 bg-white px-2.5 py-1 text-[11px] text-slate-700">
                      {t('downloadWinDialogDontRun')}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-[#0067c0] px-3 py-1.5 text-[12px] font-medium text-white">
                      <Marker n={3} tone="onBlue" />
                      {t('downloadWinDialogRun')}
                    </span>
                  </span>
                </div>
              </div>

              <p className="mt-2 border-t border-black/5 pt-2 text-center text-[11px] text-slate-400">
                {t('downloadWinMockCaption')}
              </p>
            </div>

            {/* 右:三步操作,编号与左侧示意图一一对应 */}
            <ol className="space-y-2">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-2.5 rounded-lg border border-border/70 bg-background/60 p-2.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-[11px] font-semibold text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-body font-medium text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-label leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
            <p className="flex items-center gap-1.5 text-body font-medium text-emerald-800 dark:text-emerald-300">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              {t('downloadWinTrustTitle')}
            </p>
            <ul className="mt-2 grid gap-2 tablet:grid-cols-3">
              {[t('downloadWinTrust1'), t('downloadWinTrust2'), t('downloadWinTrust3')].map(
                (item) => (
                  <li
                    key={item}
                    className="flex items-start gap-1.5 text-label leading-relaxed text-muted-foreground"
                  >
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ),
              )}
            </ul>
          </div>

          <details className="group mt-3 rounded-lg border border-border/70 bg-background/60 p-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-body font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              {t('downloadWinWhyTitle')}
              <ChevronDown
                aria-hidden="true"
                className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-2 text-label leading-relaxed text-muted-foreground">
              {t('downloadWinWhyBody')}
            </p>
          </details>

          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-label leading-relaxed text-amber-800 dark:text-amber-300">
            <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('downloadWinSafety')}</span>
          </p>

          <p className="mt-2 flex items-start gap-2 text-label leading-relaxed text-muted-foreground">
            <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('downloadWinScope')}</span>
          </p>
        </div>
      </div>
    </section>
  )
}

/** 示意图上的编号圆点:与右侧步骤一一对应;对读屏隐藏,避免重复念数字 */
function Marker({ n, tone = 'light' }: { n: number; tone?: 'light' | 'onBlue' }) {
  return (
    <span
      aria-hidden="true"
      className={
        tone === 'onBlue'
          ? 'inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[9px] font-bold text-white'
          : 'inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-amber-950'
      }
    >
      {n}
    </span>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
