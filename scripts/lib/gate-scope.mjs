/**
 * gate-scope.mjs — 守门档位判定(2026-10-22 立)
 *
 * 立因(机主原话):"提交个代码要 15 分钟,我最多接受一分钟"。实测账:全量 154 门 469s CPU,
 * 本机 12 物理核 8 并发 + CPU 竞争下墙钟下限约 400s —— **全量 + 60 秒在本机物理不可能**。
 * 而把耗时从 pre-commit 挪到 post-commit 只是改变"命令何时返回",总工作量一秒没少(机主已当面指出)。
 *
 * 唯一真解:**按改动性质裁剪门集**。改工具代码时,判业务 UI 的门(apps/web 的 rounded-full、
 * miniapp 样式等)与本次改动毫无关系,跑它们纯属浪费。
 *
 * 三档,判据只认**路径**,不认人的主观判断:
 *
 *   1. `full`  —— 强制全量,两种情形:
 *      a) 暂存集含 `apps/` 或 `packages/`(业务代码变了,所有门都该判);
 *      b) 暂存集含**判据库**(`JUDGEMENT_LIBS`)—— 这些文件被大量门 import,改错会让门
 *         **静默失效**(不报错、判据却变了),必须全量验证。
 *
 *   2. `meta` —— 元门档:暂存集只含工具/文档/钩子路径,且不含判据库。
 *      只跑"判守门自身健康度 / 仓库状态 / 文档一致性"的门(`isMetaGate`)。
 *
 *   3. 任何判不出的情形(空暂存集、路径读不到)一律回落 `full` ——
 *      **失效方向永远是"多跑",不是"少跑"**。
 *
 * 逃生舱:`IHUI_GATE_SCOPE=full` 强制全量(排障 / 发版前 / 怀疑漏判时)。
 *
 * 为什么不用"自动提取门扫描的路径":实测 270 门里只有 1 门是纯业务路径,221 门是
 * "业务 + scripts 混合"(都 import scripts/lib 公共库)⇒ 机器分不出来,只能靠命名规范 + 显式清单。
 */

/** 业务路径:改了这些,所有门都该判。 */
const BUSINESS_PATH_RE = /^(apps|packages)\//

/**
 * 判据库(2026-10-22 立):被大量门 import 的**判据/基础设施**代码。
 * 改这些必须全量 —— 它们不改变"门跑不跑",而是改变"门怎么判",改错会静默失效。
 * 新增此类文件时请加到这里:漏加的代价是"少跑",这是唯一不能接受的失效方向。
 */
const JUDGEMENT_LIBS = new Set([
  'scripts/lib/face-reader.mjs', // 全仓门的 git 派生唯一出口
  'scripts/lib/git-lock.mjs', // 写锁:错了会让所有门读到半截状态
  'scripts/lib/gitdir.mjs', // gitdir 解析
  'scripts/lib/scratch-dir.mjs', // 临时目录:错了会让门互相踩
  'scripts/lib/gate-failure-kind.mjs', // 失败归因
  'scripts/lib/staging-snapshot.js', // 索引快照
  'scripts/lib/guardian-batch-attest.mjs', // 批次留痕
  'scripts/lib/guardian-pushgate-cache.mjs', // push 门缓存
])

/**
 * 只影响**调度**、不影响**判据**的基础设施:改它们走元门档即可。
 * 理由:元门本身跑通就证明调度/钩子链没坏;业务门的判据逻辑并未被触碰。
 */
const SCHEDULER_LIBS = new Set([
  'scripts/lib/guardian-executor.mjs', // 门的调度/并行/超时
  'scripts/lib/pre-commit-hook.js', // 钩子入口
  'scripts/lib/post-commit-hook.js', // 提交后钩子(不影响 pre-commit 判定)
  'scripts/guardian-runner.mjs', // 门注册表本身
])

/**
 * 元门档的门识别规则(按 script 名)。
 *
 * 口径:**判守门自身健康度 / 仓库状态 / 文档一致性**的门才算元门。
 * 判业务代码的门(UI 样式、组件规范、i18n 文案、API 路由等)一律不算。
 *
 * 命名不规范的门不会被误收 —— 它们留在全量档,失效方向是"多跑"。
 */
