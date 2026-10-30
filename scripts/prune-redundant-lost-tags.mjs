#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * prune-redundant-lost-tags.mjs — 清理「备份语义已归零」的 lost-commit / backup tag
 *
 * 背景（2026-10-30）：
 *   门 25 / 30a / 47 / 52 在落地复跑里大面积 rc=2 或 killed，直跑门 25 拿到真因：
 *     `git cat-file --batch-check`（14961 个规格）ETIMEDOUT ⇒ exit 2「未判定」。
 *   仓里有 27,177 个 tag，其中 `lost-commit/*` 约 25,577 枚 —— 这些是门 30a 的历史产物，
 *   每一条引用枚举（for-each-ref / ls-remote / cat-file）都要为它们付一次代价。
 *   rc=2 比判红更隐蔽：它不报警，只是「没判完」，跑久了所有人都当成绿的（AGENTS §0.3）。
 *
 * 本脚本只做一件事：把「目标提交已被 main 包含」的 tag 挑出来删掉。
 *   判据 = tag peel 到 commit 后，该 commit 是否为 main 的祖先。
 *   已被 main 包含 ⇒ 它不可能被 `git gc` 回收（可达），tag 的「防 gc 清理」语义为零；
 *   删掉它不丢任何 commit、不丢任何对象、不影响任何构建产物。
 *   **指向 main 之外提交的 tag 一枚都不动** —— 那是真正在防 gc 的备份。
 *
 * 为什么必须连远端一起删：
 *   门 30a 的 `healMissingRemoteTags()` 在「仅远端有、本地缺」时会把 tag fetch 回来固化。
 *   只删本地 ⇒ 下一次落地复跑就被从远端拉回，删了又回来。
 *   所以顺序是：先推远端删除并验空，再删本地。
 *
 * 用法：
 *   node scripts/prune-redundant-lost-tags.mjs                # dry-run，只报数
 *   node scripts/prune-redundant-lost-tags.mjs --apply         # 远端 + 本地一起删
 *   node scripts/prune-redundant-lost-tags.mjs --apply --local-only   # 只删本地（不推荐）
 *   node scripts/prune-redundant-lost-tags.mjs --base origin/main      # 换基线
 *
 * 退出码：
 *   0 — 成功（dry-run 或 apply 完成）
 *   1 — 远端删除后回读仍有残留
 *   2 — 未判定（取不到 tag 清单 / base 解析不出来 / 推远端网络失败且非 local-only）
 */
/* eslint-disable no-console -- CLI 工具 */
import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// 单一真相源(AGENTS §0.6):一律经共用层派生 git(绝对路径二进制 + quotepath + timeout +
// 代理换腿)。本脚本自己拼 execFileSync 就等于又欠一份"裸 git 派生"的债,
// face-reader.test 的型 B 棘轮会把它记进分母。
import { gitRaw } from './lib/face-reader.mjs'
// 存续层期望清单的读写出口(唯一一份住在 git-refs-heal;本器只问它要,不另抄形状)
import { readManifest, saveManifest, REFS_MANIFEST_PATH } from './git-refs-heal.mjs'

const ROOT = resolve(process.cwd())

const ROOTS = ['refs/tags/lost-commit', 'refs/tags/backup']
const STATE_FILE = '.ihui-agent/state/prune-redundant-lost-tags.json'
const APPLY = process.argv.includes('--apply')
const LOCAL_ONLY = process.argv.includes('--local-only')
const baseArgIdx = process.argv.indexOf('--base')
const BASE = baseArgIdx > 0 ? process.argv[baseArgIdx + 1] : 'main'

function git(args, opts = {}) {
  return gitRaw(args, ROOT, {
    timeout: opts.timeout ?? 900_000,
    maxBuffer: opts.maxBuffer ?? 512 * 1024 * 1024,
  })
}

function die(code, msg) {
  console.error(`❌ ${msg}`)
  process.exit(code)
}

// ── 1. 基线可达集 ────────────────────────────────────────────────
let baseSha
try {
  baseSha = git(['rev-parse', '--verify', `${BASE}^{commit}`]).trim()
} catch (e) {
  die(2, `基线 \`${BASE}\` 解析失败，未判定：${String(e.stderr || e.message).split('\n')[0].slice(0, 160)}`)
}

const reachable = new Set()
for (const sha of git(['rev-list', baseSha]).split('\n')) {
  if (sha) reachable.add(sha)
}
if (reachable.size === 0) die(2, `基线 ${BASE} 的可达集为 0，未判定`)

// ── 2. 枚举 tag ─────────────────────────────────────────────────
let raw
try {
  raw = git([
    'for-each-ref',
    '--format=%(refname:short)%09%(objecttype)%09%(objectname)%09%(*objectname)',
    ...ROOTS,
  ])
} catch (e) {
  die(2, `枚举 tag 失败，未判定：${String(e.stderr || e.message).split('\n')[0].slice(0, 160)}`)
}

/**
 * effective 目标：
 *  - annotated tag ⇒ %(*objectname) 是 peel 后的对象（commit tag 时即 commit sha）
 *  - 轻量 tag     ⇒ %(*objectname) 为空，%objectname 本身就是目标
 */
