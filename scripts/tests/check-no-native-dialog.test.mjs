// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
// §22c:判据从源脚本 import,测试里一律不复算
import { __test__ as gate } from '../check-no-native-dialog.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-no-native-dialog.mjs')
const GIT = gitBinary()

function git(cwd, args) {
  return spawnSync(GIT, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function createRepo(files) {
  const dir = mkScratch('ihui-native-git-')
  assert.equal(git(dir, ['init', '-q']).status, 0)
  git(dir, ['config', 'user.email', 'test@ihui.local'])
  git(dir, ['config', 'user.name', 'Test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  for (const [rel, content] of Object.entries(files)) writeFile(dir, rel, content)
  git(dir, ['add', '-A'])
  const c = git(dir, ['commit', '-q', '-m', 'baseline'])
  assert.equal(c.status, 0, `baseline commit 失败: ${c.stdout}${c.stderr}`)
  return dir
}

function writeFile(dir, rel, content) {
  const full = join(dir, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

function stage(dir, rel, content) {
  writeFile(dir, rel, content)
  assert.equal(git(dir, ['add', '--', rel]).status, 0)
}

function run(cwd, extra = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...extra], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

const WINDOW_CONFIRM = 'export function P() {\n  if (!window.confirm("删?")) return\n}\n'
const ARROW_BARE =
  'export function T() {\n  return <button onClick={() => confirm("确认删除?")} />\n}\n'
const BOUND_OK =
  'import { useConfirm } from "@/hooks/use-confirm"\nexport function P() {\n  const { confirm, ConfirmDialogRenderer } = useConfirm()\n  return <button onClick={() => { void confirm({ title: "x" }) }}>{ConfirmDialogRenderer}</button>\n}\n'

// ─── 判据直连(源脚本 __test__ 出口) ───

test('T01 成员式 window.confirm/prompt ⇒ 必判(旧门用 (?<!\\.) 把它整个放走了)', () => {
  const hits = gate.scanNativeCalls(WINDOW_CONFIRM)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].form, 'member')
  assert.equal(hits[0].name, 'confirm')
})

test('T02 箭头体裸 confirm(文件无绑定)⇒ 必判(旧门 lookbehind 排除 `>` 而漏掉这一型)', () => {
  const hits = gate.scanNativeCalls(ARROW_BARE)
  assert.equal(hits.length, 1, JSON.stringify(hits))
  assert.equal(hits[0].form, 'bare')
})

test('T03 本地绑定(useConfirm 解构)⇒ 放过;同形文件去掉绑定就判红', () => {
  assert.equal(gate.scanNativeCalls(BOUND_OK).length, 0)
  assert.equal(gate.scanNativeCalls(ARROW_BARE).length, 1)
})

test('T04 绑定识别不得跨语句(第一版就是 `import[^;]*{` 跨行把 JSX 里那句读成绑定的)', () => {
  const src =
    'import { Button } from "@ihui/ui-react"\nexport function P() {\n  return <div>{confirm("x")}</div>\n}\n'
  assert.equal(gate.hasLocalBinding(src, 'confirm'), false)
  assert.equal(gate.scanNativeCalls(src).length, 1)
})

test('T05 注释 / 字符串 / 类型签名位 ⇒ 一律放过', () => {
  assert.equal(
    gate.scanNativeCalls('// 这里写 window.confirm("x")\nexport const z = 1\n').length,
    0,
  )
  assert.equal(
    gate.scanNativeCalls('const doc = "用 confirm() 确认"\nexport const z = 1\n').length,
    0,
  )
  assert.equal(
    gate.scanNativeCalls(
      'interface S {\n  confirm(opts: { a: string }): Promise<boolean>\n}\nexport type Q = S\n',
    ).length,
    0,
  )
})

test('T06 计数与命中清单同尺(棘轮锚点用的就是 countNativeCalls)', () => {
  assert.equal(
    gate.countNativeCalls(WINDOW_CONFIRM + '  window.alert(1)\n'),
    gate.scanNativeCalls(WINDOW_CONFIRM + '  window.alert(1)\n').length,
  )
})

// ─── CLI:三面取材 + 差值棘轮 ───

test('T07 全量档:存量只报数、exit 0;public/ 下的第三方产物不进射程', () => {
  const dir = createRepo({
    'apps/web/app/x/page.tsx': WINDOW_CONFIRM,
    'apps/web/public/vs/vendor.js': 'self.alert = function alert(message) { return message }\n',
  })
  try {
    const r = run(dir)
    assert.equal(r.status, 0, `全量档不拦\n${r.stdout}`)
    assert.match(r.stdout, /存量:\s+1 处/)
    assert.doesNotMatch(r.stdout, /vendor\.js/, 'public/ 打包产物不得进射程(旧门在此造出 8 处假阳)')
  } finally {
    rmScratch(dir)
  }
})

test('T08 staged:新文件带 window.confirm ⇒ exit 1(新文件基线 0)', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': 'export const z = 1\n' })
  try {
    stage(dir, 'apps/web/app/y/page.tsx', ARROW_BARE)
    const r = run(dir, ['--staged'])
    assert.equal(r.status, 1, `新增原生弹窗应拦\n${r.stdout}`)
    assert.match(r.stdout, /\[bare:confirm\]/)
  } finally {
    rmScratch(dir)
  }
})

test('T09 staged:存量行号挪位但数量不变 ⇒ exit 0(逐页清偿不能被自己的存量挡住)', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': WINDOW_CONFIRM })
  try {
    stage(dir, 'apps/web/app/x/page.tsx', `const pad = 1\nconst pad2 = 2\n${WINDOW_CONFIRM}`)
    const r = run(dir, ['--staged'])
    assert.equal(r.status, 0, `行号挪位不该读成新增\n${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('T10 staged:把弹窗换成项目自有出口 ⇒ exit 0 且存量下降', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': WINDOW_CONFIRM })
  try {
    stage(dir, 'apps/web/app/x/page.tsx', BOUND_OK)
    const r = run(dir, ['--staged'])
    assert.equal(r.status, 0, `正在清偿绝不能被拦\n${r.stdout}`)
    assert.match(r.stdout, /拦截数:\s+0 处/)
  } finally {
    rmScratch(dir)
  }
})

test('T11 两面旗同给 ⇒ exit 2', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': 'export const z = 1\n' })
  try {
    const r = run(dir, ['--staged', '--worktree'])
    assert.equal(r.status, 2)
    assert.match(r.stdout, /不得同用/)
  } finally {
    rmScratch(dir)
  }
})

test('T12 --self-test 走到主判定且全绿', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': 'export const z = 1\n' })
  try {
    const r = run(dir, ['--self-test'])
    assert.equal(r.status, 0, r.stdout)
    assert.match(r.stdout, /自检通过/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
