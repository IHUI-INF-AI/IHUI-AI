#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 常驻取证工具(2026-09-29 由票 D157 从 docs/benchmark-evidence/2026-09/asar-read.mjs 升为 scripts/ 常驻)。
// 从 Electron asar 里按路径读文件、列清单、正则捞内容。全程只读:不写竞品目录,也不把包体复制进仓库。
//
// 用法:
//   node scripts/benchmark-asar-read.mjs <app.asar> --list [路径正则]
//   node scripts/benchmark-asar-read.mjs <app.asar> --get /package.json
//   node scripts/benchmark-asar-read.mjs <app.asar> --grep <内容正则>   (ASAR_FILES_ONLY=1 只列文件名)
//   node scripts/benchmark-asar-read.mjs --self-test
//   node scripts/benchmark-asar-read.mjs --help
//
// 头格式(与 asar 官方一致):前 8 字节是 pickle 前言,第 4..7 字节给 header 块大小;
// header JSON 起于偏移 16(其前有 pickle 长度/标志位),数据区起于 8 + headerSize。
// 用错 offset 的表现不是报错而是"读出无关字节" —— docs 版第一版就把 /package.json 读成了别的东西,
// 靠 JSON.parse 才现形。所以本器自检的第一批断言是"读回来的字节确实能 parse 成预期的树"。
//
// 为什么从证据目录搬进 scripts/:它此前躺在文档目录里**没有自检**,解析器坏了没人喊
// (本仓反复登记的"造好没装车 / 有代码无尺子"那一型)。现在的三把尺子:
//   ① 自检入口 --self-test:合成一份真形态 asar 夹具,断言"量得到东西"(不接受恒 0);
//   ② §22c 镜像测试 scripts/tests/benchmark-evidence-tools.test.mjs:除端到端 spawn 外,另有一把
//      **独立**尺子(在原始字节里 indexOf 定位植入内容)复核本器自报的数据区起点 —— 防"构建器与
//      解析器同时写歪而自检照绿"(§22c"镜像测试只复读实现就是复读机");
//   ③ §22d 的 isDirectRun:CLI 入口与模块导出分离,测试 import 本文件不得触发 main()。
// 刻意不接提交链:它判的是**仓库外的竞品包体**,与提交内容无关 ⇒ 接进链就是一台恒红门(AGENTS §12e)。
// 文件名不以 check|scan|guard 开头 ⇒ 守门 89(check-gate-wiring)结构上看不见它;它的不变量由上面
// 那两把尺子钉,而不是靠"接了门"。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const USAGE =
  '用法: benchmark-asar-read.mjs <asar> --list [re] | --get <path> | --grep <re> | --self-test | --help'

/**
 * 读 asar 头(解析判据逐字继承自 docs 版,一个字符没改)。
 * 返回 header 块大小、目录树、数据区起点。
 */
function readAsarHeader(fd) {
  const pre = Buffer.alloc(8)
  fs.readSync(fd, pre, 0, 8, 0)
  const headerSize = pre.readUInt32LE(4)
  const hb = Buffer.alloc(headerSize)
  fs.readSync(fd, hb, 0, headerSize, 8)
  const strLen = hb.readUInt32LE(0)
  const tree = JSON.parse(
    hb
      .subarray(8, 8 + strLen)
      .toString('utf8')
      .replace(/\0+$/, ''),
  )
  const DATA_START = 8 + headerSize
  return { headerSize, tree, DATA_START }
}

function flatten(node, prefix, acc) {
  for (const [k, v] of Object.entries(node.files || {})) {
    const fp = prefix + '/' + k
    if (v && v.files) flatten(v, fp, acc)
    // 逐字继承 docs 版的 `v.size != null`;这里写成两判是因为 eqeqeq 在本仓 eslint 配置里是
    // **error**,而 scripts/ 下的文件会被 lint-staged 跑 eslint(lint 红 ⇒ 提交被逼 --no-verify,
    // 连带废掉全部守门,AGENTS §12e)。语义与 `!= null` 等价:排除 undefined 与 null,其余都算。
    else if (v && v.size !== undefined && v.size !== null)
      acc.push({
        path: fp,
        size: Number(v.size),
        offset: Number(v.offset),
        unpacked: !!v.unpacked,
      })
  }
  return acc
}

function readEntry(fd, ASAR, DATA_START, f) {
  if (f.unpacked) {
    const p = path.join(path.dirname(ASAR), path.basename(ASAR, '.asar') + '.unpacked', f.path)
    return fs.readFileSync(p)
  }
  const buf = Buffer.alloc(f.size)
  fs.readSync(fd, buf, 0, f.size, DATA_START + f.offset)
  return buf
}

