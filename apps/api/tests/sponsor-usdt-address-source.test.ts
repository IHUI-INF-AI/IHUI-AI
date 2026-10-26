// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-944 拍板②「ERC20 以 env 为权威,收敛第二真相」的机器锁。
 *
 * 判的是什么:USDT 收款地址在仓里只准有一个**权威来源**(env `USDT_TRC20_ADDRESS` /
 * `USDT_ERC20_ADDRESS`),其余持有者一律必须是「显式声明的投影」,不得成为第二真相。
 *
 * 现读事实(2026-10-23,HEAD 面):
 * - 服务端唯一读取点 = `apps/api/src/services/payment-usdt-service.ts` 的
 *   `process.env.USDT_TRC20_ADDRESS` / `process.env.USDT_ERC20_ADDRESS` 各一枚,无静态 fallback
 *   (未配置走 500,形态非法走 400,由同文件 assertUsdtAddressFormat 把关)。
 * - 前端 sponsor 页仍各持一枚同值字面量副本:2026-10-06 `a2362c86e3` 把 `usdtErc20` 行对齐了
 *   env 权威值(此前那行拿的是 ETH 捐赠地址,即票面说的「两套并存」)。值已收敛、来源仍是两处,
 *   而端点化不在本次射程 ⇒ 本文件把「两处必须逐字同值 + 不得再多出一处」钉住,分叉即红。
 *
 * 三态与取材面纪律:
 * - env 文件(`.env` / `apps/api/.env`)受 .gitignore,CI 与干净检出上取不到 ⇒ 凡判定**需要 env
 *   取值**的用例显式落「未判定」(skip + 打印缺的是哪一枚键),不拿"没有输入"冒充绿。
 * - 不依赖 env 的结构维(读取点唯一 / 投影指针在位 / 新增副本射程)在任何面上都可判;枚举到 0
 *   候选判死不记绿。
 * - 全程不回显地址原文:失败信息只给 `前6***后2 (len=N)` 脱敏形态(与被测实现「坏值不回显」
 *   同一取向 —— 收款地址虽公开,灌进测试日志会随 CI 产物长期留存)。
 * - 形态判据 import 源实现(`isTronAddress` / `isErc20Address`),本文件零复刻(§22c)。
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isErc20Address, isTronAddress } from '../src/services/payment-usdt-service.js'

// ---------- 落点(ROOT 由本文件位置推导,不取 cwd,§15) ----------
const HERE = dirname(fileURLToPath(import.meta.url)) // apps/api/tests
const API_ROOT = resolve(HERE, '..') // apps/api
const REPO_ROOT = resolve(API_ROOT, '..', '..') // 仓库根

const SPONSOR_PAGE = join(
  REPO_ROOT,
  'apps',
  'web',
  'app',
  '(main)',
  'sponsor',
  'CryptoDonation.tsx',
)
const API_ENV_FILE = join(API_ROOT, '.env')
const ROOT_ENV_FILE = join(REPO_ROOT, '.env')
const SERVICE_FILE = join(API_ROOT, 'src', 'services', 'payment-usdt-service.ts')

const ENV_KEYS = { TRC20: 'USDT_TRC20_ADDRESS', ERC20: 'USDT_ERC20_ADDRESS' } as const

/** 前端「投影」副本的唯一合法持有者:除此之外,web/packages 源码面不得再出现 0x+40hex */
const FRONTEND_ADDRESS_HOLDERS = ['apps/web/app/(main)/sponsor/CryptoDonation.tsx']

/** env 取值可得时,允许逐字持有权威值的落点:sponsor 页(投影)+ 形态校验夹具(值不是真相源) */
const ENV_VALUE_ALLOWED_HOLDERS = [
  'apps/web/app/(main)/sponsor/CryptoDonation.tsx',
  'apps/api/src/services/__tests__/usdt-address-format.test.ts',
  'apps/api/tests/payment-usdt-address-format.test.ts',
]

/**
 * 服务端 src 内「非代币合约声明」的 0x+40hex **豁免登记表**(本门唯一出口)。
 *
 * 四字段齐全(file + anchor + reason + reviewBy),缺任一即当空表用;anchor 是**代码里的
 * 引用文本**(命中行所属声明的标识符),不是行号 —— 行号一次 append 就挪位。
 * 被审面上不再命中的条目按「清单腐烂」判红;reviewBy 过期同样判红。
 *
 * 为什么要这张表:0x+40hex 只是**形状**,它既可能是 EVM 地址,也可能是十六进制编码的大数
 * (密码学常数)。本门只认**代币合约声明**这一形态(收款地址不得写回常量),形状认不出语义时,
 * 由这张表逐条登记「它不是收款地址」并写明原因,而不是把门放宽成恒真。
 * 本表只放**数值型**(BigInt 初始化)命中:地址字符串永远不在射程内。
 */
