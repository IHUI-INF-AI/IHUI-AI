// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 72 的 §22c 镜像测试:直接 import 源脚本的 __test__(不允许复制判据实现)。
 * 运行:node --test scripts/tests/check-dockerfile-copy-paths.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../check-dockerfile-copy-paths.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const ROOT_CTX_NO_COPY =
  'FROM node:22-alpine\nWORKDIR /app\n' +
  'COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./\n' +
  'RUN pnpm install --frozen-lockfile\n'
const ROOT_CTX_WITH_COPY =
  'FROM node:22-alpine\nWORKDIR /app\n' +
  'COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./\n' +
  'COPY scripts/fix-expo-metro-junction.mjs scripts/\n' +
  'RUN pnpm install --frozen-lockfile\n'

test('§22c 锚点:__test__ 暴露判据函数且样例表非空', () => {
  for (const k of [
    'main',
    'scanDockerfile',
    'checkLifecycleCopies',
    'checkCopySourcesExist',
    'parseCopies',
    'lifecycleScriptRefs',
    'workflowContexts',
    'committedPaths',
  ]) {
    assert.ok(typeof G[k] === 'function', `__test__ 缺少 ${k}`)
  }
  assert.ok(G.SELFTEST_CASES.length >= 5)
})

test('判据样例表逐条与 want 一致(含"补上 COPY 必须放过"的修法有效性)', () => {
  for (const c of G.SELFTEST_CASES) {
    if (c.wantRefs) {
      assert.deepEqual(
        G.lifecycleScriptRefs({ scripts: { postinstall: c.cmd } }),
        c.wantRefs,
        `样例失败: ${c.name}`,
      )
      continue
    }
    const v = G.checkLifecycleCopies({
      content: c.dockerfile,
      refs: c.refs,
      rel: 'deploy/docker/Dockerfile.t',
    })
    assert.equal(v.length ? 'violation' : 'pass', c.want, `样例失败: ${c.name}`)
  }
})

test('A 判据:缺 COPY 时报出的文件名与修法可执行', () => {
  const v = G.checkLifecycleCopies({
    content: ROOT_CTX_NO_COPY,
    refs: ['scripts/fix-expo-metro-junction.mjs'],
    rel: 'deploy/docker/Dockerfile.api',
  })
  assert.equal(v.length, 1)
  assert.equal(v[0].kind, 'lifecycle-script-not-copied')
  assert.match(
    v[0].hint,
    /^在 deploy\/docker\/Dockerfile\.api 的 `RUN pnpm install` 之前加一行:COPY /,
  )
  // 反向:补上该行即归零
  assert.equal(
    G.checkLifecycleCopies({
      content: ROOT_CTX_WITH_COPY,
      refs: ['scripts/fix-expo-metro-junction.mjs'],
      rel: 'x',
    }).length,
    0,
  )
})

test('B 判据:按已提交内容判存在,`COPY . .` 与通配符源不误伤', () => {
  const committed = G.committedPaths(ROOT)
  assert.ok(committed.size > 5000, `提交内容清单异常(${committed.size} 条),不得静默判绿`)
  const bogus = G.checkCopySourcesExist({
    content: 'COPY scripts/__nope__.mjs scripts/\n',
    rel: 'deploy/docker/Dockerfile.web',
    context: '.',
    committed,
  })
  assert.equal(bogus.length, 1)
  assert.equal(bogus[0].kind, 'copy-source-missing')
  // `COPY . .` = 整个上下文,恒存在
  assert.equal(
    G.checkCopySourcesExist({
      content: 'COPY --chown=u:g . .\n',
      rel: 'x',
      context: '.',
      committed,
    }).length,
    0,
  )
  // 通配符与 --from= 不参与存在性判定
  assert.equal(
    G.checkCopySourcesExist({
      content: 'COPY package.json pnpm-lock.yaml* ./\nCOPY --from=deps /app/ ./\n',
      rel: 'x',
      context: '.',
      committed,
    }).length,
    0,
  )
})

test('接线断言:workflow 里必须真解析出 Dockerfile→context 映射(B 判据的前提)', () => {
  const m = G.workflowContexts(ROOT)
  assert.ok(m.size >= 3, `workflow 未解析出任何上下文(${m.size})⇒ B 判据实际不会跑`)
  assert.equal(m.get('deploy/docker/Dockerfile.api'), '.')
  assert.equal(m.get('deploy/docker/Dockerfile.web'), '.')
  // ai-service 用的是子目录上下文,证明不是"一律按仓库根"的偷懒实现
  assert.equal(m.get('apps/ai-service/Dockerfile'), 'apps/ai-service')
})

test('本仓真值:7 个 Dockerfile 全部通过(修完即绿,回归即红)', async () => {
  assert.equal(await G.main([]), 0)
  assert.equal(await G.main(['--self-test']), 0)
})

test('parseCopies 正确剥离 flag 与续行,末 token 才是 dst', () => {
  const copies = G.parseCopies(
    'COPY --chown=app:app a.txt b.txt /app/\nCOPY x \\\n  y /\nCOPY --from=deps /app/ ./\n',
  )
  assert.deepEqual(copies[0].srcs, ['a.txt', 'b.txt'])
  assert.equal(copies[0].dst, '/app/')
  assert.deepEqual(copies[1].srcs, ['x', 'y'], '续行折回后是同一指令的两个源')
  assert.equal(copies[1].dst, '/')
  assert.equal(copies[1].line, 2, '行号要指向续行的起始行')
  assert.equal(copies[2].hasFrom, true)
})

test('生命周期抽取:preinstall/prepare 同样要覆盖,内联 node -e 与 pnpm 调用不算文件依赖', () => {
  assert.deepEqual(
    G.lifecycleScriptRefs({
      scripts: {
        preinstall: 'node scripts/pre.mjs',
        prepare: 'husky && node tools/p.mjs --flag',
        build: 'node should-not-count.mjs',
      },
    }),
    ['scripts/pre.mjs', 'tools/p.mjs'],
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