function openAsar(ASAR) {
  const fd = fs.openSync(ASAR, 'r')
  const { headerSize, tree, DATA_START } = readAsarHeader(fd)
  const all = flatten(tree, '', [])
  return { fd, ASAR, headerSize, tree, DATA_START, all }
}

/** --grep 的候选面:文本型扩展名 + 非空 + 单文件大小闸(那条 filter 逐字继承,只是提成了函数)。 */
function grepTargets(all) {
  return all.filter(
    (f) =>
      f.size > 0 &&
      f.size < 120 * 1024 * 1024 &&
      /\.(js|cjs|mjs|json|css|html|properties|yaml|yml|md)$/i.test(f.path),
  )
}

/**
 * 合成 asar 夹具构建器 —— **只服务自检与镜像测试,它不是判据**。
 * 落盘形态严格按文件头注记载的头格式:
 *   [0..3] uint32 pickle 前言 / [4..7] uint32 header 块大小
 *   header 块 = [uint32 JSON 字节数][uint32 0][JSON 字节][\0 补齐到 4 字节对齐]
 *   数据区 = 从 8 + headerSize 起,按清单顺序紧密拼接(unpacked 条目不占数据区)
 * 为什么允许它存在:没有夹具就只能拿 373MB 竞品包体做断言,而那个尺寸既进不了仓库也不该进。
 * 为什么它不构成自证:构建器与解析器的共识由镜像测试的独立尺子(raw.indexOf(植入内容) ===
 * DATA_START + entry.offset)以及本器自检的"文件总字节数 === 数据区起点 + 数据区总长"两把
 * 物理量尺复核 —— 两者都只读字节,不调用解析判据。
 */
export function buildAsarFixture(file, entries) {
  const root = { files: {} }
  const data = []
  let offset = 0
  for (const e of entries) {
    const segs = e.path.replace(/^\/+/, '').split('/')
    let node = root
    for (const seg of segs.slice(0, -1)) {
      node.files[seg] = node.files[seg] || { files: {} }
      node = node.files[seg]
    }
    // leaf:原样塞进清单的叶子对象(给"size 判据三态"这类对照用)—— 不占数据区、不算内容。
    if (e.leaf) {
      node.files[segs[segs.length - 1]] = e.leaf
      continue
    }
    const buf = Buffer.isBuffer(e.content) ? e.content : Buffer.from(String(e.content), 'utf8')
    const leaf = { size: buf.length, offset }
    if (e.unpacked) leaf.unpacked = true
    else {
      data.push(buf)
      offset += buf.length
    }
    node.files[segs[segs.length - 1]] = leaf
  }
  const json = Buffer.from(JSON.stringify(root), 'utf8')
  const pad = (4 - ((8 + json.length) % 4)) % 4
  const hb = Buffer.alloc(8 + json.length + pad)
  hb.writeUInt32LE(json.length, 0)
  json.copy(hb, 8)
  const pre = Buffer.alloc(8)
  pre.writeUInt32LE(4, 0)
  pre.writeUInt32LE(hb.length, 4)
  fs.writeFileSync(file, Buffer.concat([pre, hb, ...data]))
  return { headerSize: hb.length, jsonLength: json.length, padding: pad, dataStart: 8 + hb.length }
}

const FIXTURE = {
  packageJson: '{"name":"fixture-app","version":"9.9.9","marker":"ALPHA-MARKER"}',
  renderer: 'const ihuiSelfTest = "BRAVO-MARKER";\nexport default ihuiSelfTest\n',
  emptyFile: '',
  unpackedYaml: 'tabSelected: "#a3c4d6"\n',
}

/**
 * 自检(2026-09-29 补,docs 版原本没有 --self-test):造一份真形态合成夹具,把解析判据喂到底。
 * 覆盖:头解析 / flatten 递归 / 数据区起点(含"经典 off-by-8"反向对照)/ unpacked 分支 /
 * 尾部 \0 剥离 / grepTargets 的 size>0 闸。
 * 未覆盖(如实登记):--grep 的控制字符判别与打印形态由镜像测试的端到端 spawn 钉,不在本自检里。
 */