const API_SRC_EVM_LITERAL_EXEMPTIONS: ReadonlyArray<{
  file: string
  anchor: string
  reason: string
  reviewBy: string
}> = [
  {
    file: 'apps/api/src/services/upstream-adapters/trae-protocol.ts',
    anchor: 'P256_ORDER',
    reason:
      'NIST P-256 曲线阶(ECDSA 签名低 s 归一化用)是**数值**常量,既不是代币合约、也不是收款地址',
    reviewBy: '2027-04-26',
  },
]

const EVM_LITERAL = /0x[0-9a-fA-F]{40}/

/** 声明头:标识符 + 初始化形态(用于认「这枚 0x+40hex 是数值常量还是地址字符串」) */
const DECL_HEAD_RE =
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(.*)$/

// ---------- 小判据(只读,零写入) ----------

/** 脱敏:前 6 + 后 2 + 长度;过短则整枚掩掉 */
function mask(value: string): string {
  if (value.length <= 8) return `***(len=${value.length})`
  return `${value.slice(0, 6)}***${value.slice(-2)} (len=${value.length})`
}

/** 地址等值:EVM 十六进制允许大小写混排(粘贴/重排都会改形态),按小写归一后比字节 */
function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * 读 env 文本里的一个键,与 dotenv 同形:跳空行/`#` 注释行,允许 `export ` 前缀与成对引号,
 * **后写覆盖先写**(last-wins),未加引号的值剥掉行尾 ` #`。只用于取 USDT 两枚键,不做通用解析。
 */
function readEnvKey(text: string, key: string): string | null {
  let found: string | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    const foundKey = m[1]
    const rawValue = m[2]
    if (foundKey !== key || rawValue === undefined) continue
    let value = rawValue.trim()
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    if (quoted) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '').trim()
    found = value
  }
  return found
}

/** 只在 env 文件在场且该键非空时取值,否则 null(未判定) */
function envFileValue(file: string, key: string): string | null {
  if (!existsSync(file)) return null
  return readEnvKey(readFileSync(file, 'utf8'), key)
}

/**
 * 解析某枚 USDT 地址键的权威值,顺序与 api 进程运行时一致:
 * ① 进程环境(dotenv 不覆盖已有项)② `apps/api/.env`(api 的 cwd 落点)③ 根 `.env`。
 * 三处都取不到 ⇒ null ⇒ 调用方落「未判定」,不得记绿。
 */
function resolveAuthority(key: string): { value: string; source: string } | null {
  const fromProcess = process.env[key]?.trim()
  if (fromProcess) return { value: fromProcess, source: 'process.env' }
  for (const [file, source] of [
    [API_ENV_FILE, 'apps/api/.env'],
    [ROOT_ENV_FILE, '根 .env'],
  ] as const) {
    const value = envFileValue(file, key)
    if (value) return { value, source }
  }
  return null
}

type WalletRow = { id: string; address: string; block: string }

/**
 * 解析 sponsor 页 `WALLETS` 的 `id → address` 行:按相邻 `id:` 标记切块,块内取首个
 * `address: '…'`;块就是该行的属性区,投影指针注释必须落在块内才算数。
 */
function parseWalletRows(src: string): WalletRow[] {
  const marks: Array<{ id: string; start: number }> = []
  const idRe = /\bid:\s*'([A-Za-z0-9]+)'/g
  let m: RegExpExecArray | null
  while ((m = idRe.exec(src)) !== null) {
    const id = m[1]
    if (id !== undefined) marks.push({ id, start: m.index })
  }

  const rows: WalletRow[] = []
  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i]
    if (!mark) continue
    const next = marks[i + 1]
    const end = next ? next.start : src.length
    const block = src.slice(mark.start, end)
    const addressMatch = /address:\s*'([^']*)'/.exec(block)
    const address = addressMatch?.[1]
    if (address !== undefined) rows.push({ id: mark.id, address, block })
  }
  return rows
}

/** 相对仓库根的正斜杠路径(比对豁免清单用,Windows 反斜杠归一) */
function repoRel(absPath: string): string {
  return absPath.slice(REPO_ROOT.length + 1).replaceAll('\\', '/')
}

