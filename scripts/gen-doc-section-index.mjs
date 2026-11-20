#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-doc-section-index.mjs —— README.md / PROJECT_PLAN.md 章节可寻址索引生成器。
 *
 * 用途:
 *   这两份活文档体量巨大(百万字节级),任何 agent 不必整文件读原文,即可按本索引给出的
 *   行号区间定位到具体章节。索引是**可重生成的派生物**,原文才是真相源(§1);原文被改写后
 *   行号必然漂移,必须重跑本生成器刷新,不得手工改行号。
 *
 * 扫描口径:
 *   - 只认 ATX 标题(`#` ~ `######`);代码围栏(``` / ~~~)内部的 `#` 行不算标题;
 *   - 围栏按出现次序成对切换(同一围栏字符才算配对;info string 不影响切换)。说明:两份原文
 *     存在少量未闭合/漏写闭合符的围栏(既有 Markdown 缺陷,本票不改原文),严格 CommonMark
 *     口径会把其后大段散文标题误判进代码块;宽松成对切换以"保住真实章节"为先代价是个别
 *     shell 注释行被计入标题(可由标题形态识别,属原文缺陷的派生噪声);
 *   - 每个标题记录:层级、标题原文、起始行号、结束行号(到下一个同级或更高级标题之前)、行数;
 *   - 行号按物理行计(1 起),`Get-Content` / `sed` 口径一致;文件末尾换行不另占一行。
 *
 * 用法:
 *   node scripts/gen-doc-section-index.mjs --write   # 生成/刷新两件索引(写盘后紧随水印 inject+verify)
 *   node scripts/gen-doc-section-index.mjs --check   # 漂移校验:索引与当前原文不一致 ⇒ exit 1
 *   (无参数等同 --check;取不到原文 ⇒ exit 2 未判定,不冒绿也不冒红)
 *
 * 退出码:0 = 生成成功 / 校验通过;1 = 校验发现陈旧或缺失;2 = 未判定(原文读不到等)。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { injectText } from './watermark.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 被索引原文与派生索引件的固定映射(单一真相源,不接受 CLI 传路径)。 */
const TARGETS = [
  { src: 'README.md', out: 'docs/section-index/README-sections.md' },
  { src: 'PROJECT_PLAN.md', out: 'docs/section-index/PROJECT_PLAN-sections.md' },
]

const HEADING_RE = /^(#{1,6})[ \t]+(.+?)[ \t]*$/
const FENCE_RE = /^[ \t]{0,3}(```+|~~~+)/

/** 读取原文(字节数 + UTF-8 正文);读不到向上抛,由调用方落 exit 2 未判定。 */
function readSource(rel) {
  const abs = join(ROOT, rel)
  const buf = readFileSync(abs)
  return { bytes: buf.length, text: buf.toString('utf8') }
}

/**
 * 扫描标题。
 * @param {string} text 原文正文
 * @returns {{headings: Array<{level:number,title:string,start:number,end:number,count:number}>, totalLines:number}}
 */
function scanHeadings(text) {
  const raw = text.split(/\r?\n/)
  // 文件以换行结尾时 split 末尾留一枚空串,不占物理行号。
  const lines = raw.length > 0 && raw[raw.length - 1] === '' ? raw.slice(0, -1) : raw
  const headings = []
  let fence = null

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const fenceMatch = line.match(FENCE_RE)
    if (fenceMatch) {
      const tick = fenceMatch[1][0]
      if (!fence) {
        fence = tick
      } else if (fence === tick) {
        fence = null
      }
      // 不同围栏字符(``` 遇 ~~~)视为代码内容,不切换状态。
      continue
    }
    if (fence) continue

    const m = HEADING_RE.exec(line)
    if (!m) continue
    const level = m[1].length
    let title = m[2].trim()
    // 去掉 ATX 闭合序列(尾部 `#` 串,前面必须有空白);`#tag` 式中段标签保留。
    title = title.replace(/[ \t]+#+[ \t]*$/, '')
    headings.push({ level, title, start: i + 1 })
  }

  for (let k = 0; k < headings.length; k += 1) {
    const h = headings[k]
    let end = lines.length
    for (let j = k + 1; j < headings.length; j += 1) {
      if (headings[j].level <= h.level) {
        end = headings[j].start - 1
        break
      }
    }
    h.end = end
    h.count = end - h.start + 1
  }

  return { headings, totalLines: lines.length }
}

