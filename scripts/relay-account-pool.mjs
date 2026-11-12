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
 *   4) 「一行一个 token」的行文本直接入池(2026-11-06 立,补上纯文本手上没有出口那一格):
 *        node scripts/relay-account-pool.mjs --tokens-file tokens.txt --provider workbuddy [--dry-run]
 *      折叠判据单源 = scripts/lib/relay-account-tokens-text.mjs;本文件只做参数面与回显,
 *      不另写一份校验 ⇒ 预检读数(uid/expired/duplicateUids)与 3) 逐字同源。
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
// 个人池归属的唯一读取实现(§0.6):判据与 reason 措辞都只许这一份,不在本文件复算
import {
  POOL_OWNER_REASON_TEXT,
  UUID_LIKE_RE,
  maskPoolOwner,
  resolveDefaultPoolOwner,
} from './lib/pool-owner.mjs'
// 「一行一个 token」行文本的折叠单源(§0.6):校验/uid/去重一律留给下游预检,本文件不抄第二份
import {
  TOKENS_TEXT_REASON_TEXT,
  buildAccountsPayload,
  loadMaskPhone,
  parseTokensLineText,
  renderDuplicateNotice,
  renderEntryMapLines,
  renderNoteLines,
} from './lib/relay-account-tokens-text.mjs'
// 产物陈旧自检(2026-11-09):dist/ 不入库,增量构建可能漏编导出聚合文件 ⇒ 启动先提示重建
import { assertDistFresh } from './lib/dist-freshness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
assertDistFresh(path.join(ROOT, 'packages', 'api-client'))
const API_DIR = path.join(ROOT, 'apps', 'api')
const IMPORTER = path.join(API_DIR, 'scripts', 'relay-account-import.ts')

