// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gitee-release-backfill.mjs — 国内侧补齐 Gitee 发版资产(2026-11-21 立)。
 *
 * 为什么需要它(结构性缺陷,不是补一次就完):
 *   发版流水线里的 `sync-gitee` job 跑在 **GitHub 托管 runner** 上,把资产传进 Gitee
 *   要过国际链路 —— 87MB 的 AppImage 在 60 分钟预算内传不完(0.1.83/0.1.84/0.1.86
 *   三版实测都是 `cancelled`),所以 `.github/scripts/sync-gitee.py` 里 AppImage 是
 *   `SKIP_MIRROR_SUFFIXES` **硬跳过**,每版都留下一个"国内侧必须有人补"的缺口。
 *   而本机上传同一份 87MB 到 Gitee 只要 ~21 秒(约 4MB/s) ⇒ 正解是**谁有带宽谁补**:
 *   runner 只出小件,国内侧(本机)把大件补齐。
 *
 * 职责边界(与既有实现不重叠,§0.6 单一真相源):
 *   · 判定"缺哪件":只按 **资产名差集**(GitHub 有 / Gitee 无),不做第二套字节对账 ——
 *     字节一致性由 `scripts/bake-desktop-latest.mjs --check`(逐平台 Content-Length)
 *     与 `apps/web/src/config/desktop-feed-live.ts`(运行期 giteeByteParity)各管一面。
 *   · 下载件的完整性用 **GitHub API 给的 digest**(sha256)判,这是权威源,不是新判据。
 *   · 上传后的可下载性用直链 HEAD 的 Content-Length 复核,与 bake 的同名复核同口径。
 *
 * 用法:
 *   node scripts/gitee-release-backfill.mjs --tag desktop-v0.1.86 [--dry-run] [--max-files 2]
 *   node scripts/gitee-release-backfill.mjs --auto      # 取 GitHub Latest,30 分钟节流
 * 环境:
 *   GITEE_TOKEN 优先;缺省读密钥目录 `密钥/git仓库/gitee apikey.txt`(走 lib/key-dir.mjs,盘符不写死)
 *   GH_MIRROR    下载镜像前缀,默认 https://gh-proxy.com/(直连 GitHub 实测 ~20KB/s)
 *   BACKFILL_MAX_FILES  单次最多补几件(默认 3,防一次跑太久)
 * 结论行:`GITEE-BACKFILL state=ok|partial|undetermined added=… skipped=… failed=…`
 * 退出码:0=无需补或全部补齐 / 1=有失败 / 2=未判定(缺 token、取不到清单、CI 正在传)
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { keyFile } from './lib/key-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GH_REPO = 'IHUI-INF-AI/IHUI-AI'
const GITEE_OWNER = process.env.GITEE_OWNER || 'JLSLSSZWHYXGS_0'
const GITEE_REPO = process.env.GITEE_REPO || 'IHUI-AI'
const MIRROR = (process.env.GH_MIRROR || 'https://gh-proxy.com/').replace(/\/+$/, '') + '/'
const STATE = join(ROOT, '.ihui-agent/state/gitee-backfill.json')
const THROTTLE_MS = 30 * 60 * 1000
const SEGMENTS = 4
const MAX_FILES = Number(process.env.BACKFILL_MAX_FILES || 3)

/** 取参数(--tag/--dry-run/--max-files/--auto)。缺 tag 且非 auto ⇒ 用法错(exit 2)。 */
function parseArgs(argv) {
  const opts = { tag: '', dryRun: false, auto: false, maxFiles: MAX_FILES }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--dry-run') opts.dryRun = true
    else if (a === '--auto') opts.auto = true
    else if (a === '--tag') opts.tag = String(argv[(i += 1)] || '')
    else if (a === '--max-files') opts.maxFiles = Number(argv[(i += 1)] || MAX_FILES)
    else if (a === '--help') opts.help = true
  }
  return opts
}

/** 安静版 token 读取:env → 密钥目录;两者都取不到返回空串(调用方判未判定,不当成"没配置")。 */
function readToken() {
  if (process.env.GITEE_TOKEN) return process.env.GITEE_TOKEN.trim()
  try {
    const p = keyFile('git仓库', 'gitee apikey.txt')
    if (p && existsSync(p)) return readFileSync(p, 'utf8').trim()
  } catch {
    /* 密钥目录不可达 ⇒ 交由调用方判未判定 */
  }
  return ''
}

