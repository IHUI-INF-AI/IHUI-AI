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
  node scripts/relay-account-pool.mjs --from workbuddy             # 取本机当前登录的 WorkBuddy 号并导入
  node scripts/relay-account-pool.mjs --from trae                  # 取本机 Trae 客户端会话(含 refreshToken)并导入
  node scripts/relay-account-pool.mjs --file <accounts.json>       # 直接导入标准账号 JSON
    [--provider <trae|workbuddy|codearts>]   文件顶层无 providerCode 时必须给
    [--dry-run]                              只校验预检,不写库
    [--no-health]                            跳过导入后的上游健康检查
    [--json]                                 机器可读摘要(提取信息走 stderr)

标准 JSON:{"accounts":[{"name":"...","token":"...","refreshToken":"...","enabled":true}]}
说明:
  - 同一 provider+uid 重复导入 = 覆盖凭证并重置健康状态(用于换 token/刷新);
  - WorkBuddy 需要桌面版正在运行且已登录(密钥只存在于主进程);
  - Trae 只读 %APPDATA%\\<Trae CN|TRAE SOLO CN>\\User\\globalStorage\\storage.json 的信封,客户端不必在跑;
  - 任何输出都不包含令牌明文。
`

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
    return { options: null, error: '缺少输入:--from workbuddy|trae 或 --file <json>' }
  if (options.from && !['workbuddy', 'trae'].includes(options.from)) {
    return {
      options: null,
      error: `暂不支持的来源: ${options.from}(可选 workbuddy | trae;其他平台请用 --file)`,
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

export const __test__ = { parseArgs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