function runSelfTest() {
  const dir = mkScratch('benchmark-asar-selftest')
  const failures = []
  let pass = 0
  const eq = (name, actual, expected) => {
    if (actual !== expected)
      throw new Error(`${name}: 期望 ${JSON.stringify(expected)},实得 ${JSON.stringify(actual)}`)
  }
  const ok = (name, fn) => {
    try {
      fn()
      pass++
      console.log(`  ✅ ${name}`)
    } catch (e) {
      failures.push(name)
      console.log(`  ❌ ${name} :: ${(e && e.message) || String(e)}`)
    }
  }
  console.log('# asar-read 自检(合成夹具,零副作用越出 scratch 目录)')
  let opened = null
  try {
    const asar = path.join(dir, 'fixture.asar')
    const built = buildAsarFixture(asar, [
      { path: '/package.json', content: FIXTURE.packageJson },
      { path: '/out/renderer/index.js', content: FIXTURE.renderer },
      { path: '/empty.md', content: FIXTURE.emptyFile },
      { path: '/loose/config.yaml', content: FIXTURE.unpackedYaml, unpacked: true },
    ])
    fs.mkdirSync(path.join(dir, 'fixture.unpacked', 'loose'), { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'fixture.unpacked', 'loose', 'config.yaml'),
      FIXTURE.unpackedYaml,
    )

    ok('夹具触发尾部 NUL 补齐(不触发就没有喂到 NUL 剥离判据)', () => {
      if (!(built.padding > 0))
        throw new Error(
          `本次 padding=${built.padding} —— 调整 FIXTURE 内容长度让 header 块非 4 字节对齐,否则 NUL 剥离这一格无判据`,
        )
    })

    opened = openAsar(asar)
    const { fd, headerSize, DATA_START, all, tree } = opened
    const raw = fs.readFileSync(asar)

    ok('树解析成功且文件总字节 = 数据区起点 + 数据区长(物理量对账)', () => {
      const dataLen = Buffer.byteLength(FIXTURE.packageJson) + Buffer.byteLength(FIXTURE.renderer)
      eq('DATA_START', DATA_START, 8 + headerSize)
      eq('清单条目数', all.length, 4)
      eq('文件总字节', raw.length, DATA_START + dataLen)
      eq('树根有 files', typeof tree.files === 'object' && !Array.isArray(tree.files), true)
    })

    ok('flatten 递归目录前缀逐字带斜杠', () => {
      const paths = all.map((f) => f.path).sort()
      eq(
        '路径集合',
        JSON.stringify(paths),
        JSON.stringify([
          '/empty.md',
          '/loose/config.yaml',
          '/out/renderer/index.js',
          '/package.json',
        ]),
      )
    })

    ok('--get /package.json 读回的字节能 parse 成预期对象(读歪 offset 时这里必炸)', () => {
      const f = all.find((x) => x.path === '/package.json')
      const obj = JSON.parse(readEntry(fd, asar, DATA_START, f).toString('utf8'))
      eq('name', obj.name, 'fixture-app')
      eq('marker', obj.marker, 'ALPHA-MARKER')
    })

    ok(
      '数据区起点独立复核:indexOf(植入内容) === DATA_START + offset,且 !== headerSize + offset',
      () => {
        const f = all.find((x) => x.path === '/out/renderer/index.js')
        const at = raw.indexOf(FIXTURE.renderer)
        if (at < 0) throw new Error('夹具里没有植入内容(构建器坏了)')
        eq('独立定位', at, DATA_START + f.offset)
        if (at === headerSize + f.offset)
          throw new Error('off-by-8 反证失效:headerSize 与 DATA_START 撞成同一位置,夹具没区分开')
      },
    )

    ok('unpacked 分支从同名 .unpacked 目录取字节(不看 offset)', () => {
      const f = all.find((x) => x.path === '/loose/config.yaml')
      eq('unpacked 标记', f.unpacked, true)
      eq('取回内容', readEntry(fd, asar, DATA_START, f).toString('utf8'), FIXTURE.unpackedYaml)
    })

    ok('grepTargets 排除 size=0 条目、保留文本型非空条目', () => {
      const t = grepTargets(all).map((f) => f.path)
      eq('候选数', t.length, 3)
      eq('空文件未被当候选', t.includes('/empty.md'), false)
      eq('文本型 json 条目在候选面', t.includes('/package.json'), true)
      eq('文本型 js 条目在候选面', t.includes('/out/renderer/index.js'), true)
    })
    ok('size 判据三态:0 / false / 空串都算条目,null 与字段缺席都不算', () => {
      // 这一格专供"搬家时把 != null 改成两判"的等价性取证:写成 if (v.size) 会漏掉 0/false/''
      // 三种值(清单条目凭空少 3 条),写成只判 undefined 会把 null 收进来(多 1 条)。
      const odd = path.join(dir, 'odd.asar')
      buildAsarFixture(odd, [
        { path: '/f/ZERO.md', leaf: { size: 0, offset: 0 } },
        { path: '/f/FALSE.md', leaf: { size: false, offset: 0 } },
        { path: '/f/EMPTY.md', leaf: { size: '', offset: 0 } },
        { path: '/f/NULL.md', leaf: { size: null, offset: 0 } },
        { path: '/f/ABSENT.md', leaf: { offset: 7 } },
      ])
      const o = openAsar(odd)
      try {
        const got = o.all.map((f) => f.path).sort()
        eq(
          '被列进清单的叶子',
          JSON.stringify(got),
          JSON.stringify(['/f/EMPTY.md', '/f/FALSE.md', '/f/ZERO.md']),
        )
        eq('size:0 读回的数字', o.all.find((f) => f.path === '/f/ZERO.md').size, 0)
      } finally {
        fs.closeSync(o.fd)
      }
    })
  } finally {
    // fd 必须在 rmScratch 之前关掉:Windows 上句柄未释放时目录删不掉,夹具会赖在 Temp 里。
    if (opened) fs.closeSync(opened.fd)
    rmScratch(dir)
  }
  const total = pass + failures.length
  console.log(
    `# 自检 ${total} 条,通过 ${pass},失败 ${failures.length}${failures.length ? ': ' + failures.join(' | ') : ''}`,
  )
  return failures.length ? 1 : 0
}