const HELP = `反代账号池导入

用法:
  node scripts/relay-account-pool.mjs --from trae                  # 取本机 Trae 客户端会话(含 refreshToken)并导入
  node scripts/relay-account-pool.mjs --from workbuddy             # 取本机 WorkBuddy 桌面版当前登录号并导入(需桌面在跑且已登录)
  node scripts/relay-account-pool.mjs --from qoder                # 取本机 Qoder 登录态并导入(需 pwsh 7+;客户端不必在跑)
  node scripts/relay-account-pool.mjs --from codearts           # 取本机 CodeArts Agent 登录态并导入(Windows 自带 powershell 即可;桌面不必在跑)
  node scripts/relay-account-pool.mjs --file <accounts.json>       # 直接导入标准账号 JSON
  node scripts/relay-account-pool.mjs --tokens-file <tokens.txt> --provider <code>   # 「一行一个 token」的行文本入池
    [--name-prefix <前缀>]                 缺名称时的自动名前缀(名=<前缀->token-<12位指纹>)
    [--provider <trae|workbuddy|qoder|codearts|codex|opencode|minimax|zcode|loomy|doubao|lingma|grokbot>]   文件顶层无 providerCode 时必须给;--tokens-file 无顶层 providerCode ⇒ 必须给
    [--dry-run]                              只校验预检,不写库
    [--no-health]                            跳过导入后的上游健康检查
    [--owner <users.id>]                     显式导入为该用户的个人池(优先级最高,压过默认)
    [--ops-pool]                             显式落运营池(运维逃生口,压过默认归属;与 --owner 互斥)
    [--no-sync-prod]                         关闭默认的生产同步(默认已开启:本机导入成功后自动推生产)
    [--push-prod]                            显式确认推生产(默认即推,冗余兼容;与 --no-sync-prod 互斥)
    [--prod-only]                            跳过本机库,只推生产(隐含推生产)
    [--prod-host <alias>]                    SSH 别名(默认 ssh.aizhs.top;须免密可用)
    [--prod-checkout <path>]                 生产 checkout 根(默认 D:\\DevEnv\\ihui-prod)
    [--prod-owner <users.id>]                生产侧归属(缺省用本机/生产机 ~/.wb-switch/pool-owner)
    [--with-health]                          推生产时也做导入后上游健康检查(默认跳过:那一步要等上游 5xx 回落)
    [--sync-pull <provider>]                 从生产库拉回本地(互通:生产→本地),与本地导入等价落库
    [--json]                                 机器可读摘要(提取信息走 stderr)

行文本形态(--tokens-file,2026-11-06 立,手上只有纯文本时的出口):
  一行一枚 token;空行与 # 起始的注释行忽略;行内可写「名称<TAB或空格>token」两段形态。
  缺名称的自动名 = token-<12位sha256指纹>(可加 --name-prefix),不用"账号1/账号2"那种事后对不上号的名。
  折叠只做文本形态换算(单源 scripts/lib/relay-account-tokens-text.mjs),校验/uid/去重全部留给
  与 --file 同一条下游 ⇒ --dry-run 报的 uid/expired/duplicateUids 两通道逐字同源;
  同批 token 重复不折半,预检照旧报 duplicateUids 并由本器点名行号;
  空文件 / 全是注释行 / 读不到 ⇒ exit 2 未判定并点名原因(不报"导入 0 枚");
  token 明文不入任何输出,人给的名称按 packages/shared 的 maskPhone 单源脱敏后回显。

归属默认(2026-11-06 器物化,机主 2026-10-31 永久指令"我自己填入号池的账号只能跟着我的账号走"):
  不带 --owner 时,先读本机个人池归属配置 ~/.wb-switch/pool-owner(一行 users.id):
    取到 ⇒ 按它落个人池,并回显「归属=个人池 xxxxxxxx…(默认:取自 pool-owner)」;
    取不到(不存在/空/读不出/形状不合法)⇒ 首次导入强制落个人池,直接拒绝导入(不再静默
      落运营池),并在 stdout 点名原因 —— 绝不静默、也不冒充个人池。
  运营池仅由用户经「共享到运营池」按钮填充(2026-11-07 全局开放标记模型),不再接受直接导入;
  确需运维逃生口直落运营池:加 --ops-pool(显式绕过默认,需本人明确意图)。
  默认与 --owner 走同一枚读取判据(scripts/lib/pool-owner.mjs),与号池→本机快照同步同口径。

标准 JSON:{"accounts":[{"name":"...","token":"...","refreshToken":"...","enabled":true}]}
说明:
  - 同一 provider+uid 重复导入 = 覆盖凭证并重置健康状态(用于换 token/刷新);
  - WorkBuddy 需要桌面版正在运行且已登录(密钥只存在于主进程);
   - Trae 读 %APPDATA%\\<Trae CN|TRAE SOLO CN|Trae>\\User\\globalStorage\\storage.json 的信封
     (进程不是登录用户账户时自动兜底扫本机各用户 profile;IHUI_TRAE_SCAN_USERS=0 可关),客户端不必在跑;
  - Qoder 读 %APPDATA%\\com.qoder[cn].app.* 的 auth.v1.dat(DPAPI+AES-GCM,须以登录
     Qoder 的同一 Windows 用户跑;IHUI_QODER_CAPTURE_PS1 可换捕获脚本),客户端不必在跑;
     无 pwsh 环境降级:qoder-capture.ps1 -OutFile 后 pnpm qoder:import -- --session-file;
     该降级通道 2026-11-06 起与本页同一把归属尺:显式 --owner > 本机 ~/.wb-switch/pool-owner 默认 > 运营池,
     本人号请事先写好归属文件或直接带 --owner(不带又不配 ⇒ 落运营池并点名原因,不静默);
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
  // 2026-11-12 接车:小浣熊本机提取器就位(raccoon-auth-extract.mjs),凭据落点经 candidateAuthFiles()
  // 自动跟 %APPDATA%/office-raccoon junction 取到 D:\SOFTWARE\商汤小浣熊\_data\box-agent;通用分发分支即通。
  raccoon: { module: 'raccoon-auth-extract.mjs', fn: 'extractRaccoonAccounts' },
})
const FROM_POOL_KEYS = Object.keys(FROM_PROVIDERS)

/**
 * 帮助面(2026-11-05 收口):HELP 常量里手写的四条是**带前置说明**的那四条(需 pwsh / 需桌面在跑 /
 * 用哪个 shell),其余平台的 `--from` 一律由 FROM_PROVIDERS 动态列出 —— 帮助文案自己抄一份清单,
 * 就会在它落新平台时过期:实读本轮就有派单被这段旧文案误导,把「opencode 有提取通路」当成不存在。
 * 同一份名单不留第二处(§0.6),新平台在此登记即自动出现在帮助面上。
 */
const HELP_WITH_NOTE = ['trae', 'workbuddy', 'qoder', 'codearts']
function helpText() {
  const rest = FROM_POOL_KEYS.filter((k) => !HELP_WITH_NOTE.includes(k))
  if (rest.length === 0) return HELP
  return `${HELP}
  node scripts/relay-account-pool.mjs --from <${rest.join('|')}>   # 同名提取器已就位,前置条件见 FROM_PROVIDERS 头注`
}

