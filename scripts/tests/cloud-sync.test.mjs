// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Apache-2.0 须保留本声明与 NOTICE。

// 无头云同步通道单元测试（不依赖真实 rclone / AList / 网络）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  loadConfig,
  runSync,
  syncHealth,
  cloudSyncHealthy,
} from '../cloud-sync/rclone-baidu-sync.mjs'
import { healCloudSync } from '../cloud-sync/heal-cloud-sync.mjs'

// 每个用例独立的临时工作区（os.tmpdir() 下唯一子目录），测试后清理。
const workspaces = []
function makeWs() {
  const ws = mkdtempSync(join(tmpdir(), 'ihui-cloud-sync-test-'))
  workspaces.push(ws)
  return ws
}
function makeDir() {
  const d = mkdtempSync(join(tmpdir(), 'ihui-cloud-sync-dir-'))
  workspaces.push(d)
  return d
}
function cleanup() {
  for (const ws of workspaces.splice(0)) {
    try {
      rmSync(ws, { recursive: true, force: true })
    } catch {
      /* 忽略清理失败 */
    }
  }
}
test('清理临时工作区', cleanup)

// 1. loadConfig 解析
test('loadConfig 解析：enabled=true 且 localDirs 长度为 2', () => {
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '1',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: 'a;b',
  })
  assert.equal(cfg.enabled, true)
  assert.equal(cfg.localDirs.length, 2)
})

// 2. runSync 成功路径
test('runSync 成功路径：注入全部依赖，ok=true 且写入 lastSuccessTs', async () => {
  const dir = makeDir()
  const stateFile = join(makeWs(), 'cloud-sync-status.json')
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '1',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: dir,
    IHUI_CLOUD_SYNC_STATE_FILE: stateFile,
  })
  const r = await runSync({
    config: cfg,
    dryRun: true,
    checkRcloneAvailable: () => true,
    checkAlistReachable: async () => true,
    runner: async () => {},
  })
  assert.equal(r.ok, true)
  assert.ok(typeof r.lastSuccessTs === 'number' && r.lastSuccessTs > 0)
})

// 3. runSync rclone 不可用
test('runSync rclone 不可用：ok=false 且 why 含 rclone 不可用', async () => {
  const dir = makeDir()
  const stateFile = join(makeWs(), 'cloud-sync-status.json')
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '1',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: dir,
    IHUI_CLOUD_SYNC_STATE_FILE: stateFile,
  })
  const r = await runSync({
    config: cfg,
    dryRun: true,
    checkRcloneAvailable: () => false,
    checkAlistReachable: async () => true,
    runner: async () => {},
  })
  assert.equal(r.ok, false)
  assert.ok(r.why.includes('rclone 不可用'))
})

// 4. runSync AList 不可达
test('runSync AList 不可达：ok=false 且 why 含 AList', async () => {
  const dir = makeDir()
  const stateFile = join(makeWs(), 'cloud-sync-status.json')
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '1',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: dir,
    IHUI_CLOUD_SYNC_STATE_FILE: stateFile,
  })
  const r = await runSync({
    config: cfg,
    dryRun: true,
    checkRcloneAvailable: () => true,
    checkAlistReachable: async () => false,
    runner: async () => {},
  })
  assert.equal(r.ok, false)
  assert.ok(r.why.includes('AList'))
})

// 5. runSync 本地目录不存在
test('runSync 本地目录不存在：ok=false 且 results 含 skipped 项', async () => {
  const stateFile = join(makeWs(), 'cloud-sync-status.json')
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '1',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: '一个不存在的路径',
    IHUI_CLOUD_SYNC_STATE_FILE: stateFile,
  })
  const r = await runSync({
    config: cfg,
    dryRun: true,
    checkRcloneAvailable: () => true,
    checkAlistReachable: async () => true,
    runner: async () => {},
  })
  assert.equal(r.ok, false)
  assert.ok(Array.isArray(r.results))
  assert.ok(r.results.some((x) => x.skipped === true))
})

// 6. syncHealth 健康判定
test('syncHealth 健康判定：成功写入后 healthy=true；intervalMs=1 且较早则 healthy=false', async () => {
  const dir = makeDir()
  const stateFile = join(makeWs(), 'cloud-sync-status.json')
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '1',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: dir,
    IHUI_CLOUD_SYNC_STATE_FILE: stateFile,
  })
  await runSync({
    config: cfg,
    dryRun: true,
    checkRcloneAvailable: () => true,
    checkAlistReachable: async () => true,
    runner: async () => {},
  })
  const h1 = await syncHealth({ config: cfg })
  assert.equal(h1.healthy, true)
  assert.ok(h1.lastSuccessTs > 0)

  // 另起：intervalMs=1，状态文件 lastSuccessTs 较早 → 不健康
  const staleCfg = { ...cfg, intervalMs: 1 }
  // 写入一个较早的 lastSuccessTs
  const { writeFileSync } = await import('node:fs')
  writeFileSync(stateFile, JSON.stringify({ lastSuccessTs: 1 }), 'utf8')
  const h2 = await syncHealth({ config: staleCfg })
  assert.equal(h2.healthy, false)
})

