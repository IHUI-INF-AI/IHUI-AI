// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/run-script-tests.mjs
//
// 把 scripts/tests/*.test.mjs **全量**跑起来的一个入口。
//
// 为什么要它(2026-09-24 立):这个仓的守门链有 100+ 道门,几乎每道门都配了镜像测试
// (`node --test scripts/tests/<门>.test.mjs` 就写在 AGENTS/README 的"取证"一栏里),
// 但**没有任何入口把它们一起跑** —— CI 只逐名点了几个文件(现读:`grep -rho "scripts/tests/[^ ]*\.test\.mjs" .github/workflows/ | sort -u | wc -l`,2026-10-16 = 8 个),
// 而 `scripts/tests/` 的规模以 `--list` 末行为准(同日现读共 499 个;这里不钉数字,§0.1 凡数字现读)。
// 后果是判据改了、镜像测试红了也无人知晓(全量首跑就抓到 2 枚稳定红,而它们红在 origin/main 上)。
// 这是"造好没装车"的第三形态:测试写好了,却没有跑测试的人。
//
// 反假绿三条(与守门 70/78/80 同取向):
//  ① 一个测试文件都没发现 → exit 1(目录漂移 / 过滤后为空都不等于"全过");
//  ② TAP 输出解析不到 `# pass` 与 `# fail` → 按失败计(runner 崩了 ≠ 测试过了);
//  ③ 任一片失败 → 汇总后 exit 1,末尾给出可逐条复现的命令。
//
// 用法:
//   node scripts/run-script-tests.mjs                 # 全量
//   node scripts/run-script-tests.mjs -- push-sync    # 只跑文件名含该子串的
//   node scripts/run-script-tests.mjs --list          # 只列清单
//   node scripts/run-script-tests.mjs --serial        # 一片一文件(排查相互干扰)
//   node scripts/run-script-tests.mjs --json          # 末尾追加机器可读汇总
import { spawnSync } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const TEST_DIR_REL = join('scripts', 'tests')
/**
 * deploy\tests 也是同一性质(部署链行为验证,harness 包装成 .test.mjs),2026-10-21 起并入发现面。
 * 立因(现读,不是推测):这批 .test.mjs 此前**没有任何 runner 跑** —— CI 只逐名点 8 个
 * scripts/tests 文件、`--test scripts/tests` 只扫一个目录 ⇒ alert-stall-dedup-harness 里那条
 * 9c 从"有人往两个参数之间插进 -Detail"那天起一直红,而它报的"Fail 未标记"根本没人看见;
 * 同目录 71 条用例里还躺着一枚真红(deploy-online.ps1 的第二份根解析)。测试写了不跑 = 没写。
 */
export const TEST_DIRS_REL = [TEST_DIR_REL, join('deploy', 'tests')]

/** 发现测试文件(绝对路径)。`filters` 为文件名子串白名单,空数组=全量。 */
export function discover(rootDir = ROOT, filters = []) {
  let files = []
  for (const rel of TEST_DIRS_REL) {
    const dir = join(rootDir, rel)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.test.mjs')) files.push(join(dir, f))
    }
  }
  files.sort()
  if (filters.length) files = files.filter((f) => filters.some((k) => f.includes(k)))
  return files
}

/**
 * 按累计字符数切片:Windows 命令行有长度上限,一条超长命令会 ENAMETOOLONG 后**静默少跑一批**。
 * 宁多跑几片也不丢文件 —— 只在"超限且已有内容"时才切。
 */
export function buildChunks(files, limit = 6000, serial = false) {
  if (serial) return files.map((f) => [f])
  const chunks = []
  let cur = []
  let len = 0
  for (const f of files) {
    if (len + f.length > limit && cur.length) {
      chunks.push(cur)
      cur = []
      len = 0
    }
    cur.push(f)
    len += f.length + 1
  }
  if (cur.length) chunks.push(cur)
  return chunks
}

/**
 * 解析一片的 TAP 汇总。`parsed:false` 表示**计数缺失** —— 绝不能当成"没有失败"。
 */
export function parseTap(stdout) {
  const out = String(stdout || '')
  const grab = (key) => {
    const m = out.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))
    return m ? Number(m[1]) : null
  }
  const pass = grab('pass')
  const fail = grab('fail')
  if (pass === null && fail === null) return { parsed: false, notOk: [] }
  return {
    parsed: true,
    tests: grab('tests') ?? 0,
    pass,
    fail,
    skipped: grab('skip') ?? 0,
    cancelled: grab('cancelled') ?? 0,
    notOk: collectFailures(out.split('\n')),
  }
}

/**
 * 每条失败带一句"为什么"。原先只留用例名 ⇒ CI 上看到"红 13 条"却读不到任何断言原文,
 * 排查只能靠猜(2026-10-21 实测:13 枚同名失败,日志里没有一个字能说明它们为什么红)。
 * TAP 的 `not ok` 之后跟着缩进诊断行,取前 3 条关键行(error/code/expected/actual/stack/message)。
 * 方向与 §0.3 一致:拿不到诊断就留空,不编。
 */
