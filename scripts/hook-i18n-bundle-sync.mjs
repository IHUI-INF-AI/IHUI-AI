// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * hook-i18n-bundle-sync.mjs —— pre-commit「离线包输入变了 ⇒ 产物必须重生成」的唯一出口(2026-11-04 立)
 *
 * ## 治什么(实测,不是推断)
 *
 * 2026-11-03 夜间 `4dc42b03` 删了 `miniapp-taro/ko.json` 两枚野键、另一席改了 `shared/zh-TW.json`,
 * 两处输入都进了提交,而 7 份离线包产物没有任何环节跟着重生成 —— HEAD 上挂了一道 blocking 红门
 * (守门 105 G5: `94fd2f6a ≠ 455aaebe`),直到 21:2x 被另一单偶然撞见才清偿。
 * 自愈腿 `heal-derived-in-checkout.mjs --family i18n` 在漂移期返回 `state=written`(4 份备好),
 * 证明**检测能力一直有,缺的是"提交时强制调用它"**。
 *
 * ## 判据(与 105 同源,不另起第二把尺)
 *
 * 直接复用 `healI18nFamily({ face:'staged' })`:
 *   · `state=clean` —— 索引面现算 `inputsSha256` == 产物自述钉 ⇒ **零写盘、零 git add**;
 *   · `state=ready` —— 按索引面重生成、复量新钉、过在飞副本闸与字节上限;
 *   · `state=refused/undetermined` —— 一律点名,绝不冒绿(§0.3)。
 * 「只差元数据行时不写」由这条判据天然满足:判的是 `inputsSha256`,不是产物字节。
 * 生成器每跑一次都会刷新 `generatedAt`/`sourceCommit`;若拿字节差当判据,每笔提交都会重写 4 份,
 * 制造无限脏面 —— 本脚本因此**先判钉、只有钉不等才跑生成器**。
 *
 * ## 落索引(先申报、再 add、再复判)
 *
 * 产物的路径不在作者声明集里,直接 `git add` 会被 isolated-git 的私有索引护栏判红。
 * 走既有派生申报通道(scripts/lib/derived-artifacts.js 单一实现):
 *   declare(路径 + 工作树 blob) → `git add -- <path>` → 索引 blob 必须 == 申报 blob → **复判 clean**。
 * 复判不是装饰:add 之后从索引面重新算钉,clean 才算这一次通过。
 *
 * ## 三态退出码(pre-commit 据此阻断)
 *
 *   0 = clean / healed    2 = undetermined    3 = refused    4 = blocked(落索引或复判失败)
 *
 * ## 用法
 *
 *   node scripts/hook-i18n-bundle-sync.mjs --staged --json   # pre-commit 调用(判 + 补 + 入索引)
 *   node scripts/hook-i18n-bundle-sync.mjs --staged          # 人工跑(人读输出)
 *
 * 只判索引面:这是提交链的腿,不判 HEAD/工作树面(那两档归 heal-derived-in-checkout.mjs 的巡检)。
 */

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { healI18nFamily } from './heal-derived-in-checkout.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const derivedArtifacts = require('./lib/derived-artifacts.js')

/** 产物出自哪条命令(manifest 留痕;与 heal 的跑法一致) */
const GENERATOR = 'node scripts/gen-i18n-compressed.mjs --staged'

/**
 * 把变化集逐份申报 + `git add` + 核验索引 blob。
 * 逐份推进(declare→add→verify)而不是"全部 declare 再全部 add":
 * 后者中途失败会在 manifest 留下指向不存在索引条目的悬空申报,isolated-git 复核时必红。
 */
export function stageI18nOutputs({ files, root = ROOT, manifestFile } = {}) {
  const manifest =
    manifestFile === undefined ? process.env.IHUI_ISOLATED_INDEX_DERIVED_MANIFEST : manifestFile
  const added = []
  for (const f of files || []) {
    const relPath = String(f?.path ?? f ?? '')
    const decl = derivedArtifacts.declareDerivedArtifact({
      manifestFile: manifest,
      path: relPath,
      generator: GENERATOR,
      gitCwd: root,
    })
    const blob = decl.declared
      ? decl.blob
      : derivedArtifacts.hashWorktreeBlob({ gitCwd: root, relPath })
    const add = spawnSync('git', ['add', '--', relPath], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5 * 60 * 1000,
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (add.status !== 0) {
      const why = String(add.stderr || add.stdout || `exit=${add.status}`).trim().slice(0, 200)
      throw new Error(`git add -- ${relPath} 失败:${why}`)
    }
    const check = derivedArtifacts.verifyDeclaredEntryInIndex({ gitCwd: root, relPath, blob })
    if (!check.ok) throw new Error(`${relPath}:${check.reason}(须先排查并发写者)`)
    added.push(relPath)
  }
  return added
}

/**
 * 一次提交链同步:判 →(必要时)重生成 → 入索引 → 复判。
 * heal/stage 可注入,镜像测试不碰真 git/真生成器。
 */
export function runSync({ root = ROOT, face = 'staged', heal, stage } = {}) {
  const runHeal = heal || ((opts) => healI18nFamily(opts))
  const runStage = stage || ((opts) => stageI18nOutputs(opts))

  const first = runHeal({ face, root })
  if (first.state === 'clean') return { state: 'clean', digest: first.digest, files: [] }
  if (first.state !== 'ready') {
    return { state: first.state, why: first.why, files: [] }
  }
  if (!Array.isArray(first.files) || first.files.length === 0) {
    return {
      state: 'refused',
      why: '生成器重跑后变化集为空 ⇒ 钉说新旧不同而字节说全等,门与生成器不同形,不落半套',
      files: [],
    }
  }

  let staged
  try {
    staged = runStage({ files: first.files, root })
  } catch (e) {
    return {
      state: 'blocked',
      why: `落索引失败:${String(e?.message ?? e).slice(0, 240)}`,
      files: [],
    }
  }

  // 复判:add 之后从**索引面**重新算钉;不是 clean 就不算通过
  const second = runHeal({ face, root })
  if (second.state !== 'clean') {
    return {
      state: 'blocked',
      why: `落地后复判不是 clean:${second.state}${second.why ? `(${second.why})` : ''}`,
      files: [],
    }
  }
  return { state: 'healed', digest: first.digest, files: staged.map((path) => ({ path })) }
}

export const EXIT_CODE = { clean: 0, healed: 0, undetermined: 2, refused: 3, blocked: 4 }

function main(argv) {
  const json = argv.includes('--json')
  const t0 = performance.now()
  const res = runSync({ root: ROOT, face: 'staged' })
  const out = { ...res, ms: Math.round(performance.now() - t0) }
  if (json) {
    process.stdout.write(`${JSON.stringify(out)}\n`)
  } else if (out.state === 'clean') {
    console.log(`✅ 离线包钉与本次输入一致(inputsSha256 ${String(out.digest).slice(0, 12)}…) —— 零写盘`)
  } else if (out.state === 'healed') {
    console.log(`✅ 已按本次输入重生成 ${out.files.length} 份离线包产物并加入索引(复判 clean)`)
    for (const f of out.files) console.log(`   + ${f.path}`)
  } else {
    console.error(`❌ 离线包派生同步未通过:${out.state}${out.why ? ` —— ${out.why}` : ''}`)
  }
  return EXIT_CODE[out.state] ?? 4
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ hook-i18n-bundle-sync 未捕获异常:${e?.stack ?? e}`)
    process.exit(4)
  }
}

export const __test__ = { EXIT_CODE, GENERATOR }
