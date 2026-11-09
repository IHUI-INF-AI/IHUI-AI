#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-screen-registration-sync.test.mjs —— 提交期屏/路由登记同步门的夹具测试(2026-11-08 立)
 *
 * 判据源唯一(§22c):纯判据 import 自 ../check-screen-registration-sync.mjs 的 __test__;
 * 退出码三态用**临时真仓库**(git init + 舞台索引)驱动 CLI 实测,不 mock git:
 *   · 只加屏不登记          ⇒ exit 1 且点名
 *   · 加屏且登记            ⇒ exit 0
 *   · 判不了(登记表坏行)   ⇒ exit 2
 * 另钉 RN 屏未认领、小程序页未在册两条同族红灯。
 *
 * 运行:node --test scripts/tests/check-screen-registration-sync.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as P } from '../check-screen-registration-sync.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-screen-registration-sync.mjs')

function git(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    // 显式 stdio:与门 193 判据同族(不写 stdio 时派生 git 在本机 0/30 抛 EBUSY)。
    // 本处是门 193 修好 check-hand-migration-snapshot.mjs:339 后暴露的第二处同病实例。
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败:${r.stderr || r.stdout}`)
  return r.stdout
}

function write(cwd, rel, text) {
  const abs = join(cwd, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

const MAP_ROW = JSON.stringify({
  web: 'home',
  status: 'aligned',
  rn: 'apps/mobile-rn/src/screens/HomeScreen.tsx',
})

function mkRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-screen-reg-'))
  git(dir, ['init', '-q'])
  git(dir, ['config', 'user.email', 'fixture@example.com'])
  git(dir, ['config', 'user.name', 'fixture'])
  write(dir, 'apps/web/app/home/page.tsx', 'export default function Page() { return null }\n')
  write(dir, 'apps/mobile-rn/src/screens/HomeScreen.tsx', 'export function HomeScreen() { return null }\n')
  write(dir, 'scripts/data/web-rn-screen-map.jsonl', `${MAP_ROW}\n`)
  write(
    dir,
    'apps/miniapp-taro/src/app.config.ts',
    "export default {\n  pages: ['pages/home/index'],\n  subPackages: [],\n}\n",
  )
  write(dir, 'apps/miniapp-taro/src/pages/home/index.tsx', 'export default function Home() { return null }\n')
  git(dir, ['add', '-A'])
  git(dir, ['commit', '--no-verify', '-q', '-m', 'fixture: baseline'])
  return dir
}

function _reset(dir) {
  git(dir, ['reset', '--hard', '-q', 'HEAD'])
  git(dir, ['clean', '-fdq'])
}

function runGate(dir) {
  const r = spawnSync(process.execPath, [SCRIPT, '--staged', `--root=${dir}`], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

test('E1 只加 web 屏不登记 ⇒ exit 1 并点名', () => {
  const dir = mkRepo()
  try {
    write(dir, 'apps/web/app/new-feature/page.tsx', 'export default function Page() { return null }\n')
    git(dir, ['add', '-A'])
    const r = runGate(dir)
    assert.equal(r.code, 1, r.out)
    assert.match(r.out, /unregistered-web-route/)
    assert.match(r.out, /new-feature/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('E2 加屏且登记 ⇒ exit 0', () => {
  const dir = mkRepo()
  try {
    write(dir, 'apps/web/app/new-feature/page.tsx', 'export default function Page() { return null }\n')
    write(
      dir,
      'scripts/data/web-rn-screen-map.jsonl',
      `${MAP_ROW}\n${JSON.stringify({ web: 'new-feature', status: 'gap', note: '判过缺屏' })}\n`,
    )
    git(dir, ['add', '-A'])
    const r = runGate(dir)
    assert.equal(r.code, 0, r.out)
    assert.match(r.out, /登记同步/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('E3 判不了(登记表坏行)⇒ exit 2,不得当通过', () => {
  const dir = mkRepo()
  try {
    write(dir, 'apps/web/app/new-feature/page.tsx', 'export default function Page() { return null }\n')
    write(dir, 'scripts/data/web-rn-screen-map.jsonl', `${MAP_ROW}\n{ 这不是 JSON\n`)
    git(dir, ['add', '-A'])
    const r = runGate(dir)
    assert.equal(r.code, 2, r.out)
    assert.match(r.out, /未判定/)
    assert.match(r.out, /map-parse-error/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('E4 新 RN 屏没被登记表认领 ⇒ exit 1', () => {
  const dir = mkRepo()
  try {
    write(dir, 'apps/mobile-rn/src/screens/OrphanScreen.tsx', 'export function OrphanScreen() { return null }\n')
    git(dir, ['add', '-A'])
    const r = runGate(dir)
    assert.equal(r.code, 1, r.out)
    assert.match(r.out, /unregistered-rn-screen/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('E5 小程序新页没进 app.config ⇒ exit 1;补登记后 ⇒ exit 0', () => {
  const dir = mkRepo()
  try {
    write(dir, 'apps/miniapp-taro/src/pages/new-page/index.tsx', 'export default function Page() { return null }\n')
    git(dir, ['add', '-A'])
    let r = runGate(dir)
    assert.equal(r.code, 1, r.out)
    assert.match(r.out, /unregistered-miniapp-page/)

    write(
      dir,
      'apps/miniapp-taro/src/app.config.ts',
      "export default {\n  pages: ['pages/home/index', 'pages/new-page/index'],\n  subPackages: [],\n}\n",
    )
    git(dir, ['add', '-A'])
    r = runGate(dir)
    assert.equal(r.code, 0, r.out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('E6 无屏/路由面改动 ⇒ exit 0(合理跳过,不是未判定)', () => {
  const dir = mkRepo()
  try {
    write(dir, 'README.md', '# fixture\n')
    git(dir, ['add', '-A'])
    const r = runGate(dir)
    assert.equal(r.code, 0, r.out)
    assert.match(r.out, /无需登记判定/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('P1 纯判据:三态最小面(红/绿/未判定)', () => {
  assert.equal(
    P.judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/web/app/x/page.tsx' }],
      webRoutes: [],
      mapRows: [{ web: 'home' }],
    }).state,
    'regressed',
  )
  assert.equal(
    P.judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/web/app/x/page.tsx' }],
      webRoutes: [{ route: 'x', rel: 'apps/web/app/x/page.tsx' }],
      mapRows: [{ web: 'x', status: 'gap' }],
    }).state,
    'ok',
  )
  assert.equal(P.judgeRegistrationSync({ changed: [], mapRows: null }).state, 'undetermined')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
