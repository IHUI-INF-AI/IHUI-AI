// Sheet 跨端档位"不许整档另写 / 必须消费单一源"锁(2026-10-27 阶段1,照 shared-switch-tier-base.test.mjs 形态)。
// 判定面 = HEAD blob(与守门 70/77/83/98 同口径;干净检出上 HEAD 即被审的那枚提交)。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { resolveGitBin, resolveWorktree } from '../lib/gitdir.mjs'

const GIT = resolveGitBin()
const ROOT = resolveWorktree()

const SPEC_PATH = 'packages/shared/src/ui/sheet-spec.ts'
const ENDS = [
  ['ui-native', 'packages/ui-native/src/sheet.tsx'],
  ['ui-react', 'packages/ui-react/src/components/sheet.tsx'],
]

const readHead = (path) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', 'show', `HEAD:${path}`], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

test('T1 spec 导出核心档位常量(枚举到 0 即尺子失效)', () => {
  const spec = readHead(SPEC_PATH)
  for (const name of [
    'SHEET_PADDING_PX',
    'SHEET_CONTENT_GAP_PX',
    'SHEET_RADIUS_TIER',
    'SHEET_ANIM_DURATION_MS',
  ]) {
    assert.ok(new RegExp(`export const ${name}\\b`).test(spec), `spec 缺少 ${name}`)
  }
})

test('T2 两端都从 @ihui/shared/ui/sheet-spec 取档位(单一真相源)', () => {
  for (const [end, path] of ENDS) {
    const text = readHead(path)
    assert.ok(
      /from ['"]@ihui\/shared\/ui\/sheet-spec['"]/.test(text),
      `${end} 未从 sheet-spec 取档位`,
    )
  }
})

test('T3 两端都消费具体档位常量(不是把 px 写死在端内)', () => {
  for (const [end, path] of ENDS) {
    const text = readHead(path)
    for (const name of [
      'SHEET_PADDING_PX',
      'SHEET_CONTENT_GAP_PX',
      'SHEET_RADIUS_TIER',
      'SHEET_ANIM_DURATION_MS',
    ]) {
      assert.ok(text.includes(name), `${end} 未消费 ${name}`)
    }
  }
})

test('T4 任一端不得再声明一份 SHEET_*_PX / SHEET_RADIUS_TIER / SHEET_ANIM_DURATION_MS 第二真相源', () => {
  for (const [, path] of ENDS) {
    const text = readHead(path)
    assert.ok(
      !/export (const|let|var) (SHEET_PADDING_PX|SHEET_CONTENT_GAP_PX|SHEET_RADIUS_TIER|SHEET_ANIM_DURATION_MS)\b/.test(
        text,
      ),
      `${path} 里出现了 SHEET 档位的本地声明(第二份真相)`,
    )
  }
})
