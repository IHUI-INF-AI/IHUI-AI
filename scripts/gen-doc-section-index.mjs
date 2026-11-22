#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-doc-section-index.mjs —— README.md / PROJECT_PLAN.md 章节可寻址索引生成器。
 *
 * 用途:
 *   这两份活文档体量巨大(百万字节级),任何 agent 不必整文件读原文,即可按本索引给出的
 *   标题定位到具体章节。索引是**可重生成的派生物**,原文才是真相源(§1)。
 *
 * 判据口径(行号现算 + 结构判绿):
 *   - 两份原文每次提交都可能被生成块/数字块重写,标题**绝对行号必然漂移**,因此索引里的
 *     行区间只是生成时刻的**快照**;`--check` 只比对标题**结构**(层级 + 标题原文 + 出现顺序),
 *     不比绝对行号。标题未增删、未改序 ⇒ 绿;集合或顺序变了 ⇒ 红并逐条点名差异。
 *   - 现行号一律用 `--locate` 从当前原文现算,不要照抄快照区间。
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
 *   node scripts/gen-doc-section-index.mjs --write
 *       # 生成/刷新两件索引快照(写盘后紧随水印 inject+verify)
 *   node scripts/gen-doc-section-index.mjs --check
 *       # 结构校验:标题集合/顺序与当前原文不一致 ⇒ exit 1(不比行号)
 *   node scripts/gen-doc-section-index.mjs --locate --file README.md --title "<标题原文>"
 *       # 从当前原文现算该标题的 Lstart-Lend(行数),打印一行可取用的 sed 命令;
 *       # 标题不存在 ⇒ exit 2 点名"未找到";--file 支持 README.md / PROJECT_PLAN.md
 *   (无参数等同 --check;取不到原文 ⇒ exit 2 未判定,不冒绿也不冒红)
 *
 * 退出码:0 = 生成成功 / 校验通过 / 定位命中;1 = 校验发现结构陈旧或缺失;2 = 未判定或未找到。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 被索引原文与派生索引件的固定映射(单一真相源,不接受 CLI 传路径)。 */
const TARGETS = [
  { src: 'README.md', out: 'docs/section-index/README-sections.md' },
  { src: 'PROJECT_PLAN.md', out: 'docs/section-index/PROJECT_PLAN-sections.md' },
]

