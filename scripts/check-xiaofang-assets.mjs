#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-xiaofang-assets.mjs —— 小方品牌外挂资产「透明底 integrity」运行期校验
 *
 * 立因(2026-11-26,实测事故):
 *  1. wave 招手动图曾在上线前那一步「压到 62 帧 / 918KB 过 2MB 入库门」时被压掉了 alpha:
 *     整片仅 0.04% 像素透明、四角 RGBA=(0,0,0,255) ⇒ web 端 AI 面板空态直接糊出一块纯黑底。
 *     设计源「动图透明底压缩/招手.gif」(400×267/124 帧)是健康的(约 80% 像素 alpha=0),
 *     坏在成品这一侧,不在设计这一侧。
 *  2. 该目录被 .gitignore 忽略、不进 git;部署只 ff 被跟踪文件 ⇒ 坏版本被放回来时,
 *     git 侧零感知,也没有可回滚的历史版本。唯一守得住的,是**文件内容本身长什么样**。
 *  3. 故本脚本按内容判据兜底,不依赖提交历史,可被 pre-deploy / CI / 人工随时复跑。
 *
 * 判据(任一不满足 ⇒ exit 1):
 *  A. xiaofang-wave.webp 在位、RIFF/WEBP 魔数、包体 ≥ 900KB(288×192/120 帧成品体积下限);
 *  B. xiaofang-wave.gif  在位,且满足下列任一条:
 *     B1. sha256 == 5edadbd982954989a2863042aeb2962e5859d290f5c355809b944cd2e10cc371
 *         (2026-11-26 重出成品:288×192 / 120 帧 / 80.27% 透明 / 1,070,673 字节);
 *     B2. 结构上真的带透明扩展(Graphic Control Extension 的 transparent-color 标志置位)
 *         且包体 ≥ 900KB —— 拦的是「坏版 940,536 字节且无透明标志」这一型压扁;
 *  C. 三张 PNG(full / face / lost)在位且非空;
 *  D. 不带 --allow-alt:上面任一条不成立即红(不做「先报数后放行」)。
 *
 * 退出码:0 全通过 ／ 1 有缺陷 ／ 2 目录不在位(净面构建、纯 git 克隆、CI 的正常情况,不算失败)
 *
 * 用法:
 *   node scripts/check-xiaofang-assets.mjs                       # 默认查 apps/web/public/images/xiaofang-assets
 *   node scripts/check-xiaofang-assets.mjs --root D:/x/assets    # 指定目录(生产运行时/备份目录)
 *   node scripts/check-xiaofang-assets.mjs --json                # 单行 JSON 结果,便于 CI 解析
 */

import { createHash } from 'node:crypto'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** 2026-11-26 修复版 GIF 的 sha256(唯一放行白名单值;B2 是给「同形但非逐字节」的合法重出留的路) */
export const WAVE_GIF_SHA256 = '5edadbd982954989a2863042aeb2962e5859d290f5c355809b944cd2e10cc371'
/** 成品体积下限(wave 两兄弟都在 1MB 量级;坏版 GIF 940,536 字节低于此线) */
export const MIN_WAVE_BYTES = 900 * 1024
const REQUIRED_PNG = ['xiaofang.png', 'xiaofang-face.png', 'xiaofang-lost.png']

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const isWebp = (buf) => buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP'
const isGif = (buf) => buf.length > 6 && buf.toString('ascii', 0, 6) === 'GIF89a'

/**
 * GIF 是否声明了真透明(扫 Graphic Control Extension:0x21 0xF9 0x04 <packed> <delay:2> <index> 0x00)。
 * packed 的 bit0 = transparent color flag。只做结构判定,不解码像素 —— 判据是「有没有透明通道」,
 * 不是「透明得好不好看」,后者由 alpha 审计(逐帧解码)负责。
 * @returns {{found:boolean, transparentBlockCount:number}}
 */
export function gifTransparencyBlocks(buf) {
  let found = false
  let transparentBlockCount = 0
  for (let i = 0; i + 7 < buf.length; i += 1) {
    if (buf[i] === 0x21 && buf[i + 1] === 0xf9 && buf[i + 2] === 0x04) {
      found = true
      if ((buf[i + 3] & 0x01) === 0x01) transparentBlockCount += 1
      i += 7
    }
  }
  return { found, transparentBlockCount }
}