function parseArgs(argv) {
  const options = {
    from: null,
    file: null,
    tokensFile: null,
    namePrefix: '',
    providerCode: null,
    dryRun: false,
    health: true,
    json: false,
    help: false,
    owner: '',
    opsPool: false,
    // 2026-11-11 立:本地⇄生产号池自动同步默认开启(李总明令"必须本地与生产自动同步互通")。
    // 去掉手动 --push-prod;显式 --no-sync-prod 才关闭(本地调试/离线场景)。
    prodPush: true,
    pushProdExplicit: false,
    prodOnly: false,
    prodHost: 'ssh.aizhs.top',
    prodCheckout: 'D:\\DevEnv\\ihui-prod',
    prodOwner: '',
    withHealth: false,
    syncPull: '',
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--from') options.from = argv[++i] ?? ''
    else if (arg === '--file') options.file = argv[++i] ?? ''
    else if (arg === '--tokens-file') options.tokensFile = argv[++i] ?? ''
    else if (arg === '--name-prefix') options.namePrefix = argv[++i] ?? ''
    else if (arg === '--provider') options.providerCode = argv[++i] ?? ''
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--no-health') options.health = false
    else if (arg === '--json') options.json = true
    else if (arg === '--ops-pool') options.opsPool = true
    else if (arg === '--push-prod') {
      options.prodPush = true
      options.pushProdExplicit = true
    }
    else if (arg === '--no-sync-prod') options.prodPush = false
    else if (arg === '--prod-only') {
      options.prodPush = true
      options.prodOnly = true
    } else if (arg === '--prod-host') options.prodHost = (argv[++i] ?? '').trim()
    else if (arg === '--prod-checkout') options.prodCheckout = (argv[++i] ?? '').trim()
    else if (arg === '--prod-owner') options.prodOwner = (argv[++i] ?? '').trim()
    else if (arg === '--with-health') options.withHealth = true
    else if (arg === '--sync-pull') options.syncPull = (argv[++i] ?? '').trim()
    else if (arg === '--owner') {
      options.owner = (argv[++i] ?? '').trim()
      if (!options.owner) {
        return { options: null, error: '--owner 需要 users.id(不给 = 按本机个人池归属默认)' }
      }
    } else return { options: null, error: `未知参数: ${arg}` }
  }
  if (options.help) return { options, error: null }
  if (options.namePrefix.startsWith('--')) {
    return { options: null, error: '--name-prefix 需要一段前缀(自动名 = <前缀->token-<12位指纹>)' }
  }
  if (options.owner && options.opsPool)
    return {
      options: null,
      error: '--owner 与 --ops-pool 只能二选一(个人池归属与运营池不得同时指定)',
    }
  // 默认已开启生产同步(prodPush=true);--dry-run 与显式 --push-prod 互斥,且 dry-run 时强制不推生产
  if (options.dryRun && options.pushProdExplicit)
    return { options: null, error: '--dry-run 与 --push-prod 互斥:预检不落任何库(含生产)' }
  if (options.dryRun) options.prodPush = false
  // 运营池号不推生产个人池:显式 --push-prod 与 --ops-pool 矛盾,默认同步态下 --ops-pool 自然不推
  if (options.opsPool && options.pushProdExplicit)
    return { options: null, error: '--ops-pool 与 --push-prod 互斥:运营池号不推生产个人池' }
  if (options.opsPool) options.prodPush = false
  if (options.prodPush && !options.prodHost)
    return { options: null, error: '--prod-host 需要 SSH 别名(默认 ssh.aizhs.top)' }
  if (options.prodPush && !options.prodCheckout)
    return { options: null, error: '--prod-checkout 需要生产 checkout 根路径' }
  if (options.prodOwner && !UUID_LIKE_RE.test(options.prodOwner))
    return { options: null, error: `--prod-owner 不像 users.id: ${options.prodOwner}` }
  if (options.prodOwner && !options.prodPush)
    return { options: null, error: '--prod-owner 只在推生产(--push-prod / --prod-only / 默认同步)下生效' }
  if (options.syncPull && (options.from || options.file || options.tokensFile)) {
    return {
      options: null,
      error: '--sync-pull 与 --from/--file/--tokens-file 互斥:拉回是「生产→本地」独立通道',
    }
  }
  if (options.syncPull && options.dryRun)
    return { options: null, error: '--sync-pull 本身就要落库,不能与 --dry-run 同用' }
  if (options.from && options.file) return { options: null, error: '--from 与 --file 只能二选一' }
  if (options.tokensFile && options.file)
    return {
      options: null,
      error: '--tokens-file 与 --file 只能二选一(行文本与标准 JSON 是同一条下游的两个入口)',
    }
  if (options.from && options.tokensFile)
    return {
      options: null,
      error: '--from 与 --tokens-file 只能二选一(本机提取与行文本导入不能同批混灌)',
    }
  // --sync-pull 是「生产→本地」独立通道,不需要 --from/--file/--tokens-file
  if (!options.syncPull && !options.from && !options.file && !options.tokensFile)
    return {
      options: null,
      error: `缺少输入:--from ${FROM_POOL_KEYS.join('|')}、--file <json> 或 --tokens-file <txt>`,
    }
  if (options.tokensFile && !options.providerCode) {
    // 行文本里没有 providerCode 可回落(标准 JSON 有顶层那枚),所以平台必须显式给;
    // 取值合法性仍由下游 isRelayProviderCode 单源判,本层不抄第二份(§0.6)。
    return {
      options: null,
      error: '--tokens-file 必须配 --provider <code>(行文本不带平台;平台取值合法性由下游预检判)',
    }
  }
  if (options.from && !FROM_POOL_KEYS.includes(options.from)) {
    return {
      options: null,
      error: `未知来源: ${options.from}(号池认的平台:${FROM_POOL_KEYS.join(' | ')};其他平台用 --file)`,
    }
  }
  return { options, error: null }
}