export function collectFailures(lines) {
  const KEY = /^\s+(error|code|expected|actual|stack|message):\s*(.*)$/
  const out = []
  let cur = null
  const flush = () => {
    if (cur) out.push({ name: cur.name, why: cur.why.join(' | ').slice(0, 400) })
    cur = null
  }
  for (const raw of lines) {
    const line = String(raw).replace(/\r$/, '')
    if (line.startsWith('not ok ')) {
      flush()
      cur = { name: line.replace(/^not ok \d+ - /, '').trim(), why: [] }
      continue
    }
    if (line.startsWith('ok ') || line.startsWith('# Subtest:')) {
      flush()
      continue
    }
    if (!cur) continue
    const m = KEY.exec(line)
    if (m && cur.why.length < 3) cur.why.push(`${m[1]}=${m[2].slice(0, 160)}`.trim())
  }
  flush()
  return out
}

/** 跑一片(一个 `node --test` 子进程)。 */
export function runChunk(files) {
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 28,
    // 剥掉 NODE_TEST_CONTEXT:被别的 runner 调起时它会继承下来,嵌套的 `node --test`
    // 就不再正常输出 TAP 计数(实测镜像测试里调 main() 时一片明明全过却拿不到计数)。
    // 本工具的正常用法是 CLI(该变量本就不存在),这里只是让它**可被测试**。
    env: (() => {
      const e = { ...process.env }
      delete e.NODE_TEST_CONTEXT
      return e
    })(),
  })
  return parseTap(r.stdout)
}

/**
 * `rootDir` 是**测试专用注入口**(默认仍是真仓 ROOT):反假绿两条性质("发现 0 ⇒ 判红"、
 * "计数缺失 ⇒ 判红")必须在隔离目录里用真假测试文件端到端取证,又不能往真仓 `scripts/tests/`
 * 里丢临时文件(§25;且并发会话的一次 `add -A` 会把它当成正式测试收走)。
 */
export function main(argv = process.argv.slice(2), rootDir = ROOT) {
  const LIST = argv.includes('--list')
  const JSON_OUT = argv.includes('--json')
  const SERIAL = argv.includes('--serial')
  const sep = argv.indexOf('--')
  const filters = (sep >= 0 ? argv.slice(sep + 1) : []).filter((a) => !a.startsWith('--'))
  const files = discover(rootDir, filters)

  if (LIST) {
    for (const f of files)
      console.log(
        f
          .slice(rootDir.length + 1)
          .split('\\')
          .join('/'),
      )
    console.log(`共 ${files.length} 个`)
    return files.length ? 0 : 1
  }
  if (!files.length) {
    console.log(
      `❌ 没发现任何测试文件(${TEST_DIRS_REL.map((rel) => join(rootDir, rel)).join(' + ')}${filters.length ? ' / -- 过滤后为空' : ''})`,
    )
    return 1
  }
  const chunks = buildChunks(files, 6000, SERIAL)
  const tally = { tests: 0, pass: 0, fail: 0, skipped: 0, cancelled: 0 }
  const failures = []
  const unparsed = []
  chunks.forEach((chunk, i) => {
    const p = runChunk(chunk)
    if (!p.parsed) {
      unparsed.push({ chunk: i + 1, files: chunk.length })
      return
    }
    tally.tests += p.tests
    tally.pass += p.pass
    tally.fail += p.fail
    tally.skipped += p.skipped
    tally.cancelled += p.cancelled
    // collectFailures 返回的是 {name, why};这里必须逐字段取出 —— 直接把对象塞进 name
    // 会让清单打成 `[object Object]`(2026-10-21 实测:CI 日志 100 条全成这个,等于把失败名
    // 整个丢了,比改之前更糟)。
    for (const n of p.notOk) failures.push({ chunk: i + 1, name: n.name, why: n.why })
    console.log(
      `  片 ${i + 1}/${chunks.length}: ${chunk.length} 文件 → pass ${p.pass} / fail ${p.fail}`,
    )
  })
  console.log(
    `文件 ${files.length} 个 / ${chunks.length} 片 ⇒ 用例 ${tally.tests},pass ${tally.pass},fail ${tally.fail},skip ${tally.skipped},cancelled ${tally.cancelled}`,
  )
  if (unparsed.length) {
    console.log(`⚠️ ${unparsed.length} 片解析不到 pass/fail 计数(runner 未真正完成,按失败计):`)
    for (const u of unparsed) console.log(`   片 ${u.chunk}(${u.files} 文件)`)
  }
  if (failures.length) {
    console.log(`❌ 失败用例 ${failures.length} 条:`)
    for (const x of failures.slice(0, 40)) {
      console.log(`   [片${x.chunk}] ${x.name}`)
      if (x.why) console.log(`         ↳ ${x.why}`)
    }
    if (failures.length > 40) console.log(`   …另 ${failures.length - 40} 条`)
    console.log('单独复现:node --test scripts/tests/<文件>.test.mjs')
  } else if (!unparsed.length) {
    console.log('✅ 全量镜像测试绿')
  }
  if (JSON_OUT) {
    console.log(
      JSON.stringify({
        files: files.length,
        chunks: chunks.length,
        ...tally,
        red: failures.length + unparsed.length,
      }),
    )
  }
  return failures.length + unparsed.length ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e && e.message ? e.message : e}`)
    process.exit(2)
  }
}

export const __test__ = {
  discover,
  buildChunks,
  parseTap,
  runChunk,
  main,
  ROOT,
  TEST_DIR_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
