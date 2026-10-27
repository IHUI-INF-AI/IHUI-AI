// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 本机会话提取器(2026-10-27 装车,补 FROM_PROVIDERS.qoder=null 的缺口)。
 *
 * 分工(§0.6 单一真相源,本模块零映射):
 *   - 捕获 = apps/api/scripts/qoder-capture.ps1(既有单一捕获源:DPAPI 解 Local State
 *     密钥 → AES-256-GCM 解 auth.v1.dat → {sessions:[…]},含 cosy 设备指纹族);
 *   - 归一 = 服务端 normalizeForeignAccountShape(accessToken 别名、uid/nickname/name/
 *     machineId/deviceId、到期解析)—— importAccounts 逐行调用;
 *   - 映射 = 服务端 mapQoderImport(token/refreshToken/uid/cosy 蛇形落 extraMetadata)。
 * 本模块只做:spawn pwsh 跑捕获脚本 → 校验输出形状 → 组 {providerCode,accounts,meta}
 * 交给编排器(relay-account-pool.mjs)stdin 进落库器。raw session 直通,不抄第二份映射。
 *
 * 安全:令牌不打印、不落盘;meta 摘要只有 uid/名称/到期/指纹/字节长度(与 trae/
 * workbuddy 抽取器同口径);任何错误信息不含凭据明文。
 *
 * 无 pwsh 环境降级(§0.8 出路真跑得通):在能解密的机器上
 *   pwsh -NoProfile -File apps/api/scripts/qoder-capture.ps1 -OutFile session.json
 * 再 `pnpm qoder:import -- --session-file session.json`(该通道自带会话→条目映射)。
 *
 * 退出语义(§0.3):取不到输入 = throw(带 code),由编排器落 exit 2「未判定」并点名原因;
 * 绝不静默返回空数组冒绿。
 */
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
/** 捕获脚本单一源(apps/api/scripts/qoder-capture.ps1);IHUI_QODER_CAPTURE_PS1 可覆盖(跨机取证用) */
export const CAPTURE_PS1_DEFAULT = path.resolve(
  SCRIPT_DIR,
  '..',
  '..',
  'apps',
  'api',
  'scripts',
  'qoder-capture.ps1',
)

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
}

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

/** 单条会话的 stderr 摘要(不含任何令牌明文;指纹即哈希)。 */
export function summarizeSession(s) {
  const rec = s ?? {}
  return {
    uid: cstr(rec.uid) || '(缺)',
    name: cstr(rec.nickname) || cstr(rec.phone) || cstr(rec.name) || '(未知号)',
    edition: cstr(rec.edition) || '(未知版)',
    expiresAt: cstr(rec.expiresAt) || '-',
    refreshTokenExpiresAt: cstr(rec.refreshTokenExpiresAt) || '-',
    hasRefresh: cstr(rec.refreshToken) !== '',
    tokenFingerprint: rec.accessToken ? fingerprintOf(rec.accessToken) : '-',
    accessTokenLength: cstr(rec.accessToken).length,
    deviceId: cstr(rec.deviceId) || '-',
  }
}

/**
 * 校验捕获脚本 stdout 形状并抽出会话数组;形状不对 ⇒ throw(未判定,不猜)。
 * ps1 契约:{ sessions: [{uid, accessToken, refreshToken, expiresAt, …}] }。
 */
export function parseCaptureOutput(stdout) {
  let parsed
  try {
    parsed = JSON.parse(String(stdout ?? '').trim())
  } catch {
    throw Object.assign(new Error('捕获脚本输出不是合法 JSON(未判定)'), { code: 'QODER_BAD_OUTPUT' })
  }
  const sessions = parsed && typeof parsed === 'object' ? parsed.sessions : null
  if (!Array.isArray(sessions)) {
    throw Object.assign(new Error('捕获脚本输出缺 sessions[](未判定)'), { code: 'QODER_BAD_OUTPUT' })
  }
  return sessions
}

/** 从捕获会话里挑出可导入条目:uid 与 accessToken 双全才算(ps1 已保证,防御性复核)。 */
export function pickImportableSessions(sessions) {
  const valid = []
  let skipped = 0
  for (const s of Array.isArray(sessions) ? sessions : []) {
    const rec = s ?? {}
    if (cstr(rec.uid) === '' || cstr(rec.accessToken) === '') {
      skipped++
      continue
    }
    valid.push(rec)
  }
  return { valid, skipped }
}

