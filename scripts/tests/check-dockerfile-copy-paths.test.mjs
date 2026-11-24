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

import { __test__ as G, readAtFace } from '../check-dockerfile-copy-paths.mjs'

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
    'checkPnpmFilterScripts',
    'expandFilterSpec',
    'logicalLines',
    'workspaceGraph',
    'parseCopies',
    'lifecycleScriptRefs',
    'workflowContexts',
    'committedPaths',
    'parseDockerignore',
    'dockerignored',
    'dockerignorePatterns',
  ]) {
    assert.ok(typeof G[k] === 'function', `__test__ 缺少 ${k}`)
  }
  assert.ok(G.SELFTEST_CASES.length >= 10)
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
    if (c.graph) {
      const gv = G.checkPnpmFilterScripts({
        content: c.dockerfile,
        rel: 'deploy/docker/Dockerfile.t',
        graph: c.graph,
      })
      assert.equal(gv.length ? 'violation' : 'pass', c.want, `样例失败: ${c.name}`)
      continue
    }
    const v = G.checkLifecycleCopies({
      content: c.dockerfile,
      refs: c.refs,
      rel: 'deploy/docker/Dockerfile.t',
      ignorePatterns: c.ignore ?? [],
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

test('A 判据:COPY 必须落在 `RUN pnpm install` 之前 —— 旧 Dockerfile 红、补后绿、事后补 COPY 仍红', () => {
  const refs = ['scripts/fix-expo-metro-junction.mjs', 'scripts/lib/patch-lint-staged-stdio.mjs']
  // 2026-11-03 build-api / build-web 双红的原样:postinstall 引用两个脚本,镜像只 COPY 了第一个
  const oldDockerfile =
    'FROM node:22-alpine\nWORKDIR /app\n' +
    'COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./\n' +
    'COPY scripts/fix-expo-metro-junction.mjs scripts/\n' +
    'RUN pnpm install --frozen-lockfile\n'
  const oldViolations = G.checkLifecycleCopies({
    content: oldDockerfile,
    refs,
    rel: 'deploy/docker/Dockerfile.api',
  })
  assert.equal(oldViolations.length, 1, '旧 Dockerfile 必须红 —— 这正是 CI 双镜像失败现场')
  assert.match(oldViolations[0].detail, /scripts\/lib\/patch-lint-staged-stdio\.mjs/)
  assert.match(oldViolations[0].detail, /RUN pnpm install.*之前/)

  // 修法:在 install 前补一行 → 归绿
  const fixed = oldDockerfile.replace(
    'RUN pnpm install',
    'COPY scripts/lib/patch-lint-staged-stdio.mjs scripts/lib/\nRUN pnpm install',
  )
  assert.equal(
    G.checkLifecycleCopies({ content: fixed, refs, rel: 'deploy/docker/Dockerfile.api' }).length,
    0,
    'install 前补齐 COPY 必须归绿',
  )

  // 反向例:补在 install 之后不算覆盖(那次 install 仍会 MODULE_NOT_FOUND)
  const afterInstall = oldDockerfile.replace(
    'RUN pnpm install --frozen-lockfile\n',
    'RUN pnpm install --frozen-lockfile\nCOPY scripts/lib/patch-lint-staged-stdio.mjs scripts/lib/\n',
  )
  assert.equal(
    G.checkLifecycleCopies({ content: afterInstall, refs, rel: 'x' }).length,
    1,
    'install 之后才 COPY 不算覆盖,判据不得放宽',
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

test('C 判据 @ 真仓包图:web 旧行必红且点名 api-client,修后写法归绿(同仓 api 作对照)', () => {
  const graph = G.workspaceGraph(ROOT)
  assert.ok(graph && graph.size >= 20, `workspaceGraph 未真正读到包图(size=${graph?.size})`)
  const bad = G.checkPnpmFilterScripts({
    content: 'FROM n\nRUN pnpm --filter @ihui/web... run build:static\n',
    rel: 'deploy/docker/Dockerfile.web',
    graph,
  })
  assert.equal(bad.length, 1, '旧行必须红 —— 这正是 2026-09-23 CI build-web 恒红的成因')
  assert.equal(bad[0].kind, 'pnpm-filter-script-skipped')
  assert.match(bad[0].detail, /@ihui\/api-client/)
  assert.equal(
    [...G.expandFilterSpec('@ihui/web...', graph)].filter(
      (p) => graph.get(p).hasBuild && !graph.get(p).scripts.has('build:static'),
    ).length,
    7,
    'web 闭包内"产出 dist 却没有 build:static"的包应恰为 7 个(判据点名的就是这 7 个)',
  )
  assert.deepEqual(
    G.checkPnpmFilterScripts({
      content:
        'FROM n\nRUN pnpm --filter @ihui/web^... run build && pnpm --filter @ihui/web run build:static\n',
      rel: 'deploy/docker/Dockerfile.web',
      graph,
    }),
    [],
    '修法必须归绿',
  )
  assert.deepEqual(
    G.checkPnpmFilterScripts({
      content: 'FROM n\nRUN pnpm --filter @ihui/api... run build\n',
      rel: 'deploy/docker/Dockerfile.api',
      graph,
    }),
    [],
    '同仓对照:api 用 run build(人人都有)故恒绿 —— 两条 Dockerfile 只差脚本名',
  )
})

test('expandFilterSpec 三形态 + logicalLines 续行折叠', () => {
  const graph = new Map([
    ['@t/app', { scripts: new Set(['build']), hasBuild: true, deps: ['@t/dep'] }],
    ['@t/dep', { scripts: new Set(['build']), hasBuild: true, deps: [] }],
  ])
  assert.deepEqual([...G.expandFilterSpec('@t/app', graph)], ['@t/app'])
  assert.deepEqual([...G.expandFilterSpec('@t/app...', graph)].sort(), ['@t/app', '@t/dep'])
  assert.deepEqual([...G.expandFilterSpec('@t/app^...', graph)], ['@t/dep'])
  assert.equal(G.expandFilterSpec('!@t/app', graph), null, '取反表达式应放过')
  assert.equal(G.expandFilterSpec('...@t/app', graph), null, '上游方向应放过')
  assert.equal(G.expandFilterSpec('@t/nope...', graph), null, '包名不在图里应放过')
  const folded = G.logicalLines('RUN a \\\n  b \\\n  c\nRUN d\n')
  assert.equal(folded.length, 2)
  assert.equal(folded[0].line, 1, '折叠后仍报起始物理行号')
  assert.equal(folded[0].text.replace(/\s+/g, ' ').trim(), 'RUN a b c')
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

test('D 判据:根 postinstall 脚本不得被 .dockerignore 排除(真仓真值)', () => {
  const pkg = JSON.parse(readAtFace(ROOT, 'head', 'package.json'))
  const refs = G.lifecycleScriptRefs(pkg)
  assert.deepEqual(
    refs,
    ['scripts/fix-expo-metro-junction.mjs', 'scripts/lib/patch-lint-staged-stdio.mjs'],
    '根 postinstall 的脚本引用集变了 ⇒ 必须同步核 .dockerignore 可达性',
  )
  const patterns = G.dockerignorePatterns(ROOT)
  assert.ok(patterns.length > 10, `.dockerignore 规则数异常(${patterns.length}),不得静默判绿`)
  for (const ref of refs) {
    assert.equal(
      G.dockerignored(ref, patterns),
      false,
      `${ref} 被 .dockerignore 排除 ⇒ 镜像里 COPY 也搬不进构建上下文`,
    )
  }
})

test('D 判据匹配语义:父目录 / `!` 取反 / 无斜杠模式限定根层(按 Docker 口径)', () => {
  const ref = 'scripts/lib/patch-lint-staged-stdio.mjs'
  assert.equal(G.dockerignored(ref, ['scripts/lib']), true, '规则命中父目录即排除')
  assert.equal(G.dockerignored(ref, ['scripts/*']), true, '`*` 不跨 `/`,但命中父目录 scripts/lib')
  assert.equal(G.dockerignored(ref, ['**/*.mjs']), true, '`**` 可跨任意层目录')
  assert.equal(
    G.dockerignored(ref, ['*.mjs']),
    false,
    '无斜杠模式只作用于上下文根层,不误伤 scripts/',
  )
  assert.equal(G.dockerignored('x.mjs', ['*.mjs']), true)
  assert.equal(
    G.dockerignored(ref, ['scripts/**', `!${ref}`]),
    false,
    '最后一条命中的 `!` 规则重新纳入',
  )
  assert.equal(G.parseDockerignore('# 注释\n\n**/node_modules/\n  \n').length, 1)
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