/**
 * 校验一个资产目录。纯函数式:只读不写,便于测试直接 import。
 * @param {string} dir
 * @returns {{code:0|1|2, problems:string[], rows:object[]}}
 */
export function checkAssets(dir) {
  const problems = []
  const rows = []
  if (!existsSync(dir)) {
    return { code: 2, problems: [], rows: [{ file: dir, status: 'absent' }] }
  }
  const read = (name) => {
    const p = join(dir, name)
    if (!existsSync(p)) return null
    const buf = readFileSync(p)
    return { p, buf, bytes: statSync(p).size }
  }

  const webp = read('xiaofang-wave.webp')
  if (!webp) {
    problems.push('xiaofang-wave.webp 不在位(空态 wave 的唯一成品)')
  } else if (!isWebp(webp.buf)) {
    problems.push(`xiaofang-wave.webp 魔数不是 RIFF/WEBP(实得 ${JSON.stringify(webp.buf.toString('ascii', 0, 12))})`)
  } else if (webp.bytes < MIN_WAVE_BYTES) {
    problems.push(`xiaofang-wave.webp 仅 ${webp.bytes} 字节 < 下限 ${MIN_WAVE_BYTES}(疑似被压帧/降质)`)
  } else {
    rows.push({ file: 'xiaofang-wave.webp', bytes: webp.bytes, status: 'ok' })
  }

  const gif = read('xiaofang-wave.gif')
  if (!gif) {
    problems.push('xiaofang-wave.gif 不在位(兜底件缺失)')
  } else if (!isGif(gif.buf)) {
    problems.push('xiaofang-wave.gif 文件头不是 GIF89a')
  } else {
    const sha = sha256(gif.buf)
    const t = gifTransparencyBlocks(gif.buf)
    if (sha === WAVE_GIF_SHA256) {
      rows.push({ file: 'xiaofang-wave.gif', bytes: gif.bytes, sha256: sha.slice(0, 12), status: 'ok(白名单 sha256)' })
    } else if (gif.bytes >= MIN_WAVE_BYTES && t.transparentBlockCount > 0) {
      rows.push({
        file: 'xiaofang-wave.gif',
        bytes: gif.bytes,
        sha256: sha.slice(0, 12),
        status: `ok(结构判据:${t.transparentBlockCount} 个透明 GCE)`,
      })
    } else {
      problems.push(
        `xiaofang-wave.gif 既不命中白名单 sha256,也不满足结构判据(透明 GCE=${t.transparentBlockCount},${gif.bytes} 字节)—— 这一型就是 2026-11-26 的黑底压扁版`,
      )
      rows.push({ file: 'xiaofang-wave.gif', bytes: gif.bytes, sha256: sha.slice(0, 12), status: 'bad' })
    }
  }

  for (const name of REQUIRED_PNG) {
    const f = read(name)
    if (!f) problems.push(`${name} 不在位`)
    else if (f.bytes === 0) problems.push(`${name} 是空文件`)
    else rows.push({ file: name, bytes: f.bytes, status: 'ok' })
  }

  return { code: problems.length ? 1 : 0, problems, rows }
}

/** 从 argv 里取 --root / --json;取不到 --root 时用仓库默认相对路径 */
export function parseArgs(argv) {
  const out = { root: null, json: false }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') out.json = true
    else if (argv[i] === '--root' && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      out.root = argv[i + 1]
      i += 1
    }
  }
  return out
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const a = parseArgs(process.argv.slice(2))
  const dir = a.root ? resolve(a.root) : resolve(process.cwd(), 'apps/web/public/images/xiaofang-assets')
  const r = checkAssets(dir)
  if (a.json) {
    console.log(JSON.stringify({ dir, code: r.code, problems: r.problems, rows: r.rows }))
  } else {
    console.log(`[xiaofang-assets] 目录: ${dir}`)
    for (const row of r.rows) console.log(`  ${row.status.padEnd(26)} ${row.file} ${row.bytes ?? ''}`)
    for (const p of r.problems) console.log(`  ✗ ${p}`)
    if (r.code === 2) console.log('  [SKIP] 目录不在本工作树(外挂目录不入 git;净面/CI 属正常)')
    else if (r.code === 0) console.log('  ✅ 全部通过')
    else console.log(`  ❌ ${r.problems.length} 项缺陷`)
  }
  process.exit(r.code)
}
