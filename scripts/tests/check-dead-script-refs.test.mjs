// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-dead-script-refs.mjs` 的镜像测试(§22c:判据 import 源脚本的 `__test__`,本文件零复制)。
 * 行为臂覆盖本门的六类判据(真死/注释/cwd 相对/子目录 scripts/回滚态/无法解析)
 * 外加更正单新增的 GitHub Actions working-directory 与 cd、Dockerfile WORKDIR。
 * 形状锁:门体必须支持 --staged 与 --self-test,且自检不得只写一半(六类标签都要在)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { __test__ as g } from '../check-dead-script-refs.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HEAD = new Set([
  'scripts/alive.mjs',
  'packages/database/scripts/pre-migrate-fresh-db-guard.mjs',
  'apps/api/scripts/notify-deploy-failure.ts',
  'apps/web/scripts/gen-thing.mjs',
  'deploy/scripts/ai-diagnose.mjs',
])
const PKG = { '@ihui/api': 'apps/api' }
const onDisk = (p) => HEAD.has(p)

function judge({ ref, file, lineText, col = 0, lineHint = null, headSet = HEAD, indexSet = null, worktreeExists = onDisk }) {
  return g.resolveRef({ ref, file, lineText, col, lineHint, pkgDirs: PKG, headSet, indexSet, worktreeExists })
}

test('① 真死引用:工作流 run 步骤(默认 cwd = 仓根)引用不存在 ⇒ dead', () => {
  const text = 'jobs:\n  t:\n    steps:\n      - run: node scripts/nope.mjs\n'
  const refs = g.extractRefs(text, '.github/workflows/x.yml')
  assert.equal(refs.length, 1)
  const r = judge({ ref: refs[0].ref, file: '.github/workflows/x.yml', lineText: '      - run: node scripts/nope.mjs', col: refs[0].col })
  assert.equal(r.verdict, 'dead')
})

test('② 注释遮蔽:YAML # / JS // 与 /* */ / Dockerfile # 都不算引用', () => {
  assert.equal(g.extractRefs('jobs:\n  x:\n    steps:\n      - run: echo ok # node scripts/nope.mjs\n', '.github/workflows/x.yml').length, 0)
  assert.equal(g.extractRefs('const a = 1 // node scripts/nope.mjs\n', 'deploy/x.mjs').length, 0)
  assert.equal(g.extractRefs('/* node scripts/nope.mjs */\n', 'deploy/x.mjs').length, 0)
  assert.equal(g.extractRefs('# RUN node scripts/nope.mjs\nFROM node:20\n', 'deploy/docker/Dockerfile.web').length, 0)
  // 行注释只遮本行,不得吞掉后面的可执行引用(第一版就是把后面整段遮没了)
  const two = 'echo ok # 注释\nnode scripts/alive.mjs\n'
  const refs = g.extractRefs(two, 'deploy/x.sh')
  assert.equal(refs.length, 1)
  assert.equal(refs[0].line, 2)
})

test('③ cwd 相对命中:pnpm --filter 用包目录解析', () => {
  const line = 'pnpm --filter @ihui/api exec tsx scripts/notify-deploy-failure.ts'
  const refs = g.extractRefs(line, 'deploy/scripts/deploy-diagnose.sh')
  const r = judge({ ref: refs[0].ref, file: 'deploy/scripts/deploy-diagnose.sh', lineText: line, col: refs[0].col })
  assert.equal(r.verdict, 'exists')
  assert.equal(r.path, 'apps/api/scripts/notify-deploy-failure.ts')
  assert.match(r.reason, /pnpm-filter:@ihui\/api/)
})

test('④ 子目录 scripts 命中:祖先目录逐级解析(不是整体屏蔽)', () => {
  const line = 'node scripts/ai-diagnose.mjs'
  const refs = g.extractRefs(line, 'deploy/docker/x.sh')
  const r = judge({ ref: refs[0].ref, file: 'deploy/docker/x.sh', lineText: line, col: refs[0].col })
  assert.equal(r.verdict, 'exists')
  assert.equal(r.path, 'deploy/scripts/ai-diagnose.mjs')
  assert.match(r.reason, /ancestor:deploy/)
})

test('⑤ 回滚态:HEAD 存在但工作树缺失 ⇒ rollback,不许判红', () => {
  const line = 'node scripts/alive.mjs'
  const refs = g.extractRefs(line, 'deploy/x.sh')
  const r = judge({ ref: refs[0].ref, file: 'deploy/x.sh', lineText: line, col: refs[0].col, worktreeExists: () => false })
  assert.equal(r.verdict, 'rollback')
  assert.equal(g.judgeReport({ dead: 0, undetermined: 0 }), 0)
})

