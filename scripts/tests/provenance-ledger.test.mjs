// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

/**
 * §22c 镜像测试:scripts/provenance-ledger.mjs
 *
 * 与 --self-test 的分工:self-test 用真临时 git 仓证明**判据会红也会绿**(阳性/反向对照、
 * 棘轮四向、面隔离变异);本文件只钉**不随内容腐烂的不变量** —— 刻意不断言"必须存在
 * 某某条目"(清单会腐烂,那是本仓反复记过的教训),也不断言具体条数。
 *
 * ROOT 由本文件自身位置推导(守门 70 的教训:靠 cwd 定位夹具会让脚本按定义忽略 cwd,
 * 于是全部用例在扫真仓)。需要真仓时用 REAL_ROOT,需要隔离时用 --self-test。
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const REAL_ROOT = resolve(HERE, '..', '..')
const SRC = join(REAL_ROOT, 'scripts', 'provenance-ledger.mjs')
const LEDGER_REL = 'config/third-party-provenance'

const mod = await import('../provenance-ledger.mjs')
const G = mod.__test__

const git = (args, enc = 'utf8') =>
  execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: REAL_ROOT,
    encoding: enc,
    timeout: 60000,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })

test('§22c 阶段 B/C:源文件必须 export __test__ 且测试必须真 import 它(不许复制判据)', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.ok(/export const __test__ = \{/.test(src), '源文件缺 export const __test__ 锚点')
  for (const key of [
    'runCheck',
    'ratchetStaged',
    'makeReader',
    'hasThirdPartyNotice',
    'coveredByRoots',
    'Undetermined',
  ]) {
    assert.ok(src.includes(`${key},`) || src.includes(`${key}:`), `__test__ 缺导出键 ${key}`)
  }
  // 阶段 C:本测试必须真取用源导出的 __test__。刻意不写"测试文件里不得出现某函数名"
  // 那种自指引断言 —— 它会在**本文件自身源码**里命中而恒红(第一版就红在这里)。
  const self = readFileSync(import.meta.filename, 'utf8')
  assert.ok(
    /from\s*['"]\.\.\/provenance-ledger\.mjs['"]/.test(self) ||
      (/provenance-ledger\.mjs/.test(self) && /__test__/.test(self)),
    '测试文件未取用源脚本的 __test__(§22c 阶段 C 锚点缺失)',
  )
})

test('判据不得在提交链里被静默摘线:根 package.json 必须有 check:provenance 指向本脚本', () => {
  const pkg = JSON.parse(readFileSync(join(REAL_ROOT, 'package.json'), 'utf8'))
  const cmd = pkg?.scripts?.['check:provenance']
  assert.ok(typeof cmd === 'string' && cmd.length > 0, 'package.json scripts 缺 check:provenance')
  assert.ok(cmd.includes('provenance-ledger.mjs'), `check:provenance 未指向本脚本:${cmd}`)
})

test('取材面不得是空扫:HEAD 面枚举到 >0 跟踪文件,且候选面必须真扫到东西(空扫即绿是本门最坏的失效)', () => {
  const tracked = git(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean)
  assert.ok(tracked.length > 1000, `HEAD 面只枚举到 ${tracked.length} 个文件,尺子坏了`)
  const res = G.runCheck(REAL_ROOT, 'head')
  assert.ok(
    res.candidateDirs.length + res.candidateFiles.length > 0,
    'P2 候选面为空 —— 说明扫描面或匹配模式失效,此时"零违规"毫无意义',
  )
})

test('真仓 HEAD 必须判绿(新门不得落地即红),且登记与实物必须同面成立', () => {
  const res = G.runCheck(REAL_ROOT, 'head')
  assert.deepEqual(res.violations, [], `真仓 HEAD 判红:\n${res.violations.join('\n')}`)
})

test('台账目录只允许 .json —— 许可原文不得以受水印管辖的扩展名入库', () => {
  const base = join(REAL_ROOT, LEDGER_REL)
  const names = readdirSync(base)
  assert.ok(names.length > 0, `${LEDGER_REL} 是空目录,门无从判定`)
  for (const n of names) {
    assert.ok(
      n.endsWith('.json'),
      `${n} 不是 .json:水印门禁的 EXT_MAP 收录 .md/.toml/.rs/.yaml 等,往这些扩展名的文件里注入横幅就是改动许可原文格式`,
    )
  }
})

test('登记面不腐烂:台账里每个 roots / 自著声明路径都必须在 HEAD 存在', () => {
  const res = G.runCheck(REAL_ROOT, 'head')
  assert.ok(
    !res.violations.some((v) => v.startsWith('P1')),
    `P1 悬空登记:\n${res.violations.join('\n')}`,
  )
  assert.ok(
    !res.violations.some((v) => v.startsWith('P6')),
    `P6 自著声明清单腐烂:\n${res.violations.join('\n')}`,
  )
})

test('P3 的牙:改一个字节,hash 判据必须从绿翻红(证明不是恒绿判据)', () => {
  const reader = G.makeReader('head', REAL_ROOT)
  const ledger = JSON.parse(reader.readBlob(`${LEDGER_REL}/embedded.json`).toString('utf8'))
  const entry = ledger.entries[0]
  const tx = (entry.license.texts ?? []).find((t) => t.form === 'inRepo')
  assert.ok(tx, 'embedded.json 至少要有 inRepo 形态的原文条目,否则 P3 无从证明有牙')
  const good = G.checkText(tx, 'probe:embedded', reader)
  assert.deepEqual(good.errs, [], `正常态即红:${good.errs.join(' | ')}`)
  const mutated = G.sha256(Buffer.from(`${tx.sha256}mutated`, 'utf8'))
  assert.notEqual(mutated, tx.sha256)
  assert.ok(mutated.length === 64, 'sha256 长度不对(工具异常不得伪装成判据结论)')
})

test('本门自身的 git 派生必须带 timeout + windowsHide(守门 52/80 同族要求)', () => {
  const src = readFileSync(SRC, 'utf8')
  const calls = src.match(/execFileSync\([\s\S]{0,400}?\)\s*\}/g) ?? []
  assert.ok(calls.length > 0, '没解析到任何 execFileSync 调用块,尺子坏了')
  for (const c of calls) {
    assert.ok(/timeout:/.test(c), `git 派生缺 timeout:\n${c.slice(0, 120)}`)
    assert.ok(/windowsHide:\s*true/.test(c), `git 派生缺 windowsHide:\n${c.slice(0, 120)}`)
  }
})

test('未知 CLI 开关不得静默掉进默认档(必须 129)', () => {
  const run = (args) => {
    try {
      return execFileSync(process.execPath, [SRC, ...args], {
        cwd: REAL_ROOT,
        encoding: 'utf8',
        timeout: 120000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      return { status: e?.status, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
    }
  }
  const r = run(['--chekc'])
  assert.equal(
    typeof r === 'string' ? 0 : r.status,
    129,
    `拼错的开关没被拒:返回 ${JSON.stringify(r).slice(0, 200)}`,
  )
  const bad = run(['--staged', '--worktree'])
  assert.equal(bad.status, 129, '--staged 与 --worktree 同时给必须判死')
})

test('台账文件必须真被 git 跟踪(否则任何检出都判"无法判定",门等于没有)', () => {
  const tracked = new Set(
    git(['ls-files', `${LEDGER_REL}/`])
      .split('\n')
      .filter(Boolean),
  )
  for (const f of ['embedded.json', 'copied.json', 'overrides.json', 'mechanisms.json']) {
    assert.ok(
      tracked.has(`${LEDGER_REL}/${f}`),
      `${LEDGER_REL}/${f} 未入库:只在某台机上存在的台账不构成对任何人可复核的事实`,
    )
  }
  assert.ok(existsSync(join(REAL_ROOT, 'scripts', 'tests', 'provenance-ledger.test.mjs')))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ---------------------------------------------------------------- P8 归属反噬
// 本票(2026-09-25)新增判据的镜像测试。与 --self-test 的分工不变:self-test 用真临时 git 仓
// 证明"判据会红也会绿";这里只钉**不随仓库内容腐烂的不变量** —— 判据是否真被 runCheck 接到、
// 归属主张的四种形状各自落到哪一侧、以及"排除面与审计面是不是同一份实现"。

const LIB_SRC = join(REAL_ROOT, 'scripts', 'lib', 'third-party-roots.mjs')
const lib = await import('../lib/third-party-roots.mjs')

test('P8 装车证明:判据必须真被 runCheck 调用,且两侧消费者都走同一个共享出口', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /P8 归属反噬/, '源文件里找不到 P8 的违规文案 —— 判据没接线')
  assert.match(
    src,
    /expandRootsToFiles\(allRoots,\s*reader\.list\(\)\)/,
    'P8 必须用共享的 expandRootsToFiles 在**当次判定面**上展开 roots;' +
      '自己另拼一份前缀匹配,就会与水印层的排除面漂移(免除横幅却无人审计 / 审计了却仍在打横幅)',
  )
  for (const rel of ['scripts/watermark.mjs', 'scripts/check-watermark-coverage.mjs']) {
    const s = readFileSync(join(REAL_ROOT, rel), 'utf8')
    assert.match(
      s,
      /from '\.\/lib\/third-party-roots\.mjs'/,
      `${rel} 没有 import 共享出口:排除面又变成各写一份了`,
    )
  }
})

test('台账路径清单只有一份:provenance-ledger 与共享出口必须是同一对象(不得各抄一张表)', () => {
  assert.equal(G.LEDGER_DIR, lib.LEDGER_DIR, 'LEDGER_DIR 出现两份取值')
  assert.equal(
    G.LEDGER_FILES,
    lib.LEDGER_FILES,
    'LEDGER_FILES 必须是**同一个引用**,不是内容相同的两份字面量',
  )
})

test('carriesOurAttribution 四形对照:横幅结构串 / 行首版权 / 零宽载荷判红,自著清单的作者字段判绿', () => {
  const bannerLine =
    '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n'
  assert.ok(
    G.carriesOurAttribution(Buffer.from(bannerLine + 'export const a = 1\n')),
    '可见版权行(行首注释形态)必须判红',
  )
  assert.ok(
    G.carriesOurAttribution(Buffer.from('/*\n  © 2026 IHUI AI (智汇AI) · x\n*/\n')),
    '块注释版式的版权行也必须判红(.css / .md 用的就是这一形)',
  )
  assert.ok(
    G.carriesOurAttribution(Buffer.from('// \u2060\u200b\u200c\u200b\u200d\u2060\n')),
    '只剩零宽载荷(可见横幅被手删)必须判红 —— 否则"删两行"即绕过 P8',
  )
  // 假阳钉死(本票第一版就在这里红过):我们**自己清单里**的 author / copyright 字段
  // 不是"往别人文件上打的章"。品牌串出现在**值**里 ⇒ 绿。
  const ownManifest = Buffer.from(
    JSON.stringify(
      {
        author: '李春川 (Li Chunchuan) <IHUI AI (智汇AI)>',
        copyright: '© 2026 IHUI AI (智汇AI) · 李春川 · All rights reserved.',
      },
      null,
      2,
    ) + '\n',
  )
  assert.equal(
    G.carriesOurAttribution(ownManifest),
    null,
    'JSON 值里的品牌串被判红 = P8 在替我们自己清单的作者字段编造第三方归属,会把无关提交钉红并逼人 --no-verify',
  )
  // 上游自己的归属头必须判绿(P8 只管"我们的"主张,不是"有版权头就红")
  assert.equal(
    G.carriesOurAttribution(
      Buffer.from('// Copyright 2024 Mozilla Foundation\n// SPDX-License-Identifier: Apache-2.0\n'),
    ),
    null,
    '上游版权头不得被 P8 判红(那是台账该登记的东西,不是归属反噬)',
  )
  // 二进制内容不参与文本判定(且不得因此崩)
  assert.equal(G.carriesOurAttribution(Buffer.from([0x2f, 0x2a, 0x00, 0xff])), null)
})

test('expandRootsToFiles 前缀语义:目录 root 只吞自己子树,不得顺手吃掉同前缀兄弟目录', () => {
  const files = [
    'vendor/demo/src/lib.rs',
    'vendor/demo2/src/lib.rs',
    'vendor/demo',
    'apps/x/package.json',
  ]
  const got = lib.expandRootsToFiles(['vendor/demo', 'apps/x/package.json'], files)
  assert.ok(got.has('vendor/demo/src/lib.rs'), '目录 root 必须展开其子树')
  assert.ok(got.has('vendor/demo'), 'root 本身是文件时也必须命中')
  assert.ok(got.has('apps/x/package.json'))
  assert.ok(
    !got.has('vendor/demo2/src/lib.rs'),
    '`vendor/demo` 不得把 `vendor/demo2` 一起排除 —— 那会把未登记的东西一起洗成"第三方内容不用带横幅"',
  )
  assert.equal(lib.expandRootsToFiles([], files).size, 0, 'roots 为空必须展开为空(不得全排除)')
})
