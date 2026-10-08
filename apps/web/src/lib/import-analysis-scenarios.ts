// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 导入会话「用场景分析」的**目录访问层**(D28 补齐层,2026-10-03)
 *
 * 与 `import-analysis.ts` 的分工:那边是纯判据(读 provenance / 推荐 id / 填模板),
 * 不碰 210 条模板正文;这边是唯一 import 投影的模块,只在「用场景分析」弹窗
 * `await import()` 时被拉入 —— 会话消息区显示"来自微信导入"不该为 493KB 目录买单。
 *
 * 投影文件 = `products/ai-prompt-library/`(付费数字商品)的机器投影,20 分类 / 210 条。
 * 这里的函数全部是它的**只读视图**,不做任何内容改写。
 */
import {
  IMPORT_ANALYSIS_CATEGORIES,
  IMPORT_ANALYSIS_SCENARIOS,
  type ImportAnalysisCategory,
  type ImportAnalysisScenario,
} from './import-analysis-catalog.generated'
import {
  CODE_RECOMMENDED_SCENARIO_IDS,
  FALLBACK_RECOMMENDED_SCENARIO_IDS,
  WECHAT_RECOMMENDED_SCENARIO_IDS,
  type ImportSource,
} from './import-analysis'

export type { ImportAnalysisCategory, ImportAnalysisScenario }

/** 全部分类(投影内已按 id 升序) */
export function listCategories(): readonly ImportAnalysisCategory[] {
  return IMPORT_ANALYSIS_CATEGORIES
}

/** 全库场景(投影内已按 id 升序) */
export function listScenarios(): readonly ImportAnalysisScenario[] {
  return IMPORT_ANALYSIS_SCENARIOS
}

/** id → 场景索引(模块级常量,只建一次) */
const SCENARIO_BY_ID: ReadonlyMap<string, ImportAnalysisScenario> = new Map(
  IMPORT_ANALYSIS_SCENARIOS.map((s) => [s.id, s]),
)

/**
 * 按 id 取场景。
 *
 * 未命中返回 `null` —— 库更新删掉某个 id 时 UI 诚实显示"该场景已不可用",
 * **不静默换一条**:静默替换会让用户填的 variables 与实际模板对不上,
 * 产出一份"看着对其实跑的是别的场景"的分析,这比报错糟得多。
 */
export function findScenario(id: string): ImportAnalysisScenario | null {
  return SCENARIO_BY_ID.get(id) ?? null
}

/** 某分类下的场景 */
export function listScenariosByCategory(categoryId: string): ImportAnalysisScenario[] {
  return IMPORT_ANALYSIS_SCENARIOS.filter((s) => s.categoryId === categoryId)
}

/**
 * 该导入来源的推荐场景(已剔除库里已不存在的 id)。
 *
 * wechat → 聊天记录类(纪要 / 待办 / 复盘 / 客诉 / 沟通),其余四源 → 编程会话类
 * (审查 / 重构 / 调试)。这是 `wechat` 区别于 codex/claude_code 导入的关键:
 * 同一个"用场景分析"入口,默认落到的是对**这份记录本身**有用的场景上。
 */
export function recommendedScenarios(
  source: ImportSource | null | undefined,
): ImportAnalysisScenario[] {
  const raw =
    source === 'wechat'
      ? WECHAT_RECOMMENDED_SCENARIO_IDS
      : source === 'claude_code' || source === 'codex' || source === 'cursor' || source === 'aider'
        ? CODE_RECOMMENDED_SCENARIO_IDS
        : FALLBACK_RECOMMENDED_SCENARIO_IDS
  const out: ImportAnalysisScenario[] = []
  for (const id of raw) {
    const s = SCENARIO_BY_ID.get(id)
    if (s) out.push(s)
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