/**
 * 归属裁决(2026-11-06 器物化):显式 `--owner` > 显式 `--ops-pool` > 本机 pool-owner 默认。
 * 默认取不到 ⇒ owner=null(旧行为 = 落运营池),但 reason 必须原样带出去由调用方点名,
 * 失效方向是"看得见",不是"静默放过去"(§0.3/§0.10)。
 * @returns {{owner: string|null, source: 'explicit-flag'|'default-owner-file'|'none', reason: string, file: string}}
 */
function resolveOwnerDecision(options, resolveDefaultOwner = resolveDefaultPoolOwner) {
  if (options.owner) {
    return { owner: options.owner, source: 'explicit-flag', reason: 'ok', file: '' }
  }
  if (options.opsPool) {
    return { owner: null, source: 'none', reason: 'ops-pool-flag', file: '' }
  }
  const d = resolveDefaultOwner()
  if (d.owner) {
    return { owner: d.owner, source: 'default-owner-file', reason: 'ok', file: d.file }
  }
  return { owner: null, source: 'none', reason: d.reason, file: d.file }
}

/** 归属回显行(stdout;人类面与 --json 面读的是同一枚裁决,不留两套口径) */
function ownerNoticeLine(decision) {
  if (decision.source === 'explicit-flag') {
    return `归属=个人池 ${maskPoolOwner(decision.owner)}(--owner 显式指定)\n`
  }
  if (decision.source === 'default-owner-file') {
    return `归属=个人池 ${maskPoolOwner(decision.owner)}(默认:取自 pool-owner)\n`
  }
  if (decision.reason === 'ops-pool-flag') {
    return '归属=运营池(--ops-pool 显式指定)\n'
  }
  return (
    `⚠️ 未取到个人池归属文件(${POOL_OWNER_REASON_TEXT[decision.reason] ?? decision.reason}:${decision.file})` +
    '⇒ 首次导入强制落个人池,取不到归属即拒绝导入(不再静默落运营池)。\n' +
    '   要落个人池请显式带 --owner <users.id>(或在该文件里写入本人 users.id)。\n' +
    '   运营池仅经「共享到运营池」按钮填充。\n'
  )
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

/**
 * 下游导入旗标装配(纯函数,唯一出口):把归属裁决如实翻成 `--owner` / `--owner-source`。
 * 抽出来是为了让"归属 → 透传"这一环可被测试钉住而不必真起子进程(真起 = 真连库,§5 测试隔离)。
 */
function buildImporterArgs(providerCode, options, decision) {
  const args = ['--stdin']
  if (providerCode) args.push('--provider', providerCode)
  if (options.dryRun) args.push('--dry-run')
  if (!options.health) args.push('--no-health')
  if (options.json) args.push('--json')
  // 归属出口:个人池的号重导入必须带 owner,否则服务层缺省 null 会把它打回运营池
  // (2026-11-06 起 owner 由 resolveOwnerDecision 裁决:显式旗标 > 本机 pool-owner 默认)
  if (decision.owner) args.push('--owner', decision.owner)
  // 来源如实透传:让 --json 机器面与 stdout 人类面报同一枚归属来源
  args.push('--owner-source', decision.source)
  return args
}

function runImporter(payloadText, providerCode, options, decision) {
  const tsxCli = resolveTsx()
  if (!tsxCli) {
    return Promise.resolve({
      code: 2,
      error: '未找到 tsx(apps/api/node_modules/tsx);请先在仓根跑 pnpm install',
    })
  }
  const args = [tsxCli, IMPORTER, ...buildImporterArgs(providerCode, options, decision)]
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

/** 起一个子进程并收齐退出码;inherit=true 时输出直通(生产导入器的摘要要原样让人看见) */
export function runProcess(cmd, args, { inherit = false, input = null } = {}) {
  const hasInput = typeof input === 'string'
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: [
        hasInput ? 'pipe' : 'ignore',
        inherit ? 'inherit' : 'pipe',
        inherit ? 'inherit' : 'pipe',
      ],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    if (!inherit) {
      child.stdout.on('data', (d) => (stdout += String(d)))
      child.stderr.on('data', (d) => (stderr += String(d)))
    }
    child.on('error', (e) => resolve({ code: 2, error: e.message, stdout }))
    child.on('exit', (code, signal) => {
      if (signal) resolve({ code: 2, error: `进程被信号终止: ${signal}`, stdout })
      else resolve({ code: code ?? 2, error: stderr.trim() || null, stdout })
    })
    if (hasInput) {
      child.stdin.on('error', () => {
        /* 对端已关:退出码才是结论 */
      })
      child.stdin.end(input)
    }
  })
}

