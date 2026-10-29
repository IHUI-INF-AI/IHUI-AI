// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 反代账号池一键导入(2026-10-23 立)。
 *
 * 三种入口:
 *   1) 自动取本机正在登录的 WorkBuddy:
 *        node scripts/relay-account-pool.mjs --from workbuddy
 *   2) 自动取本机 Trae 客户端会话(带 refreshToken ⇒ 号池可自续期):
 *        node scripts/relay-account-pool.mjs --from trae
 *   3) 直接导入标准账号 JSON({accounts:[...]} 或裸数组):
 *        node scripts/relay-account-pool.mjs --file accounts.json [--provider workbuddy]
 *
 * 编排:提取/读取 → (stdin 传 JSON,不落盘) → apps/api/scripts/relay-account-import.ts
 *       → 校验 → importAccounts 落库(按 provider+uid 覆盖,重复跑即刷新令牌)→ 健康检查。
 *
 * 安全:令牌不打印、不落盘;WorkBuddy 调试通道取完即关。
 * 退出码:0 成功 / 1 校验不通过或全部失败 / 2 参数或环境未判定。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const IMPORTER = path.join(API_DIR, 'scripts', 'relay-account-import.ts')

const HELP = `反代账号池导入

用法:
  node scripts/relay-account-pool.mjs --from trae                  # 取本机 Trae 客户端会话(含 refreshToken)并导入
  node scripts/relay-account-pool.mjs --from workbuddy             # 取本机 WorkBuddy 桌面版当前登录号并导入(需桌面在跑且已登录)
  node scripts/relay-account-pool.mjs --from qoder                # 取本机 Qoder 登录态并导入(需 pwsh 7+;客户端不必在跑)
  node scripts/relay-account-pool.mjs --from codearts           # 取本机 CodeArts Agent 登录态并导入(Windows 自带 powershell 即可;桌面不必在跑)
  node scripts/relay-account-pool.mjs --file <accounts.json>       # 直接导入标准账号 JSON
    [--provider <trae|workbuddy|qoder|codearts|codex|opencode|minimax|zcode|loomy|doubao|lingma|grokbot>]   文件顶层无 providerCode 时必须给
    [--dry-run]                              只校验预检,不写库
    [--no-health]                            跳过导入后的上游健康检查
    [--json]                                 机器可读摘要(提取信息走 stderr)

标准 JSON:{"accounts":[{"name":"...","token":"...","refreshToken":"...","enabled":true}]}
说明:
  - 同一 provider+uid 重复导入 = 覆盖凭证并重置健康状态(用于换 token/刷新);
  - WorkBuddy 需要桌面版正在运行且已登录(密钥只存在于主进程);
   - Trae 读 %APPDATA%\\<Trae CN|TRAE SOLO CN|Trae>\\User\\globalStorage\\storage.json 的信封
     (进程不是登录用户账户时自动兜底扫本机各用户 profile;IHUI_TRAE_SCAN_USERS=0 可关),客户端不必在跑;
  - Qoder 读 %APPDATA%\\com.qoder[cn].app.* 的 auth.v1.dat(DPAPI+AES-GCM,须以登录
     Qoder 的同一 Windows 用户跑;IHUI_QODER_CAPTURE_PS1 可换捕获脚本),客户端不必在跑;
     无 pwsh 环境降级:qoder-capture.ps1 -OutFile 后 pnpm qoder:import -- --session-file;
  - CodeArts 读 %APPDATA%\codearts-agent\User\globalStorage\state.vscdb 的
     HuaweiCloudSession 秘密(v10+DPAPI+AES-GCM,须以登录 CodeArts 的同一 Windows 用户跑;
     桌面在跑可能持锁,先关再提;IHUI_CODEARTS_SCAN_USERS=0 可关 profile 兜底);
  - 任何输出都不包含令牌明文。
`