/**
 * 递归列源码文件。恒定跳过依赖/构建落点;`includeFixtures=false` 时再跳夹具面
 * (`__tests__/`、`tests/`、`*.test.*`、`*.spec.*`),把判据射程收到「产品代码里的真相持有者」。
 */
function walkSourceFiles(rootDir: string, includeFixtures: boolean): string[] {
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) return []
  const skipDirs = new Set(['node_modules', 'dist', '.next', 'coverage', 'build', '.turbo'])
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skipDirs.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!includeFixtures && (entry.name === '__tests__' || entry.name === 'tests')) continue
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (!includeFixtures && /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue
      out.push(full)
    }
  }
  walk(rootDir)
  return out
}

/** 共享层与 web 的源码根(packages 只取其 src 面,避免扫进构建产物) */
function frontendScanRoots(): string[] {
  const roots = [join(REPO_ROOT, 'apps', 'web', 'app'), join(REPO_ROOT, 'apps', 'web', 'src')]
  const packagesDir = join(REPO_ROOT, 'packages')
  if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const src = join(packagesDir, entry.name, 'src')
      if (existsSync(src)) roots.push(src)
    }
  }
  return roots
}

/** 前端 + 共享层源码面里持有 0x+40hex 字面量的文件 */
function frontendFilesWithEvmLiteral(): string[] {
  const hits: string[] = []
  for (const root of frontendScanRoots()) {
    for (const file of walkSourceFiles(root, false)) {
      if (EVM_LITERAL.test(readFileSync(file, 'utf8'))) hits.push(repoRel(file))
    }
  }
  return Array.from(new Set(hits)).sort()
}

/** api 服务端 src(不含夹具)里逐行扫 0x+40hex,返回持有该字面量的行 + 该行所属声明的上下文 */
function apiSrcEvmLiteralLines(): Array<{
  rel: string
  line: string
  /** 命中行所属声明的标识符(向上最近一条 const/let/var 声明) */
  decl: string
  /** 该声明是不是 BigInt 初始化(数值常量 vs 地址字符串) */
  declIsBigInt: boolean
  /** 命中行是不是该声明的初始化式本身(同一行或紧邻的下一行) */
  declAdjacent: boolean
}> {
  const found: Array<{
    rel: string
    line: string
    decl: string
    declIsBigInt: boolean
    declAdjacent: boolean
  }> = []
  for (const file of walkSourceFiles(join(API_ROOT, 'src'), false)) {
    const rel = repoRel(file)
    let decl = ''
    let declIsBigInt = false
    let declLine = 0
    let lineNo = 0
    for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
      lineNo += 1
      const m = DECL_HEAD_RE.exec(rawLine)
      if (m && m[1] !== undefined) {
        decl = m[1]
        declIsBigInt = /^\s*BigInt\(/.test(m[2] ?? '')
        declLine = lineNo
      }
      if (EVM_LITERAL.test(rawLine)) {
        found.push({
          rel,
          line: rawLine.trim(),
          decl,
          declIsBigInt,
          declAdjacent: lineNo - declLine <= 1,
        })
      }
    }
  }
  return found
}

/**
 * 某枚命中是否落在豁免登记表里:四件事同时成立才算命中 ⇒
 * 同一文件里另起的收款地址字面量(不同声明、不同形态)不在射程内。
 */
function isExemptEvmLiteral(hit: {
  rel: string
  decl: string
  declIsBigInt: boolean
  declAdjacent: boolean
}): boolean {
  return (
    hit.declIsBigInt &&
    hit.declAdjacent &&
    API_SRC_EVM_LITERAL_EXEMPTIONS.some((e) => e.file === hit.rel && e.anchor === hit.decl)
  )
}

/** 产品码 + 夹具面里逐字(大小写不敏感)持有某枚权威值的文件 */
function filesHoldingValue(value: string): string[] {
  const needle = value.toLowerCase()
  const roots = [...frontendScanRoots(), join(API_ROOT, 'src'), join(API_ROOT, 'tests')]
  const hits: string[] = []
  for (const root of roots) {
    for (const file of walkSourceFiles(root, true)) {
      if (readFileSync(file, 'utf8').toLowerCase().includes(needle)) hits.push(repoRel(file))
    }
  }
  return Array.from(new Set(hits)).sort()
}