/**
 * 生产推送(2026-11-10 立):同一条 stdin 载荷,经 SSH 在生产 checkout 内交给**同一个导入器**
 * (`relay-account-import.ts --stdin`,与本机 runImporter 共用 buildImporterArgs 装配),
 * 只开一条连接、不落任何临时文件,也不走后台密码登录。
 * 归属默认由生产机 ~/.wb-switch/pool-owner 决定,可用 --prod-owner 显式点名;
 * 生产侧健康检查默认跳过(导入器不再等上游 5xx 回落),显式 --with-health 才当场验。
 */
async function pushPayloadToProd(payloadText, providerCode, options) {
  const decision = options.prodOwner
    ? { owner: options.prodOwner, source: 'explicit-flag' }
    : { owner: null, source: 'default-owner-file' }
  const importerArgs = buildImporterArgs(
    providerCode,
    { ...options, dryRun: false, health: options.withHealth },
    decision,
  )
  const remoteCmd =
    `cd /d "${options.prodCheckout}" & node ` +
    ['apps\\api\\node_modules\\tsx\\dist\\cli.mjs', 'apps\\api\\scripts\\relay-account-import.ts']
      .concat(importerArgs)
      .join(' ')
  const ssh = await runProcess(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', options.prodHost, remoteCmd],
    { inherit: true, input: payloadText },
  )
  return {
    code: ssh.code,
    error: ssh.code === 0 ? null : ssh.error || `生产导入器退出码 ${ssh.code}`,
  }
}

