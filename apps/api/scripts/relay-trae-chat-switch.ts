// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 一键切号·携带对话 —— 把号池里任意 Trae 账号写回本机客户端,并把本机此前登录号的
 * 对话记录(正库 + global/workspace state.vscdb + storage.json + conversation-tips)
 * 整体重绑到目标号名下,切完打开客户端即可接着旧号的对话聊(2026-10-30 立)。
 *
 * 与 relay-trae-client-switch.ts 的分工(§0.6):那条链只管登录态信封;
 * 本脚本 = 信封切号 + "对话随行"编排。判据与写盘原语 import:
 *   scripts/lib/trae-client-switch.mjs(信封重建/原子写/找文件)
 *   scripts/lib/trae-sqlcipher.mjs(正库解密/重加密/自证 —— 取证实证见其头注)
 *   scripts/lib/trae-chat-carry.mjs(四处账号绑定面重绑的纯操作)
 * 号池取数/解密沿用 client-switch 的同一段(直连库,只输脱敏面)。
 *
 * 模式:--to <uid|名称> [--owner <ops|前缀≥8位>] [--product <Trae CN|TRAE SOLO CN|Trae>]
 *       [--dry-run] [--force] [--no-launch] [--json]
 * 退出码:0 成功(dry-run 亦 0)/ 1 业务失败(无匹配、目标串命中多枚号、同 uid 多持有者未定向、
 * 已尽力回滚 —— 回滚明细在报告里)/ 2 未判定
 * (参数错、本机无客户端、池行解不出、在跑又没 --force)。
 * 多持有者(同 uid 的运营池行 + 个人池行,号池去重键允许并存)**不给结论只给定向**,判据在
 * scripts/lib/trae-client-switch.mjs 的 pickPoolCandidates(与 client-switch 腿同一枚实现)。
 * 安全:任何输出不含凭据明文;正库写回前整文件备份,失败逐件还原。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config as dotenvConfig } from 'dotenv'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const API_DIR = path.resolve(SCRIPT_DIR, '..')
const ROOT = path.resolve(API_DIR, '..', '..')
dotenvConfig({ path: path.resolve(API_DIR, '.env') })

const sw = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'trae-client-switch.mjs')).href
)
const carry = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'trae-chat-carry.mjs')).href
)
const proc = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'trae-client-process.mjs')).href
)
const ex = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'trae-auth-extract.mjs')).href
)

const { eq, and, sql } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
// 设备证明换票的报文构造与端点:唯一实现住 trae-protocol(§0.6),本层只发请求不再抄一份
const proto = await import('../src/services/upstream-adapters/trae-protocol.js')
const { decryptField, encryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')
const { setTimeout: sleep } = await import('node:timers/promises')

interface Args {
  target: string
  owner: string
  product: string
  dryRun: boolean
  force: boolean
  noLaunch: boolean
  json: boolean
  help: boolean
  error: string | null
}

function parseArgs(argv: string[]): Args {
  const o: Args = {
    target: '',
    owner: '',
    product: '',
    dryRun: false,
    force: false,
    noLaunch: false,
    json: false,
    help: false,
    error: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--to') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) {
        o.error = '--to 需要 <uid 或 名称>'
        break
      }
      o.target = v
    } else if (a === '--owner') {
      // 定向开关:同 uid 多持有者(运营池 + 个人池并存)时指明切哪一池;判据在 lib,本层不重抄
      const v = argv[++i]
      if (!v || v.startsWith('--')) {
        o.error = String(sw.OWNER_SELECTOR_USAGE)
        break
      }
      o.owner = v
    } else if (a === '--product') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) {
        o.error = '--product 需要 <Trae CN | TRAE SOLO CN | Trae>(缺省 = 自动定位现役那份)'
        break
      }
      const known = (proc.TRAE_PRODUCTS as readonly string[]).find(
        (p) => p.toLowerCase() === v.trim().toLowerCase(),
      )
      if (!known) {
        o.error = `--product 不认识:${v}(可用:${proc.TRAE_PRODUCTS.join(' / ')})`
        break
      }
      o.product = known
    } else if (a === '--dry-run') o.dryRun = true
    else if (a === '--force') o.force = true
    else if (a === '--no-launch') o.noLaunch = true
    else if (a === '--json') o.json = true
    else if (a === '--help' || a === '-h') o.help = true
    else o.error = `未知参数: ${a}`
  }
  if (!o.error && !o.help && !o.target) o.error = '缺少 --to <uid|名称>'
  return o
}

/**
 * 目标串 → 池行候选(判据单源 = sw.pickPoolCandidates;本层只负责取数,不再自己挑一枚)。
 * 号池去重键是 (owner_user_id, provider_code, uid),同 uid 双持有者合法并存 ⇒ 命中 >1 行
 * 一律返回具名歧义,由调用方打印"这一 uid 有两个持有者"与定向后的下一步命令。
 */
async function pickPoolRow(target: string, owner: string) {
  const rows = await db
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, 'trae'))
  return sw.pickPoolCandidates(rows, target, { owner })
}

/** 多持有者歧义的具名结论:人类面逐行 stderr,机读面报告由调用方写 stdout(判据与措辞单源在 lib) */
function ambiguityOutput(picked: { candidates: Array<Record<string, unknown>> }, target: string) {
  const notice = sw.ambiguousOwnerNotice(target, picked.candidates, {
    entry: 'node scripts/switch-trae-client-with-chat.mjs',
  })
  for (const line of notice.printLines) process.stderr.write(`${line}\n`)
  return {
    outcome: 'ambiguous-owner',
    matched: String(target),
    holderCount: picked.candidates.length,
    holders: notice.holders,
    nextCommands: notice.commands,
    steps: ['abort-ambiguous-owner'],
  }
}

/** 池行 → 切号参数(token/rt/profile/device;与 client-switch 同判据面) */
function decodePoolRow(row: any) {
  let token = ''
  try {
    token = row.tokenEnc ? decryptField(row.tokenEnc) : ''
  } catch {
    token = ''
  }
  if (!token) return { error: `uid=${row.uid} 的 token 密文解不出(密钥轮换/坏档?)` }
  let refreshToken: string | null = null
  try {
    if (row.refreshTokenEnc) refreshToken = decryptField(row.refreshTokenEnc)
  } catch {
    refreshToken = null
  }
  let secrets: Record<string, unknown> | null = null
  try {
    if (row.secretsEnc) {
      const parsed = JSON.parse(decryptField(row.secretsEnc))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) secrets = parsed
    }
  } catch {
    secrets = null
  }
  const profile =
    secrets?.profile && typeof secrets.profile === 'object' && !Array.isArray(secrets.profile)
      ? (secrets.profile as Record<string, unknown>)
      : null
  // 会话模板(采集时的整份 userInfo 去凭证):profile 缺失时写回端的账号档案基底(2026-11-11 立)
  const sessionTemplate =
    secrets?.sessionTemplate &&
    typeof secrets.sessionTemplate === 'object' &&
    !Array.isArray(secrets.sessionTemplate)
      ? (secrets.sessionTemplate as Record<string, unknown>)
      : null
  const deviceKeyPem = typeof secrets?.deviceKeyPem === 'string' ? secrets.deviceKeyPem : ''
  const devicePubPem = typeof secrets?.devicePubPem === 'string' ? secrets.devicePubPem : ''
  const device =
    row.deviceId && deviceKeyPem && devicePubPem
      ? { deviceId: row.deviceId, deviceKeyPem, devicePubPem }
      : null
  return { token, refreshToken, profile, sessionTemplate, device }
}

