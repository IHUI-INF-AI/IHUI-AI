'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'

/**
 * 第 5 页:智汇 AI vs Claude Code vs Cursor vs ChatGPT 8 行竞品对比表
 *
 * 2026-07-21 拆分(从原 HomeScenarioGrid 抽出):
 * - 用户反馈"内容太拥挤了,再分个页面出来"
 * - 8 行对比表独立成页,字号 / 行高 / 单元格 padding 全部放大,可读性大幅提升
 * - 让决策者看完 ROI 后,再细看"行业唯一 8 端全覆盖 / 100+ LLM / 三栈合一"等核心壁垒
 *
 * 8 行对比维度:端覆盖 / 大模型数量 / AI 技术栈 / API 端点 / 教育模块 /
 *              决策者社群 / 中文优化 / 智能体广场
 */

const COMPARISON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8] as const

export function HomeComparison() {
  const t = useTranslations('marketing.comparison')

  return (
    <section className="space-y-5">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h2>
        <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
          {t('titleEn')}
        </h3>
        <p className="mx-auto max-w-3xl text-sm text-muted-foreground sm:text-base">
          {t('subtitle')}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{t('colFeature')}</th>
              <th className="bg-primary/10 px-3 py-2.5 font-semibold text-primary sm:px-4 sm:py-3">
                {t('colUs')}
              </th>
              <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{t('colClaude')}</th>
              <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{t('colCursor')}</th>
              <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{t('colChatgpt')}</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((n) => {
              const us = t(`row${n}Us`)
              return (
                <tr key={n} className="border-t">
                  <td className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">
                    {t(`row${n}Feature`)}
                  </td>
                  <td className="bg-primary/5 px-3 py-2.5 font-medium text-primary sm:px-4 sm:py-3">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{us}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground sm:px-4 sm:py-3">
                    <div className="flex items-center gap-1.5">
                      {t(`row${n}Claude`) === '无' ? (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{t(`row${n}Claude`)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground sm:px-4 sm:py-3">
                    <div className="flex items-center gap-1.5">
                      {t(`row${n}Cursor`) === '无' ? (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{t(`row${n}Cursor`)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground sm:px-4 sm:py-3">
                    <div className="flex items-center gap-1.5">
                      {t(`row${n}Chatgpt`) === '无' ? (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{t(`row${n}Chatgpt`)}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
