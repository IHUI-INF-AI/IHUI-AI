// Switch 跨端档位"不许整档另写 / 必须消费单一源"锁(2026-10-27 阶段1,照 shared-button-tier-base.test.mjs 形态)。
// 判定面 = HEAD blob(与守门 70/77/83/98 同口径;干净检出上 HEAD 即被审的那枚提交)。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { resolveGitBin, resolveWorktree } from '../lib/gitdir.mjs'

const GIT = resolveGitBin()
const ROOT = resolveWorktree()

const SPEC_PATH = 'packages/shared/src/ui/switch-spec.ts'
const ENDS = [
  ['ui-native', 'packages/ui-native/src/switch.tsx'],
  ['ui-react', 'packages/ui-react/src/components/switch.tsx'],
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
    'SWITCH_SIZE_TIERS',
    'SWITCH_TRACK_W_PX',
    'SWITCH_TRACK_H_PX',
    'SWITCH_TRACK_PADDING_PX',
    'SWITCH_TRACK_BORDER_W_PX',
    'SWITCH_TRACK_RADIUS_TIER',
    'SWITCH_THUMB_SIZE_PX',
    'SWITCH_THUMB_RADIUS_TIER',
    'SWITCH_THUMB_TRANSLATE_X_PX',
    'SWITCH_DEFAULT_SIZE',
  ]) {
    assert.ok(new RegExp(`export const ${name}\\b`).test(spec), `spec 缺少 ${name}`)
  }
})

test('T2 两端都从 @ihui/shared/ui/switch-spec 取档位(单一真相源)', () => {
  for (const [end, path] of ENDS) {
    const text = readHead(path)
    assert.ok(
      /from ['"]@ihui\/shared\/ui\/switch-spec['"]/.test(text),
      `${end} 未从 switch-spec 取档位`,
    )
  }
})

test('T3 两端都消费具体档位常量(不是把 px 写死在端内)', () => {
  for (const [end, path] of ENDS) {
    const text = readHead(path)
    for (const name of [
      'SWITCH_TRACK_W_PX',
      'SWITCH_TRACK_H_PX',
      'SWITCH_THUMB_SIZE_PX',
      'SWITCH_THUMB_TRANSLATE_X_PX',
    ]) {
      assert.ok(text.includes(name), `${end} 未消费 ${name}`)
    }
  }
})

test('T4 web 不再用本地 sizeMap 整档另写(改走 spec 映射)', () => {
  const text = readHead('packages/ui-react/src/components/switch.tsx')
  assert.ok(!/const sizeMap = \{/.test(text), 'web 仍保留本地 sizeMap(应改消费 switch-spec)')
})

test('T5 任一端不得再声明一份 SWITCH_*_PX 第二真相源', () => {
  for (const [, path] of ENDS) {
    const text = readHead(path)
    assert.ok(
      !/export (const|let|var) SWITCH_(TRACK_W_PX|TRACK_H_PX|THUMB_SIZE_PX|THUMB_TRANSLATE_X_PX)\b/.test(
        text,
      ),
      `${path} 里出现了 SWITCH_*_PX 的本地声明(第二份真相)`,
    )
  }
})