function api(url, init = {}) {
  return fetch(url, init).then(async (r) => {
    const text = await r.text()
    if (!r.ok) throw new Error(`${r.status} ${url} :: ${text.slice(0, 200)}`)
    return JSON.parse(text)
  })
}

/** GitHub 认证头:CI 里没有 token 也能读公开 release(限流 60/h),本机有 gh 会话时带上更稳。 */
function ghHeaders() {
  const t = (process.env.GH_TOKEN || '').trim()
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ihui-backfill',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  }
}

/** GitHub 侧资产清单(GitHub 的 digest 是唯一权威校验源)。 */
async function ghAssets(tag) {
  const rel = await api(`https://api.github.com/repos/${GH_REPO}/releases/tags/${tag}`, {
    headers: ghHeaders(),
  })
  return (rel.assets || []).map((a) => ({
    name: a.name,
    size: a.size,
    digest: String(a.digest || ''),
    url: a.browser_download_url,
  }))
}

/** Gitee 侧已有资产名 + release id(0.1.x 的 assets size 字段实测为空,只认名字)。 */
async function giteeRelease(tag, token) {
  const list = await api(
    `https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}/releases?per_page=50`,
    { headers: { Authorization: `token ${token}` } },
  )
  const rel = (list || []).find((r) => String(r.tag_name || '') === tag)
  if (!rel) return null
  return { id: rel.id, names: new Set((rel.assets || []).map((a) => String(a.name))) }
}

/** 多段并行 Range 下载到 dest(镜像链路单流实测 ~120KB/s,4 段可把 87MB 压到 ~10 分钟)。 */
async function download(name, size, url, dest) {
  const target = `${MIRROR}${url}`
  const probe = await fetch(target, { headers: { Range: 'bytes=0-0' } }).catch(() => null)
  const ranged = probe && probe.status === 206
  const segs = ranged && size > 4 * 1024 * 1024 ? SEGMENTS : 1
  const part = segs === 1 ? Math.ceil(size / 1) : Math.ceil(size / segs)
  const buffers = []
  for (let i = 0; i < segs; i += 1) {
    const start = i * part
    const end = Math.min(size - 1, start + part - 1)
    const headers = segs === 1 ? {} : { Range: `bytes=${start}-${end}` }
    buffers.push(
      fetch(target, { headers })
        .then(async (r) => {
          if (!r.ok && r.status !== 206) throw new Error(`${r.status} 下载失败 ${name}`)
          const buf = Buffer.from(await r.arrayBuffer())
          if (segs > 1 && buf.length !== end - start + 1)
            throw new Error(`分段长度不符 ${name} seg${i} ${buf.length}≠${end - start + 1}`)
          return { i, buf }
        })
        .then((v) => ({ ...v, order: i })),
    )
  }
  const got = await Promise.all(buffers)
  got.sort((a, b) => a.order - b.order)
  const merged = Buffer.concat(got.map((g) => g.buf))
  if (merged.length !== size) throw new Error(`总长不符 ${name} ${merged.length}≠${size}`)
  writeFileSync(dest, merged)
  return merged
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

/** 上传到 Gitee release;同名已存在不传(幂等,绝不制造第二份同名附件)。 */
async function upload(releaseId, token, filePath, name) {
  const buf = readFileSync(filePath)
  const form = new FormData()
  form.append('file', new Blob([buf]), name)
  const r = await fetch(
    `https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${releaseId}/attach_files`,
    { method: 'POST', headers: { Authorization: `token ${token}` }, body: form },
  )
  if (!r.ok) throw new Error(`${r.status} 上传失败 ${name} :: ${(await r.text()).slice(0, 160)}`)
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE, 'utf8'))
  } catch {
    return {}
  }
}

function writeState(tag, result) {
  mkdirSync(dirname(STATE), { recursive: true })
  const prev = readState()
  writeFileSync(
    STATE,
    JSON.stringify(
      { ...prev, lastRunAt: new Date().toISOString(), lastTag: tag, lastResult: result },
      null,
      2,
    ) + '\n',
  )
}