/** 渲染索引件裸正文(水印横幅/尾行由 injectText 在写盘链路与内存比对两处同形补齐)。 */
function renderIndex(target, stats) {
  const { headings, totalLines, bytes } = stats
  const src = target.src
  const out = []

  out.push(`# ${src} 章节可寻址索引`)
  out.push('')
  out.push('> **本索引是派生物,原文才是真相源。** 行号区间由生成器按当前原文扫描得出;')
  out.push('> 原文被改写后行号即漂移,必须重跑生成器刷新本索引,不得手工改行号。')
  out.push('')
  out.push('- 生成命令(重写本索引):`node scripts/gen-doc-section-index.mjs --write`')
  out.push('- 漂移校验(不一致 exit 1):`node scripts/gen-doc-section-index.mjs --check`')
  out.push(
    `- 被索引原文:\`${src}\`(${bytes.toLocaleString('en-US')} 字节 / ` +
      `${totalLines.toLocaleString('en-US')} 物理行 / ${headings.length} 个标题)`,
  )
  out.push('- 区间口径:标题行起,到下一个同级或更高级标题之前;行数 = 结束行 - 起始行 + 1。')
  out.push('- 围栏口径:``` / ~~~ 按出现次序成对切换;原文存在漏闭合围栏时,个别 shell 注释行可能被计入标题。')
  out.push('- 取用命令(区间 `Lstart-Lend`,在仓库根目录执行;每行已附 Bash 命令):')
  out.push(`  - Bash / Git Bash:\`sed -n '<Lstart>,<Lend>p' ${src}\``)
  out.push(
    `  - PowerShell:\`Get-Content ${src} | Select-Object -Skip <Lstart-1> -First <Lend-Lstart+1>\``,
  )
  out.push('')
  out.push('## 索引清单')
  out.push('')

  for (const h of headings) {
    const indent = '  '.repeat(h.level - 1)
    const cmd = `sed -n '${h.start},${h.end}p' ${src}`
    out.push(`${indent}- L${h.level} ${h.title} | ${h.start}-${h.end} (${h.count} 行) | \`${cmd}\``)
  }
  out.push('')

  return out.join('\n')
}

/** 裸正文 → 落盘形态(与 watermark.mjs inject 同一段构造;check 内存比对必须做同一变换)。 */
function applyWatermark(expected, rel) {
  return injectText(expected, { rel }).text
}

function scanTarget(target) {
  const { bytes, text } = readSource(target.src)
  return { ...scanHeadings(text), bytes }
}

function cmdWatermark(args, abs) {
  const wm = join(ROOT, 'scripts', 'watermark.mjs')
  execFileSync(process.execPath, [wm, ...args, abs], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function runWrite() {
  const results = []
  for (const target of TARGETS) {
    const stats = scanTarget(target)
    const expected = renderIndex(target, stats)
    const abs = join(ROOT, target.out)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, expected, 'utf8')
    // §5c:writeFileSync 后必须紧随注入(process.execPath + 绝对路径);再 verify 自查。
    cmdWatermark(['inject'], abs)
    cmdWatermark(['verify'], abs)
    results.push({ target, count: stats.headings.length, bytes: statSync(abs).size })
  }

  for (const r of results) {
    console.log(
      `✅ 已生成 ${r.target.out}:${r.count} 个标题 / ${r.bytes.toLocaleString('en-US')} 字节(水印 inject+verify 通过)`,
    )
  }
  const total = results.reduce((n, r) => n + r.bytes, 0)
  console.log(
    `✅ --write 完成:${results.length} 件索引,合计 ${total.toLocaleString('en-US')} 字节`,
  )
}

function runCheck() {
  const reports = []
  let stale = 0
  let missing = 0
  let unjudged = 0

  for (const target of TARGETS) {
    let stats
    try {
      stats = scanTarget(target)
    } catch (e) {
      unjudged += 1
      reports.push(`${'⚠️'} 未判定 ${target.out}:原文 ${target.src} 读不到(${String(e?.message ?? e).split('\n')[0]})`)
      continue
    }

    const expected = applyWatermark(renderIndex(target, stats), target.out)
    const abs = join(ROOT, target.out)
    if (!existsSync(abs)) {
      missing += 1
      reports.push(`❌ 产物缺失 ${target.out}(现算 ${stats.headings.length} 个标题)`)
      continue
    }

    const actual = readFileSync(abs, 'utf8')
    if (actual === expected) {
      reports.push(`✅ 新鲜 ${target.out}:${stats.headings.length} 个标题与当前原文一致`)
    } else {
      stale += 1
      reports.push(`❌ 陈旧 ${target.out}:索引与当前原文行号/标题不一致,需重跑 --write`)
    }
  }

  for (const line of reports) console.log(line)

  if (unjudged > 0) {
    console.log(`⚠️ --check 未判定:${unjudged} 件取不到输入(不冒绿也不冒红)`)
    process.exit(2)
  }
  if (stale > 0 || missing > 0) {
    console.log(`❌ --check 失败:${stale} 件陈旧 / ${missing} 件缺失`)
    process.exit(1)
  }
  console.log(`✅ --check 通过:${TARGETS.length} 件索引与当前原文一致`)
}

function main() {
  const arg = process.argv[2] ?? '--check'
  if (arg === '--write') {
    runWrite()
  } else if (arg === '--check') {
    runCheck()
  } else {
    console.error('用法: node scripts/gen-doc-section-index.mjs [--write|--check]')
    process.exit(2)
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