const HEADING_RE = /^(#{1,6})[ \t]+(.+?)[ \t]*$/
const FENCE_RE = /^[ \t]{0,3}(```+|~~~+)/
/** 索引正文行:标题组贪婪吃掉标题内可能出现的 `|`,后缀锚定快照区间与 sed 命令。 */
const ROW_RE =
  /^(\s*)- L(\d+) (.*) \| (\d+)-(\d+) \((\d+) 行\) \| `sed -n '(\d+),(\d+)p' ([^`]+)`$/

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

/** 解析索引正文已登记的标题行(层级/原文/快照行号);水印横幅与尾行不匹配,自然跳过。 */
function parseIndexRows(md) {
  const rows = []
  for (const line of md.split(/\r?\n/)) {
    const m = ROW_RE.exec(line)
    if (m) {
      rows.push({
        level: Number(m[2]),
        title: m[3],
        start: Number(m[4]),
        end: Number(m[5]),
        count: Number(m[6]),
      })
    }
  }
  return rows
}

/** 结构等价比对:层级 + 标题原文 + 出现顺序;不比行号快照。 */
function diffStructure(now, indexed) {
  const a = now.map((h) => ({ level: h.level, title: h.title }))
  const b = indexed.map((h) => ({ level: h.level, title: h.title }))
  const positional = []
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i += 1) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      positional.push({ at: i + 1, now: a[i], indexed: b[i] })
    }
  }
  const key = (r) => `${r.level}|${r.title}`
  const aKeys = a.map(key)
  const bKeys = b.map(key)
  const onlyNow = aKeys.filter((k) => !bKeys.includes(k))
  const onlyIndexed = bKeys.filter((k) => !aKeys.includes(k))
  return {
    positional,
    onlyNow,
    onlyIndexed,
    equal: positional.length === 0 && onlyNow.length === 0 && onlyIndexed.length === 0,
  }
}

/** 渲染索引件裸正文(水印横幅/尾行由写盘链路的 watermark.mjs inject 补齐)。 */
function renderIndex(target, stats) {
  const { headings, totalLines, bytes } = stats
  const src = target.src
  const out = []

  out.push(`# ${src} 章节可寻址索引`)
  out.push('')
  out.push('> **本索引是派生物,原文才是真相源。**')
  out.push(`> **行号是生成时刻的快照**:${src} 每次提交都可能被生成块/数字块重写,标题行号会整体漂移;`)
  out.push(`> 取现行号请用 \`node scripts/gen-doc-section-index.mjs --locate --file ${src} --title "<标题>"\` 现算,`)
  out.push('> 不要照抄本页快照区间。')
  out.push('> `--check` 判的是**标题结构**(层级 + 标题原文 + 出现顺序),不比绝对行号;标题未增删、未改序即绿。')
  out.push('')
  out.push('- 生成命令(重写本索引快照):`node scripts/gen-doc-section-index.mjs --write`')
  out.push('- 结构校验(标题集合/顺序不一致 exit 1):`node scripts/gen-doc-section-index.mjs --check`')
  out.push(`- 现行号现算:\`node scripts/gen-doc-section-index.mjs --locate --file ${src} --title "<标题原文>"\``)
  out.push(
    `- 快照时刻原文:\`${src}\`(${bytes.toLocaleString('en-US')} 字节 / ` +
      `${totalLines.toLocaleString('en-US')} 物理行 / ${headings.length} 个标题)`,
  )
  out.push('- 区间口径:标题行起,到下一个同级或更高级标题之前;行数 = 结束行 - 起始行 + 1。')
  out.push('- 围栏口径:``` / ~~~ 按出现次序成对切换;原文存在漏闭合围栏时,个别 shell 注释行可能被计入标题。')
  out.push('- 取用命令(快照区间 `Lstart-Lend`,在仓库根目录执行;现行号以 `--locate` 为准):')
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
      reports.push(
        `${'⚠️'} 未判定 ${target.out}:原文 ${target.src} 读不到(${String(e?.message ?? e).split('\n')[0]})`,
      )
      continue
    }

    const abs = join(ROOT, target.out)
    if (!existsSync(abs)) {
      missing += 1
      reports.push(`❌ 产物缺失 ${target.out}(现算 ${stats.headings.length} 个标题)`)
      continue
    }

    const indexed = parseIndexRows(readFileSync(abs, 'utf8'))
    if (indexed.length === 0) {
      stale += 1
      reports.push(`❌ 陈旧 ${target.out}:索引行格式无法解析(0 枚标题行),需重跑 --write`)
      continue
    }

    const diff = diffStructure(stats.headings, indexed)
    if (diff.equal) {
      reports.push(
        `✅ 结构新鲜 ${target.out}:${stats.headings.length} 枚标题(层级+原文+顺序)与当前原文一致;` +
          `行号为快照,现行号用 --locate`,
      )
    } else {
      stale += 1
      reports.push(
        `❌ 陈旧 ${target.out}:标题结构与当前原文不一致(现算 ${stats.headings.length} / 索引 ${indexed.length})`,
      )
      for (const d of diff.positional.slice(0, 10)) {
        reports.push(`   位置 ${d.at}: 索引 ${JSON.stringify(d.indexed)} ≠ 现算 ${JSON.stringify(d.now)}`)
      }
      for (const k of diff.onlyIndexed.slice(0, 10)) reports.push(`   索引多出: ${k}`)
      for (const k of diff.onlyNow.slice(0, 10)) reports.push(`   现算多出: ${k}`)
    }
  }

  for (const line of reports) console.log(line)

  if (unjudged > 0) {
    console.log(`⚠️ --check 未判定:${unjudged} 件取不到输入(不冒绿也不冒红)`)
    process.exit(2)
  }
  if (stale > 0 || missing > 0) {
    console.log(`❌ --check 失败:${stale} 件结构陈旧 / ${missing} 件缺失`)
    process.exit(1)
  }
  console.log(`✅ --check 通过:${TARGETS.length} 件索引标题结构与当前原文一致(行号快照不参与判绿)`)
}

function argValue(args, flag) {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

function runLocate(args) {
  const file = argValue(args, '--file')
  const title = argValue(args, '--title')
  if (!file || !title) {
    console.error('用法: node scripts/gen-doc-section-index.mjs --locate --file <README.md|PROJECT_PLAN.md> --title "<标题原文>"')
    process.exit(2)
  }
  const target = TARGETS.find((t) => t.src === file)
  if (!target) {
    console.error(`❌ --file 仅支持:${TARGETS.map((t) => t.src).join(' / ')};收到:${file}`)
    process.exit(2)
  }

  let stats
  try {
    stats = scanTarget(target)
  } catch (e) {
    console.error(`⚠️ 未判定:原文 ${file} 读不到(${String(e?.message ?? e).split('\n')[0]})`)
    process.exit(2)
  }

  const hits = stats.headings.filter((h) => h.title === title)
  if (hits.length === 0) {
    console.error(`❌ 未找到标题:${JSON.stringify(title)}(file=${file})`)
    process.exit(2)
  }
  const h = hits[0]
  const cmd = `sed -n '${h.start},${h.end}p' ${file}`
  const suffix = hits.length > 1 ? ` · 同名 ${hits.length} 枚,取第 1 枚` : ''
  console.log(`✅ 命中 ${file} L${h.start}-L${h.end} (${h.count} 行)${suffix} · \`${cmd}\``)
}

function main() {
  const args = process.argv.slice(2)
  const cmd = args[0] ?? '--check'
  if (cmd === '--write') {
    runWrite()
  } else if (cmd === '--check') {
    runCheck()
  } else if (cmd === '--locate') {
    runLocate(args.slice(1))
  } else {
    console.error('用法: node scripts/gen-doc-section-index.mjs [--write|--check|--locate --file <src> --title <标题>]')
    process.exit(2)
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
