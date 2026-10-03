// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 导入会话「用场景分析」的**瘦身目录访问层**(小程序端专用,2026-10-03)
 *
 * 与同目录 `scenarios.ts`(full 投影访问层)的关系:**同一份权威源的两个访问层**,
 * 判据(`provenance.ts` 的推荐 id 表)与拼装逻辑共用,只有"投影"不同:
 *   - `scenarios.ts`         → `catalog.generated.ts`(full):web / mobile-rn 消费
 *   - `scenarios-slim.ts`(本文件)→ `catalog.slim.generated.ts`(slim):小程序端消费
 *
 * ## 为什么小程序要单独一份
 *
 * 实测(2026-10-03,`IHUI_MINIAPP_OUTPUT_ROOT=D:/DevEnv/build-verify/miniapp-analysis`):
 * `pkg-ai/ai/conversation-import.js` = 736,316 B,其中目录投影 **707,113 B = 96.03%**;
 * 而投影内 `template` 一个字段就 632,331 B(89.4%)—— 它是 `buildAnalysisPrompt` 的
 * 输入正文,**裁掉就没有这个功能了**,故瘦身能动的只有 template 之外的纯展示字段。
 * slim 裁掉 `description` / `tags` / 分类的 `category` / `categoryEn`,实测省 33,778 B。
 * 是个诚实但有限的量:本层存在的意义是"把能省的都省了",不是"把包体减半"。
 *
 * ⚠️ 本端**只能静态 import**:Taro 小程序对异步 chunk 数量与 import() 加载有限制
 * (`config/index.ts` 明确不配置 splitChunks / runtimeChunk),全端生产代码 `import()`
 * 先例数为 0。本文件静态引 slim 投影 ⇒ 投影落 `pkg-ai` 分包,主包零增长。
 *
 * ## 与 full 的行为等价性(不是"差不多",是逐字相同)
 *
 * 裁掉的三个字段在三端**都没有功能性读点**:
 *   - `tags`:全仓零读点(web / RN / 小程序 / shared 都不读)。
 *   - 分类 `category` / `categoryEn`:全仓零读点(只有 `icon` 被 web 读,web 吃 full)。
 *   - `description`:三端 UI 都写 `s.useCase || s.description`,而 useCase 在本库
 *     210/210 条**全部非空** ⇒ slim 下 `s.useCase || s.description` 恒等于 `s.useCase`,
 *     显示逐字不变;`buildAnalysisPrompt` 取的是同一个 `useCase || description`。
 * 也就是说 slim **没有让用户少看到任何一个字**,只是不再把用不到的字符串打进包。
 */
import {
  IMPORT_ANALYSIS_CATEGORIES,
  IMPORT_ANALYSIS_SCENARIOS,
  type ImportAnalysisCategory,
  type ImportAnalysisScenario,
} from './catalog.slim.generated'
import {
  CODE_RECOMMENDED_SCENARIO_IDS,
  FALLBACK_RECOMMENDED_SCENARIO_IDS,
  WECHAT_RECOMMENDED_SCENARIO_IDS,
  type ImportSource,
} from './provenance'

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
 * 按 id 取场景。未命中返回 `null` —— 与 full 层同一口径:**不静默换一条**
 * (静默替换会让用户填的 variables 与实际模板对不上)。
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
 * 判据表来自 `provenance.ts`,与 full 层**同一份** —— 三端推荐必须一致。
 */
export function recommendedScenarios(source: ImportSource | null | undefined): ImportAnalysisScenario[] {
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
