// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-collide-renumber 的**落地面**(blob 产出层,不是判据层)。
 *
 * 为什么搬出来:"把内容变成 blob"(派生 git + 水印 + 回读)与"算出让号方案"(纯判据)是两种关注点,
 * 混在一格里会让判据层的取证连带背上 I/O。
 * ⚠️ 搬出时曾把理由写成"守门 11e 的 800 行上限对新增文件 blocking"—— 那是一条**假前提**:
 * 11e 的扩展名表只有 `.ts/.tsx/.js/.jsx`(`scripts/check-file-size.mjs:85`,staged 档 :149 用它筛),
 * `.mjs` 不进它的射程。拆分仍然成立,但成立的是关注点分离而不是过门 ——
 * 理由写错的下场是下一个人会为了"过门"去拆不该拆的东西。
 * 这一层只有一个动作:文本 → blob,并且**从不写工作树、从不 commit**。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from './scratch-dir.mjs'
import { gitBinary } from './face-reader.mjs'

// 本模块在 `scripts/lib/` 下 —— 往上**两级**才是仓库根。少剥一级会得到 `…/scripts/scripts/…`,
// 症状不是"少个水印"而是派生直接 MODULE_NOT_FOUND(实测 --apply 第一次就是这么红的)。
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const GIT_TIMEOUT = 120000
const GIT = gitBinary()
const firstLine = (e) =>
  String(e?.message ?? e ?? '')
    .split(/\r?\n/)[0]
    .slice(0, 180)

/** 水印器取哪一份:`--root` 指向**另一份检出**时,必须用那一份自己的 watermark.mjs ——
 *  它按脚本自身位置推导仓库根(§15),拿别处的副本去判被审仓的第三方排除面就是错基准(守门 118 那一型)。
 *  取不到才退回本模块所在仓的那一份。 */
function watermarkCli(root) {
  const mine = join(root, 'scripts', 'watermark.mjs')
  return existsSync(mine) ? mine : join(REPO_ROOT, 'scripts', 'watermark.mjs')
}

function runWatermark(root, args, label) {
  const r = spawnSync(process.execPath, [watermarkCli(root), ...args], {
    encoding: 'utf8',
    cwd: root,
    windowsHide: true,
    timeout: GIT_TIMEOUT,
  })
  // 「完好」只认退出码 —— 汇总行里没有"完好"二字(把措辞当判据踩过的那一型)。
  if (r.status !== 0)
    throw new Error(
      `${label} 水印不过:rc=${r.status} ${String(r.stdout || r.stderr || '').slice(0, 200)}`,
    )
  return true
}

/** 文本 → blob(写临时件 → 可选水印 → hash-object -w → **从对象库回读比对**)。
 *  回读不是仪式:本仓有过"三条内存断言全绿而提交进去的是 0 字节台账"的一手事故。 */
export function hashBlob(text, { root, rel, watermark = false }) {
  const dir = mkScratch('ihui-renumber-')
  try {
    // 临时件**必须带真扩展名**:`watermark.mjs inject` 按类型判 skip-type,叫 blob.tmp 就被整个跳过,
    // 于是"过了水印"这句话是空的(实测第一次 --apply 就红在这里,而不是静默通过 —— 这次是运气)。
    const f = join(dir, 'blob' + extname(rel || ''))
    // 统一规范化为 \n:buildArchiveAppend 在 Windows 上产 \r\n,watermark inject --reseat-tail
    // 会剥末行 \r,hash-object 与 readFileSync 读到的 EOL 就不一致(实测 24107 vs 24115,差 8 字节)。
    const normalized = text.replace(/\r\n/g, '\n')
    writeFileSync(f, normalized, 'utf8')
    if (watermark) {
      runWatermark(root, ['inject', '--reseat-tail', f], rel)
      // 追加型写入会把末行的隐写载荷顶走 —— `--reseat-tail` 负责请回,`verify` 负责**只认退出码**
      // 地说一句它真在位。少了这一步,"注入成功"就只是"注入器没抛错",不是"水印完好"。
      runWatermark(root, ['verify', f], rel)
    }
    const out = spawnSync(GIT, ['-c', 'safe.directory=*', '-C', root, 'hash-object', '-w', f], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: GIT_TIMEOUT,
    })
    if (out.status !== 0)
      throw new Error(`hash-object 失败:${String(out.stderr || out.stdout || '').slice(0, 200)}`)
    const blob = String(out.stdout || '').trim()
    if (!/^[0-9a-f]{40}$/.test(blob))
      throw new Error(`hash-object 给出的不是 oid:${blob.slice(0, 40)}`)
    const back = spawnSync(GIT, ['-c', 'safe.directory=*', '-C', root, 'cat-file', 'blob', blob], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: GIT_TIMEOUT,
      maxBuffer: 1 << 28,
    })
    if (back.status !== 0) throw new Error(`blob 回读失败:${firstLine(back.stderr)}`)
    const written = readFileSync(f, 'utf8')
    if (back.stdout !== written)
      throw new Error(`blob 回读与写入内容不等(长度 ${back.stdout.length} vs ${written.length})`)
    return blob
  } finally {
    rmScratch(dir)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