/** 号池认的平台 ⇒ 本机会话提取器是否已装车。
 *  值为 null ⇒ 该平台的入账/换票/轮转/告警都在跑,缺的只是「本机提取器」:
 *  `--from` 一律明示未判定(exit 2)并点名当下真出路(§0.3 取不到输入不猜;§0.8 不指跑不通的路)。
 *  新平台取证到落点后,在此登记适配器模块与函数名即完成接入 —— 单一入口,不留第二份口径(§0.6)。 */
const FROM_PROVIDERS = Object.freeze({
  trae: { module: 'trae-auth-extract.mjs', fn: 'extractTraeAccount' },
  workbuddy: { module: 'workbuddy-auth-extract.mjs', fn: 'extractWorkbuddyAccount' },
  qoder: { module: 'qoder-auth-extract.mjs', fn: 'extractQoderAccounts' },
  codearts: { module: 'codearts-auth-extract.mjs', fn: 'extractCodeartsAccounts' },
  codex: { module: 'codex-auth-extract.mjs', fn: 'extractCodexAccounts' },
  opencode: { module: 'opencode-auth-extract.mjs', fn: 'extractOpencodeAccounts' },
  minimax: { module: 'minimax-auth-extract.mjs', fn: 'extractMinimaxAccounts' },
  zcode: { module: 'zcode-auth-extract.mjs', fn: 'extractZcodeAccounts' },
  loomy: { module: 'loomy-auth-extract.mjs', fn: 'extractLoomyAccounts' },
  doubao: { module: 'doubao-auth-extract.mjs', fn: 'extractDoubaoAccounts' },
  lingma: { module: 'lingma-auth-extract.mjs', fn: 'extractLingmaAccounts' },
  grokbot: { module: 'grokbot-auth-extract.mjs', fn: 'extractGrokbotAccounts' },
})
const FROM_POOL_KEYS = Object.keys(FROM_PROVIDERS)

function parseArgs(argv) {
  const options = {
    from: null,
    file: null,
    providerCode: null,
    dryRun: false,
    health: true,
    json: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--from') options.from = argv[++i] ?? ''
    else if (arg === '--file') options.file = argv[++i] ?? ''
    else if (arg === '--provider') options.providerCode = argv[++i] ?? ''
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--no-health') options.health = false
    else if (arg === '--json') options.json = true
    else return { options: null, error: `未知参数: ${arg}` }
  }
  if (options.help) return { options, error: null }
  if (options.from && options.file) return { options: null, error: '--from 与 --file 只能二选一' }
  if (!options.from && !options.file)
    return { options: null, error: `缺少输入:--from ${FROM_POOL_KEYS.join('|')} 或 --file <json>` }
  if (options.from && !FROM_POOL_KEYS.includes(options.from)) {
    return {
      options: null,
      error: `未知来源: ${options.from}(号池认的平台:${FROM_POOL_KEYS.join(' | ')};其他平台用 --file)`,
    }
  }
  return { options, error: null }
}

function resolveTsx() {
  const candidates = [
    path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function runImporter(payloadText, providerCode, options) {
  const tsxCli = resolveTsx()
  if (!tsxCli) {
    return Promise.resolve({
      code: 2,
      error: '未找到 tsx(apps/api/node_modules/tsx);请先在仓根跑 pnpm install',
    })
  }
  const args = [tsxCli, IMPORTER, '--stdin']
  if (providerCode) args.push('--provider', providerCode)
  if (options.dryRun) args.push('--dry-run')
  if (!options.health) args.push('--no-health')
  if (options.json) args.push('--json')
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: API_DIR,
      windowsHide: true,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    child.on('error', (e) => resolve({ code: 2, error: e.message }))
    child.on('exit', (code, signal) => {
      if (signal) resolve({ code: 2, error: `导入子进程被信号终止: ${signal}` })
      else resolve({ code: code ?? 2, error: null })
    })
    child.stdin.write(payloadText)
    child.stdin.end()
  })
}