/**
 * 写回前的设备匹配预检(2026-11-12 立;机主实测事故的直接修复)。
 *
 * 事故:2026-11-12 08:35 一键切号(trae → 第 7 枚 187******26),脚本报「✅ 切号完成」,
 * 2 秒后客户端把 `iCubeAuthInfo://icube.cloudide` 与 `iCubeServerData://icube.cloudide`
 * 一起清空 = 未登录态。客户端日志给出唯一原因:
 *   [exchangeTokenByRefreshToken] POST /trae/api/v3/oauth/ExchangeToken
 *     DeviceInfo.DeviceID=4355605738307003
 *   → 401 {"Error":{"Code":"20403","Message":"Token device not match"}}
 * 该号是裸票导入(secretsEnc / deviceId 全 null),refreshToken 绑在另一台设备上,
 * 本机设备身份换不出票;客户端启动必做这一步,换不出就当场登出。
 *
 * 判据必须「与客户端同款」:同一端点、同一 ClientID×产品线组合链、**本机设备私钥签名**。
 * 报文构造复用 trae-protocol.buildExchangeTokenProofBody(与 trae-adapter 设备证明通道
 * 同一枚实现),本层只负责发请求与判定。
 *   换得出票 ⇒ 写回后客户端一定能登(它走的就是这条);
 *   明确拒收 ⇒ **一个本机文件都不写**,现登录态原样保留;
 *   判不出来 ⇒ 照常写回,交由写后客户端验收(verifyClientAccepted)兜底回滚。
 * 失效方向按 §0.10:多要一次定向说明,绝不多踢一次登录。
 *
 * ⚠️ 2026-11-12 实测修正(本条差点把整个切号入口锁死):
 * 该端点在本机网络下对**任何**带 DeviceProof 的请求都回 `504`(实测 5 次 × 5.1s 全 504、
 * 网关超时),连客户端自己 08:35:55 发的真实签名请求也是 504,而空签名回 401
 * `20405 Device proof required`、坏 JSON 回 400 —— 即 504 与票是否有效、签名是否正确
 * **无关**,它是这条通道在本机的环境表现。若把非 2xx 一律当「换不出票」,预检会把
 * 每一枚号都判成 rejected(含本机正登录着的那枚),一键切号从此永久停摆。
 * 因此判定口径改为:
 *   2xx 且解出 token            ⇒ ok(拿到新票,顺带回写池)
 *   401/403 且 20403/10101/20101 ⇒ rejected(**上游明确拒绝**,这才是设备/票不匹配)
 *   其它(5xx/504/超时/网络)     ⇒ undetermined(**不拦**,写回后由客户端验收兜底)
 *
 * rt 轮换:该通道换票成功会轮换 refreshToken ⇒ 池里那枚当场作废,同轮 CAS 回写。
 */
type PreflightResult =
  | {
      decision: 'ok'
      token: string
      refreshToken: string | null
      expiresAt: Date | null
      /** existing-token = 现成 token 仍有效(未换票、未轮换 rt);缺省 = 换票换出来的新票 */
      via?: 'existing-token'
    }
  | { decision: 'rejected'; reason: string }
  | { decision: 'undetermined'; reason: string }