/**
 * 生产→本地拉回(2026-11-11 立,与默认推生产构成双向互通)。
 * 经 SSH 在生产 checkout 内跑同一个导入器的 `--export <provider>`(只读、不写生产),
 * 拿到该平台全部账号(含明文凭证)后,按 ownerUserId 分组交回本机导入器落本地库:
 * 归属 null 落运营池(不传 --owner),非空按该 users.id 落个人池。明文只在 SSH/stdin 通道内流动。
 */
async function syncPullFromProd(options, deps) {
  const provider = options.syncPull
  const remoteCmd =
    `cd /d "${options.prodCheckout}" & node ` +
    ['apps\\api\\node_modules\\tsx\\dist\\cli.mjs', 'apps\\api\\scripts\\relay-account-import.ts']
      .concat(['--export', provider])
      .join(' ')
  process.stderr.write(`拉回:从生产导出 ${provider} 账号(SSH ${options.prodHost})\n`)
  const ssh = await runProcess(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', options.prodHost, remoteCmd],
    {},
  )
  if (ssh.code !== 0) {
    process.stderr.write(`❌ 从生产导出失败: ${ssh.error || `退出码 ${ssh.code}`}\n`)
    return ssh.code === 0 ? 2 : ssh.code
  }
  // 生产进程的 dotenv/[db] 诊断也写 stdout ⇒ 只用边界标记截取 JSON 段,不臆测整段 stdout 是 JSON
  const BEGIN = '__POOL_EXPORT_BEGIN__'
  const END = '__POOL_EXPORT_END__'
  const b = ssh.stdout.indexOf(BEGIN)
  const e = ssh.stdout.indexOf(END)
  let payload
  try {
    if (b < 0 || e <= b) throw new Error('未找到导出边界标记(生产 checkout 可能是旧版导入器)')
    payload = JSON.parse(ssh.stdout.slice(b + BEGIN.length, e).trim())
  } catch (err) {
    process.stderr.write(
      `❌ 生产导出结果解析失败(未判定): ${err instanceof Error ? err.message : String(err)}\n`,
    )
    return 2
  }
  const accounts = Array.isArray(payload?.accounts) ? payload.accounts : []
  if (accounts.length === 0) {
    process.stderr.write(`ℹ️ 生产库 ${provider} 无账号可拉回\n`)
    return 0
  }
  // 按归属分组:owner=null 落运营池(不传 --owner);非空落该个人池。
  // 归属优先取 __sync.ownerUserId —— 2026-11-11 起导出改平台原生形状,元数据放 __sync。
  const groups = new Map()
  for (const a of accounts) {
    const sync = a && typeof a === 'object' && a.__sync && typeof a.__sync === 'object' ? a.__sync : {}
    const ownerRaw = sync.ownerUserId !== undefined ? sync.ownerUserId : a?.ownerUserId
    const owner = typeof ownerRaw === 'string' && ownerRaw.trim() ? ownerRaw.trim() : null
    if (!groups.has(owner)) groups.set(owner, [])
    groups.get(owner).push(a)
  }
  let worst = 0
  for (const [owner, list] of groups) {
    // 归属已由 --owner 显式传,载荷里剥掉同步元数据(__sync/ownerUserId/updatedAt/providerCode),
    // 避免未知字段进 extraMetadata 污染行
    const cleaned = list.map((a) => {
      const copy = { ...a }
      delete copy.ownerUserId
      delete copy.__sync
      delete copy.updatedAt
      delete copy.providerCode
      return copy
    })
    const groupPayload = JSON.stringify({ providerCode: provider, accounts: cleaned })
    const decision = { owner, source: owner ? 'explicit-flag' : 'none' }
    const importerOpts = { dryRun: false, health: false, json: options.json }
    process.stdout.write(`── 拉回 ${provider} owner=${owner ?? '运营池'} 条数=${list.length}\n`)
    const r = await deps.runImporter(groupPayload, provider, importerOpts, decision)
    if (r.error) process.stderr.write(`❌ 拉回落库失败(owner=${owner ?? '运营池'}): ${r.error}\n`)
    worst = Math.max(worst, r.code)
  }
  return worst
}

