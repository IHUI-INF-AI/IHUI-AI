// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * land-derived-blobs.mjs —— 「派生产物按对象空间落地」的唯一出口
 *
 * 为什么要有它(2026-10-27 实测的两格):
 *   ① 守门 105 的 G5 判"自述钉 ≠ 现算输入哈希"是 blocking 且每次提交都跑,而重生成只有人肉一条路;
 *      旁路落地(commit-tree+CAS)不跑钩子 ⇒ 输入一改,HEAD 上的产物就永远旧一格。
 *   ② 把"生成完 → hash-object → object-space-land"这段电次各写一遍,就会有第 N 份同形脚本
 *      (AGENTS 记过:6 份 commit-tree 装置互相漂开)。分隔符这种两边字面约定尤其危险:
 *      LAND_PATHS 用 `,` 而不是 `;`,落地器把整串当**一条**路径,报一句「清单里缺这些声明路径」,
 *      在守护日志里只是一行 ⚠️ —— 静默失效,正是本仓最高频那一型。
 *
 * 纪律:本模块**只落地,不判定**。落不落、落完绿不绿,由调用方(和它对面那道门)说。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** LAND_PATHS 的分隔符 = object-space-land.mjs 的 env 契约(以 `;` 分隔) */
export const LAND_PATHS_SEP = ';'

/** 落地 env 的构造(纯函数;调用方的镜像测试拿落地器自己的 parseArgs 做 round-trip) */
export function landEnv({ paths, manifest, msg, proof, baseRef = '' }) {
  return {
    LAND_PATHS: paths.join(LAND_PATHS_SEP),
    LAND_BLOBS: manifest,
    LAND_BLOB_PROOF: proof,
    LAND_MSG: msg,
    // 把 CAS 的基线钉死在"我这份 blob 是对着哪一枚提交生成的"上:HEAD 若已被别席推进,
    // 落地器必须**失败并重判**,而不是拿新 HEAD 重放一份旧面上的字节(检出档的全部前提就是同面)。
    ...(baseRef ? { LAND_BASE_REF: baseRef } : {}),
  }
}

/** 把一份磁盘文本写成 blob 并返回 oid(对象库里那份,与"面"无关) */
export function hashText(root, text, { run } = {}) {
  const exec =
    run ??
    ((args, opts) =>
      execFileSync('git', ['-c', 'safe.directory=*', '-C', root, ...args], {
        windowsHide: true,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120000,
        maxBuffer: 1 << 24,
        ...opts,
      }))
  return String(exec(['hash-object', '-w', '--stdin'], { input: text })).trim()
}

/** 盘上某路径「按 git 过滤器入库后」的 oid(取不到 ⇒ null) */
export function hashPath(root, rel, { run } = {}) {
  const exec =
    run ??
    ((args) =>
      execFileSync('git', ['-c', 'safe.directory=*', '-C', root, ...args], {
        windowsHide: true,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120000,
        maxBuffer: 1 << 24,
      }))
  try {
    return String(exec(['hash-object', '-w', '--', rel])).trim() || null
  } catch {
    return null
  }
}

/**
 * 用 blob 清单落一枚提交(object-space-land:CAS + 行级复活守卫都在它那边)。
 * @param {{root:string, files:Array<{path:string,blob:string}>, msg:string, proof:string, slot?:string, timeoutMs?:number}} o
 * @returns {{ok:boolean, why?:string, out?:string}}
 */
export function landBlobs({
  root,
  files,
  msg,
  proof,
  slot = 'derived',
  timeoutMs = 10 * 60 * 1000,
  baseRef = '',
}) {
  if (!Array.isArray(files) || files.length === 0)
    return { ok: false, why: 'files 为空 ⇒ 不落地(空清单会交出 undefined 当路径)' }
  for (const f of files) {
    if (!/^[0-9a-f]{40}$/.test(String(f.blob ?? ''))) {
      return {
        ok: false,
        why: `${f.path} 的 blob 不是 40 位 oid(${String(f.blob).slice(0, 12)})⇒ 拒绝落地`,
      }
    }
  }
  const tmpDir = join(root, '.ihui-agent', 'tmp', `land-derived-${slot}`)
  mkdirSync(tmpDir, { recursive: true })
  const manifest = join(tmpDir, `blobs-${process.pid}.json`)
  writeFileSync(manifest, JSON.stringify({ files }, null, 1), 'utf8')
  const paths = files.map((f) => f.path)
  try {
    let out = ''
    let status = 0
    try {
      out = execFileSync(
      process.execPath,
      [join(dirname(fileURLToPath(import.meta.url)), '..', 'object-space-land.mjs')],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 1 << 26,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
        env: { ...process.env, ...landEnv({ paths, manifest, msg, proof, baseRef }) },
      },
    )
    } catch (e) {
      // 非零退出**不等于没落地**:落地器落成功后还会复跑受影响判据,那一轮若有别的维红就非零退出。
      // 所以结论只看它有没有自证 CAS/回读;红要如实报出去(gatesRed),不许折成"没落上"。
      status = typeof e?.status === 'number' ? e.status : -1
      out = String(e?.stdout ?? '')
      if (!out) return { ok: false, why: String(e?.stderr ?? e?.message ?? e).slice(0, 400) }
    }
    const landed = /CAS 成功|提交面回读/.test(String(out))
    const gatesRed = /判红|blocking d+ 臂|拒绝报绿/.test(String(out))
    if (!landed) return { ok: false, why: '落地器未自证成功(既没报 CAS 也没报回读)', out: String(out), status }
    return { ok: true, landed, gatesRed, out: String(out), status }
  } finally {
    try {
      rmSync(manifest, { force: true })
    } catch {
      /* 临时件清不掉只影响工作区卫生,不影响结论 */
    }
  }
}

export const __test__ = { LAND_PATHS_SEP, landEnv, landBlobs, hashText, hashPath }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