async function preflightTraeDeviceMatch(
  dec: { token?: string; refreshToken: string | null },
  store: Record<string, unknown>,
): Promise<PreflightResult> {
  /**
   * ⓪ 先验 token(2026-11-12 立,修「预检比客户端更严 ⇒ 好号被挡在门外」)。
   *
   * 客户端的真实启动路径是:**先用现成 token**,只有它过期/校验失败时才拿 rt 换票
   * (`checkLogin` → 401 才走 `exchangeTokenByRefreshToken`)。所以"rt 换不出票"并不等于
   * "写回后必然登出" —— 只要 token 本身有效,客户端就能正常登录,rt 只影响**下次**续期。
   *
   * 实测(2026-11-12,本机):4 枚裸票号(secretsEnc 为空、rt 绑在别的设备)对 rt 换票回
   * 20403/10101,但 `POST /cloudide/api/v3/trae/CheckLogin` 全部 `IsLogin=true`,且 token
   * 还剩 13 天 ⇒ 旧预检把 4 枚可用号全判死,还给出"只能重新登录"的错误出路。
   *
   * 判据与客户端同款:同一端点(CheckLogin)、同一报文({IDEVersion,ReqSource,GetAIPayHost})、
   * token 走 `x-cloudide-token` 头。
   *   200 且 Result.IsLogin===true ⇒ ok(把现成 token 当票用,rt 原样写回,登进去后客户端自己续)
   *   200 且 IsLogin===false     ⇒ 继续走 ①(rt 换票),由换票结论定档
   *   其它(5xx/网络)             ⇒ 继续走 ①(不把环境问题当拒收)
   */
  if (dec.token) {
    try {
      const r = await fetch(proto.TRAE_CHECK_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cloudide-token': dec.token },
        body: JSON.stringify({
          IDEVersion: proto.TRAE_IDE_VERSION,
          ReqSource: 'IDE',
          GetAIPayHost: true,
        }),
      })
      if (r.ok) {
        const body = (await r.json().catch(() => null)) as Record<string, unknown> | null
        const result =
          body?.Result && typeof body.Result === 'object'
            ? (body.Result as Record<string, unknown>)
            : null
        if (result?.IsLogin === true) {
          // 现成 token 有效:直接用它(不换票、不轮换 rt),rt 留给客户端自己续
          return {
            decision: 'ok',
            token: dec.token,
            refreshToken: null,
            expiresAt: null,
            via: 'existing-token',
          }
        }
      }
    } catch {
      // 网络/解析失败 ⇒ 不判定,继续走换票腿
    }
  }
  if (!dec.refreshToken) {
    return {
      decision: 'rejected',
      reason: '池内该号既没有可用 token 也没有 refreshToken:客户端启动无从登录,不能写回',
    }
  }
  const dev = ex.extractDeviceMaterial(store) as {
    deviceId?: string
    machineId?: string
    privateKeyPem?: string
    publicKeyPem?: string
  } | null
  const deviceId = String(dev?.deviceId ?? '').trim()
  const privateKeyPem = String(dev?.privateKeyPem ?? '').trim()
  const publicKeyPem = String(dev?.publicKeyPem ?? '').trim()
  if (!deviceId || !privateKeyPem || !publicKeyPem) {
    return {
      decision: 'undetermined',
      reason:
        '读不到本机设备身份(storage.json 的 iCubeAuthInfo://icube-dc:* 解不出密钥对)⇒ 无法判定能否换票,拒绝写回',
    }
  }
  const machineId = String(dev?.machineId ?? store['telemetry.machineId'] ?? '').trim()
  let firstReject = ''
  let firstRejectKind: ReturnType<typeof proto.classifyExchangeReject> = null
  for (const combo of proto.TRAE_EXCHANGE_TOKEN_COMBOS) {
    let res: Response
    try {
      res = await fetch(proto.TRAE_EXCHANGE_TOKEN_PROOF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cloudide-token': '' },
        body: JSON.stringify(
          proto.buildExchangeTokenProofBody({
            deviceId,
            machineId: machineId || undefined,
            privateKeyPem,
            publicKeyPem,
            clientId: combo.clientId,
            platformCode: combo.platformCode,
            refreshToken: dec.refreshToken,
          }),
        ),
      })
    } catch (e) {
      return {
        decision: 'undetermined',
        reason: `换票预检请求发不出去(网络/未判定):${e instanceof Error ? e.message : String(e)}`,
      }
    }
    const text = await res.text().catch(() => '')
    if (res.ok) {
      let payload: { token: string; refreshToken: string | null; expiresAt: Date | null } | null =
        null
      try {
        payload = proto.extractTokenPayload(JSON.parse(text))
      } catch {
        payload = null
      }
      if (!payload?.token) {
        return { decision: 'undetermined', reason: '换票响应无 Token(上游形状变更?未判定)' }
      }
      return {
        decision: 'ok',
        token: payload.token,
        refreshToken: payload.refreshToken ?? null,
        expiresAt: payload.expiresAt ?? null,
      }
    }
    if (!firstReject) firstReject = text || `HTTP ${res.status}`
    /**
     * 只有「上游明确拒收」才算 rejected,其余一律 undetermined(不拦切号)。
     * 实测(2026-11-12,两种都真见过):
     *   20403 Token device not match           → HTTP 401(设备不匹配,客户端必被拒)
     *   10101 refresh token is not matched ... → HTTP 400(rt 与客户端线不匹配)
     *   20101 refresh token is invalid         → HTTP 401(rt 已废)
     * 判据 = 报文带具名码 ∧ 4xx —— **不是**只认 401/403:10101 走的是 400。
     * 5xx/504/超时/网络故障不代表票废了,把它们当 rejected 等于让环境问题锁死切号入口。
     */
    const kind = proto.classifyExchangeReject(text)
    const explicitReject = kind !== null && res.status >= 400 && res.status < 500
    if (!explicitReject) {
      return {
        decision: 'undetermined',
        reason: `换票预检未判定(HTTP ${res.status},非上游拒收):${text.slice(0, 160) || '(空响应)'}`,
      }
    }
    if (!firstRejectKind) firstRejectKind = kind
    // 20101:rt 已废 ⇒ 换组也救不回来,直接判死
    if (kind === 'token-dead') {
      return {
        decision: 'rejected',
        reason: `该号的 refreshToken 已失效(20101 refresh token is invalid):${text.slice(0, 160)}`,
      }
    }
    // 20403 / 10101 / 设备绑定数满:换下一条产品线再试一次(失败不轮换 rt)
  }
  return {
    decision: 'rejected',
    reason: rejectReasonOf(firstRejectKind, firstReject),
  }
}

/**
 * 拒收理由(2026-11-12 立,修一处会把人误导到错误出路的文案)。
 *
 * 旧实现把四条语义不同的码一律写成「refreshToken 绑在别的设备上 … 只能在本机重新登录一次」。
 * 实测 340221726063980 这条 rt 的真相是:该号 **token 有效、额度可查**(本机直连
 * `ide_user_ent_usage` 回 200 且 usage_summary 正常),换不出票的原因是**客户端签发它时用的
 * DeviceID 不是本机这枚**(20403 与 10101 是同一件事的两种表述 —— 实测同一票对 IDE_PC 组合回
 * 20403、对 SOLO_PC 组合回 10101)。此时"重新登录一次"不是唯一出路,也说不出真正的原因。
 * 因此按实测语义分档给话,并明确"票本身可能是好的"。
 */
function rejectReasonOf(
  kind: ReturnType<typeof proto.classifyExchangeReject>,
  raw: string,
): string {
  const tail = `${raw.slice(0, 200)}`
  if (kind === 'device-limit') {
    return (
      '该号的设备绑定数已达上限(上游 10110/10303):票本身有效,但本机没走客户端自己的设备注册' +
      `通道(ahaDeviceService)就换不出票。客户端启动必走这一步 ⇒ 写回后必然当场登出。原始响应:${tail}`
    )
  }
  if (kind === 'client-mismatch' || kind === 'device-mismatch') {
    return (
      '该号的 refreshToken 由**另一台设备**的客户端签发,与本机设备身份换不出票' +
      `(上游 ${kind === 'device-mismatch' ? '20403 设备不匹配' : '10101 rt 与客户端线不匹配'}):` +
      `${tail}。客户端启动必走这一步 ⇒ 写回后必然当场登出。` +
      '注意:这只说明**本机设备身份换不出票**,不代表该号的 token/额度已失效(本机直连用量端点仍可能正常)'
    )
  }
  return `该号的 refreshToken 换不出票(上游明确拒收):${tail}。客户端启动必走这一步 ⇒ 写回后必然当场登出`
}

/**
 * 预检换出的新票回写号池(CAS,与 relay-account-pool-scheduler.refreshOneLocked 的写回同形)。
 * 不做这一步的话:该通道每次都轮换 rt,池里那枚立刻作废,10 分钟内的下一次切号预检就会
 * 拿旧票重放 —— 上游视角等于我们自己制造一次 rt 重放。
 */
async function persistPreflightTicket(
  row: Record<string, unknown>,
  r: { token: string; refreshToken: string | null; expiresAt: Date | null },
): Promise<boolean> {
  const applied = await db
    .update(aiRelayAccountPool)
    .set({
      tokenEnc: encryptField(r.token),
      ...(r.refreshToken ? { refreshTokenEnc: encryptField(r.refreshToken) } : {}),
      ...(r.expiresAt ? { tokenExpiresAt: r.expiresAt } : {}),
      lastRefreshAt: new Date(),
      refreshFailureCount: 0,
      credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiRelayAccountPool.id, String(row.id)),
        eq(aiRelayAccountPool.credVersion, Number(row.credVersion)),
      ),
    )
    .returning({ id: aiRelayAccountPool.id })
  return applied.length > 0
}

