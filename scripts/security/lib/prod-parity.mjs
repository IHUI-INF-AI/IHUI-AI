// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生产一致性判据(2026-11-25 立)。
 *
 * 为什么要有它:2026-11-24 实测过一次**静默回滚** —— 并发会话按旧 HEAD 部署过一次,
 * `D:\DevEnv\ihui-prod` 的 router 退回 505 行(不含 WAF、不含告知页),而 Windows
 * 服务仍是 `SERVICE_RUNNING`。四面自证当场从「WAF 403 3828B」变成「200 257654B
 * 正常页面」,但**没有任何东西在无人值守时告诉我们**。等到人发现,防线已经空了若干小时。
 *
 * 判据纯函数、零 IO:文件清单与状态机是唯一真相源,哨兵(check-prod-parity)与
 * 修复器(sync-prod-parity)都 import 它,禁止各写一份(§0.6)。
 *
 * 三态纪律(§0.3):
 *   · ok          —— 每件的 HEAD blob 与生产副本逐字节相等;
 *   · drift       —— 能判死的不一致(生产副本缺失,或 hash 不等),**必须**给可执行的下一步;
 *   · undetermined —— 取不到输入(HEAD 里没有这件、git 读不到),既不当绿也不当红。
 * 清单为空同样落 undetermined:枚举到 0 个候选就报绿,等于把"没判"写成"判过"。
 */

/** 受管面:router 本体 + 它 import 的 lib。新增 lib 必须同笔登记,否则哨兵覆盖不到。 */
export const PROD_PARITY_FILES = Object.freeze([
  'deploy/win/ihui-api-router.mjs',
  'deploy/win/lib/block-notice.mjs',
  'deploy/win/lib/notice-ledger.mjs',
  'deploy/win/lib/tool-fingerprint.mjs',
  'deploy/win/lib/waf-signatures.mjs',
  'deploy/win/lib/edge-admission.mjs',
  'deploy/win/lib/normalize-input.mjs',
  // 2026-11-25:路由层新 import 了它,不登记的话体嗅探被换掉/漏同步时哨兵看不见。
  'deploy/win/lib/body-sniff.mjs',
])

export const PARITY_STATE = Object.freeze({
  OK: 'ok',
  DRIFT: 'drift',
  UNDETERMINED: 'undetermined',
})

/**
 * @param {{path:string, head:string|null, prod:string|null}[]} rows
 *   head = HEAD blob 的 sha(短或全长皆可,比较前统一小写比较);取不到传 null;
 *   prod = 生产副本 `git hash-object --no-filters` 的 sha;文件不存在传 null。
 */
export function judgeParity(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      state: PARITY_STATE.UNDETERMINED,
      rows: [],
      drift: [],
      reason: '受管面清单为空或未枚举到任何文件',
    }
  }

  const norm = rows.map((r) => ({
    path: r?.path ?? '',
    head: r?.head ? String(r.head).toLowerCase() : null,
    prod: r?.prod ? String(r.prod).toLowerCase() : null,
  }))

  // 能判死的优先报红:某件 HEAD 取不到(清单腐烂)不该连带放过另一件已确证的漂移。
  const noHead = norm.filter((r) => !r.head)
  const drift = norm.filter((r) => r.head && (!r.prod || r.head !== r.prod))
  const noHeadNote = noHead.length ? `;另 ${noHead.length} 件 HEAD 取不到(未判定): ${noHead.map((r) => r.path).join(', ')}` : ''

  if (drift.length) {
    // 生产副本缺失属于**能判死**的不一致:基准有、副本没有 ⇒ 服务跑的不是 HEAD 的内容。
    return {
      state: PARITY_STATE.DRIFT,
      rows: norm,
      drift,
      reason: `${drift.length}/${norm.length} 件与 HEAD 不一致${noHeadNote}`,
    }
  }

  // 一件都判不了 ⇒ 未判定:既不当绿也不当红。
  if (noHead.length) {
    return {
      state: PARITY_STATE.UNDETERMINED,
      rows: norm,
      drift: [],
      reason: `HEAD 里取不到这些文件(清单已腐烂或未提交): ${noHead.map((r) => r.path).join(', ')}`,
    }
  }

  return {
    state: PARITY_STATE.OK,
    rows: norm,
    drift: [],
    reason: `${norm.length} 件逐字节一致`,
  }
}

/** 漂移的定性:哪几件缺、哪几件内容不同(告警正文与修复动作都靠它)。 */
export function classifyDrift(drift) {
  const missing = (drift ?? []).filter((r) => !r.prod).map((r) => r.path)
  const differing = (drift ?? []).filter((r) => r.prod && r.head !== r.prod).map((r) => r.path)
  return { missing, differing }
}

/**
 * 给收信人的可执行下一步(§5e-1:判据挂到人通道前必须回答"红了收信人能做什么")。
 * 只有一条动作、一条命令,不列选项。
 */
export function remediationFor(state, drift = []) {
  if (state === PARITY_STATE.OK) return ''
  if (state === PARITY_STATE.UNDETERMINED) {
    return '先跑 `node scripts/security/check-prod-parity.mjs --json` 复现:`HEAD 取不到某件` 说明清单与仓库已漂,先改清单或补提交,不要直接覆盖生产。'
  }
  const { missing, differing } = classifyDrift(drift)
  const parts = []
  if (missing.length) parts.push(`生产缺 ${missing.length} 件`)
  if (differing.length) parts.push(`${differing.length} 件内容不同`)
  return `生产副本与 HEAD 不一致(${parts.join(' / ')}),跑 \`node scripts/security/sync-prod-parity.mjs --apply\` 一键备份+覆盖+重启+复验。`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