/** 服务端 src 内某个 `process.env.KEY` 读取点的落点清单(带次数) */
function envReadersInApiSrc(key: string): string[] {
  const token = `process.env.${key}`
  const readers: string[] = []
  for (const file of walkSourceFiles(join(API_ROOT, 'src'), false)) {
    const hits = readFileSync(file, 'utf8').split(token).length - 1
    if (hits > 0) readers.push(`${repoRel(file)}×${String(hits)}`)
  }
  return readers
}

const erc20Authority = resolveAuthority(ENV_KEYS.ERC20)
const trc20Authority = resolveAuthority(ENV_KEYS.TRC20)

if (erc20Authority === null || trc20Authority === null) {
  const missing: string[] = []
  if (erc20Authority === null) missing.push(ENV_KEYS.ERC20)
  if (trc20Authority === null) missing.push(ENV_KEYS.TRC20)
  console.warn(
    `[未判定] env 权威值不可得:${missing.join(' / ')}` +
      `(进程环境、${repoRel(API_ENV_FILE)}、${repoRel(ROOT_ENV_FILE)} 三处都取不到非空值)` +
      ' ⇒ 依赖 env 取值的用例本轮记「未判定」(skip),不代表已对齐。',
  )
}

describe('G-944② sponsor 页只准是 env 权威的投影', () => {
  const rows = parseWalletRows(readFileSync(SPONSOR_PAGE, 'utf8'))
  const rowOf = (id: string): WalletRow | undefined => rows.find((r) => r.id === id)

  it('前置:WALLETS 行可解析(枚举到 0 行即判死,不记绿)', () => {
    expect(rows.length, `sponsor 页未解析出 id→address 行:${SPONSOR_PAGE}`).toBeGreaterThanOrEqual(
      4,
    )
    for (const id of ['usdtErc20', 'usdtTrc20', 'ethereum']) {
      expect(rowOf(id), `缺 ${id} 行`).toBeDefined()
    }
  })

  it('usdtErc20 形态合法,且不得取 ETH 捐赠行那枚(票面「第二真相」的历史形状)', () => {
    const erc = rowOf('usdtErc20')
    const eth = rowOf('ethereum')
    expect(erc, '缺 usdtErc20 行').toBeDefined()
    expect(eth, '缺 ethereum 行').toBeDefined()
    const ercAddress = String(erc?.address)
    expect(isErc20Address(ercAddress), `usdtErc20 行非法 EVM 形态:${mask(ercAddress)}`).toBe(true)
    expect(
      sameAddress(ercAddress, String(eth?.address)),
      `usdtErc20 行与 ethereum 行同值(${mask(ercAddress)})⇒ USDT 收款地址被混用,` +
        '正是 a2362c86e3 收掉的那一型',
    ).toBe(false)
  })

  it('usdtTrc20 形态合法(波场侧同一条纪律,不分网络宽严)', () => {
    const tron = rowOf('usdtTrc20')
    const tronAddress = String(tron?.address)
    expect(isTronAddress(tronAddress), `usdtTrc20 行非法波场形态:${mask(tronAddress)}`).toBe(true)
  })

  it('两条 USDT 行都带 env 出处指针(声明"我是投影",不是独立真相)', () => {
    expect(
      String(rowOf('usdtErc20')?.block).includes(ENV_KEYS.ERC20),
      `usdtErc20 行未注明权威来源 ${ENV_KEYS.ERC20} ⇒ 该字面量按独立真相判`,
    ).toBe(true)
    expect(
      String(rowOf('usdtTrc20')?.block).includes(ENV_KEYS.TRC20),
      `usdtTrc20 行未注明权威来源 ${ENV_KEYS.TRC20} ⇒ 该字面量按独立真相判`,
    ).toBe(true)
  })

  it.runIf(erc20Authority !== null)('env 权威对齐(ERC20):sponsor 页字面量与 env 逐字同值', () => {
    const ercAddress = String(rowOf('usdtErc20')?.address)
    const authority = String(erc20Authority?.value)
    expect(
      sameAddress(ercAddress, authority),
      `sponsor 页 ERC20 ${mask(ercAddress)} ≠ env[${String(erc20Authority?.source)}] ${mask(authority)}` +
        ' ⇒ 两套并存回潮;env 是权威,改 env 的同批必须同步本页(或把本页端点化)',
    ).toBe(true)
  })

  it.runIf(trc20Authority !== null)('env 权威对齐(TRC20):sponsor 页字面量与 env 逐字同值', () => {
    const tronAddress = String(rowOf('usdtTrc20')?.address)
    const authority = String(trc20Authority?.value)
    expect(
      sameAddress(tronAddress, authority),
      `sponsor 页 TRC20 ${mask(tronAddress)} ≠ env[${String(trc20Authority?.source)}] ${mask(authority)}` +
        ' ⇒ 两套并存回潮',
    ).toBe(true)
  })

  it.runIf(
    envFileValue(API_ENV_FILE, ENV_KEYS.ERC20) !== null &&
      envFileValue(ROOT_ENV_FILE, ENV_KEYS.ERC20) !== null,
  )('两份 env 的 USDT_ERC20_ADDRESS 同值(否则"权威"随 api 的 cwd 漂移)', () => {
    const apiValue = String(envFileValue(API_ENV_FILE, ENV_KEYS.ERC20))
    const rootValue = String(envFileValue(ROOT_ENV_FILE, ENV_KEYS.ERC20))
    expect(
      sameAddress(apiValue, rootValue),
      `${repoRel(API_ENV_FILE)} ${mask(apiValue)} 与 ${repoRel(ROOT_ENV_FILE)} ${mask(rootValue)} 不同值` +
        ' ⇒ 同机两枚真相,收款地址按进程 cwd 取值而变',
    ).toBe(true)
  })
})

