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
 *   1. `full` —— 全量档,**只有三种来路**:
 *      a) 逃生舱 `IHUI_GATE_SCOPE=full`(排障 / 发版前 / 怀疑漏判时显式强制全量);
 *      b) 暂存集含**判据库**(`JUDGEMENT_LIBS`)—— 这些文件被大量门 import,改错会让门
 *         **静默失效**(不报错、判据却变了),必须全量验证(CI 是延迟发现 ⇒ 本地当场验);
 *      c) 暂存集为空 / 读不到 —— 判不出就不裁,**失效方向永远是"多跑",不是"少跑"**。
 *
 *   2. `meta` —— 元门档,**本地默认档**(2026-10-22 起本地一律 meta、全量归 CI):
 *      暂存集不含判据库的一切提交都走此档,包括改 `apps/`、`packages/` 的**业务提交**。
 *      业务提交的 reason 带 `businessCount` 说明(业务判据归 CI),本地只跑
 *      "判守门自身健康度 / 仓库状态 / 文档一致性"的门(`isMetaGate`)。
 *
 *   3. 兜底:唯一的回落是 1.c —— 暂存集为空 / 读不到时走 `full`,宁可多跑不可漏跑。
 *
 * 为什么不用"自动提取门扫描的路径":实测 270 门里只有 1 门是纯业务路径,221 门是
 * "业务 + scripts 混合"(都 import scripts/lib 公共库)⇒ 机器分不出来,只能靠显式清单。
 *
 * 2026-11-14(DG-14):元门档的识别从**脚本名前缀正则**改为**登记表声明**
 * (`scripts/data/gate-channel-registry.json` 的 `metaGates`)。旧做法是"命名命中即入档",
 * 后果是新增门只要不叫 check-gate-/check-doc-/… 就永远不在本地跑,而登记表还认为它"已接线"
 * (DG-14 的零通道缺口)。现在:① 入档必须显式声明;② 漏声明的门由 `check-gate-triggers`
 * 第二维判红(新门无任何阻断通道 ⇒ 红),存量无通道门逐枚登记在 `uncoveredBaseline` 只减不增。
 */

/** 业务路径:只用于统计 `businessCount` 并在 reason 里说明「业务判据归 CI」(本地仍走 meta)。 */
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
// DG-14(2026-11-14):元门档声明表 = 通道登记表单源。gate-scope 只消费 `metaGates`,
// push / required CI 两条通道由 check-gate-triggers 第二维从注册表与 workflow 自动发现。
import channelRegistry from '../data/gate-channel-registry.json' with { type: 'json' }

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
 * 元门档登记表(DG-14,2026-11-14)。
 *
 * 口径:**判守门自身健康度 / 仓库状态 / 文档一致性**的门才算元门,且必须**逐枚声明** ——
 * 清单单源 = `scripts/data/gate-channel-registry.json` 的 `metaGates`(对象,键为 script 名,
 * 值为入档理由)。不再按脚本名前缀猜:命名启发式会让"新增门命名不命中"静默落进零通道。
 *
 * 判业务代码的门(UI 样式、组件规范、i18n 文案、API 路由等)一律不算。
 * 本机环境状态读数(端口占用 / 轮换留痕 / 锁持有)**算** —— 它判的不是本次改动,而是
 * "这台机器此刻能不能干活",成本在 0.1s 量级;把它排除出 meta 档 = 本地永不跑,
 * 而 CI runner 上没有本机状态可读 ⇒ 两边都没有读数(S-O69 门 280 即此例)。
 *
 * 新门要进元门档 = 在登记表里加一行(理由必填);不加也没进 push/required CI ⇒
 * `check-gate-triggers` 第二维判红,不会静默落进"只在报告档"的第三态。
 */
const META_GATES = new Set(Object.keys(channelRegistry.metaGates || {}))

/** 该门是否属于元门档(判守门自身 / 仓库状态 / 文档)。 */
export function isMetaGate(check) {
  if (!check) return false
  const script = String(check.script || '')
  return META_GATES.has(script)
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

export const __testing = {
  BUSINESS_PATH_RE,
  JUDGEMENT_LIBS,
  SCHEDULER_LIBS,
  META_GATES,
  CHANNEL_REGISTRY: channelRegistry,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
