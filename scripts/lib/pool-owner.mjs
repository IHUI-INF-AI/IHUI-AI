// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 个人池归属(pool-owner)读取的唯一出口(2026-11-06 立)。
 *
 * 立因(机主 2026-10-31 永久指令):"我自己填入号池的账号只能跟着我的账号走,
 * 别的用户不得看见、不得使用"。落点 = 本机 `~/.wb-switch/pool-owner`(一行 users.id,
 * 机器态文件,不在仓库里;按 § 机器事实纪律每次现读,不硬编码盘符/用户名)。
 *
 * 此前的现实:读取只有一份实现,住在 `apps/api/scripts/relay-pool-snapshot-sync.ts` 的
 * `resolvePoolOwner`(号池 → 本机快照同步方向)。而入池方向(`scripts/relay-account-pool.mjs`)
 * 完全没有取这份配置 ⇒ 不带 `--owner` 就把机主自己的号打成运营池(ownerUserId=null),
 * 对同 uid 的个人池行查不到 existing ⇒ 凭空多出一枚运营池重复行(2026-11-06 亲踩)。
 * 把一条永久指令压在"人记得带旗标"上 = §0.8/§12f 禁止的形状;能器物化就器物化。
 *
 * 本模块把那**一枚**读取实现搬到工具层(§0.6 单一真相源):
 *  - 工具层 CLI(`scripts/relay-account-pool.mjs`)静态 import 本文件;
 *  - `apps/api/scripts/relay-pool-snapshot-sync.ts` 的 `resolvePoolOwner` 改为按既有
 *    「apps/api/scripts 动态 import scripts/lib」模式委托本文件,签名与语义不变。
 *  留在工具层而不是反向(apps/api→工具层静态 import 会被架构契约表
 *  `config/architecture-policy.yaml` 的 D1 判红:apps/api 已 managed:true 且 requires 未登记
 *  repo-tooling,且政策明文"不得改用 arch-exempt 糊过去")。
 *
 * uuid 形状判据:同一形状在 `apps/api/src/utils/uuid.ts` 有 TS 侧唯一出口;本层不 import 它
 * (跨层静态 import 即 D1 违规,动态 import 一个纯正则模块收益为零),故在此落工具侧副本并
 * 双向注明同形关系 —— 语义变更须两处同改(与 `apps/api/scripts/flag-value` 一族同一处置口径)。
 *
 * 失效方向(§0.3/§0.10):读不到就是读不到,一律以 `reason` 具名点出**为什么**,由调用方打印;
 * 绝不静默冒充"个人池",也绝不静默回落成"运营池"。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** 归属文件的相对落点(相对家目录);唯一写法,禁止在调用方拼第二份(§0.6)。 */
export const POOL_OWNER_SEGMENTS = Object.freeze(['.wb-switch', 'pool-owner'])

/**
 * users.id 形状闸(与 apps/api/src/utils/uuid.ts 的 UUID_STRING_RE 同形,理由见文件头注)。
 * 只回答"这串像不像 uuid",不回答"这个用户在不在库里"。
 */
export const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** reason ⇒ 人读原因(输出面点名用;新增档位必须同批改这张表,不许在调用方另写措辞)。 */
export const POOL_OWNER_REASON_TEXT = Object.freeze({
  ok: '',
  missing: '文件不存在',
  empty: '文件为空(没有有效行)',
  unreadable: '文件读不出来',
  'invalid-format': '内容不是合法 uuid(疑似写错或含多余内容)',
})

/** 归属来源三档(--json 机器面与人类面共用同一枚词汇,禁止两套口径)。 */
export const OWNER_SOURCES = Object.freeze(['explicit-flag', 'default-owner-file', 'none'])

/** 归属文件绝对路径(只用于点名,不含任何凭据)。 */
export function poolOwnerFilePath(home = os.homedir()) {
  return path.join(home, ...POOL_OWNER_SEGMENTS)
}

/**
 * 读原始归属配置:取首个非空行 trim。
 * @param {{home?: string, fsImpl?: typeof fs}} [opts]
 * @returns {{value: string|null, reason: 'ok'|'missing'|'empty'|'unreadable', file: string, detail: string}}
 */
export function readPoolOwnerFile({ home = os.homedir(), fsImpl = fs } = {}) {
  const file = poolOwnerFilePath(home)
  let raw
  try {
    raw = String(fsImpl.readFileSync(file, 'utf8'))
  } catch (e) {
    const code = String(e?.code ?? '')
    return {
      value: null,
      reason: code === 'ENOENT' ? 'missing' : 'unreadable',
      file,
      detail: code || String(e instanceof Error ? e.message : e),
    }
  }
  const firstLine =
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ''
  if (firstLine === '') return { value: null, reason: 'empty', file, detail: '' }
  return { value: firstLine, reason: 'ok', file, detail: '' }
}

/**
 * 入池方向的**默认归属**:调用方没显式给 `--owner` 时按本机 pool-owner 文件判定。
 * 取到合法 uuid ⇒ `{ owner, source:'default-owner-file' }`;
 * 其余(不存在/为空/读不出/形状不合法)⇒ `{ owner:null, source:'none', reason }`,
 * 由调用方把 reason 打印出来后再落运营池(旧行为,但不静默)。
 * @param {{home?: string, fsImpl?: typeof fs}} [opts]
 * @returns {{owner: string|null, source: 'default-owner-file'|'none', reason: string, file: string}}
 */
export function resolveDefaultPoolOwner({ home = os.homedir(), fsImpl = fs } = {}) {
  const read = readPoolOwnerFile({ home, fsImpl })
  if (read.reason !== 'ok') {
    return { owner: null, source: 'none', reason: read.reason, file: read.file }
  }
  const value = String(read.value)
  if (!UUID_LIKE_RE.test(value)) {
    return { owner: null, source: 'none', reason: 'invalid-format', file: read.file }
  }
  return { owner: value, source: 'default-owner-file', reason: 'ok', file: read.file }
}

/** 归属回显:个人池只显示前 8 位(与 apps/api/scripts/relay-account-import.ts 同一口径)。 */
export function maskPoolOwner(owner) {
  const s = String(owner ?? '')
  if (s.length === 0) return ''
  return `${s.slice(0, 8)}***`
}

export const __test__ = {
  POOL_OWNER_SEGMENTS,
  UUID_LIKE_RE,
  POOL_OWNER_REASON_TEXT,
  OWNER_SOURCES,
  poolOwnerFilePath,
  readPoolOwnerFile,
  resolveDefaultPoolOwner,
  maskPoolOwner,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