const META_SCRIPT_RE = new RegExp(
  '^(' +
    [
      'check-gate-', // 守门接线/元数据
      'check-husky-', // 钩子形态
      'check-no-conflict-markers', // 冲突标记
      'check-commit-loss', // 提交丢失(30a)
      // 刻意**不**收 `check-architecture-policy`(103):全仓架构策略存量对账,实测 18.2s,
      // 判的是存量不是本次改动;改工具代码时它恒为"无关"。要在此刻看:IHUI_GATE_SCOPE=full。
      'check-watermark', // 水印语法/覆盖(47 查"本次携带的文件",已覆盖本档)
      // 刻意**不**收 `provenance-ledger`(107):它是"全仓台账存量对账",单轮 58.9s,
      // 判的是存量而不是本次改动;本次文件的水印完整性已由 47 check-watermark-coverage 覆盖。
      // 改工具代码时把它拉进来,元门档就永远进不了 60 秒。
      'check-doc-', // 文档数字/引用
      'check-root-dir-clean', // 根目录整洁(44)
      'check-staged-', // 暂存面
      'check-lock-', // 锁清单
      'check-skip-env-', // 逃生舱承诺
      'check-direct-run-guard', // 直接运行守卫
      'check-mjs-syntax', // 语法
      'check-plan-', // 计划台账
      // 刻意**不**收 `check-declared-`(127 出站路由):全仓出站路由存量对账,实测 18.3s,
      // 判的是存量不是本次改动;改 API 路由时它会随 apps/ 一起进全量档。
      'check-git-', // git 派生纪律
      'check-ignored-', // 忽略规则
      'check-tracked-', // 跟踪文件
      'check-temp-', // 临时落地
      'check-scratch-', // scratch 根
      'check-frozen-', // 冻结面
      'check-forbidden-', // 禁令面
      'check-adr-', // 架构决策记录
      'check-agent-', // 代理配置
    ].join('|') +
    ')',
)

/** 该门是否属于元门档(判守门自身 / 仓库状态 / 文档)。 */
export function isMetaGate(check) {
  if (!check) return false
  const script = String(check.script || '')
  return META_SCRIPT_RE.test(script)
}

/**
 * 判定本轮该走哪一档。
 *
 * @param {string[]} stagedPaths 暂存区路径(仓库相对,正斜杠)
 * @returns {{ scope: 'full'|'meta', reason: string, businessCount: number, judgementLibs: string[] }}
 */
export function resolveGateScope(stagedPaths) {
  // 逃生舱:显式全量优先于一切推断。
  if (process.env.IHUI_GATE_SCOPE === 'full') {
    return { scope: 'full', reason: 'IHUI_GATE_SCOPE=full 强制全量', businessCount: 0, judgementLibs: [] }
  }
  // 判不出 ⇒ 全量(失效方向永远是"多跑")。
  if (!Array.isArray(stagedPaths) || stagedPaths.length === 0) {
    return { scope: 'full', reason: '暂存集为空或读不到', businessCount: 0, judgementLibs: [] }
  }
  const norm = stagedPaths.map((p) => String(p).replace(/\\/g, '/').trim()).filter(Boolean)
  const business = norm.filter((p) => BUSINESS_PATH_RE.test(p))
  if (business.length > 0) {
    return {
      scope: 'full',
      reason: `含业务路径 ${business.length} 个(如 ${business[0]})`,
      businessCount: business.length,
      judgementLibs: [],
    }
  }
  const libs = norm.filter((p) => JUDGEMENT_LIBS.has(p))
  if (libs.length > 0) {
    return {
      scope: 'full',
      reason: `含判据库 ${libs.join(' / ')}(改错会让门静默失效)`,
      businessCount: 0,
      judgementLibs: libs,
    }
  }
  return { scope: 'meta', reason: '仅工具 / 文档 / 钩子路径,不含业务代码与判据库', businessCount: 0, judgementLibs: [] }
}

/** 该路径是否属于"只影响调度"的基础设施(供日志说明用)。 */
export function isSchedulerLib(p) {
  return SCHEDULER_LIBS.has(String(p).replace(/\\/g, '/'))
}

export const __testing = { BUSINESS_PATH_RE, JUDGEMENT_LIBS, SCHEDULER_LIBS, META_SCRIPT_RE }
