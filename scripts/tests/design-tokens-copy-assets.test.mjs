// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// copy-assets 的回归锁 —— `packages/design-tokens` 此前**零测试面**(package.json 没有 test
// 脚本),所以这个构建资源复制器唯一的真实防线("原字节"与"缺源必拦")只存在于头注散文里。
// 本文件放在 `scripts/tests/`(§22c 镜像测试的规范落点)而不是包内,理由是架构契约表
// `config/architecture-policy.yaml`:包 → repo-tooling 是**反向依赖**(D2 判红,实测过一次),而
// repo-tooling → design-tokens 已在 requires 里声明。放在包内就只能各自抄一份临时目录逻辑,
// 那正是本仓记过多次的"两处算同一件事必然漂移"。
//
// 三条失败判据各配"注入即红 / 还原即绿"的对照 —— 演练只能证明"会红",能翻红又能翻绿才叫有牙。
// 全部判据打在**真实现**上(import `__test__` 出口),测试里没有第二份实现。

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch } from '../lib/scratch-dir.mjs'
import { __test__ as ca } from '../../packages/design-tokens/scripts/copy-assets.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SUBJECT = join(REPO, 'packages', 'design-tokens', 'scripts', 'copy-assets.mjs')
const REAL_SRC = join(REPO, 'packages', 'design-tokens', 'src')
const REAL_DIST = join(REPO, 'packages', 'design-tokens', 'dist')

/**
 * tsc 的 include 只覆盖 src 下的 .ts 源码 ⇒ "复制器必须负责哪些文件"有机器可算的定义,
 * 不靠手工清单。(刻意不写出 glob 原文:块注释里出现闭合符会提前关掉注释,而解析器报的
 * 语法错落在文件末尾 —— 症状与病因隔了一百多行,本票真实踩过。)
 */
function filesTscWillNotEmit(dir, base = dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...filesTscWillNotEmit(abs, base))
    // .d.ts 是编译**输入**而非产出,所以它仍须由复制器搬运。
    else if (!(entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')))
      out.push(relative(base, abs).split(sep).join('/'))
  }
  return out.sort()
}

/** 递归 "路径:字节数" 快照,用于幂等对照。 */
function snapshotTree(dir) {
  if (!existsSync(dir)) return '<absent>'
  const rows = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, e.name)
      if (e.isDirectory()) walk(abs)
      else rows.push(`${relative(dir, abs).split(sep).join('/')}:${readFileSync(abs).byteLength}`)
    }
  }
  walk(dir)
  return rows.sort().join('|')
}

const sameBytes = (a, b) => readFileSync(a).compare(readFileSync(b)) === 0

/**
 * 换掉 console 的一个方法、跑 fn、把听到的行交回来。
 * 为什么不只看退出码:"码为 1 但喊错了原因"与"根本没喊"在报告上长得一样,
 * 而这三条判据的**点名**本身就是交付物。
 */
function heard(which, fn) {
  const original = console[which]
  const lines = []
  console[which] = (...args) => lines.push(args.join(' '))
  try {
    return { value: fn(), lines }
  } finally {
    console[which] = original
  }
}

// mkScratch 自带 process 'exit' 回收(共用层已实现),断言失败也不会漏夹具目录。
const scratch = mkScratch('dt-copy-assets')
const srcCopy = join(scratch, 'src')
cpSync(REAL_SRC, srcCopy, { recursive: true })

// 零副作用按**构造**保证:每个调用点都显式把 distDir 指进夹具,真实 dist 永不当目标。
// 唯一能绕过这道围栏的形态是"import 即跑 CLI",由最后那条 §22d 判据钉死。
function assertInsideFixture(p) {
  assert.ok(p === scratch || p.startsWith(scratch + sep), `落点越出夹具:${p}`)
}

describe('清单与 src 实际形态对账', () => {
  it('真实 src 里每一份 tsc 不会产出的资源都在计划清单内', () => {
    const plan = ca.planAssets(REAL_SRC)
    const missing = filesTscWillNotEmit(REAL_SRC).filter((rel) => !plan.includes(rel))
    assert.deepEqual(missing, [])
  })

  it('新增一份未登记的 JS 资源必须被同一对账点名(上一条"为空"不是恒真)', () => {
    const stray = join(srcCopy, 'stray-helper.js')
    writeFileSync(stray, 'export const stray = 1\n')
    try {
      const plan = ca.planAssets(srcCopy)
      const missing = filesTscWillNotEmit(srcCopy).filter((rel) => !plan.includes(rel))
      assert.deepEqual(missing, ['stray-helper.js'])
    } finally {
      rmSync(stray, { force: true })
    }
  })

  it('新增一份 CSS 由 styles/ 自动发现并原字节进 dist(声明"不需要改清单"必须有牙)', () => {
    const extra = join(srcCopy, 'styles', 'extra.css')
    writeFileSync(extra, '/* 新增档位不登记 FIXED_FILES */\n')
    const dist = join(scratch, 'dist-auto')
    try {
      assertInsideFixture(dist)
      assert.ok(ca.planAssets(srcCopy).includes('styles/extra.css'))
      assert.equal(ca.runCli({ srcDir: srcCopy, distDir: dist }), 0)
      assert.ok(sameBytes(extra, join(dist, 'styles', 'extra.css')))
    } finally {
      rmSync(extra, { force: true })
    }
  })
})

