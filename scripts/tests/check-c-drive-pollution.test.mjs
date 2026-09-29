// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 90 的镜像测试(§22c):直接 import 源脚本的 __test__,不复制判据实现。
// 重点是两条"造门时就踩过"的反例:名字判据不得误伤他人工具态,以及 TEMP 漂移必须能被识别。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../check-c-drive-pollution.mjs'
// 封口清单只从源脚本取,测试里同样不抄第二份名字(§22c)
import { SEALED_DIRS, pathsFor } from '../seal-c-root-stray.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// 编号唯一性:同日多会话在同一位置各加一道门必然撞号。本门一天内撞了三次 ——
// 85(与 check-test-paths)→ 90(与 check-sse-dispatch-parity)→ 91(与
// check-error-code-coverage),最终落 92。所以断言**不硬写编号**:先从 runner 里反查
// "本门脚本所在注册块的 id",再要求那个 id 全文件唯一。硬写编号的写法下次重排就又红了
// (或更糟:悄悄通过)。
test('本门编号在 guardian-runner 中必须唯一(反查 id,不硬写编号)', () => {
  const runner = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'guardian-runner.mjs'),
    'utf8',
  )
  const block = runner.match(
    /\{\s*\n\s*id: '([0-9]+[a-z]?)',[\s\S]{0,400}?script: 'check-c-drive-pollution\.mjs'/,
  )
  assert.ok(block, '本门未接入 runner(找不到 id→script 相邻的注册块)')
  const myId = block[1]
  const hits = runner.match(new RegExp(`id: '${myId}'`, 'g')) || []
  assert.equal(hits.length, 1, `id ${myId} 出现 ${hits.length} 次 ⇒ 与别的门撞号,注册块可能互相顶掉`)

  const ids = [...runner.matchAll(/^\s{4}id: '([0-9a-z]+)',$/gm)].map((m) => m[1])
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))]
  assert.deepEqual(dupes, [], `runner 存在重号: ${dupes.join(', ')}`)

  // 邻门注册块不得因"整文件提交"而缺失(本仓实测踩过,见提交 5db08f26e 的修复)
  for (const neighbor of [
    'check-sse-dispatch-parity.mjs',
    'check-test-paths.mjs',
    'check-error-code-coverage.mjs',
  ]) {
    assert.ok(runner.includes(`script: '${neighbor}'`), `邻门 ${neighbor} 的注册块缺失`)
  }
})

test('盘根 IHUI- 前缀与 .empty-tmp / .pnpm-store 判为自有', () => {
  assert.ok(G.classifyRoot('IHUI-probe-tail.ps1'))
  assert.ok(G.classifyRoot('.empty-tmp'))
  assert.ok(G.classifyRoot('.empty-tmp2'))
  assert.ok(G.classifyRoot('.pnpm-store'))
})

test('盘根单字母目录 = MSYS 路径错位指纹;单字母文件与系统目录都不判', () => {
  // 实测成因:C:\c 是 2026-08-06 把 /c/tmp/... 当相对路径用套出来的,内藏 515MB
  assert.ok(G.classifyRootEntry('c', true), 'C:\\c 这类错位目录必须被识别')
  assert.equal(G.classifyRootEntry('c', false), null, '单字母文件不得判(宁漏不误报)')
  assert.equal(G.classifyRootEntry('Windows', true), null, '系统目录误判')
  assert.ok(G.classifyRootEntry('IHUI-probe-tail.ps1', false), '既有 IHUI- 规则须仍生效')
})

test('系统条目与白名单目录不得判为我们的', () => {
  for (const n of ['Windows', 'Program Files', 'ProgramData', 'Users', 'Recovery', 'pagefile.sys']) {
    assert.equal(G.classifyRoot(n), null, `${n} 被误判为自有`)
  }
  assert.ok(G.FOREIGN_ROOT.has('tools'), 'tools 未登记为外来条目')
})

test('Temp 里只认我们的前缀,他人随机名一律放过', () => {
  assert.ok(G.classifyTmp('ihui-origin-Ab12Cd'))
  assert.ok(G.classifyTmp('next-backup-node22-20260918-094636'))
  assert.equal(G.classifyTmp('8f575ef0-6180-4c22-b1d4-4161278b643b.tmp'), null)
  assert.equal(G.classifyTmp('qoder-000b-cwd'), null, '宿主工具态被误判为本项目产物')
})

test('scanC 只读:结果含 temp 结论且两次一致', () => {
  const a = G.scanC()
  const b = G.scanC()
  assert.equal(a.ours.length, b.ours.length, '两次扫描数量漂移(本门不应改文件)')
  assert.ok(['ok', 'drift', 'unknown'].includes(a.temp.status), `TEMP 判定状态异常:${a.temp.status}`)
})

test('TEMP 漂移判据:注册表与进程不一致必须报 drift', () => {
  const r = G.detectTempDrift()
  if (r.status === 'drift') {
    assert.notEqual(r.proc, r.declared, 'drift 却给出相同路径')
    assert.ok(r.declared, 'drift 判定要求注册表值可读')
  } else if (r.status === 'ok') {
    assert.equal(r.proc.toLowerCase().replace(/[\\/]+$/, ''), r.declared.toLowerCase().replace(/[\\/]+$/, ''))
  }
})

