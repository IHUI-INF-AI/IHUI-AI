// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全面自完整性判据(2026-11-25 立)。
 *
 * 为什么要有它(补的是 prod-parity 覆盖不到的那一格):
 * `check-prod-parity` 只守 8 件生产副本(`D:\DevEnv\ihui-prod`),而真正在本机跑
 * 的那套防线 —— `scripts/security/**` 的判据、采集、告警、封禁脚本 —— 一共有
 * 57 件 .mjs,其余 49 件此前没有任何东西盯着。
 *
 * 这 49 件为什么值得盯:攻击者拿到主机后最省力的动作不是硬碰防火墙,而是**关掉
 * 我们自己的检测** —— 把 host-triage 的判据改宽、把 evidence-chain 的写入摘掉、
 * 把 autoban 的派发链删一环。改完之后每一条防线都还在"运行",每一条都返回成功,
 * 而所有哨兵都读的是同一份被改过的代码 ⇒ 自证清白。**静默失效比宕机更贵**。
 *
 * 判据与 prod-parity 的差别只在基准面:那边比的是「生产副本 vs HEAD」,这边比的是
 * 「仓库工作树盘上 vs HEAD」。三态语义完全一致,因此 PARITY_STATE 从 prod-parity
 * 单点 import,本层零复算(§0.6 单一真相源)。
 *
 * 为什么不写成阻断门:稳态下 57 件全等于 HEAD(2026-11-25 实测 57/57),但落地过程
 * 中必然会短暂出现"盘上先变、HEAD 后追"的窗口 —— 那不是入侵,是在干活。所以本层
 * 只做周期哨兵 + 告警,不进提交链(§0.2 恒红门禁令:与本次提交内容无关的红唯一
 * 结局是逼人跳门)。
 *
 * 三态纪律(§0.3):
 *   · ok           —— 每件盘上 sha 与 HEAD blob 逐字节相等;
 *   · drift        —— 能判死的不一致(盘上缺失,或 hash 不等);
 *   · undetermined —— 取不到输入(HEAD 里没有这件、git 读不到),既不当绿也不当红。
 * 清单为空同样落 undetermined:枚举到 0 个候选就报绿,等于把"没判"写成"判过"。
 */

import { PARITY_STATE } from './prod-parity.mjs'

/** 受管面:防线自身的代码。新增目录必须同笔登记,否则哨兵覆盖不到。 */
export const SELF_INTEGRITY_SCOPE = Object.freeze([
  'scripts/security',
  'deploy/win',
])

/** 只盯源码。同目录下的 .sql/.ps1 未跟踪件不在此列(它们不是运行时判据)。 */
export const SELF_INTEGRITY_EXTENSIONS = Object.freeze(['.mjs'])

/** 受管面是否覆盖某个仓库相对路径(调用方据此过滤 HEAD 清单)。 */
export function coversPath(repoPath) {
  const p = String(repoPath ?? '').split('\\').join('/')
  if (!p) return false
  if (!SELF_INTEGRITY_EXTENSIONS.some((e) => p.endsWith(e))) return false
  return SELF_INTEGRITY_SCOPE.some((root) => p === root || p.startsWith(`${root}/`))
}

/**
 * @param {{path:string, head:string|null, disk:string|null}[]} rows
 *   head = HEAD blob 的 sha;取不到传 null;
 *   disk = 盘上文件 `git hash-object --no-filters` 的 sha;文件不存在传 null。
 */
export function judgeSelfIntegrity(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      state: PARITY_STATE.UNDETERMINED,
      rows: [],
      drift: [],
      total: 0,
      reason: '受管面清单为空或未枚举到任何文件',
    }
  }

  const norm = rows.map((r) => ({
    path: String(r?.path ?? ''),
    head: r?.head ? String(r.head).toLowerCase() : null,
    disk: r?.disk ? String(r.disk).toLowerCase() : null,
  }))

  // 能判死的优先报红:某件 HEAD 取不到(清单腐烂)不该连带放过另一件已确证的漂移。
  const noHead = norm.filter((r) => !r.head)
  const drift = norm.filter((r) => r.head && (!r.disk || r.head !== r.disk))
  const noHeadNote = noHead.length
    ? `;另 ${noHead.length} 件 HEAD 取不到(未判定): ${noHead.map((r) => r.path).join(', ')}`
    : ''

  if (drift.length) {
    return {
      state: PARITY_STATE.DRIFT,
      rows: norm,
      drift,
      total: norm.length,
      reason: `${drift.length}/${norm.length} 件与 HEAD 不一致${noHeadNote}`,
    }
  }

  if (noHead.length) {
    return {
      state: PARITY_STATE.UNDETERMINED,
      rows: norm,
      drift: [],
      total: norm.length,
      reason: `HEAD 里取不到这些文件(清单已腐烂或未提交): ${noHead.map((r) => r.path).join(', ')}`,
    }
  }

  return {
    state: PARITY_STATE.OK,
    rows: norm,
    drift: [],
    total: norm.length,
    reason: `${norm.length} 件逐字节一致`,
  }
}

/** 漂移的定性:哪几件盘上没了、哪几件内容不同(告警正文与处置动作都靠它)。 */
export function classifySelfDrift(drift) {
  const missing = (drift ?? []).filter((r) => !r.disk).map((r) => r.path)
  const differing = (drift ?? []).filter((r) => r.disk && r.head !== r.disk).map((r) => r.path)
  return { missing, differing }
}

/**
 * 给收信人的可执行下一步(§5e-1:判据挂到人通道前必须回答"红了收信人能做什么")。
 *
 * 这一档的歧义必须说清:盘上与 HEAD 不一致**既可能是本人正在改**,也可能是被改过。
 * 所以动作是"先确认是不是你自己改的",而不是"立刻覆盖" —— 后者会在真被入侵时
 * 把攻击者的改动当成"正当改动"备份掉。
 */
export function remediationForSelf(state, drift = []) {
  if (state === PARITY_STATE.OK) return ''
  if (state === PARITY_STATE.UNDETERMINED) {
    return '先跑 `node scripts/security/check-self-integrity.mjs --json` 复现:`HEAD 取不到某件` 说明清单与仓库已漂,先补提交,不要直接覆盖盘上文件。'
  }
  const { missing, differing } = classifySelfDrift(drift)
  const parts = []
  if (missing.length) parts.push(`盘上缺 ${missing.length} 件`)
  if (differing.length) parts.push(`${differing.length} 件内容不同`)
  return `安全面与 HEAD 不一致(${parts.join(' / ')}):先确认是不是你本人正在改;不是你改的 ⇒ 按 HEAD 还原并查是谁动的(这 49 件被改 = 防线自身可能已失效)。`
}

export const __test__ = {
  coversPath,
  judgeSelfIntegrity,
  classifySelfDrift,
  remediationForSelf,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