// 7. cloudSyncHealthy 未启用
test('cloudSyncHealthy 未启用：{running:null, mode:gui}', async () => {
  const stateFile = join(makeWs(), 'cloud-sync-status.json')
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '0',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: 'x',
    IHUI_CLOUD_SYNC_STATE_FILE: stateFile,
  })
  const r = await cloudSyncHealthy({ config: cfg })
  assert.equal(r.running, null)
  assert.equal(r.mode, 'gui')
})

// 8. cloudSyncHealthy 启用且健康
test('cloudSyncHealthy 启用且健康：{running:true, mode:headless}', async () => {
  const dir = makeDir()
  const stateFile = join(makeWs(), 'cloud-sync-status.json')
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '1',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: dir,
    IHUI_CLOUD_SYNC_STATE_FILE: stateFile,
  })
  await runSync({
    config: cfg,
    dryRun: true,
    checkRcloneAvailable: () => true,
    checkAlistReachable: async () => true,
    runner: async () => {},
  })
  const r = await cloudSyncHealthy({ config: cfg })
  assert.equal(r.running, true)
  assert.equal(r.mode, 'headless')
})

// 9. healCloudSync 未启用
test('healCloudSync 未启用：{skipped:true}', async () => {
  const stateFile = join(makeWs(), 'cloud-sync-status.json')
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '0',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: 'x',
    IHUI_CLOUD_SYNC_STATE_FILE: stateFile,
  })
  const r = await healCloudSync({ config: cfg })
  assert.equal(r.skipped, true)
})

// 10. healCloudSync 启用+不健康+runner 成功
test('healCloudSync 启用+不健康+runner 成功：{attempted:true, ok:true} 且 verified===null', async () => {
  const dir = makeDir()
  const ws = makeWs()
  const stateFile = join(ws, 'cloud-sync-status.json')
  // 独立 tickFile，避免命中项目树内默认 tickFile（跨运行残留）造成误判 throttled。
  const tickFile = join(ws, 'heal-tick.json')
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '1',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: dir,
    IHUI_CLOUD_SYNC_STATE_FILE: stateFile,
  })

  // 接口隔离说明（重要发现）:healCloudSync 内部调用 runSync 时**只转发 runner**，
  // 不转发 checkRcloneAvailable / checkAlistReachable。为使 heal 成功路径可在无真实
  // rclone / AList 的环境下验证，这里用 node 自身充当 rcloneBin（通过真实 --version 检查），
  // 并临时 mock 全局 fetch 让 AList 检查返回 200 —— 全程不发生真实网络访问。
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => ({ status: 200, ok: true })
  const savedRcloneBin = cfg.rcloneBin
  cfg.rcloneBin = process.execPath
  try {
    const r = await healCloudSync({
      config: cfg,
      tickFile,
      checkAlistReachable: async () => true,
      runner: async () => {},
    })
    assert.equal(r.attempted, true)
    assert.equal(r.ok, true)
    // 严格证明不伪造成功
    assert.equal(r.verified, null)
  } finally {
    globalThis.fetch = origFetch
    cfg.rcloneBin = savedRcloneBin
  }
})

// 11. healCloudSync 节流
test('healCloudSync 节流：同上 now 第二次调用返回 {throttled:true}', async () => {
  const dir = makeDir()
  const ws = makeWs()
  const stateFile = join(ws, 'cloud-sync-status.json')
  const tickFile = join(ws, 'heal-tick.json')
  const cfg = loadConfig({
    IHUI_CLOUD_SYNC_ENABLED: '1',
    IHUI_CLOUD_SYNC_LOCAL_DIRS: dir,
    IHUI_CLOUD_SYNC_STATE_FILE: stateFile,
  })
  const T0 = 1_700_000_000_000
  const baseOpts = {
    config: cfg,
    now: T0,
    tickFile,
    // 让第一次 runSync 失败（不写入 lastSuccessTs），保证第二次 syncHealth 仍不健康，
    // 从而走到节流判定而非 alreadyHealthy。
    checkRcloneAvailable: () => false,
    checkAlistReachable: async () => true,
    runner: async () => {},
  }
  const first = await healCloudSync(baseOpts)
  assert.equal(existsSync(tickFile), true)
  assert.equal(first.attempted, true)
  const second = await healCloudSync(baseOpts)
  assert.equal(second.throttled, true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
