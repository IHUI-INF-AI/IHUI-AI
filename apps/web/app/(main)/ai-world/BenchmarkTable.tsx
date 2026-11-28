// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui-react'
import { FlaskConical } from 'lucide-react'
import raw from '@/data/benchmark-leaderboard.json'

type Entry = {
  benchmark: string
  model: string
  total: number
  passed: number
  passRate: number
  generatedAt: string | null
  source: string
}

type Data = { generatedAt: string; entries: Entry[] }

const data = raw as Data

const BENCH_LABEL: Record<string, string> = {
  'HumanEval-50': 'HumanEval 前 50 题（Python 函数补全，官方测试真实执行，多平台同题）',
  'HumanEval-164': 'HumanEval 全量 164 题（Python 函数补全，官方测试真实执行）',
  'IHUI-8': 'IHUI-8（Python / TypeScript / Shell 八道真实任务）',
}

const PROVIDER_LABEL: Record<string, string> = {
  workbuddy: 'WorkBuddy',
  trae: 'Trae',
  qoder: 'Qoder',
  doubao: '豆包',
  zcode: 'ZCode',
}

function splitModel(raw: string): { provider: string; model: string } {
  const i = raw.indexOf('/')
  if (i > 0) {
    const prefix = raw.slice(0, i)
    return { provider: PROVIDER_LABEL[prefix] ?? prefix, model: raw.slice(i + 1) }
  }
  return { provider: 'IHUI 号池', model: raw }
}

function rankClass(rank: number): string {
  if (rank === 1) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
  if (rank === 2) return 'bg-gray-200 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300'
  if (rank === 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-500'
  return 'bg-muted/50 text-muted-foreground'
}

const BENCH_ORDER = ['HumanEval-50', 'HumanEval-164', 'IHUI-8']

export function BenchmarkTable() {
  const benchmarks = React.useMemo(() => {
    const present = [...new Set(data.entries.map((e) => e.benchmark))]
    return present.sort((a, b) => {
      const ai = BENCH_ORDER.indexOf(a)
      const bi = BENCH_ORDER.indexOf(b)
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })
  }, [])
  const [active, setActive] = React.useState(
    benchmarks.includes('HumanEval-50') ? 'HumanEval-50' : (benchmarks[0] ?? 'HumanEval-50'),
  )
  const rows = data.entries.filter((e) => e.benchmark === active)

  return (
    <Card>
      <CardContent className="space-y-3 p-3 min-[640px]:p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-semibold">
              <FlaskConical className="h-4 w-4" />
              <span>IHUI-AI 实测榜</span>
            </h2>
            <p className="mt-0.5 text-label text-muted-foreground">
              号池真实模型、真实落盘、真实执行测试；不是厂商自报分数
            </p>
          </div>
          <span className="hidden shrink-0 text-label text-muted-foreground/70 min-[640px]:inline">
            更新 {new Date(data.generatedAt).toLocaleDateString('zh-CN')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
          {benchmarks.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setActive(b)}
              className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs transition-colors ${
                active === b
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <p className="text-label text-muted-foreground">{BENCH_LABEL[active] ?? active}</p>

        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">排名</TableHead>
                <TableHead>模型</TableHead>
                <TableHead className="hidden w-24 min-[640px]:table-cell">来源平台</TableHead>
                <TableHead className="w-24">通过</TableHead>
                <TableHead className="w-20">通过率</TableHead>
                <TableHead className="hidden w-20 min-[768px]:table-cell">样本</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const { provider, model } = splitModel(r.model)
                return (
                  <TableRow key={`${r.benchmark}-${r.model}`} className="hover:bg-accent/40">
                    <TableCell>
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-label font-semibold tabular-nums ${rankClass(i + 1)}`}
                      >
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium" title={r.model}>
                      {model}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground min-[640px]:table-cell">
                      {provider}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.passed}/{r.total}
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {(r.passRate * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground min-[768px]:table-cell">
                      {r.total}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-label leading-relaxed text-muted-foreground">
          说明：同一模型同一基准只保留样本量最大的一次，避免小样本刷分。HumanEval 使用官方 164
          题，公开榜取同题前 50 题便于横向比较；模型补全函数后由本机 Python 真实执行官方测试。IHUI-8
          为 Python、TypeScript、Shell 八道真实任务，全部跑 pytest / tsc / bash
          校验。原始结果与复现脚本在仓库 apps/cli/benchmarks。
        </p>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