// —— 封口形态(2026-09-24 加):本门对盘根写歪项必须给**相反且正确**的两个结论 ——
test('classifySeal 四态:表内真目录=BROKEN / 表内链接=SEALED / 表外=FOREIGN / 不存在=ABSENT', () => {
  const name = SEALED_DIRS[0].name
  assert.equal(G.classifySeal(name, { exists: true, isLink: false, isDir: true }), 'BROKEN')
  assert.equal(G.classifySeal(name, { exists: true, isLink: true, isDir: false }), 'SEALED')
  assert.equal(G.classifySeal(name, { exists: false, isLink: false, isDir: false }), 'ABSENT')
  assert.equal(G.classifySeal('Windows', { exists: true, isLink: false, isDir: true }), 'FOREIGN')
  // 大小写不敏感:Windows 文件系统本就如此,漏了会让 TMP/Tmp 这类变体绕过判据
  assert.equal(G.classifySeal(name.toUpperCase(), { exists: true, isLink: true, isDir: false }), 'SEALED')
})

test('端到端:改道前判残骸、改道后判已封口且**绝不跟随链接量体积**', () => {
  const base = mkScratch('pollution-seal-')
  try {
    const root = join(base, 'root')
    const dev = join(base, 'devenv')
    const entry = SEALED_DIRS[0]
    const stray = join(root, entry.name)
    mkdirSync(stray, { recursive: true })
    writeFileSync(join(stray, 'a.json'), 'x'.repeat(50000))

    const before = G.scanDriveRoot(root, dev)
    assert.ok(
      before.hits.some((h) => h.why.includes('封口丢失')),
      '真目录没判回潮 ⇒ 根治失效时门是瞎的',
    )

    const target = pathsFor(entry, root, dev).target
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'a.json'), 'x'.repeat(50000))
    rmSync(stray, { recursive: true, force: true })
    symlinkSync(target, stray, 'junction')

    const after = G.scanDriveRoot(root, dev)
    assert.equal(
      after.hits.filter((h) => h.why.includes('封口丢失')).length,
      0,
      '已封口仍判回潮 ⇒ 每日必红',
    )
    assert.ok(after.sealed.some((s) => s.name === entry.name), '已封口项没进 sealed 清单')
    const attributed = after.hits.reduce((a, b) => a + (b.sizeMB || 0), 0)
    assert.equal(attributed, 0, `跟随了链接、把 D 盘目标算成 C 盘残骸:${attributed}MB`)
  } finally {
    rmScratch(base)
  }
})

test('扫描位不得跟随改道后的 junction(实测 PS 的 -Recurse 会穿透,Node 侧同理)', () => {
  const base = mkScratch('pollution-rep-')
  try {
    const t = join(base, 'tgt')
    mkdirSync(t)
    const ln = join(base, 'lnk')
    symlinkSync(t, ln, 'junction')
    assert.equal(G.isReparsePoint(ln), true, 'junction 未被认出 ⇒ 扫描会跟进外置根')
    assert.equal(G.isReparsePoint(t), false, '真目录被误判 ⇒ 残骸会被整体跳过(假绿)')
    assert.equal(G.isReparsePoint(join(base, 'nope')), false, '不存在的路径不得判真')
  } finally {
    rmScratch(base)
  }
})

test('每日维护脚本必须带"重解析点只断链、绝不递归删"的护栏', () => {
  const ps1 = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'c-drive-auto-maintain.ps1'), 'utf8')
  assert.match(ps1, /function\s+Test-ReparsePoint/, '缺重解析点判据函数')
  assert.match(ps1, /Test-ReparsePoint\s+\$path/, 'ForceDelete 未在唯一删除出口上判重解析点')
  // 断链必须是 non-recursive:`Delete($path, $true)` 或 -Recurse 会顺着 junction 清空外置根
  assert.match(ps1, /\[System\.IO\.Directory\]::Delete\(\$path,\s*\$false\)/, '断链写成递归删除 ⇒ 会穿透删目标')
})

test('页面文件量大小必须用 WMI 的 AllocatedBaseSize(不是 MSDN 文档那个名字)', () => {
  // 实测:本机 Win32_PageFileUsage 只有 `AllocatedBaseSize`;写成文档里的 `AllocBaseSize`
  // 不会报错,PowerShell 把它渲染成**空串** ⇒ 一条都量不到。这正是"属性名错但静默通过"的形状。
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'check-c-drive-pollution.mjs'), 'utf8')
  assert.match(src, /\$_.AllocatedBaseSize/, '未使用 AllocatedBaseSize')
  assert.doesNotMatch(src, /\$_.AllocBaseSize/, '用了会被静默渲染成空串的属性名')
})

test('页面文件哨兵:一条都没量到必须报"未判定",不得报"一致"(假绿灯防回归)', () => {
  const r = G.pagefilePending(G.parsePagingFiles('    C:\\pagefile.sys 2048 2048'), new Map())
  assert.equal(r.readable, true, '配置读到了')
  assert.equal(r.measured, 0, '不该记为量到')
  assert.equal(r.pending.length, 0, '量不到不得造待办')
  // 报告文本里必须出现"未判定"字样 —— 判据没量到却打印"一致"就是假绿
  assert.ok(r.entries > r.measured, 'entries/measured 差必须可见,供报告区分未判定')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
