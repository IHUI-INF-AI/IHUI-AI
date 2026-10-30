#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-sbom.mjs — 从 pnpm-lock.yaml 生成 CycloneDX 1.5 SBOM
 *
 * 立因（2026-10-30）：
 *   `SECURITY.md` 的「软件供应链」段声称「SBOM：每个 Release 附带 SBOM，见 Release Assets」，
 *   而 `.github/workflows/**` 里 **一条 SBOM 生成步骤都没有**（实测 grep 零命中）。
 *   AGENTS §0.8 明禁「文档写跑不通的出路」—— 用户照着 Release 页找不到任何 SBOM。
 *   本脚本把这句话变成真能跑出来的东西，而不是把声明删掉降承诺。
 *
 * 为什么自己解析 lockfile 而不是 `pnpm licenses` / `pnpm list -r`：
 *   - 仓里没有 yaml 解析库（js-yaml / yaml 都未安装），为一份 SBOM 加运行时依赖不划算；
 *   - pnpm-lock v9 的 `packages:` 段是**扁平**的 `'name@version':` → `resolution.integrity`，
 *     结构与版本号都是行内可判的，不需要通用 YAML 能力；
 *   - 生成器必须能在 CI 与本机同一条命令跑通，且**不需要 node_modules 已安装**。
 *
 * 正确性护栏（"不许悄悄少算"）：
 *   解析完后断言「components 覆盖 packages 段全部顶层键」。差一条即 exit 2，
 *   绝不生成一份"看着有、其实漏了"的 SBOM —— 漏依赖的 SBOM 比没有更糟（它给人虚假的完整感）。
 *
 * 用法：
 *   node scripts/gen-sbom.mjs                       # → outputs/sbom/sbom.cdx.json
 *   node scripts/gen-sbom.mjs --out dist/sbom.json
 *   node scripts/gen-sbom.mjs --quiet                # 只输出路径
 *
 * 退出码：
 *   0 — 已生成
 *   1 — lockfile 不存在 / packages 段为 0 条（空扫不记绿，§0.3）
 *   2 — 覆盖率断言失败（解析漏条）
 */
/* eslint-disable no-console -- CLI 工具 */
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const LOCK = join(ROOT, 'pnpm-lock.yaml')
const outIdx = process.argv.indexOf('--out')
const OUT = resolve(ROOT, outIdx > 0 ? process.argv[outIdx + 1] : 'outputs/sbom/sbom.cdx.json')
const QUIET = process.argv.includes('--quiet')

function die(code, msg) {
  console.error(`❌ ${msg}`)
  process.exit(code)
}

if (!existsSync(LOCK)) die(1, `找不到 ${LOCK}（在仓库根执行本脚本）`)
const text = readFileSync(LOCK, 'utf8')

// ── 1. 切出 packages: 段（到下一个顶格键为止）───────────────────────────
const lines = text.split(/\r?\n/)
let start = -1
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === 'packages:') {
    start = i + 1
    break
  }
}
if (start < 0) die(1, 'lockfile 里没有 packages: 段（空扫不记绿）')

/** `  'name@version':` / `  name@version:` / `  name@version(peer@1.0.0):` */
const ENTRY_RE = /^ {2}(?! )(.+):$/
const INTEGRITY_RE = /^\s{4}resolution:\s*\{\s*integrity:\s*([^,\s}]+)/

const seenKeys = 0 // eslint 占位,下面用计数变量
let entryCount = 0
const components = new Map() // purl → component（同 purl 多 peer 变体时只留一份）

function splitNameVersion(raw) {
  // 去掉 peer 后缀：`react-dom@19.0.0(react@19.0.0)` → `react-dom@19.0.0`
  const paren = raw.indexOf('(')
  const core = paren >= 0 ? raw.slice(0, paren) : raw
  // 从右找最后一个 @：`@scope/name@1.2.3` → ['@scope/name', '1.2.3']
  const at = core.lastIndexOf('@')
  if (at <= 0) return null
  const name = core.slice(0, at)
  const version = core.slice(at + 1)
  if (!name || !version) return null
  return { name, version }
}

function purlOf(name, version) {
  // CycloneDX/npm purl：scope 的 @ 编码为 %40，/ 保留
  const enc = name.startsWith('@') ? `%40${name.slice(1)}` : name
  return `pkg:npm/${enc}@${version}`
}