async function main() {
  if (process.argv[2] === '--help') {
    console.log(USAGE)
    return
  }
  if (process.argv[2] === '--self-test') {
    process.exit(runSelfTest())
  }
  const [, , ASAR, MODE, ...REST] = process.argv
  if (!ASAR || !MODE) {
    console.error(USAGE)
    process.exit(2)
  }
  const { fd, DATA_START, all } = openAsar(ASAR)

  if (MODE === '--list') {
    const re = REST[0] ? new RegExp(REST[0], 'i') : null
    const hit = all.filter((f) => !re || re.test(f.path))
    const lim = Number(process.env.ASAR_LIMIT || 400)
    for (const f of hit.slice(0, lim))
      console.log(`${(f.size / 1024).toFixed(0)}K\t${f.unpacked ? 'U' : ' '}\t${f.path}`)
    console.log(`# 命中 ${hit.length} / 总 ${all.length} (打印前 ${Math.min(lim, hit.length)})`)
  } else if (MODE === '--get') {
    const f = all.find((x) => x.path === REST[0])
    if (!f) {
      console.error(`# 不在清单里: ${REST[0]}`)
      process.exit(1)
    }
    process.stdout.write(readEntry(fd, ASAR, DATA_START, f))
  } else if (MODE === '--grep') {
    const re = new RegExp(REST[0], 'g')
    const max = Number(process.env.ASAR_MAX || 80)
    const cands = grepTargets(all)
    let printed = 0
    for (const f of cands) {
      let buf
      try {
        buf = readEntry(fd, ASAR, DATA_START, f)
      } catch {
        continue
      }
      const text = buf.toString('utf8')
      // 文本型判据:控制字符比例过高就跳过(二进制/minified wasm 等)
      let ctl = 0
      for (let i = 0; i < Math.min(buf.length, 4096); i++) if (buf[i] < 9) ctl++
      if (ctl > 40) continue
      const hits = text.match(re)
      if (!hits || !hits.length) continue
      const uniq = [...new Set(hits)].slice(0, 12)
      console.log(`\n[${uniq.length}/${hits.length}] ${f.path}`)
      if (process.env.ASAR_FILES_ONLY !== '1')
        for (const u of uniq) console.log('   ', u.slice(0, 160))
      if (++printed >= max) {
        console.log(`# 达到 ${max} 文件上限,停`)
        break
      }
    }
    console.log(`\n# 扫了 ${cands.length} 个文本型条目,命中 ${printed} 个文件`)
  } else {
    console.error('未知模式 ' + MODE)
    process.exit(2)
  }
  fs.closeSync(fd)
}

// §22d:CLI 入口与模块导出双形态分离。被 import 时不得触发 main(),否则测试一 import 就跑去
// 读 process.argv 并 process.exit,把 node --test 的进程直接打死。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  USAGE,
  readAsarHeader,
  flatten,
  readEntry,
  openAsar,
  grepTargets,
  buildAsarFixture,
  FIXTURE,
  runSelfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