async function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n\n${HELP}\n`)
    return 2
  }
  const options = parsed.options
  if (options.help) {
    process.stdout.write(`${HELP}\n`)
    return 0
  }

  let payloadText
  let providerCode = options.providerCode || null

  if (options.from && !FROM_PROVIDERS[options.from]) {
    process.stderr.write(
      `❌ 提取未装车(未判定):--from ${options.from} —— 该平台的入账/换票/轮转/告警均已建,` +
        `本机会话提取器尚未开发(落点在取证,§0.3 绝不猜)。当下真跑得通的出路:` +
        `①后台「中转-号池-账号池」导入账号 JSON;` +
        `②node scripts/relay-account-pool.mjs --file <json> --provider ${options.from}。`,
    )
    return 2
  }

  if (options.from === 'workbuddy') {
    const { extractWorkbuddyAccount } = await import(
      pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'workbuddy-auth-extract.mjs')).href
    )
    let extracted
    try {
      extracted = await extractWorkbuddyAccount()
    } catch (e) {
      const code = e?.code ? `[${e.code}] ` : ''
      process.stderr.write(
        `❌ 提取失败(未判定): ${code}${e instanceof Error ? e.message : String(e)}\n`,
      )
      return 2
    }
    const meta = extracted.meta
    process.stderr.write(
      `提取: 版本=${meta.edition} pid=${meta.pid} uid=${meta.uid} 名称=${meta.name} ` +
        `token到期=${meta.tokenExpiresAt ?? '-'} 指纹=${meta.tokenFingerprint} ` +
        `(access ${meta.accessTokenLength}B / refresh ${meta.refreshTokenLength}B)\n`,
    )
    providerCode = extracted.providerCode
    payloadText = JSON.stringify(extracted)
  } else if (options.from === 'codearts') {
    const { extractCodeartsAccounts } = await import(
      pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'codearts-auth-extract.mjs')).href
    )
    let extracted
    try {
      extracted = await extractCodeartsAccounts()
    } catch (e) {
      const code = e?.code ? `[${e.code}] ` : ''
      process.stderr.write(
        `❌ 提取失败(未判定): ${code}${e instanceof Error ? e.message : String(e)}\n`,
      )
      return 2
    }
    const meta = extracted.meta
    process.stderr.write(
      `提取: 会话=${meta.count} 跳过=${meta.skipped} 落点=${meta.sourceDir}\n` +
        meta.sessions
          .map(
            (s) =>
              `  #${s.uid} ${s.name} STS到期=${s.expiresAt} refresh=${s.hasRefresh ? '有' : '无'} ` +
              `AK/SK=${s.hasAkSk ? '全' : '缺'} DPoP=${s.hasDpopJwk ? '有' : '缺'} PKCE=${s.hasCodeVerifier ? '有' : '缺'} ` +
              `指纹=${s.tokenFingerprint} (STS ${s.tokenLength}B)`,
          )
          .join('\n') +
        '\n',
    )
    providerCode = extracted.providerCode
    payloadText = JSON.stringify(extracted)
  } else if (options.from === 'qoder') {
    const { extractQoderAccounts } = await import(
      pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'qoder-auth-extract.mjs')).href
    )
    let extracted
    try {
      extracted = await extractQoderAccounts()
    } catch (e) {
      const code = e?.code ? `[${e.code}] ` : ''
      process.stderr.write(
        `❌ 提取失败(未判定): ${code}${e instanceof Error ? e.message : String(e)}\n`,
      )
      return 2
    }
    const meta = extracted.meta
    process.stderr.write(
      `提取: 会话=${meta.count} 跳过=${meta.skipped}\n` +
        meta.sessions
          .map(
            (s) =>
              `  #${s.uid} ${s.name} (${s.edition}) token到期=${s.expiresAt} ` +
              `rt到期=${s.refreshTokenExpiresAt} refresh=${s.hasRefresh ? '有' : '无'} ` +
              `指纹=${s.tokenFingerprint} (access ${s.accessTokenLength}B)`,
          )
          .join('\n') +
        '\n',
    )
    providerCode = extracted.providerCode
    payloadText = JSON.stringify(extracted)
  } else if (options.from === 'trae') {
    const { extractTraeAccount } = await import(
      pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'trae-auth-extract.mjs')).href
    )
    let extracted
    try {
      extracted = extractTraeAccount()
    } catch (e) {
      const code = e?.code ? `[${e.code}] ` : ''
      process.stderr.write(
        `❌ 提取失败(未判定): ${code}${e instanceof Error ? e.message : String(e)}\n`,
      )
      return 2
    }
    const meta = extracted.meta
    process.stderr.write(
      `提取: 落点=${meta.storageFile} 键=${meta.storageKey} uid=${meta.uid} 名称=${meta.name} ` +
        `token到期=${meta.tokenExpiresAt ?? '-'} refreshToken到期=${meta.refreshExpiresAt ?? '-'} ` +
        `指纹=${meta.tokenFingerprint} (access ${meta.accessTokenLength}B / refresh ${meta.refreshTokenLength}B)\n`,
    )
    providerCode = extracted.providerCode
    payloadText = JSON.stringify(extracted)
  } else if (options.from && FROM_PROVIDERS[options.from]) {
    // 2026-10-27 扩容八平台通用分支:提取器已在注册表登记 ⇒ 按 module/fn 动态分发。
    // 各平台 meta.sessions 形状不同 ⇒ 逐条 compact JSON 打印(提取器侧已保证零 token 回显)。
    const entry = FROM_PROVIDERS[options.from]
    const mod = await import(
      pathToFileURL(path.join(ROOT, 'scripts', 'lib', entry.module)).href
    )
    const extractFn = mod[entry.fn]
    if (typeof extractFn !== 'function') {
      process.stderr.write(
        `❌ 提取器接线错误(未判定):${entry.module} 未导出 ${entry.fn}\n`,
      )
      return 2
    }
    let extracted
    try {
      extracted = await extractFn()
    } catch (e) {
      const code = e?.code ? `[${e.code}] ` : ''
      process.stderr.write(
        `❌ 提取失败(未判定): ${code}${e instanceof Error ? e.message : String(e)}\n`,
      )
      return 2
    }
    const meta = extracted.meta
    const sessionLines = Array.isArray(meta.sessions)
      ? meta.sessions.map((s) => `  ${JSON.stringify(s)}`)
      : []
    process.stderr.write(
      `提取: 会话=${meta.count ?? sessionLines.length}` +
        (typeof meta.skipped === 'number' ? ` 跳过=${meta.skipped}` : '') +
        (meta.sourceDir || meta.sourceFile || meta.sourcePath
          ? ` 落点=${meta.sourceDir ?? meta.sourceFile ?? meta.sourcePath}`
          : '') +
        '\n' +
        sessionLines.join('\n') +
        '\n',
    )
    providerCode = extracted.providerCode
    payloadText = JSON.stringify(extracted)
  } else {
    try {
      payloadText = fs.readFileSync(path.resolve(options.file), 'utf8')
    } catch (e) {
      process.stderr.write(
        `❌ 读取文件失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`,
      )
      return 2
    }
    if (!providerCode) {
      try {
        const raw = JSON.parse(payloadText)
        if (
          raw &&
          typeof raw === 'object' &&
          !Array.isArray(raw) &&
          typeof raw.providerCode === 'string'
        ) {
          providerCode = raw.providerCode
        }
      } catch {
        process.stderr.write('❌ JSON 解析失败(未判定)\n')
        return 2
      }
    }
  }

  const result = await runImporter(payloadText, providerCode, options)
  if (result.error) process.stderr.write(`❌ ${result.error}\n`)
  return result.code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export const __test__ = { parseArgs, FROM_PROVIDERS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
