// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本机会话自动入池的归属解析出口(2026-11-06 立)。
 *
 * 立因:回灌腿的 `kind === 'none'` 支路(本机新登录 ⇒ 池里没这枚号)此前一律写死
 * `importAccounts(provider, [autoInput], null)`,即**自动入池恒落运营池**。而机主
 * 2026-10-31 的永久指令是「我自己填入号池的账号只能跟着我的账号走,别的用户不得看见、
 * 不得使用」,入池方向的手动腿(`scripts/relay-account-pool.mjs`)已于 2026-11-06 按
 * `~/.wb-switch/pool-owner` 器物化默认归属 —— 同一把尺子的另一半没人管,于是 2026-11-06
 * 又亲踩一次:本机 Qoder 号先被回灌腿 auto-import 建成运营池行,机主随后手动带 `--owner`
 * 导入 ⇒ 两条 partial unique 允许同 uid 两行(运营池 + 私有各一)⇒ 同 uid 双行,而
 * `chooseSyncTargetRow` 运营池优先 ⇒ 个人池那行永远拿不到客户端新票,保活与签到落在别处。
 *
 * 判据不在此复算(§0.6):读取实现唯一一份,住在工具层 `scripts/lib/pool-owner.mjs`
 * 的 `resolveDefaultPoolOwner`。apps/api → repo-tooling 的**静态** import 会被架构契约表
 * `config/architecture-policy.yaml` 的 D1 判红(apps/api 已 `managed:true` 且 requires 未登记
 * repo-tooling,政策明文"不得改用 arch-exempt 糊过去"),故沿用 `apps/api/scripts` 既有
 * 「动态 import scripts/lib/*.mjs」模式(relay-pool-snapshot-sync.ts 同款)。
 *
 * 失效方向(§0.3/§0.10)分两档,绝不并桶:
 *  - 装载失败(模块没了 / 出口不见了)⇒ **抛错**,由调用方按 failed 点名 ⇒ 未判定。
 *    这一档绝不能悄悄落运营池:那等于把"归属判据坏了"洗成"这号本来就该进运营池"。
 *  - 配置里没有归属(文件不存在 / 空 / 读不出 / 形状不合法)⇒ `ownerUserId=null` 落运营池
 *    (旧行为),但 `reason` 必须原样带回调用方打印 ⇒ 不静默。
 *
 * 射程:只服务「本机会话自动入池」这一条支路。手动入池走 `scripts/relay-account-pool.mjs`
 * 自己的旗标优先级(--owner > --ops-pool > 默认);槽位形态的共享号池(minimax 一族,
 * name 是 `provider:region` 而非本人手机号)不在本出口射程内,它本就没有"跟着某个人走"的语义。
 */
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
/** 仓根(apps/api/scripts → 上三层);`scripts/lib/pool-owner.mjs` 的装载基准 */
const REPO_ROOT = resolvePath(SCRIPT_DIR, '..', '..', '..')

const poolOwnerLib = await import(
  pathToFileURL(resolvePath(REPO_ROOT, 'scripts', 'lib', 'pool-owner.mjs')).href
).catch(() => null)

/** 归属解析结果(source/reason 供输出面点名,值本身不进任何日志正文)。 */
export interface AutoImportOwnerDecision {
  /** null ⇒ 落运营池(仅在配置确实没有归属时合法);来源与原因必须回显 */
  ownerUserId: string | null
  /** 'default-owner-file' | 'none'(与工具层 OWNER_SOURCES 同一枚词汇,不另立两套口径) */
  source: string
  /** 'ok' = 取到;'missing'|'empty'|'unreadable'|'invalid-format' = 落运营池的原因(措辞由工具层 POOL_OWNER_REASON_TEXT 单源给) */
  reason: string
  /** 归属文件的绝对路径(点名用,不含凭据) */
  file: string
}

/**
 * 取本机自动入池应落的归属。装载失败 ⇒ 抛错(未判定),调用方不得 catch 成 null。
 * @param opts 注入给工具层的家目录与 fs 替身(测试用;缺省走 `os.homedir()` / `node:fs`)
 */
export function resolveAutoImportOwner(
  opts: { home?: string; fsImpl?: unknown } = {},
): AutoImportOwnerDecision {
  if (!poolOwnerLib || typeof poolOwnerLib.resolveDefaultPoolOwner !== 'function') {
    throw new Error(
      '个人池归属读取模块(scripts/lib/pool-owner.mjs)装载失败 ⇒ 未判定:' +
        '不猜归属,也不在本文件另抄第二份读法',
    )
  }
  const r = poolOwnerLib.resolveDefaultPoolOwner(opts)
  return { ownerUserId: r.owner, source: r.source, reason: r.reason, file: r.file }
}

/**
 * 归属回显措辞单源:两条腿(trae/qoder)与人读日志共用这一句,禁止各写一份措辞。
 * 个人池只露 users.id 前 8 位(与工具层 maskPoolOwner 同口径);运营池必须带上"为什么"。
 */
export function describeAutoImportOwner(d: AutoImportOwnerDecision): string {
  if (d.ownerUserId) return `个人池 ${String(d.ownerUserId).slice(0, 8)}***(来源:${d.source})`
  return `运营池(默认归属取不到:${d.reason} ⇒ 落旧行为,非静默)`
}

export const __test__ = { REPO_ROOT, poolOwnerLib }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