const redundant = []
const essential = []
const unclassified = []

for (const line of raw.split('\n')) {
  if (!line.trim()) continue
  const [name, objType, objName, peeled] = line.split('\t')
  const target = (peeled && peeled.trim()) || objName
  if (!name || !target) {
    unclassified.push({ name, reason: 'no-target' })
    continue
  }
  if (objType === 'blob' || objType === 'tree') {
    // 不是 commit 备份，本脚本不判，交人工
    unclassified.push({ name, reason: `object-type=${objType}` })
    continue
  }
  if (reachable.has(target)) redundant.push({ name, target })
  else essential.push({ name, target })
}

// ── 3. 报数（按前缀分组，便于判断影响面）────────────────────────
function groupOf(name) {
  const m = /^(lost-commit\/[^/]*|backup\/[^/]*|nightly-[^/]*)/.exec(name)
  return m ? m[1] : name.split('/')[0]
}
function tally(list) {
  const map = new Map()
  for (const it of list) {
    const g = groupOf(it.name)
    map.set(g, (map.get(g) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

console.log(`基线 ${BASE} (${baseSha.slice(0, 12)}) 可达提交 ${reachable.size}`)
console.log(`扫描根：${ROOTS.join(' , ')}`)
console.log(`可删（目标已在主线，备份语义为零）：${redundant.length}`)
console.log(`必留（目标不在主线，真正在防 gc）：${essential.length}`)
if (unclassified.length) console.log(`未分类（blob/tree tag 等，本脚本不动）：${unclassified.length}`)
console.log('\n可删分组 top:')
for (const [g, n] of tally(redundant).slice(0, 12)) console.log(`  ${String(n).padStart(6)}  ${g}`)
console.log('\n必留分组 top:')
for (const [g, n] of tally(essential).slice(0, 12)) console.log(`  ${String(n).padStart(6)}  ${g}`)

mkdirSync(dirname(STATE_FILE), { recursive: true })
writeFileSync(
  STATE_FILE,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      base: BASE,
      baseSha,
      reachableCount: reachable.size,
      redundantCount: redundant.length,
      essentialCount: essential.length,
      unclassifiedCount: unclassified.length,
      remainingEssential: essential.map((x) => x.name).slice(0, 5000),
      remainingUnclassified: unclassified.slice(0, 500),
      applied: false,
    },
    null,
    2
  ) + '\n',
  'utf8'
)

if (!APPLY) {
  console.log(`\n(dry-run) 未做任何改动。清单已落 ${STATE_FILE}`)
  process.exit(0)
}
if (redundant.length === 0) {
  console.log('\n无可删项，结束。')
  process.exit(0)
}

// ── 4. 先删远端 ─────────────────────────────────────────────────
if (!LOCAL_ONLY) {
  // 批宽与耗时都是 2026-10-30 量出来的,不是拍的:
  //   ① 原批宽 80 ⇒ 8093 枚要 102 次 push,实测 3~4 分钟/批、外推 5 小时。代价不在 ref
  //      advertisement(我先猜错过一次,实测否掉),而在每次 `git push` 触发的 .husky/pre-push
  //      全量代码质量门。那道门的 tag-only 豁免原先只看 `$1 ~ /^refs\/tags\//`,而**删除 tag**
  //      时 git 传的 local 侧是 `(nil)`、tag 名只住在远端侧 ⇒ 豁免结构上够不着。已在钩子判据
  //      里治本(回归锁 scripts/tests/pre-push-tag-only-exemption.test.mjs,含变异自证),
  //      所以这里**不设任何跳门变量** —— 纯删 ref 的推送本就该被那道门自己放行。
  //   ② 批宽取 500:argv 受 Windows 32767 字符上限约束(500 × ~48 字符 ≈ 24KB,留余量),
  //      摘掉重复的门之后 8093 枚只需 17 次 push。不用 --atomic:单条 not-exist 不该拖垮整批,
  //      判"删干净没有"的尺子是下面那次 ls-remote 回读,不是退出码。
  const CHUNK = 500
  let pushed = 0
  for (let i = 0; i < redundant.length; i += CHUNK) {
    const chunk = redundant.slice(i, i + CHUNK)
    const refspecs = chunk.map((x) => `:refs/tags/${x.name}`)
    try {
      git(['push', 'origin', ...refspecs], { timeout: 900_000 })
      pushed += chunk.length
    } catch (e) {
      const msg = String(e.stderr || e.message || '')
      // 远端已不存在（被别席删过）不算失败
      if (!/remote ref does not exist|stale info/i.test(msg)) {
        die(2, `推远端删除失败（已删 ${pushed}/${redundant.length}），未判定：${msg.split('\n')[0].slice(0, 200)}`)
      }
      pushed += chunk.length
    }
    console.log(`  远端已删 ${pushed}/${redundant.length}`)
  }
  console.log(`远端删除完成 ${pushed}`)

  // 回读验证：远端不应再有这些 tag
  const leftRaw = git(['ls-remote', '--tags', 'origin', ...ROOTS], { timeout: 900_000 })
  const leftSet = new Set(
    leftRaw
      .split('\n')
      .map((l) => l.split('\t')[1])
      .filter(Boolean)
      .map((r) => r.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, ''))
  )
  const stillThere = redundant.filter((x) => leftSet.has(x.name))
  if (stillThere.length) {
    writeFileSync(
      STATE_FILE.replace(/\.json$/, '.leftover.json'),
      JSON.stringify(stillThere.map((x) => x.name), null, 2) + '\n'
    )
    die(1, `远端回读仍有 ${stillThere.length} 枚残留（清单见 ${STATE_FILE.replace(/\.json$/, '.leftover.json')}）`)
  }
  console.log('远端回读确认：可删集已全部不在远端')
}

// ── 5. 再删本地 ─────────────────────────────────────────────────
const CHUNK_L = 400
let localDeleted = 0
for (let i = 0; i < redundant.length; i += CHUNK_L) {
  const chunk = redundant.slice(i, i + CHUNK_L).map((x) => x.name)
  try {
    git(['tag', '-d', ...chunk], { timeout: 300_000 })
    localDeleted += chunk.length
  } catch (e) {
    // 部分失败：逐条再来一次，只跳过已不存在的
    for (const n of chunk) {
      try {
        git(['tag', '-d', n], { timeout: 60_000 })
        localDeleted++
      } catch {
        /* 已不存在或不可删，跳过 */
      }
    }
  }
  if ((i / CHUNK_L) % 5 === 0) console.log(`  本地已删 ${localDeleted}/${redundant.length}`)
}
console.log(`本地删除完成 ${localDeleted}`)

try {
  git(['pack-refs', '--all', '--prune'], { timeout: 600_000 })
} catch {
  /* 固化失败不影响结果 */
}

// ── 6. 摘除存续层的期望清单条目(不摘就会被离线重建)────────────────
// 实测教训(2026-10-30):本器删完 8,093 枚远端 + 本地引用后,git-guardian 的「嵌套 ref 存续」层
//   在 22:08 按 refs-manifest.json 把其中 **8,086 枚重建并固化进 packed-refs** —— 它照"期望清单"
//   复活引用,不知道那是一次有意的删除(AGENTS §1 对活文档行写的是同一条纪律:摘除必须让重建那一层
//   认账,否则"删了又回来"永远追不完)。
// 读写与落点一律走 git-refs-heal 的出口(§0.6 单一真相源,本层零复算)。
if (!APPLY) {
  console.log('(dry-run) 存续层清单本轮不摘 —— 与引用删除同一批才有效,单摘等于自断存续')
} else {
  const manifestExists = existsSync(REFS_MANIFEST_PATH)
  const manifestBytes = manifestExists ? statSync(REFS_MANIFEST_PATH).size : 0
  if (!manifestExists || manifestBytes <= 2) {
    // 读不到/空表 ⇒ 一条都不动:写 `{}` 等于清空整张存续层清单(所有期望值一起丢),比不摘更坏。
    console.log(
      `⚠️ 存续层清单未判定(存在=${manifestExists} 字节=${manifestBytes})⇒ 本轮不摘条目;` +
        `被删的引用可能被下一轮 refs 自愈重建。出路:确认清单可读后重跑本器`,
    )
  } else {
    const manifest = readManifest()
    const before = Object.keys(manifest).length
    if (before === 0) {
      // 文件非空却解析出 0 条 ⇒ 判"读不到"(§0.3),绝不按"确实没有"落盘
      console.log(`⚠️ 存续层清单 ${manifestBytes}B 解析出 0 条 ⇒ 视为读不到,本轮不写(不拿空表覆盖真清单)`)
    } else {
      let dropped = 0
      for (const x of redundant) {
        const key = `refs/tags/${x.name}`
        if (Object.prototype.hasOwnProperty.call(manifest, key)) {
          delete manifest[key]
          dropped++
        }
      }
      const after = Object.keys(manifest).length
      if (saveManifest(manifest)) {
        console.log(`存续层清单: ${before} → ${after}(本轮声明摘除 ${dropped}/${redundant.length} 条)`)
      } else {
        // 写失败 ⇒ 大声报,不静默:条目仍在期望清单里,引用会被重建回来
        console.log('❌ 存续层清单写入失败 ⇒ 未摘除;删掉的引用会被 refs 自愈重建,请重跑本器')
        process.exitCode = 1
      }
    }
  }
}

writeFileSync(
  STATE_FILE,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      base: BASE,
      baseSha,
      reachableCount: reachable.size,
      redundantCount: redundant.length,
      essentialCount: essential.length,
      unclassifiedCount: unclassified.length,
      remainingEssential: essential.map((x) => x.name).slice(0, 5000),
      remainingUnclassified: unclassified.slice(0, 500),
      applied: true,
      localDeleted,
    },
    null,
    2
  ) + '\n',
  'utf8'
)

console.log(`\n✅ 完成。剩 tag 总数 ${git(['tag']).split('\n').filter(Boolean).length}`)
console.log(`   必留 ${essential.length} 枚（目标不在主线，继续防 gc）`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
