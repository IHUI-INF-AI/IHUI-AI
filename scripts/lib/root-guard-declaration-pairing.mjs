// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * root-guard-declaration-pairing.mjs — 根护栏「声明集成对」判据(2026-11-11 立,票 RP-72)
 *
 * 立因:本枚声明集改 `scripts/guardian-runner.mjs` 或 `scripts/git-guardian.mjs`(根护栏清单
 * 绑定的规则面)而未同枚改 `scripts/data/root-guard-manifest.json` ⇒ 判拦,并点名同枚 --seal
 * 出口。此前没有任何尺子在判「声明集」这一型:
 *   · check-root-guard-consistency.mjs(门 267)判「清单 ↔ 被审面」漂移(warn);
 *   · check-root-guard-manifest-sync.mjs 判「清单 ↔ HEAD 机器态」齐平;
 *   两把尺子都只在事后看机器状态,而病根在**枚内**:规则文件与清单没进同一枚提交,
 *   落地即漂移,要等下一把尺子隔天点名(票面:RP-64 已积 19 枚未声明提交)。
 *
 * 接法(票面纪律):共判新增走提交链/落地前置**声明自检**档 —— runner 只打印、不阻断;
 * 升 blocking 仍走「存量先归零」(RP-64 那 19 枚待 ack)。
 * 不提供任何 skip 变量:唯一出路是同枚重封清单
 * `node scripts/root-guard.mjs --seal --staged --reason "..."`(--staged 档正是
 * root-guard.mjs 头注写明的「改规则文件时唯一能让"清单与规则同枚"成立的一档」)。
 */

/** 根护栏清单绑定的规则面(与 root-guard-manifest.json targets 的 id 同名同路径,不抄第二份清单:只取这两枚判据面) */
export const ROOT_GUARD_RULE_FILES = ['scripts/guardian-runner.mjs', 'scripts/git-guardian.mjs']
/** 与规则面必须同枚共改的清单 */
export const ROOT_GUARD_MANIFEST_FILE = 'scripts/data/root-guard-manifest.json'

/**
 * 判「本枚声明集」是否成对。
 * @param {string[]} declaredPaths 本枚声明集(提交链 = staged 面路径;归一化为 '/' 分隔的仓库相对路径)
 * @returns {{verdict: 'na'|'pass'|'block', ruleFiles: string[], manifestFile: string}}
 *   na = 本枚没碰任何规则面(不适用);pass = 碰了规则面且同枚带清单;block = 碰了规则面而未同枚改清单。
 */
export function rootGuardDeclarationPairing(declaredPaths) {
  const paths = Array.isArray(declaredPaths) ? declaredPaths : []
  const ruleFiles = ROOT_GUARD_RULE_FILES.filter((f) => paths.includes(f))
  if (ruleFiles.length === 0) return { verdict: 'na', ruleFiles: [], manifestFile: ROOT_GUARD_MANIFEST_FILE }
  if (paths.includes(ROOT_GUARD_MANIFEST_FILE)) return { verdict: 'pass', ruleFiles, manifestFile: ROOT_GUARD_MANIFEST_FILE }
  return { verdict: 'block', ruleFiles, manifestFile: ROOT_GUARD_MANIFEST_FILE }
}