describe('G-944② 服务端只有一处读 env,且不得另持收款常量', () => {
  it('process.env.USDT_ERC20_ADDRESS 在 src 内恰出现一次(读取点唯一)', () => {
    const readers = envReadersInApiSrc(ENV_KEYS.ERC20)
    expect(
      readers,
      `ERC20 env 读取点不止一处:${readers.join(' , ') || '0 处(枚举到 0 判死)'}`,
    ).toHaveLength(1)
    expect(readers[0], 'ERC20 env 唯一读取点必须仍是 payment-usdt-service').toContain(
      join('apps', 'api', 'src', 'services', 'payment-usdt-service.ts').replaceAll('\\', '/') +
        '×1',
    )
  })

  it('src 内 0x+40hex 字面量只准是代币合约声明(收款地址不得写回常量)', () => {
    const offenders = apiSrcEvmLiteralLines().filter(
      (h) =>
        !/const\s+[A-Z0-9_]*CONTRACT\s*=\s*'0x[0-9a-fA-F]{40}'/.test(h.line) &&
        !isExemptEvmLiteral(h),
    )
    expect(
      offenders.map((o) => `${o.rel}:${o.line.slice(0, 48)}`),
      '服务端源码出现非代币合约声明的 EVM 地址字面量 ⇒ 收款地址被硬编码回服务层',
    ).toEqual([])
    expect(existsSync(SERVICE_FILE), `缺服务端实现文件:${SERVICE_FILE}`).toBe(true)
  })

  it('豁免登记表不腐烂:每条都仍命中被审面,且未过复核期', () => {
    const hits = apiSrcEvmLiteralLines()
    const today = new Date().toISOString().slice(0, 10)
    for (const e of API_SRC_EVM_LITERAL_EXEMPTIONS) {
      expect(
        hits.some((h) => isExemptEvmLiteral(h) && h.rel === e.file && h.decl === e.anchor),
        `豁免条目已不再命中被审面(${e.file} / ${e.anchor})⇒ 清单腐烂(不是通过):${e.reason}`,
      ).toBe(true)
      expect(
        today <= e.reviewBy,
        `豁免条目已过复核期(${e.file} / ${e.anchor},reviewBy=${e.reviewBy})⇒ 须重读代码后再登记`,
      ).toBe(true)
    }
  })
})

describe('G-944② 第二真相不得再多出一处', () => {
  it('前端/共享层源码面持有 EVM 地址字面量的文件只有 sponsor 页', () => {
    const holders = frontendFilesWithEvmLiteral()
    expect(holders, `持有 0x+40hex 字面量的前端文件超出豁免清单:${holders.join(' , ')}`).toEqual(
      FRONTEND_ADDRESS_HOLDERS,
    )
  })

  it.runIf(erc20Authority !== null)(
    '逐字持有 env 权威值的文件只在豁免清单内(env 轮换时无处可藏)',
    () => {
      const holders = filesHoldingValue(String(erc20Authority?.value))
      const outside = holders.filter((h) => !ENV_VALUE_ALLOWED_HOLDERS.includes(h))
      expect(outside, `豁免清单之外持有 env 权威值:${outside.join(' , ')} ⇒ 第三处真相`).toEqual([])
      expect(holders, 'env 权威值在豁免清单内也无一处可查').not.toHaveLength(0)
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