test('⑥ 无法解析:取不到 cwd 语境 ⇒ undetermined 且 exit 2(不折成红)', () => {
  const df = 'FROM node:20\nRUN node scripts/nope.mjs\n'
  const refs = g.extractRefs(df, 'deploy/docker/Dockerfile.x')
  const r = judge({ ref: refs[0].ref, file: 'deploy/docker/Dockerfile.x', lineText: 'RUN node scripts/nope.mjs', col: refs[0].col })
  assert.equal(r.verdict, 'undetermined')
  assert.equal(g.judgeReport({ dead: 0, undetermined: 1 }), 2)
  assert.ok(g.extractRefs('node scripts/${TARGET}.mjs\n', 'deploy/x.sh').some((x) => x.dynamic))
})

test('⑦ 更正单:GitHub Actions working-directory(步骤级优先于 job 级 defaults)', () => {
  const step = [
    'jobs:', '  db:', '    steps:', '      - name: guard',
    '        working-directory: packages/database',
    '        run: |', '          node scripts/pre-migrate-fresh-db-guard.mjs', '',
  ].join('\n')
  const refs = g.extractRefs(step, '.github/workflows/x.yml')
  const hints = g.buildGhaHints(step)
  const r = judge({ ref: refs[0].ref, file: '.github/workflows/x.yml', lineText: '          node scripts/pre-migrate-fresh-db-guard.mjs', col: refs[0].col, lineHint: hints[6] })
  assert.equal(r.verdict, 'exists')
  assert.equal(r.path, 'packages/database/scripts/pre-migrate-fresh-db-guard.mjs')
  assert.match(r.reason, /working-directory\(step\)/)

  const job = [
    'jobs:', '  db:', '    defaults:', '      run:',
    '        working-directory: packages/database',
    '    steps:', '      - name: guard', '        run: node scripts/pre-migrate-fresh-db-guard.mjs', '',
  ].join('\n')
  const refs2 = g.extractRefs(job, '.github/workflows/x.yml')
  const hints2 = g.buildGhaHints(job)
  const r2 = judge({ ref: refs2[0].ref, file: '.github/workflows/x.yml', lineText: '        run: node scripts/pre-migrate-fresh-db-guard.mjs', col: refs2[0].col, lineHint: hints2[7] })
  assert.equal(r2.verdict, 'exists')
  assert.equal(r2.path, 'packages/database/scripts/pre-migrate-fresh-db-guard.mjs')
})

test('⑧ cd 形式:同行 cd 优先于 repo 根', () => {
  const line = 'cd packages/database && node scripts/pre-migrate-fresh-db-guard.mjs'
  const refs = g.extractRefs(line, 'deploy/x.sh')
  const r = judge({ ref: refs[0].ref, file: 'deploy/x.sh', lineText: line, col: refs[0].col })
  assert.equal(r.verdict, 'exists')
  assert.match(r.reason, /^cd:/)
})

test('⑨ Dockerfile WORKDIR 参与解析', () => {
  const df = 'FROM node:20\nWORKDIR deploy\nRUN node scripts/ai-diagnose.mjs\n'
  const refs = g.extractRefs(df, 'deploy/docker/Dockerfile.x')
  const hints = g.buildDockerHints(df)
  const r = judge({ ref: refs[0].ref, file: 'deploy/docker/Dockerfile.x', lineText: 'RUN node scripts/ai-diagnose.mjs', col: refs[0].col, lineHint: hints[2] })
  assert.equal(r.verdict, 'exists')
  assert.equal(r.path, 'deploy/scripts/ai-diagnose.mjs')
})

test('⑩ 退出码合成:未判定优先于真死', () => {
  assert.equal(g.judgeReport({ dead: 3, undetermined: 1 }), 2)
  assert.equal(g.judgeReport({ dead: 1, undetermined: 0 }), 1)
  assert.equal(g.judgeReport({ dead: 0, undetermined: 0 }), 0)
})

test('形状锁:门体支持 --staged/--self-test,自检覆盖六类标签', () => {
  const src = readFileSync(path.join(HERE, '..', 'check-dead-script-refs.mjs'), 'utf8')
  assert.match(src, /argv\.includes\('--staged'\)/, '门体没有 --staged 面')
  assert.match(src, /argv\.includes\('--self-test'\)/, '门体没有 --self-test')
  for (const label of ['①', '②', '③', '④', '⑤', '⑥']) {
    assert.ok(src.includes(label), `自检缺第 ${label} 类`)
  }
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '取面必须走 face-reader(§0.4)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