/** 可注入面(测试用):下游导入与默认归属读取都必须能被替身接走,绝不真写库、绝不读真机文件。 */
const DEFAULT_DEPS = {
  runImporter,
  pushProd: pushPayloadToProd,
  resolveDefaultOwner: resolveDefaultPoolOwner,
  // 名称脱敏单源的装载出口(测试注入替身,绝不依赖 packages/shared 的构建产物在不在)
  loadMaskPhone,
}

async function main(argv, injectedDeps = {}) {
  const deps = { ...DEFAULT_DEPS, ...injectedDeps }
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n\n${helpText()}\n`)
    return 2
  }
  const options = parsed.options
  if (options.help) {
    process.stdout.write(`${helpText()}\n`)
    return 0
  }

  // 生产→本地拉回(互通):不经本机提取/归属裁决,归属由导出数据逐账号自带
  if (options.syncPull) return syncPullFromProd(options, deps)

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

  // 归属裁决排在提取与写下游之前:先定"这批号跟谁走",再把结论(含取不到的具名原因)
  // 打在 stdout 上 —— 永久指令不靠人记旗标,但必须让人一眼看见这行号跟谁走。
  const decision = resolveOwnerDecision(options, deps.resolveDefaultOwner)
  // 只推生产时,本机归属文件缺失不该吓人:归属由生产机自己的 pool-owner / --prod-owner 决定
  if (!(options.prodOnly && decision.source === 'none')) {
    process.stdout.write(ownerNoticeLine(decision))
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
    const mod = await import(pathToFileURL(path.join(ROOT, 'scripts', 'lib', entry.module)).href)
    const extractFn = mod[entry.fn]
    if (typeof extractFn !== 'function') {
      process.stderr.write(`❌ 提取器接线错误(未判定):${entry.module} 未导出 ${entry.fn}\n`)
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
    const isSessionBased = Array.isArray(meta.sessions)
    const sessionLines = isSessionBased
      ? meta.sessions.map((s) => `  ${JSON.stringify(s)}`)
      : []
    const sourceFile =
      meta.sourceFile ?? meta.sourceDir ?? meta.sourcePath ?? extracted.accounts?.[0]?.meta?.sourceFile
    process.stderr.write(
      `提取: ${isSessionBased ? '会话' : '账号'}=${isSessionBased ? (meta.count ?? sessionLines.length) : (extracted.accounts?.length ?? 0)}` +
        (typeof meta.skipped === 'number' ? ` 跳过=${meta.skipped}` : '') +
        (sourceFile ? ` 落点=${sourceFile}` : '') +
        '\n' +
        sessionLines.join('\n') +
        '\n',
    )
    providerCode = extracted.providerCode
    payloadText = JSON.stringify(extracted)
  } else if (options.tokensFile) {
    // 「一行一个 token」行文本入口:本层只折叠 + 回显,判定一律留给下游同一条通路
    // (validateAccountExport / resolveImportAccountUidProbe / importAccounts)。
    const tokensPath = path.resolve(options.tokensFile)
    let tokensText
    try {
      tokensText = fs.readFileSync(tokensPath, 'utf8')
    } catch (e) {
      process.stderr.write(
        `❌ 读取行文本失败(未判定): ${e instanceof Error ? e.message : String(e)}\n   文件=${tokensPath}\n`,
      )
      return 2
    }
    const folded = parseTokensLineText(tokensText, { namePrefix: options.namePrefix })
    if (folded.reason !== 'ok') {
      process.stderr.write(
        `❌ 行文本没有可用 token(未判定):${TOKENS_TEXT_REASON_TEXT[folded.reason] ?? folded.reason}\n` +
          `   文件=${tokensPath} 总行=${folded.stats.lines} 空白=${folded.stats.blank} 注释=${folded.stats.comments}\n` +
          '   出路:一行一枚 token(空行与 # 起始的注释行会被忽略;可写「名称<TAB或空格>token」两段形态)。\n',
      )
      return 2
    }
    // 折叠台账走 stderr:序号↔行号↔指纹的对应关系必须留得下,又不能污染 --json 的 stdout 机器面
    const maskPhoneFn = await deps.loadMaskPhone()
    process.stderr.write(
      `行文本折入: 文件=${tokensPath} token=${folded.stats.tokens} 空白行=${folded.stats.blank} 注释行=${folded.stats.comments}\n` +
        renderEntryMapLines(folded.entries, maskPhoneFn) +
        '\n',
    )
    const dupNotice = renderDuplicateNotice(folded.duplicates)
    if (dupNotice) process.stderr.write(dupNotice)
    if (folded.notes.length > 0) {
      process.stderr.write(
        `⚠️ 行形态提示 ${folded.notes.length} 条(不拦截,判定权留给下游预检):\n${renderNoteLines(folded.notes)}\n`,
      )
    }
    payloadText = JSON.stringify(buildAccountsPayload(folded.entries))
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

  // 首次导入强制落个人池(李总 2026-10-31 永久指令 + 2026-11-07 共享模型):
  // 取不到个人池归属(无 --owner、无本机 pool-owner 文件)⇒ 拒绝导入,而非静默落运营池。
  // 放在输入解析/校验之后:空文件 / 全注释 / 形态坏等"未判定"出口优先,本处只拦"确有可用
  // 凭据却无个人归属"的情形。运营池仅由用户经「共享到运营池」按钮填充(全局开放标记模型),
  // 不再接受直接导入;显式 --ops-pool 仍保留为运维逃生口(需本人明确意图),不在此拒绝之列。
  if (decision.source === 'none' && !options.opsPool && !options.prodOnly) {
    process.stderr.write(
      `❌ 首次导入强制落个人池:未取到个人池归属(原因=${POOL_OWNER_REASON_TEXT[decision.reason] ?? decision.reason}:${decision.file})。\n` +
        '   请显式带 --owner <users.id>,或在 ~/.wb-switch/pool-owner 写入本人 users.id。\n' +
        '   运营池仅经「共享到运营池」按钮填充,不再静默落入。\n',
    )
    return 2
  }

  // 推生产侧健康检查默认跳过(Trae 这类 IDE 号要等 model_list 5xx 回落,单号就几十秒),
  // 要当场验可用带 --with-health;不验不等于不查,保活调度会按档位复检。本机导入健康检查不受此影响。
  if (options.prodPush && !options.withHealth) {
    process.stderr.write('ℹ️ 已跳过生产侧导入后健康检查(由保活调度复检;要当场验证请加 --with-health)\n')
  }

  // 只推生产:本机库一行不写,凭据只在生产 checkout 内落一次。
  // 生产归属缺省沿用本机裁决(两库 admin users.id 同源镜像);显式 --prod-owner 覆盖。
  const prodOptions = options.prodPush
    ? { ...options, prodOwner: options.prodOwner || decision.owner }
    : options
  if (options.prodPush && !prodOptions.prodOwner) {
    process.stderr.write('❌ 生产推送缺个人池归属:带 --prod-owner <users.id>(不推运营池)\n')
    return 2
  }
  if (options.prodOnly) {
    const push = await deps.pushProd(payloadText, providerCode, prodOptions)
    if (push.error) process.stderr.write(`❌ 生产推送失败: ${push.error}\n`)
    return push.code
  }

  // 本机导入健康检查按原逻辑(--no-health / --health 控制),不受默认推生产影响
  const localOptions = options
  const result = await deps.runImporter(payloadText, providerCode, localOptions, decision)
  if (result.error) process.stderr.write(`❌ ${result.error}\n`)
  if (result.code !== 0 || !options.prodPush) return result.code

  // 本机已入池,再把同一批凭据推一份到生产(SSH 直连,不经后台密码)
  const push = await deps.pushProd(payloadText, providerCode, prodOptions)
  if (push.error) process.stderr.write(`❌ 生产推送失败: ${push.error}\n`)
  return push.code
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

export const __test__ = {
  parseArgs,
  FROM_PROVIDERS,
  resolveOwnerDecision,
  ownerNoticeLine,
  buildImporterArgs,
  main,
  helpText,
  HELP,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