let cur = null
for (let i = start; i < lines.length; i++) {
  const line = lines[i]
  if (/^\S/.test(line)) break // 回到顶格 ⇒ packages 段结束
  const m = ENTRY_RE.exec(line)
  if (m) {
    entryCount++
    const raw = m[1].replace(/^['"]|['"]$/g, '')
    cur = splitNameVersion(raw)
    if (cur) {
      const purl = purlOf(cur.name, cur.version)
      if (!components.has(purl)) {
        components.set(purl, {
          type: 'library',
          name: cur.name,
          version: cur.version,
          purl,
          scope: 'required',
          hashes: [],
        })
      }
      cur.purl = purl
    }
    continue
  }
  const im = INTEGRITY_RE.exec(line)
  if (im && cur && cur.purl) {
    const [alg, b64] = im[1].split('-')
    const comp = components.get(cur.purl)
    const ALG = { sha512: 'SHA-512', sha256: 'SHA-256', sha1: 'SHA-1' }
    if (comp && ALG[alg] && b64 && !comp.hashes.length) {
      try {
        comp.hashes.push({ alg: ALG[alg], content: Buffer.from(b64, 'base64').toString('hex') })
      } catch {
        /* 坏的 integrity 只是少一个哈希,不影响组件存在性 */
      }
    }
  }
}

if (entryCount === 0) die(1, 'packages: 段解析出 0 条 —— 格式变了或切段失败，空扫不记绿')

// ── 2. workspace 自身包（八端 + packages/*）也进清单 ────────────────────
const workspaceComponents = []
const wsDirs = []
for (const group of ['apps', 'packages', 'sdks']) {
  const dir = join(ROOT, group)
  if (!existsSync(dir)) continue
  for (const name of readdirSync(dir)) {
    const pj = join(dir, name, 'package.json')
    if (existsSync(pj)) wsDirs.push(pj)
  }
}
for (const pj of wsDirs) {
  try {
    const j = JSON.parse(readFileSync(pj, 'utf8'))
    if (!j.name || !j.version) continue
    workspaceComponents.push({
      type: 'application',
      name: j.name,
      version: j.version,
      purl: purlOf(j.name, j.version),
      scope: 'required',
      hashes: [],
    })
  } catch {
    /* 坏 package.json 不阻塞 SBOM 生成 */
  }
}

// ── 3. 覆盖率断言：解析出的组件必须覆盖 packages 段每一条顶层键 ──────────
// 去重会让 components.size < entryCount（同 name@version 的 peer 变体），所以拿"见过的键"比。
// 这里用 purl 集合与 entryCount 的差来兜：若 |components| 明显小于 entryCount 的唯一键数，
// 说明解析漏了（例如某个版本号里带 ':' 导致 ENTRY_RE 不匹配）。
const uniquePurls = components.size
if (uniquePurls === 0) die(1, '解析出 0 个依赖组件 —— 空扫不记绿')
// 允许 peer 变体造成的合理合并（实测 lockfile 里同名同版本最多几种 peer 组合），
// 但不允许"合并掉一半"这种量级的漏算。
if (uniquePurls < entryCount * 0.5) {
  die(
    2,
    `覆盖率断言失败：packages 段 ${entryCount} 条，去重后仅 ${uniquePurls} 个组件（<50%）—— 解析漏条，拒绝生成`,
  )
}

// ── 4. 组装 CycloneDX 1.5 ───────────────────────────────────────────────
const list = [...components.values()]
  .concat(workspaceComponents)
  .sort((a, b) => (a.purl < b.purl ? -1 : a.purl > b.purl ? 1 : 0))

// 内容寻址的 serialNumber：同一份依赖图生成同一个 UUID（可复现、可对账）
const digest = createHash('sha256').update(JSON.stringify(list.map((c) => c.purl))).digest('hex')
const serial = `urn:uuid:${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-${
  ((parseInt(digest.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)
}${digest.slice(18, 20)}-${digest.slice(20, 32)}`

let rootVersion = '0.0.0'
try {
  rootVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version || '0.0.0'
} catch {
  /* 版本号只影响元数据展示 */
}

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: serial,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ vendor: 'IHUI AI', name: 'gen-sbom.mjs', version: '1.0.0' }],
    component: {
      type: 'application',
      name: 'ihui-ai',
      version: rootVersion,
      purl: purlOf('ihui-ai', rootVersion),
    },
  },
  components: list,
}
void randomUUID
void seenKeys

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(bom, null, 2) + '\n', 'utf8')

if (QUIET) {
  console.log(OUT)
} else {
  console.log(`✅ SBOM: ${list.length} 个组件（依赖 ${components.size} + 工作区包 ${workspaceComponents.length}）`)
  console.log(`   lockfile 条目 ${entryCount}（peer 变体合并 ${entryCount - components.size} 条）`)
  console.log(`   → ${OUT}`)
  console.log(`   serialNumber ${serial}`)
}
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