/**
 * 预检 rt 轮换的兜底落盘(2026-11-12 立,机主实测事故的直接产物)。
 *
 * 该换票通道**只要 2xx 就轮换 refreshToken**:上游当场作废旧 rt。于是出现一个
 * 极易被忽略的陷阱 —— 预检换出了新票,但 CAS 回写池失败(池被别的会话抢先刷过),
 * 新 rt 只活在本次进程的内存里;一旦本进程退出/写回失败,这个账号的可用凭据就
 * **永久蒸发**(旧 rt 已被上游废,新 rt 没落库)。
 *
 * 今天就是这么把本机正登录着的那枚号弄成未登录态的:预检拿 200 换了新 rt,
 * 而手里那份 storage.json 备份里的旧 rt 随即变成 20101 invalid。
 *
 * 因此:CAS 失败时,不只报一句"沿用其新票"就完事,而是**必须**把新凭据落到
 * 一份独立的安全备份里(仓外,0600 语义),并在报告里点名路径 —— 这样即使池侧
 * 丢了,人还能拿它救回来。绝不把"新票没落库"写成无害告警。
 */
function salvageRotatedTicket(
  uid: string,
  r: { token: string; refreshToken: string | null; expiresAt: Date | null },
): string {
  const dir = path.join(ROOT, 'logs', 'rotated-tickets')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${uid}-${Date.now()}.json`)
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        uid,
        token: r.token,
        refreshToken: r.refreshToken,
        expiresAt: r.expiresAt,
        savedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  )
  return file
}

/**
 * 写后客户端验收(2026-11-12 立)。
 *
 * 写盘成功 ≠ 登录成功。客户端启动第一件事是拿 rt 换票,换不出就把登录信封删掉
 * (实测 08:35:53 启动 → 08:35:55 清空,连 serverData 一起)。所以拉起后必须看客户端认不认:
 *   信封被删 / 被改成别的 uid ⇒ rejected,走回滚把用户送回切前那个能用的登录态;
 *   客户端确实重写过 storage.json 且信封还是目标 uid ⇒ accepted;
 *   窗口内客户端没动过文件 ⇒ unobserved(不记绿也不冒红 —— §0.3,没判不写成判过)。
 */
async function verifyClientAccepted(
  storageFile: string,
  newUid: string,
  sinceMs: number,
  waitMs = 15_000,
): Promise<{ verdict: 'accepted' | 'rejected' | 'unobserved'; detail: string }> {
  const deadline = Date.now() + waitMs
  let touched = false
  for (;;) {
    let store: Record<string, unknown> | null = null
    try {
      store = JSON.parse(fs.readFileSync(storageFile, 'utf8'))
    } catch {
      store = null
    }
    if (store) {
      try {
        touched = fs.statSync(storageFile).mtimeMs > sinceMs
      } catch {
        /* 取不到 mtime 不改判 */
      }
      const envelope = store[sw.AUTH_KEY]
      if (typeof envelope !== 'string' || !envelope) {
        return { verdict: 'rejected', detail: '客户端已把登录信封移除(未登录态)' }
      }
      try {
        const uid = String(
          (JSON.parse(ex.decryptEnvelope(envelope)) as { userId?: unknown })?.userId ?? '',
        )
        if (uid !== newUid) {
          return { verdict: 'rejected', detail: `登录信封已变成 uid=${uid || '?'}` }
        }
      } catch {
        return { verdict: 'rejected', detail: '登录信封已无法解密(客户端重写且内容不合法)' }
      }
    }
    if (Date.now() >= deadline) break
    await sleep(500)
  }
  if (touched) {
    return {
      verdict: 'accepted',
      detail: `${Math.round(waitMs / 1000)}s 内客户端重写过 storage.json 且信封仍是目标号`,
    }
  }
  return {
    verdict: 'unobserved',
    detail: `${Math.round(waitMs / 1000)}s 内客户端未重写 storage.json(登录成功但无变更,或启动很慢)`,
  }
}

export async function main(argv: string[]): Promise<number> {
  const o = parseArgs(argv)
  if (o.error) {
    process.stderr.write(`❌ ${o.error}\n`)
    return 2
  }
  if (o.help) {
    process.stdout.write(
      '用法: pnpm tsx apps/api/scripts/relay-trae-chat-switch.ts --to <uid|名称> [--owner <ops|owner 前缀≥8位>] [--product <Trae CN|TRAE SOLO CN|Trae>] [--dry-run] [--force] [--no-launch] [--json]\n' +
        '把池号写回本机客户端登录态,并把旧登录号(该产品面)的对话记录重绑到该号(切号携带对话;日常入口 = node scripts/switch-trae-client-with-chat.mjs)。\n' +
        '  --owner  同一 uid 在池里有两个合法持有者(运营池 + 个人池)时定向用;不定向 ⇒ 具名歧义、不写任何文件。\n',
    )
    return 0
  }

  const picked = await pickPoolRow(o.target, o.owner)
  if (picked.decision === 'bad-owner-selector') {
    // 参数面错误与 --to 缺参同档(未判定 = 2),绝不"当作没给定向"继续跑
    process.stderr.write(`❌ ${picked.error}\n`)
    return 2
  }
  if (picked.decision === 'not-found') {
    process.stderr.write(
      `❌ 池内没有匹配 "${o.target.trim()}" 的 Trae 账号${picked.scopeNote ?? ''}(--list 查看全部)\n`,
    )
    return 1
  }
  if (picked.decision === 'ambiguous-uid') {
    process.stderr.write(`❌ "${o.target.trim()}" 命中多枚号,请用 uid 精确指定:\n`)
    for (const r of picked.candidates) process.stderr.write(`  ${sw.describePoolCandidate(r)}\n`)
    return 1
  }
  if (picked.decision === 'ambiguous-owner') {
    // 同 uid 双持有者:给"多要一次定向说明",不是给一个看起来已经办成的结论
    process.stdout.write(`${JSON.stringify(ambiguityOutput(picked, o.target))}\n`)
    return 1
  }
  const row = picked.row
  const dec = decodePoolRow(row)
  if (dec.error) {
    process.stderr.write(`❌ ${dec.error}\n`)
    return 1
  }

  const storageFile = o.product ? sw.findStorageFileForProduct(o.product) : sw.findStorageFile()
  if (!storageFile) {
    process.stderr.write('❌ 本机未找到 Trae storage.json(未判定)\n')
    return 2
  }
  const userDataDir = path.dirname(path.dirname(path.dirname(storageFile)))
  const product =
    o.product || proc.productOfDir(path.basename(userDataDir)) || path.basename(userDataDir)
  const newUid = String(row.uid)

  // 旧登录号:读当前信封(只取 uid,不输其他)
  let oldUid: string | null = null
  try {
    const beforeTxt = fs.readFileSync(storageFile, 'utf8')
    const before = JSON.parse(beforeTxt)
    oldUid = carry.userIdFromUserInfo(
      JSON.parse(ex.decryptEnvelope(String(before[sw.AUTH_KEY] ?? ''))),
    )
  } catch {
    oldUid = null
  }

  const steps: string[] = []
  const report: Record<string, unknown> = {
    // holder 一栏 = 这一枚池行的持有者(脱敏);候选唯一才走到这里,见 pickPoolRow
    target: { uid: newUid, name: row.name, holder: sw.describePoolOwner(row) },
    holderCount: picked.candidates.length,
    oldUid,
    dryRun: o.dryRun,
    steps,
  }

  const planBlock = {
    product,
    rebindingFrom: oldUid ?? null,
    rebindingTo: newUid,
    userDataDir,
    agentDb: carry.locateAgentDatabase(userDataDir),
    storageFile,
    willCloseClient: !o.noLaunch,
  }

  // noop 的合法含义 = 候选唯一 ∧ 确为当前在用那枚(判据单源 = sw.narrowByCurrentAccount)
  const decided = sw.narrowByCurrentAccount(picked, oldUid)
  if (decided.decision === 'same-account') {
    // 该客户端已登着目标号:对话本来就在名下,无事可做(不重加密、不折腾文件)
    // 注:产品面是 per-client 的 —— SOLO 与 Trae CN 各自判各自的登录态,互不顶替。
    steps.push('noop-same-account')
    report.outcome = 'unchanged'
    report.plan = planBlock
    process.stdout.write(`${JSON.stringify(report)}\n`)
    return 0
  }

  if (!oldUid) {
    steps.push('warn-no-local-uid(读不到当前信封 ⇒ 只切登录态,不做对话重绑)')
  }

  if (o.dryRun) {
    report.plan = planBlock
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return 0
  }

  /**
   * ⓪ 档案自愈(2026-11-12 立,机主令「不能出现切不过的号」)。
   *
   * 为什么必须在写回之前:客户端登录态判定 `uS()` 的 MARSCODE 分支以
   * `!account.storeRegion ⇒ need-update` 定档,命中就**立刻拿 refreshToken 去换票**;
   * 裸票号的 rt 由别的设备签发 ⇒ 20403 ⇒ 客户端清空登录信封 = 当场登出。
   * 也就是说"缺少 storeRegion"本身就是一条必然登出的路 —— 与 ticket 是否有效无关。
   *
   * 这里用**有效 token** 调客户端同款 GetUserInfo 拉真实档案补齐(纯接口、零人工),
   * 补齐后落盘的是 `storeRegion=CN` 的完整档案,客户端判 VALID_TOKEN 直接用现成 token 登录。
   * 该步只动 secretsEnc,不碰凭证列;拉不到(如 token 已过期)时**如实记一笔并继续**,
   * 由后面的预检/客户端验收给出最终结论(不在这里假装判过)。
   */
  let profileHeal: { ok: boolean; note: string } = { ok: true, note: 'skipped' }
  try {
    const account =
      (dec.profile as Record<string, unknown> | null)?.account ??
      (dec.sessionTemplate as Record<string, unknown> | null)?.account ??
      null
    const storeRegion =
      account && typeof account === 'object'
        ? String((account as Record<string, unknown>).storeRegion ?? '')
        : ''
    if (storeRegion.trim() !== '') {
      profileHeal = { ok: true, note: 'already-complete' }
      steps.push('profile-already-complete')
    } else {
      const mod = await import(
        pathToFileURL(path.join(ROOT, 'scripts', 'trae-backfill-profile.mjs')).href
      )
      const healed = await mod.ensureProfiles([row], {
        decryptField,
        encryptField,
        db,
        aiRelayAccountPool,
        eq,
      })
      if (healed.repaired.length > 0) {
        profileHeal = {
          ok: true,
          note: `repaired(region=${healed.repaired[0].account?.storeRegion})`,
        }
        steps.push('profile-healed-from-upstream')
        report.profileHeal = healed.repaired[0]
        // 档案变了 ⇒ 重建写回原料(userInfo 的 account 段来自 profile)
        const fresh = await db
          .select()
          .from(aiRelayAccountPool)
          .where(eq(aiRelayAccountPool.id, row.id))
        if (fresh.length > 0) {
          const reDec = decodePoolRow(fresh[0])
          if (!reDec.error) {
            dec.profile = reDec.profile
            dec.sessionTemplate = reDec.sessionTemplate
            Object.assign(row, fresh[0])
          }
        }
      } else {
        const why = healed.failed[0]?.why ?? '上游未返回可写档案'
        profileHeal = { ok: false, note: why }
        steps.push('warn-profile-heal-failed')
        process.stderr.write(
          `⚠️ 档案自愈未成:${why}\n` +
            '   该号写回后客户端可能判 need-update 并当场登出,由客户端验收兜底。\n',
        )
      }
    }
  } catch (e) {
    profileHeal = { ok: false, note: e instanceof Error ? e.message : String(e) }
    steps.push('warn-profile-heal-error')
  }
  report.profileHealStatus = profileHeal

  /**
   * 写前预检(必须在关端之前,也必须在 dry-run 之后 —— 预检会真换票并轮换 rt,
   * dry-run 承诺"不写任何文件",不能带这种副作用)。
   * 换不出票 ⇒ 一个本机文件都不写,现登录态原样保留。
   */
  let preflightStore: Record<string, unknown>
  try {
    preflightStore = JSON.parse(fs.readFileSync(storageFile, 'utf8')) as Record<string, unknown>
  } catch (e) {
    process.stderr.write(`❌ 读 storage.json 失败(未判定): ${String(e)}\n`)
    return 2
  }
  // decodePoolRow 的成功分支形状(已在上方 error 分支 return):收窄成预检入参
  const pre = await preflightTraeDeviceMatch(
    dec as { token?: string; refreshToken: string | null },
    preflightStore,
  )
  if (pre.decision === 'rejected') {
    steps.push('abort-preflight-device-mismatch')
    report.outcome = 'rejected-preflight'
    report.preflight = { decision: 'rejected', reason: pre.reason }
    process.stderr.write(`❌ 拒绝切号(未改动任何本机文件,现登录态保持原样)\n   ${pre.reason}\n`)
    process.stderr.write(
      '   出路(按可行性排序):\n' +
        '   ① 本机重新登录一次该号(短信/扫码),让服务端把 refreshToken 绑到本机设备身份;\n' +
        '   ② 或改切一枚本机登录过的号:`node scripts/switch-client-account.mjs --list --provider trae`;\n' +
        '   ③ 跨机迁移该号时,须连同**签发它的那台设备**的客户端设备注册材料一并迁移\n' +
        '      (客户端 `ahaDeviceService` 的设备身份,与 storage.json 里 icube-dc 密钥对不是同一层)。\n',
    )
    process.stdout.write(`${JSON.stringify(report)}\n`)
    return 1
  }
  if (pre.decision === 'undetermined') {
    /**
     * undetermined 不再中止(2026-11-12 实测修正):该端点在本机对任何带设备证明的请求都回 504,
     * 若这里 abort,一键切号会把每一枚号都挡在门外 —— 包括本机正登录着的那枚。
     * 未判定 = 没判过(§0.3),因此不记绿也不冒红:照常写回,由第⑦步客户端验收
     * 给出真正的结论;拒收则整组回滚到切前态。
     */
    steps.push('warn-preflight-undetermined(不拦,写后由客户端验收兜底)')
    report.preflight = { decision: 'undetermined', reason: pre.reason }
    process.stderr.write(`⚠️ 换票预检未判定:${pre.reason}\n   照常写回,写后由客户端验收兜底。\n`)
  }
  // 只有真换出票时才回写池(rt 已轮换);未判定时池里那枚没被动过,不能凭空改写。
  // via='existing-token' 这条腿**没有**换票、rt 没轮换 ⇒ 一个字段都不该动池,
  // 否则会把池里那枚"刚验证过的票"改写成同一张票却刷新了 lastRefreshAt(掩盖真实刷新节奏)。
  if (pre.decision === 'ok' && pre.via === 'existing-token') {
    steps.push('preflight-existing-token-ok(现成 token 仍有效,未换票、未动池)')
    report.preflight = { decision: 'ok', via: 'existing-token', tokenRotated: false }
  } else if (pre.decision === 'ok') {
    const ticketPersisted = await persistPreflightTicket(row, pre)
    steps.push('preflight-device-match-ok')
    if (!ticketPersisted) {
      /**
       * CAS 失败 = 池里已被别的会话抢先刷过。但**我们手里这张新票是刚换出来的**,
       * 上游已经把旧 rt 废掉了 ⇒ 新票不落盘就等于让它蒸发。必须先兜底存档再继续。
       */
      const salvaged = salvageRotatedTicket(String(row.uid), pre)
      steps.push('warn-preflight-ticket-cas-missed(新票已兜底存档)')
      report.rotatedTicketSalvaged = salvaged
      process.stderr.write(
        `⚠️ 预检换出的新票没能回写号池(CAS 未命中),已兜底存到:\n   ${salvaged}\n` +
          '   该文件含凭据明文,救援后请删除。\n',
      )
    }
    report.preflight = {
      decision: 'ok',
      tokenRotated: true,
      refreshTokenRotated: Boolean(pre.refreshToken),
      poolPersisted: ticketPersisted,
    }
  }
  /** 写回用的票:预检换出新票就用新票,否则用池里原票(客户端会自己拿 rt 换) */
  const writeToken = pre.decision === 'ok' ? pre.token : dec.token
  const writeRefreshToken =
    pre.decision === 'ok' ? (pre.refreshToken ?? dec.refreshToken) : dec.refreshToken
  const writeExpiresAt =
    pre.decision === 'ok' ? (pre.expiresAt ?? row.tokenExpiresAt) : row.tokenExpiresAt

  const runningPids = sw.isProductRunning(product)
  if (runningPids === null) {
    process.stderr.write(
      `❌ 查不到 ${product} 的进程面(tasklist 失败)⇒ 未判定;不能确认客户端是否正在跑,拒绝写回(它退出时会用内存态覆盖)\n`,
    )
    return 2
  }
  if (runningPids.length > 0 && !o.force) {
    process.stderr.write(
      `❌ ${product} 正在运行(${runningPids.length} 个进程)—— 先完全退出,或 --force 由本器代关(按 pid 逐个关)。\n`,
    )
    return 2
  }

  /**
   * 备份日志(2026-11-10 修缺陷 1/2/4):每轮一个 `carry-backups/<runId>/` 目录。
   * 与老固定后缀的区别:
   *   - vscdb / 正库 / storage.json / tips 全部在**写前**入账 ⇒ 写坏了能整组还原
   *     (老代码只把 storage.json 与 database.db 塞进 backups[],vscdb 纯裸写);
   *   - runId 隔离 ⇒ 第二轮失败不会覆盖第一轮的"切前态"(老 .pre-carry.bak 会被下一轮顶掉);
   *   - SQLite 伴生 -wal/-shm 同进同出 ⇒ 不会出现"还原主库 + 留一截新 WAL"的坏库。
   */
  const journal = carry.createCarryJournal({
    backupRoot: path.join(userDataDir, 'carry-backups'),
    root: userDataDir,
  })
  report.runId = journal.runId
  report.backupDir = journal.dir
  const fail = async (msg: string, code = 1): Promise<number> => {
    process.stderr.write(`❌ ${msg}(备份 ${journal.count()} 份,尝试还原…)\n`)
    const res = journal.restore()
    // backups/restored 的字段形状保持不变(数组元素仍是路径字符串);新增项都是可加字段
    report.rollback = {
      backups: journal.backupPaths(),
      restored: res.restored,
      removed: res.removed,
      failedRestores: res.failed,
      renames: journal.renames(),
      runId: journal.runId,
    }
    report.outcome = 'failed-rolled-back'
    process.stdout.write(`${JSON.stringify(report)}\n`)
    return code
  }

  /**
   * 关端前先抓 exe 路径并缓存:客户端一关,resolveProductExe 就查不到进程路径了
   * (它靠 CIM 读运行中进程的 ExecutablePath)。而正库段的 dll 定位需要它做首选候选。
   * 这一步零成本,却是本机 `no-dll` 的根治点之一。
   */
  let preCloseExePath = ''
  try {
    const probe = proc.resolveProductExe(product)
    preCloseExePath = typeof probe === 'string' ? probe : ((probe as { path?: string })?.path ?? '')
  } catch {
    preCloseExePath = ''
  }

  // ① 关端(在跑且 --force)
  if (runningPids.length > 0) {
    const closed = proc.closeProduct(product, { pids: runningPids })
    if (!closed.closed)
      return fail(`代关 ${product} 未成功:${JSON.stringify(closed).slice(0, 160)}`, 2)
    await sleep(2000)
    steps.push('client-closed')
  }

  // ② 切登录信封(先做,失败面小;原子写自带 .pre-switch.bak,我们另在写前把原件入账)
  let store: Record<string, unknown>
  try {
    store = JSON.parse(fs.readFileSync(storageFile, 'utf8'))
    journal.backup(storageFile)
  } catch (e) {
    return fail(`读 storage.json 失败: ${String(e)}`, 2)
  }
  let userInfo: Record<string, unknown>
  try {
    userInfo = sw.buildClientUserInfo({
      uid: newUid,
      // 预检换出了新票就用新票(rt 已在预检那步被上游轮换,写旧票会被当场拒);
      // 预检未判定时池里的票没被动过,用原票即可(客户端启动会自己拿 rt 换)
      token: writeToken,
      refreshToken: writeRefreshToken,
      tokenExpiresAt: writeExpiresAt,
      refreshExpiresAt: row.refreshExpiresAt,
      name: row.name,
      profile: dec.profile,
      sessionTemplate: dec.sessionTemplate,
      lastRefreshAt: row.lastRefreshAt,
      updatedAt: row.updatedAt,
    })
  } catch (e) {
    return fail(`重建客户端 userInfo 失败: ${String(e)}`)
  }
  const patch = sw.buildStoragePatch(store, { userInfo, device: dec.device })

  // ③ 对话重绑(仅在拿得到 oldUid 时):先做 vscdb/tips(可单件回滚),再做正库(最重的一步)
  const vscdbLeftover = { files: 0, leftoverOldKeys: 0 }
  if (oldUid) {
    const gs = path.join(userDataDir, 'User', 'globalStorage')
    const ws = path.join(userDataDir, 'User', 'workspaceStorage')
    try {
      // 缺陷 1:vscdb 此前是"原地写、无备份",写坏只能靠外部手拍 —— 现在每个文件写前入账
      // (文件不存在时 backup 只记一笔"回滚要删",免得 DatabaseSync 顺手造出的空库留下来)
      const gsFile = path.join(gs, 'state.vscdb')
      journal.backup(gsFile)
      const g = carry.rebindVscdb(gsFile, oldUid, newUid)
      const wsFiles = fs.existsSync(ws)
        ? fs
            .readdirSync(ws)
            .map((d) => path.join(ws, d, 'state.vscdb'))
            .filter((f) => fs.existsSync(f))
        : []
      const wsResults = wsFiles.map((f) => {
        journal.backup(f)
        return carry.rebindVscdb(f, oldUid, newUid)
      })
      const w = wsResults.reduce(
        (a, b) => ({
          renamed: a.renamed + b.renamed,
          collisions: a.collisions + b.collisions,
        }),
        { renamed: 0, collisions: 0 },
      )
      vscdbLeftover.files = 1 + wsFiles.length
      vscdbLeftover.leftoverOldKeys =
        Number(g.leftoverOldKeys ?? 0) +
        wsResults.reduce((a, b) => a + Number(b.leftoverOldKeys ?? 0), 0)
      report.vscdb = { global: g, workspace: w, leftoverOldKeys: vscdbLeftover.leftoverOldKeys }
      steps.push('rebind-vscdb')

      const tips = carry.planTipsRenames(userDataDir, oldUid, newUid)
      let tipsRenamed = 0
      for (const { from, to } of tips) {
        if (from === to) continue
        journal.backup(from)
        // 新名切前就在 ⇒ 也得留一份,回滚时还原它而不是删它(缺陷 3 的边界)
        const preExisted = fs.existsSync(to)
        if (preExisted) journal.backup(to)
        journal.recordRename(from, to, { preExisted })
        fs.renameSync(from, to)
        tipsRenamed += 1
      }
      report.tipsRenamed = tipsRenamed

      const patched = carry.rebindStorageJson(patch.next as Record<string, unknown>, oldUid, newUid)
      for (const a of patched.actions)
        if (a.kind === 'envelope-uid-rebind') steps.push('rebind-envelope-uid')
      Object.assign(patch.next, patched.next)
    } catch (e) {
      // 缺陷 5 的显式档:vscdb 改完仍有旧 uid 键 ⇒ 具名 leftover-uid 并进 fail 流程
      if ((e as { code?: string })?.code === 'leftover-uid') {
        steps.push('abort-leftover-uid')
        return fail(`leftover-uid 断言失败: ${String(e)}`)
      }
      return fail(`状态重绑失败: ${String(e)}`)
    }
  }

  // ④ 正库(SQLCipher):解密 → 重绑 → 重加密 → 自证 → 原子写回(全链走 lib 单源)
  const dbFile = carry.locateAgentDatabase(userDataDir)
  if (dbFile && oldUid) {
    steps.push('agent-db-found')
    try {
      const exe = preCloseExePath
      const exePath = exe
      /**
       * 2026-11-10 修:不能再只靠 exe 目录推 dll —— 正库段在客户端**已关闭之后**才跑,
       * 那时 resolveProductExe 查不到进程路径(本机装在 G:\Trae CN,返回 '')⇒ no-dll ⇒ 整链回滚。
       * 改走 `locateAgentDll`:从 userDataDir 逐级向上反推安装根,与进程无关。
       * exePath 只在前置缓存命中时才有值(关端前抓的),仍作首选。
       */
      const dllPath = carry.locateAgentDll({
        product,
        userDataDir,
        exePath,
        env: process.env,
      })
      if (!dllPath) {
        return fail(
          `找不到 ai_agent.dll(正库密钥材料):userDataDir=${userDataDir} / exe=${exePath || '(空)'}。` +
            '请确认客户端安装完整(resources/app/modules/ai-agent/ai_agent.dll 存在)',
        )
      }
      steps.push('agent-dll-found')
      const res = await carry.rebindAgentDbFile(dbFile, {
        oldUid,
        newUid,
        dllPath,
        write: true,
        // 缺陷 4:正库原件与伴生 -wal/-shm 在写前进同一本日志 ⇒ 失败时与 storage.json/vscdb 一起还原
        journal,
      })
      report.agentDb = res
      report.serverHistoryInfoUserId = res.serverHistoryInfo
      report.leftoverCheck = {
        db: res.leftovers?.checked ?? [],
        dbLeftovers: res.leftovers?.leftovers ?? [],
        vscdb: vscdbLeftover,
        // uidCols 之外仍带旧号的表只报不改(model_config_cache 这类"缓存"面,不属对话正文)
        otherUidTables: res.otherUidTables ?? [],
      }
      steps.push('rebind-agent-db:selfcheck-pass')
      steps.push('assert-no-leftover-uid')
      if (res.serverHistoryInfo?.decision === 'left-untouched') {
        // 判据:该列客户端从不填、也不据此过滤本地历史 ⇒ 全 NULL 保持原样,不做 NULL 归并
        steps.push('skip-server-history-user-null(客户端不据此过滤)')
      } else if (res.rebound?.['server_history_info:null-merge']) {
        steps.push('rebind-server-history-null-merge')
      }
    } catch (e) {
      if ((e as { code?: string })?.code === 'leftover-uid') {
        steps.push('abort-leftover-uid')
        return fail(`leftover-uid 断言失败: ${String(e)}`)
      }
      return fail(`正库迁移失败: ${String(e)}`)
    }
  } else if (!dbFile) {
    steps.push('warn-no-agent-db(本机没装过对话?跳过正库)')
  }

  // ⑤ 信封落盘(所有自证过了才写)
  const writeAt = Date.now()
  const backup = sw.writeStorageAtomic(storageFile, patch.next as Record<string, unknown>)
  report.storageBackup = backup
  try {
    const after = JSON.parse(fs.readFileSync(storageFile, 'utf8'))
    const back = JSON.parse(ex.decryptEnvelope(after[sw.AUTH_KEY]))
    if (String(back?.userId) !== newUid) return fail('写后回读:信封 userId 与目标号不符')
    steps.push('storage-verified')
  } catch (e) {
    return fail(`写后回读校验失败: ${String(e)}(备份 ${backup})`)
  }

  // ⑥ 拉起客户端
  report.outcome = 'carried'
  if (!o.noLaunch) {
    const exe = proc.resolveProductExe(product)
    const exePath = typeof exe === 'string' ? exe : (exe?.path ?? '')
    const launched = exePath
      ? proc.launchProduct(exePath, { product })
      : { launched: false, error: '无 exe 路径' }
    report.launch = launched
    steps.push(launched.launched ? 'client-relaunched' : 'launch-failed')
  }

  /**
   * ⑦ 客户端验收(2026-11-12 立)。
   *
   * 写盘成功 ≠ 登录成功:客户端启动第一件事就是拿 rt 换票,换不出就把登录信封删掉
   * (实测 08:35:53 启动 → 08:35:55 清空,连 iCubeServerData 一起)。这一步把
   * 「脚本说切完了」与「客户端真登上了」之间的缺口堵掉 —— 拒收就整组回滚 + 重新拉起,
   * 把用户送回切前那个能用的登录态,绝不把人留在未登录态。
   */
  if (!o.noLaunch && (report.launch as { launched?: boolean } | undefined)?.launched) {
    const acc = await verifyClientAccepted(storageFile, newUid, writeAt)
    report.clientAcceptance = acc
    steps.push(`client-acceptance:${acc.verdict}`)
    if (acc.verdict === 'rejected') {
      report.outcome = 'failed-client-rejected'
      process.stderr.write(
        `❌ 客户端拒收写入的登录态:${acc.detail}\n` + '   正在整组回滚到切前态并重新拉起客户端…\n',
      )
      // 客户端在跑时退出会用内存态覆写 storage.json ⇒ 回滚前必须先关端
      const pidsNow = proc.listProductPids(product)
      proc.closeProduct(product, { pids: pidsNow ?? undefined, waitMs: 12_000 })
      await sleep(1200)
      const res = journal.restore()
      report.rollback = {
        backups: journal.backupPaths(),
        restored: res.restored,
        removed: res.removed,
        failedRestores: res.failed,
        renames: journal.renames(),
        runId: journal.runId,
      }
      /**
       * 回滚后归属一致性核对(2026-11-12 立;本次事故的第二层原因就是这个缺口)。
       *
       * 08:35 那次:客户端拒收 → journal 回了 storage.json/vscdb,但**正库的 project /
       * user_configuration 留在了新号**,于是"登录态是 A 号、项目与配置归属是 B 号"。
       * 脚本当时报的是"已切号完成",没人知道数据错位了 —— 用户界面看起来一切正常,
       * 只是项目和配置全都不见了。
       *
       * 这里只核对**本脚本自己写过的两张表**(project / user_configuration):
       * 回滚后它们的 user_id 必须全部回到 oldUid(切前那枚),既不能留 newUid,也不能空。
       * 对不上 ⇒ 在报告里具名标出并把退出码抬到 1,绝不把错位说成"已回滚"。
       * 注:local_artifact 等表本来就可能跨多个历史 uid,不做单一归属断言。
       */
      try {
        const dbNow = carry.locateAgentDatabase(userDataDir)
        const dllNow = carry.locateAgentDll({
          product,
          userDataDir,
          exePath: '',
          env: process.env,
        })
        if (dbNow && dllNow && oldUid) {
          const owner = await carry.readTableUidOwners({
            dbFile: dbNow,
            dllPath: dllNow,
            tables: ['project', 'user_configuration'],
          })
          const bad = Object.entries(owner as Record<string, string[]>).filter(([, uids]) =>
            uids.some((u) => u && u !== oldUid),
          )
          report.rollbackOwnerCheck = {
            expected: oldUid,
            owners: owner,
            mismatched: bad.map(([t]) => t),
          }
          if (bad.length > 0) {
            const detail = bad.map(([t, u]) => `${t}=${u.join('/')}`).join(', ')
            steps.push('rollback-owner-mismatch')
            process.stderr.write(
              `❌ 回滚后数据归属仍与登录态不一致(${detail};期望 ${oldUid})。\n` +
                '   正向 `node scripts/switch-client-account.mjs` 重切同一枚号即可把归属搬正;\n' +
                `   或人工用备份还原:${journal.dir}\n`,
            )
            report.steps = steps
            process.stdout.write(`${JSON.stringify(report)}\n`)
            return 1
          }
          steps.push('rollback-owner-verified')
        }
      } catch (e) {
        // 核对不了不改判(report 里留具名未判定),但绝不静默当成已核对
        report.rollbackOwnerCheck = {
          error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
        }
        steps.push('rollback-owner-undetermined')
      }
      const exeR = proc.resolveProductExe(product)
      const exePathR = typeof exeR === 'string' ? exeR : (exeR?.path ?? '')
      report.relaunchAfterRollback = exePathR
        ? proc.launchProduct(exePathR, { product })
        : { launched: false, error: '无 exe 路径' }
      report.steps = steps
      process.stdout.write(`${JSON.stringify(report)}\n`)
      process.stderr.write('   已回滚;请打开客户端核对是否回到切前那个账号。\n')
      return 1
    }
  }
  process.stdout.write(`${JSON.stringify(report)}\n`)
  process.stderr.write(
    `✅ 已切号并携带对话: 旧 uid=${oldUid ?? '未读到'} → 新 uid=${newUid} 名称=${row.name}\n`,
  )
  if (!o.noLaunch && !(report.launch as any)?.launched) {
    process.stderr.write('   ⚠️ 客户端没能自动拉起,手工打开 Trae 即生效。\n')
  }
  if ((report.clientAcceptance as { verdict?: string } | undefined)?.verdict === 'unobserved') {
    process.stderr.write(
      '   ℹ️ 客户端 15s 内没重写 storage.json:登录成功但无变更,或启动较慢 —— 打开界面核对一下当前账号。\n',
    )
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(
        `❌ ${e instanceof Error ? e.message : String(e)}\n${e instanceof Error ? e.stack : ''}`,
      )
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