describe('原字节复制', () => {
  it('全部计划项落进目标且逐项字节等值', () => {
    const dist = join(scratch, 'dist-ok')
    assertInsideFixture(dist)
    const { files, failed } = ca.runCopy({ srcDir: srcCopy, distDir: dist })
    assert.deepEqual(failed, [])
    assert.ok(files.length >= 8, `计划项少于 8 项:${files.join(',')}`)
    for (const rel of files) {
      assert.ok(existsSync(join(dist, rel)), `目标缺失:${rel}`)
      assert.ok(sameBytes(join(srcCopy, rel), join(dist, rel)), `字节漂移:${rel}`)
    }
  })

  it('重复跑幂等:第二次不产生任何字节或体积漂移', () => {
    const dist = join(scratch, 'dist-idem')
    const opts = { srcDir: srcCopy, distDir: dist }
    assert.equal(ca.runCli(opts), 0)
    const before = snapshotTree(dist)
    assert.equal(ca.runCli(opts), 0)
    assert.equal(snapshotTree(dist), before)
  })
})

describe('三条失败判据各有注入对照', () => {
  it('① 源缺失 ⇒ 退出码 1 并逐条点名(不得静默跳过)', () => {
    const empty = join(scratch, 'src-empty')
    mkdirSync(join(empty, 'styles'), { recursive: true })
    const { value, lines } = heard('error', () =>
      ca.runCli({ srcDir: empty, distDir: join(scratch, 'dist-missing') }),
    )
    const text = lines.join('\n')
    assert.equal(value, 1)
    assert.ok(text.includes('源缺失:radius.js'), text)
    assert.ok(text.includes('资源复制失败'), text)
  })

  it('② 复制动作没落地(目标缺失)⇒ 退出码 1,不能算成功', () => {
    const { value, lines } = heard('error', () =>
      ca.runCli({ srcDir: srcCopy, distDir: join(scratch, 'dist-noop'), copy: () => {} }),
    )
    assert.equal(value, 1)
    assert.ok(lines.join('\n').includes('复制后目标缺失'), lines.join('\n'))
  })

  it('③ 复制器悄悄转码 ⇒ 退出码 1;同一夹具换回默认实现即绿', () => {
    const corrupt = (from, to) => writeFileSync(to, `${readFileSync(from, 'utf8')}\r\n`)
    const { value, lines } = heard('error', () =>
      ca.runCli({ srcDir: srcCopy, distDir: join(scratch, 'dist-corrupt'), copy: corrupt }),
    )
    assert.equal(value, 1)
    assert.ok(lines.join('\n').includes('复制后字节不等'), lines.join('\n'))
    // 反向对照:同一份夹具用默认实现必须是 0,否则上面那条只是恒真。
    assert.equal(ca.runCli({ srcDir: srcCopy, distDir: join(scratch, 'dist-corrupt-default') }), 0)
  })

  it('styles 目录取不到 ⇒ 抛出而非当成"零份 CSS"通过', () => {
    const ghost = join(scratch, 'src-no-styles')
    mkdirSync(ghost, { recursive: true })
    cpSync(join(REAL_SRC, 'radius.js'), join(ghost, 'radius.js'))
    assert.throws(() => ca.stylesFiles(ghost))
  })
})

describe('CLI 入口形状与构建链一致', () => {
  it('被 import 时不跑 CLI:子进程 stdout 只报模块形状,不得出现复制成功行', () => {
    const href = pathToFileURL(SUBJECT).href
    const probe = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import(${JSON.stringify(href)}).then((m) => process.stdout.write("SHAPE:" + typeof m.__test__))`,
      ],
      { encoding: 'utf8', windowsHide: true },
    )
    assert.equal(probe.status, 0, probe.stderr)
    assert.ok(probe.stdout.includes('SHAPE:object'), probe.stdout)
    // 守卫漂回"顶层直接跑 CLI"时这行必然出现 —— 断言它**不出现**才是 §22d 的牙。
    assert.ok(!probe.stdout.includes('已原字节复制'), `import 竟跑了 CLI:${probe.stdout}`)
  })

  it(
    '真实 dist 含齐计划要求的每一项(复制器与上一次构建没分叉)',
    { skip: existsSync(REAL_DIST) ? false : '该检出尚未构建 dist —— 如实 skip,不冒充通过' },
    () => {
      const planned = ca.planAssets(REAL_SRC)
      const present = filesTscWillNotEmit(REAL_DIST)
      assert.deepEqual(planned.filter((rel) => !present.includes(rel)), [])
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