async function latestTag() {
  const rel = await api(`https://api.github.com/repos/${GH_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ihui-backfill' },
  })
  return String(rel.tag_name || '')
}

/** CI 正在传同一 tag ⇒ 退出(并发上传同名附件会在 Gitee 上留两份,实测 deb 重复过)。 */
async function ciInFlight(tag) {
  const runs = await api(
    `https://api.github.com/repos/${GH_REPO}/actions/runs?event=push&per_page=20`,
    { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ihui-backfill' } },
  )
  return (runs.workflow_runs || []).some(
    (r) =>
      String(r.head_branch || '') === tag &&
      (r.status === 'in_progress' || r.status === 'queued'),
  )
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(
      '用法: node scripts/gitee-release-backfill.mjs --tag <tag> [--dry-run] [--max-files N] | --auto',
    )
    return 0
  }
  const token = readToken()
  let tag = opts.tag
  if (!tag && opts.auto) {
    const st = readState()
    if (st.lastRunAt && Date.now() - Date.parse(st.lastRunAt) < THROTTLE_MS) {
      console.log(`GITEE-BACKFILL state=ok skipped=throttled last=${st.lastTag || '-'}`)
      return 0
    }
    tag = await latestTag()
  }
  if (!tag) {
    console.log('GITEE-BACKFILL state=undetermined reason=no-tag(给 --tag 或 --auto)')
    return 2
  }
  if (!token) {
    console.log('GITEE-BACKFILL state=undetermined reason=no-token')
    return 2
  }

  const [gh, gitee] = await Promise.all([ghAssets(tag), giteeRelease(tag, token)])
  if (!gitee) {
    console.log(`GITEE-BACKFILL state=undetermined reason=gitee-release-absent tag=${tag}`)
    return 2
  }
  const missing = gh.filter((a) => !gitee.names.has(a.name))
  if (missing.length === 0) {
    writeState(tag, 'ok')
    console.log(`GITEE-BACKFILL state=ok tag=${tag} added=0 skipped=${gh.length} (Gitee 已齐)`)
    return 0
  }
  if (await ciInFlight(tag)) {
    console.log(
      `GITEE-BACKFILL state=undetermined reason=ci-in-flight tag=${tag} missing=${missing.length}`,
    )
    return 2
  }
  if (opts.dryRun) {
    console.log(
      `GITEE-BACKFILL state=ok dry-run tag=${tag} missing=${missing
        .map((m) => m.name)
        .join(',')}`,
    )
    return 0
  }

  const tmpdir = join(ROOT, '.ihui-agent/tmp/gitee-backfill', tag)
  mkdirSync(tmpdir, { recursive: true })
  const ordered = missing
    .slice()
    .sort((a, b) => (a.name.endsWith('-setup.exe') ? -1 : b.name.endsWith('-setup.exe') ? 1 : 0))
    .slice(0, Math.max(1, opts.maxFiles))
  const added = []
  const failed = []
  for (const a of ordered) {
    const dest = join(tmpdir, a.name)
    try {
      const buf = existsSync(dest) && statSync(dest).size === a.size
        ? readFileSync(dest)
        : await download(a.name, a.size, a.url, dest)
      const digest = a.digest.startsWith('sha256:') ? a.digest.slice(7) : ''
      if (digest && sha256(buf) !== digest) throw new Error(`sha256 不符 ${a.name}`)
      if (gitee.names.has(a.name)) continue
      await upload(gitee.id, token, dest, a.name)
      const head = await fetch(
        `https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/download/${tag}/${a.name}`,
        { method: 'HEAD' },
      ).catch(() => null)
      const len = Number(head?.headers.get('content-length') || 0)
      if (head && head.ok && len && len !== a.size) throw new Error(`Gitee 侧长度不符 ${a.name}`)
      gitee.names.add(a.name)
      added.push(a.name)
      rmSync(dest, { force: true })
    } catch (e) {
      failed.push(`${a.name}:${String(e.message || e).slice(0, 120)}`)
    }
  }
  const state = failed.length === 0 ? 'ok' : added.length > 0 ? 'partial' : 'partial'
  writeState(tag, state)
  console.log(
    `GITEE-BACKFILL state=${state} tag=${tag} added=${added.length} failed=${failed.length}`
  )
  for (const f of failed) console.log(`  ✗ ${f}`)
  return failed.length === 0 ? 0 : 1
}

main()
  .then((rc) => process.exit(rc))
  .catch((e) => {
    console.log(`GITEE-BACKFILL state=undetermined reason=exception ${String(e.message || e).slice(0, 200)}`)
    process.exit(2)
  })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
