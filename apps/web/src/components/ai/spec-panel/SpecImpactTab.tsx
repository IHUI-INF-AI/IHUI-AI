// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Spec 模式面板:影响分析标签页(2026-07-23 超越创新)
import { Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SpecPanelApi } from './useSpecPanel'
import { RISK_BADGE, RISK_LABEL } from './constants'

export function SpecImpactTab({ p }: { p: SpecPanelApi }) {
  const { t } = p
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={p.handleAnalyzeImpact}
          disabled={p.impactLoading}
          className={cn(
            'flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            p.impactLoading && 'cursor-not-allowed opacity-60',
          )}
        >
          {p.impactLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          <span>{p.impactLoading ? '分析中' : '分析影响'}</span>
        </button>
      </div>
      <textarea
        value={p.impactInput}
        onChange={(e) => p.setImpactInput(e.target.value)}
        placeholder={t('proposedChangePlaceholder')}
        rows={5}
        className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
      />
      {p.impactResult && (
        <div className="max-h-[45vh] space-y-2 overflow-auto rounded-md border border-border bg-background p-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">风险评分:</span>
            <span
              className={cn(
                'rounded px-2 py-0.5 text-xs font-bold',
                RISK_BADGE[p.impactResult.riskLevel],
              )}
            >
              {RISK_LABEL[p.impactResult.riskLevel] || p.impactResult.riskLevel}
            </span>
            {p.impactResult.llmAnalysis?.summary && (
              <span className="text-xs text-muted-foreground">
                {p.impactResult.llmAnalysis.summary}
              </span>
            )}
          </div>
          {p.impactResult.llmAnalysis?.riskReason && (
            <p className="text-xs text-muted-foreground">{p.impactResult.llmAnalysis.riskReason}</p>
          )}
          <div>
            <p className="text-xs font-medium text-foreground">
              受影响文件 ({p.impactResult.affectedFiles.length})
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.impactResult.affectedFiles.slice(0, 20).map((f, i) => (
                <span
                  key={i}
                  className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {f}
                </span>
              ))}
              {p.impactResult.affectedFiles.length > 20 && (
                <span className="text-[10px] text-muted-foreground">
                  +{p.impactResult.affectedFiles.length - 20}
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">
              受影响测试 ({p.impactResult.affectedTests.length})
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.impactResult.affectedTests.slice(0, 10).map((f, i) => (
                <span
                  key={i}
                  className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {f}
                </span>
              ))}
              {p.impactResult.affectedTests.length > 10 && (
                <span className="text-[10px] text-muted-foreground">
                  +{p.impactResult.affectedTests.length - 10}
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">
              下游 spec ({p.impactResult.downstreamSpecs.length})
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.impactResult.downstreamSpecs.map((f, i) => (
                <span
                  key={i}
                  className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
          {p.impactResult.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground">建议措施</p>
              <ul className="mt-1 space-y-0.5">
                {p.impactResult.recommendations.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    <span className="text-foreground">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.impactResult.llmAnalysis?.error && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              LLM 不可用({p.impactResult.llmAnalysis.error}),仅展示静态扫描结果
            </p>
          )}
        </div>
      )}
      {!p.impactResult && !p.impactLoading && (
        <p className="text-xs text-muted-foreground p-2">
          填写拟修改内容后点击「分析影响」,LLM + 静态扫描预测影响范围 + 风险评分
        </p>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