/**
 * 会话模板(2026-10-27 立):auth.v1.dat 解出的整份会话去掉凭证/到期字段。
 * 「登录本机」用它 + 池内最新凭证重封 auth.v1.dat;凭证字段只在这里剔除一次。
 */
export function buildSessionTemplate(rawSession) {
  if (!rawSession || typeof rawSession !== 'object' || Array.isArray(rawSession)) return null
  const template = JSON.parse(JSON.stringify(rawSession))
  for (const k of ['token', 'accessToken', 'refreshToken', 'expiresAt', 'refreshTokenExpiresAt']) {
    delete template[k]
  }
  return template
}

/**
 * 提取本机 Qoder 会话 → 编排器 payload。pwsh 缺失/捕获失败/输出畸形一律 throw 带 code,
 * 编排器据此 exit 2;绝不静默返回空。
 * @param {{ps1Path?: string, pwshBin?: string}} [opts] ps1Path/pwshBin 仅供测试注入
 */
export async function extractQoderAccounts(opts = {}) {
  const ps1 = opts.ps1Path ?? process.env.IHUI_QODER_CAPTURE_PS1 ?? CAPTURE_PS1_DEFAULT
  if (!fs.existsSync(ps1)) {
    throw Object.assign(
      new Error(`捕获脚本不存在: ${ps1}(仓不完整或被误删;降级出路见模块头注)`),
      { code: 'QODER_PS1_MISSING' },
    )
  }
  const r = spawnSync(
    opts.pwshBin ?? 'pwsh',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1],
    {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      // §12g:派生必须显式接管 stdio(不吃 stdin ⇒ 首通道 ignore,stdout 要回读 JSON ⇒ 管道)
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  if (r.error) {
    const enoent = r.error.code === 'ENOENT'
    throw Object.assign(
      new Error(
        enoent
          ? '本机没有 pwsh(PowerShell 7+):捕获脚本依赖 pwsh 运行。出路:①安装 pwsh 后重跑;②在能解密的机器上跑 qoder-capture.ps1 -OutFile session.json,再 `pnpm qoder:import -- --session-file session.json`'
          : `捕获脚本启动失败: ${r.error.message}`,
      ),
      { code: enoent ? 'QODER_PWSH_MISSING' : 'QODER_CAPTURE_SPAWN_FAILED' },
    )
  }
  if (r.status !== 0) {
    const why =
      (r.stderr ?? '').trim().split('\n').slice(-2).join('; ').slice(0, 300) || `exit ${r.status}`
    throw Object.assign(
      new Error(
        `本机 Qoder 捕获失败(${why})。请确认:① 本机已登录 Qoder 客户端(%APPDATA%\\com.qoder[cn].app.* 存在);` +
          '② 以登录 Qoder 的同一 Windows 用户运行(DPAPI 限制)。降级出路:qoder-capture.ps1 -OutFile + pnpm qoder:import -- --session-file',
      ),
      { code: 'QODER_CAPTURE_FAILED' },
    )
  }
  const { valid, skipped } = pickImportableSessions(parseCaptureOutput(r.stdout))
  if (valid.length === 0) {
    throw Object.assign(
      new Error(`捕获到 0 条可导入会话(跳过 ${skipped} 条;登录态缺失或缺 uid/token ⇒ 未判定)`),
      { code: 'QODER_NO_SESSIONS' },
    )
  }
  return {
    providerCode: 'qoder',
    accounts: valid.map((s) => {
      const template = buildSessionTemplate(s.rawSession)
      const rest = { ...s }
      delete rest.rawSession
      // rawSession 含凭证,绝不进 accounts(防 extraMetadata 明文落库);
      // sessionTemplate 已剔凭证,是 canonical 键,导入映射会加密进 secretsEnc
      return template ? { ...rest, sessionTemplate: template } : rest
    }),
    meta: { count: valid.length, skipped, sessions: valid.map(summarizeSession) },
  }
}

export const __test__ = {
  summarizeSession,
  parseCaptureOutput,
  pickImportableSessions,
  buildSessionTemplate,
  fingerprintOf,
  CAPTURE_PS1_DEFAULT,
}
