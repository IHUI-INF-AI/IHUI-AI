// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 导入会话「用场景分析」面板(小程序端,2026-10-03)
 *
 * 与 web(import-analysis-dialog.tsx)/ RN(ImportAnalysisSheet.tsx)同款三段结构
 * (选场景 → 填 variables → 发起),但**刻意不共用组件**:三端 UI 基座完全不同
 * (Radix / RN Modal / Taro),硬抽组件只会造出一个三端都要传一堆 props 的空壳。
 * 真正共享的是**判据与目录**(下沉到 `@ihui/shared/import-analysis*`),
 * 故三端对同一份导入记录给出的推荐场景、拼出的分析指令必然一致。
 *
 * ⚠️ 目录**静态 import**(不是动态 import):本端生产代码里没有任何 `import()` 先例 ——
 * Taro 小程序对异步 chunk 数量与加载有限制(config/index.ts 明确"不配置 splitChunks/
 * runtimeChunk,保留 Taro 默认打包策略"),实测动态 import 会让构建在
 * "Module not found: ./import-analysis/scenarios"(exports 字段解析)处直接失败。
 *
 * 静态 import 会不会把投影压进主包?**不会**,本轮已实测**:
 *   - 本页在 pkg-ai 分包(20 MB 上限,实测基线 570,982 B);
 *   - config/index.ts 的 `mini.optimizeMainPackage: { enable: true }` 会把**仅被分包引用**
 *     的公共代码自动下沉到分包(该开关正是为"主包 2 MB 硬上限"而设,见其文件头注);
 *   - 没有任何主包页引用本模块 ⇒ 投影落 pkg-ai,主包零增长(见交付报告的实测前后对比)。
 * 这也是"判据层 provenance.ts 刻意不静态引投影、只有本面板引"的原因:
 * 投影的**唯一**引用点在本分区内,下沉规则因此可判定。
 *
 * ## 本端吃的是 slim 投影(2026-10-03)
 *
 * 实测本页产物 736,316 B,其中目录投影 707,113 B = **96.03%**,而投影内 `template`
 * 一个字段就占 89.4% —— 它是分析指令正文,不可裁。故 slim 只裁**纯展示**字段
 * (`description` / `tags` / 分类的 category / categoryEn),实测省 33,778 B。
 * 本面板因此经 `@ihui/shared/import-analysis/scenarios-slim` 消费(判据与拼装逻辑
 * 仍与 web / RN 共用同一份 `provenance.ts`,三端推荐场景与拼出的指令逐字一致)。
 * ⚠️ 下面所有场景展示都只读 slim 里**存在**的字段:原 `s.useCase || s.description`
 * 已改为 `s.useCase` —— useCase 在本库 210/210 非空,两者本就是同一个值,
 * 改后 UI 显示逐字不变,且不会露出 undefined。
 *
 * 发起不新造 LLM 调用链:onSubmit 抛出一条**普通用户消息**,页面侧跳聊天页
 * 由其既有 sendMessage(→ api/index 的 chatStream)发出,历史里的导入记录即本轮上下文。
 */
import { useCallback, useMemo, useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import ThemeRoot from '@/components/ThemeRoot'
import { buildAnalysisPrompt, type ImportSource } from '@ihui/shared/import-analysis'
import {
  listCategories,
  listScenarios,
  recommendedScenarios,
  type ImportAnalysisCategory,
  type ImportAnalysisScenario,
} from '@ihui/shared/import-analysis/scenarios-slim'
import type { TtFn } from '@/i18n'

export interface ImportAnalysisPanelProps {
  visible: boolean
  onClose: () => void
  /** 导入来源(决定推荐场景);null = 非导入会话,只给全库 */
  source: ImportSource | null
  tt: TtFn
  /** 发起:拼好的分析指令,页面侧跳聊天页由既有通道发出 */
  onSubmit: (prompt: string) => void
}

/**
 * 目录(投影)是**同步常量**:静态 import 之后没有加载态可言。
 * 保留 phase 联合是为了让"目录不可用"有一个可展示的失败面 —— 与 web/RN 的
 * dynamic import 不同,这里 phase 恒为 'ready',catalogUnavailable 恒为 false。
 */
type CatalogState =
  | { phase: 'loading' }
  | {
      phase: 'ready'
      categories: readonly ImportAnalysisCategory[]
      recommended: ImportAnalysisScenario[]
      all: readonly ImportAnalysisScenario[]
    }
  | { phase: 'error'; message: string }

export function ImportAnalysisPanel({
  visible,
  onClose,
  source,
  tt,
  onSubmit,
}: ImportAnalysisPanelProps) {
  // 目录静态可得,useMemo 缓存一次即可(210 条 filter/recommend 每次渲染重算没有必要)
  const catalog = useMemo<CatalogState>(() => {
    try {
      return {
        phase: 'ready',
        categories: listCategories(),
        recommended: recommendedScenarios(source),
        all: listScenarios(),
      }
    } catch (e) {
      return { phase: 'error', message: e instanceof Error ? e.message : String(e) }
    }
    // source 变化即换一个推荐集;catalog 本身是模块级常量,不参与依赖
  }, [source])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [browseOpen, setBrowseOpen] = useState(false)

  // 未填变量的占位提示(i18n 一处,发起时共用同一个函数)
  const pendingLabel = useCallback(
    (name: string) => tt('conversationImport.analysisPendingVar', '（待补充：{name}）', { name }),
    [tt],
  )

  const selected: ImportAnalysisScenario | null =
    catalog.phase === 'ready' && selectedId !== null
      ? (catalog.all.find((s) => s.id === selectedId) ?? null)
      : null

  const inCategory =
    catalog.phase === 'ready' && categoryId !== null
      ? catalog.all.filter((s) => s.categoryId === categoryId)
      : []

  const handleSubmit = () => {
    if (!selected) return
    onSubmit(buildAnalysisPrompt(selected, variables, pendingLabel))
  }

  if (!visible) return null

  return (
    <View className="fixed inset-0 z-[100] flex flex-col bg-black/45">
      <ThemeRoot className="mt-auto max-h-[85vh] flex flex-col bg-background rounded-t-lg px-[32rpx] pt-[32rpx] pb-[40rpx]">
        {/* 头部:标题 + 关闭 */}
        <View className="flex items-center justify-between mb-[16rpx]">
          <Text className="text-[length:32rpx] text-foreground font-semibold">
            {tt('conversationImport.analysisTitle', '用场景分析')}
          </Text>
          <View onClick={onClose} hoverClass="opacity-60" className="py-[8rpx] px-[16rpx]">
            <Text className="text-[length:26rpx] text-muted-foreground">
              {tt('conversationImport.analysisClose', '关闭')}
            </Text>
          </View>
        </View>
        <Text className="block text-[length:24rpx] text-muted-foreground mb-[20rpx]">
          {tt(
            'conversationImport.analysisDesc',
            '选一个场景、填写变量，分析指令会作为一条消息发进本会话——本会话的导入记录就是它的上下文。',
          )}
        </Text>

        <ScrollView className="max-h-[52vh] h-0" scrollY>
          {catalog.phase === 'error' && (
            <ThemeRoot className="flex items-start gap-[12rpx] p-[20rpx] mb-[20rpx] bg-card rounded-md">
              <View className="flex-shrink-0 mt-[4rpx]">
                <LineIcon name="triangle-alert" size={26} color="var(--color-destructive)" />
              </View>
              <Text className="flex-1 text-[length:24rpx] text-destructive">
                {tt('conversationImport.analysisLoadFailed', '场景库加载失败：{error}', {
                  error: catalog.message,
                })}
              </Text>
            </ThemeRoot>
          )}

          {catalog.phase === 'ready' && (
            <View>
              {/* ① 选场景:推荐区(按来源给默认)+ 全库浏览 */}
              <Text className="block text-[length:26rpx] text-foreground font-semibold mb-[12rpx]">
                {tt('conversationImport.analysisScenarioLabel', '① 选择分析场景')}
              </Text>
              {catalog.recommended.length > 0 && (
                <>
                  <Text className="block text-[length:22rpx] text-muted-foreground mb-[12rpx]">
                    {tt('conversationImport.analysisRecommended', '推荐（按导入来源）')}
                  </Text>
                  {catalog.recommended.map((s) => (
                    <ScenarioRow
                      key={s.id}
                      title={s.title}
                      subtitle={s.useCase}
                      active={selectedId === s.id}
                      onClick={() => {
                        setSelectedId(s.id)
                        setVariables({})
                      }}
                    />
                  ))}
                </>
              )}

              <View
                onClick={() => setBrowseOpen((v) => !v)}
                hoverClass="opacity-60"
                className="py-[16rpx]"
              >
                <Text className="text-[length:24rpx] text-primary">
                  {tt('conversationImport.analysisBrowseAll', '浏览全部场景（{count}）', {
                    count: catalog.all.length,
                  })}
                </Text>
              </View>

              {browseOpen && (
                <View className="mb-[20rpx]">
                  <Text className="block text-[length:22rpx] text-muted-foreground mb-[12rpx]">
                    {tt('conversationImport.analysisCategoryLabel', '场景分类')}
                  </Text>
                  <View className="flex flex-wrap gap-[12rpx] mb-[16rpx]">
                    <CategoryChip
                      label={tt('conversationImport.analysisAllCategories', '全部分类')}
                      active={categoryId === null}
                      onClick={() => setCategoryId(null)}
                    />
                    {catalog.categories.map((c) => (
                      <CategoryChip
                        key={c.id}
                        label={`${c.categoryZh}(${c.count})`}
                        active={categoryId === c.id}
                        onClick={() => setCategoryId(c.id)}
                      />
                    ))}
                  </View>
                  {categoryId !== null &&
                    inCategory.map((s) => (
                      <ScenarioRow
                        key={s.id}
                        title={s.title}
                        subtitle=""
                        active={selectedId === s.id}
                        onClick={() => {
                          setSelectedId(s.id)
                          setVariables({})
                        }}
                      />
                    ))}
                </View>
              )}

              {/* ② 填 variables */}
              {selected && (
                <View className="mb-[20rpx]">
                  <Text className="block text-[length:26rpx] text-foreground font-semibold mb-[12rpx]">
                    {tt('conversationImport.analysisVariablesLabel', '② 填写变量：{title}', {
                      title: selected.title,
                    })}
                  </Text>
                  {selected.variables.length === 0 ? (
                    <Text className="block text-[length:22rpx] text-muted-foreground">
                      {tt('conversationImport.analysisNoVariables', '该场景无需填写变量。')}
                    </Text>
                  ) : (
                    selected.variables.map((name) => (
                      <View key={name} className="mb-[16rpx]">
                        <Text className="block text-[length:22rpx] text-muted-foreground mb-[8rpx]">
                          {name}
                        </Text>
                        <Input
                          className="h-[72rpx] px-[20rpx] text-[length:26rpx] text-foreground bg-card rounded-sm border border-border"
                          value={variables[name] ?? ''}
                          placeholder={tt(
                            'conversationImport.analysisVarPlaceholder',
                            '填写 {name}（可留空）',
                            { name },
                          )}
                          placeholderClass="text-[var(--color-text-tertiary)]"
                          onInput={(e) =>
                            setVariables((prev) => ({ ...prev, [name]: e.detail.value }))
                          }
                        />
                      </View>
                    ))
                  )}
                  <Text className="block text-[length:22rpx] text-muted-foreground">
                    {tt(
                      'conversationImport.analysisOptionalHint',
                      '变量可留空：留空的部分会明确标为「待补充」，不会被静默丢弃。',
                    )}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* ③ 发起 */}
        {catalog.phase === 'ready' && (
          <View className="mt-[20rpx] pt-[20rpx] border-t border-border">
            <Text className="block text-[length:22rpx] text-muted-foreground mb-[16rpx]">
              {selected
                ? tt(
                    'conversationImport.analysisEstimate',
                    '预计约 {tokens} tokens · 难度 {difficulty}',
                    { tokens: selected.estimatedTokens, difficulty: selected.difficulty },
                  )
                : tt('conversationImport.analysisPickFirst', '请先选择一个场景')}
            </Text>
            <View
              onClick={handleSubmit}
              hoverClass="opacity-80"
              className={`h-[88rpx] flex items-center justify-center gap-[8rpx] rounded-md ${
                selected ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <LineIcon name="sparkles" size={28} color="var(--color-foreground)" />
              <Text className="text-[length:28rpx] text-foreground font-semibold">
                {tt('conversationImport.analysisSubmit', '发起分析')}
              </Text>
            </View>
          </View>
        )}
      </ThemeRoot>
    </View>
  )
}

/** 一个可选场景(推荐区与全库浏览共用同一种行形态) */
function ScenarioRow({
  title,
  subtitle,
  active,
  onClick,
}: {
  title: string
  subtitle: string
  active: boolean
  onClick: () => void
}) {
  return (
    <ThemeRoot
      className={`p-[20rpx] mb-[12rpx] rounded-md border bg-card ${
        active ? 'border-[var(--color-border-medium)]' : 'border-border'
      }`}
    >
      <View onClick={onClick} hoverClass="opacity-80">
        <Text className="block text-[length:26rpx] text-foreground font-semibold">{title}</Text>
        {subtitle !== '' && (
          <Text className="block text-[length:22rpx] text-muted-foreground mt-[6rpx]">
            {subtitle}
          </Text>
        )}
      </View>
    </ThemeRoot>
  )
}

/** 分类胶囊 */
function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <View
      onClick={onClick}
      hoverClass="opacity-80"
      className={`px-[20rpx] py-[10rpx] rounded-md border ${
        active ? 'bg-primary border-[var(--color-border-medium)]' : 'bg-card border-border'
      }`}
    >
      <Text className="text-[length:22rpx] text-foreground">{label}</Text>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
