// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * 判据库清单 —— **单一真相源 = `scripts/lib/judgement-libs.json`**(2026-10-22 收口)。
 *
 * 为什么单独一份 JSON:这份清单原先在 `gate-scope.mjs` 与 `pre-commit-hook.js` **各存一份**,
 * 违反 §0.6「同类判据全仓只许一份,第二份必然漂移」。改成 JSON 后 ESM 与 CJS 都能读
 * (pre-commit-hook 是 CJS,import 不了 .mjs),从此只有一处需要维护。
 *
 * 入库口径 = **被 3 道以上门 import 的 `scripts/lib/*` 公共库**(含 3)。实测口径
 * (2026-10-22,扫 guardian-runner 全部注册项的 import 语句):
 *   face-reader 184 / flag-value 59 / code-mask 47 / selftest-registrant 36 /
 *   exclude-dirs 26 / i18n-script-families 19 / i18n-message-faces 18 / logger 14 /
 *   scratch-dir 52 / i18n-key-flow 5 / gitdir 5 / plan-task-index 5 / box-geometry 4 /
 *   radius-tokens 4 / design-token-blocks 3 / third-party-roots 3 / watermark-lines 3
 *   + git-lock / gate-failure-kind / staging-snapshot / guardian-batch-attest /
 *     guardian-pushgate-cache(不靠 import 计数,但同属"改错让门静默失效"族)
 *
 * 改这些文件 ⇒ 本地强制 full。理由:它们被大量门 import,改错会让门**静默失效**
 * (不报错、判据却变了),而 CI 是延迟发现 ⇒ 本地必须当场验。
 *
 * 复核命令(新增 lib 后跑一遍,别靠记忆):
 *   node -e "const fs=require('fs');const src=fs.readFileSync('scripts/guardian-runner.mjs','utf8');
 *   const regs=[...src.matchAll(/script: '([^']+)'/g)].map(m=>m[1]);const c={};
 *   for(const s of regs){let t='';try{t=fs.readFileSync('scripts/'+s,'utf8')}catch{continue}
 *   for(const m of t.matchAll(/from '(\.\.?\/lib\/[a-z0-9-]+\.(?:mjs|js))'/g)){const k=m[1].replace(/^\.*\//,'');c[k]=(c[k]||0)+1}}
 *   console.log(Object.entries(c).filter(([,n])=>n>=3).sort((a,b)=>b[1]-a[1]))"
 */
import judgementLibs from './judgement-libs.json' with { type: 'json' }

const JUDGEMENT_LIBS = new Set(judgementLibs)

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
    return {
      scope: 'full',
      reason: 'IHUI_GATE_SCOPE=full 强制全量',
      businessCount: 0,
      judgementLibs: [],
    }
  }
  // 2026-10-22 机主令"那就上 CI":全量守门移交 CI(.github/workflows/guardian-full.yml),
  // **本地一律只跑元门档** —— 包括改 apps/、packages/ 的业务提交。
  //
  // 为什么业务路径不再触发 full:269 道门在本机 12 物理核上要约 400s(全仓扫描门的 CPU 下限),
  // 那是算力问题;机主要求本地提交进 1 分钟,所以本地求快、CI 求全。
  //
  // 代价(必须知道):本地 pre-commit **不再拦业务代码错误**(UI 样式/组件规范/API 路由等),
  // 那些判据只在 CI 跑。提交会先落地,CI 红了你再修 —— 这是"本地快 + CI 全"的既定分工,
  // 不是漏判。要本地也全量(发版前/排障):IHUI_GATE_SCOPE=full。
  // 唯一例外:Button 高度档位门保留 pre-commit 索引面直调(单门只读暂存文件,<1s;
  // 见 scripts/lib/pre-commit-hook.js 同名段),**不受 TOOL_ONLY 专项档跳过**——工具/文档
  // 提交的索引里没有 tsx ⇒ 0 候选直接绿。在 .github/workflows/guardian-full.yml 的自动
  // 触发启用前,这是它唯一的本地自动执行点。
  //
  // 仍然强制 full 的只剩**判据库**:那些文件被大量门 import,改错会让门静默失效,
  // 而 CI 是延迟发现 ⇒ 本地必须当场验。
  if (!Array.isArray(stagedPaths) || stagedPaths.length === 0) {
    return { scope: 'full', reason: '暂存集为空或读不到', businessCount: 0, judgementLibs: [] }
  }
  const norm = stagedPaths.map((p) => String(p).replace(/\\/g, '/').trim()).filter(Boolean)
  const libs = norm.filter((p) => JUDGEMENT_LIBS.has(p))
  if (libs.length > 0) {
    return {
      scope: 'full',
      reason: `含判据库 ${libs.join(' / ')}(改错会让门静默失效,CI 是延迟发现 ⇒ 本地当场验)`,
      businessCount: 0,
      judgementLibs: libs,
    }
  }
  const business = norm.filter((p) => BUSINESS_PATH_RE.test(p))
  const bizNote = business.length > 0 ? `(含业务路径 ${business.length} 个,业务判据归 CI)` : ''
  return {
    scope: 'meta',
    reason: `本地元门档:全量守门归 CI${bizNote}`,
    businessCount: business.length,
    judgementLibs: [],
  }
}

/** 该路径是否属于"只影响调度"的基础设施(供日志说明用)。 */
export function isSchedulerLib(p) {
  return SCHEDULER_LIBS.has(String(p).replace(/\\/g, '/'))
}

export const __testing = { BUSINESS_PATH_RE, JUDGEMENT_LIBS, SCHEDULER_LIBS, META_SCRIPT_RE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
