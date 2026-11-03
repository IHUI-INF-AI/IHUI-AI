// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:门 8 精确挂载图的「少判组合」报数(票 O87g 步骤④,2026-10-26 立)。
 *
 * 票面要求:"若精确面比笛卡尔积窄,必须统计少判了哪些组合、为什么结构上不存在,写进测试断言"。
 * 本组三层牙:
 *  · D1 阳性 —— 笛卡尔假组合路径(ctx `/api/courses`)必须判红,且报数行点出 crossPrefix 至少 1 条;
 *  · D2 防过度收紧 —— 真挂载路径(`/api/ranking/courses`)仍在册,且不得出现在「少判」清单里;
 *  · D3 兜底档 —— server.ts 不在面时退笛卡尔绿档,「少判」行必须消失(它是精确档专属读数);
 *  · D4 源码锁 —— 报数块必须由 GRAPH_AVAILABLE 把门、只报数不判红,否则下一手会把读数与判据混成一体。
 * 判据不复制常量(§22c):全部读数从脚本子进程输出里现取。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-api-routes.mjs')

function createTempRoot() {
  const dir = mkScratch('ihui-api-routes-delta-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  return dir
}
function writeFile(dir, relPath, content = '') {
  const full = join(dir, ...relPath.split('/'))
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}
function runScript(cwd) {
  const r = spawnSync('node', [SCRIPT_PATH, '--worktree', '--root', cwd], {
    cwd: dirname(SCRIPT_PATH),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = `${r.stdout || ''}${r.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

/** 两个插件、各自前缀:ranking 挂 /api/ranking,ai 挂 /api/ai —— 笛卡尔拼接会互相串台 */
function twoPluginFixture(dir) {
  writeFile(
    dir,
    'apps/api/src/server.ts',
    [
      "import Fastify from 'fastify'",
      "import { rankingRoutes } from './routes/ranking'",
      "import { aiRoutes } from './routes/ai'",
      'export function buildServer() {',
      '  const server = Fastify()',
      "  server.register(rankingRoutes, { prefix: '/api/ranking' })",
      "  server.register(aiRoutes, { prefix: '/api/ai' })",
      '  return server',
      '}',
      '',
    ].join('\n'),
  )
  writeFile(
    dir,
    'apps/api/src/routes/ranking.ts',
    [
      'export async function rankingRoutes(server) {',
      "  server.get('/courses', async () => ({ items: [] }))",
      '}',
      '',
    ].join('\n'),
  )
  writeFile(
    dir,
    'apps/api/src/routes/ai.ts',
    [
      'export async function aiRoutes(server) {',
      "  server.post('/chat', async () => ({ ok: true }))",
      '}',
      '',
    ].join('\n'),
  )
}

// ─── D1 阳性:笛卡尔假组合路径必须判红 + 报数行点名 crossPrefix ───
test('O87g-D1 阳性:前端打 /api/courses(只有 /api/ranking/courses 真在册)⇒ 判红且少判清单含 crossPrefix', () => {
  const dir = createTempRoot()
  try {
    twoPluginFixture(dir)
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/courses')`)
    const r = runScript(dir)
    assert.equal(
      r.status,
      1,
      `结构上不存在的 /api/courses 必须判红(旧笛卡尔档在这一格报"在册"= 本票假绿)\nstdout: ${r.out}`,
    )
    assert.match(r.out, /GET \/api\/courses/, '必须点名这条死调用')
    assert.match(
      r.out,
      /精确档相对笛卡尔「前缀假设」面少判 \d+ 个组合（crossPrefix 结构上不存在 [1-9]\d*/,
      `报数行必须出现且 crossPrefix 至少 1 条(两插件互串型)\nstdout: ${r.out}`,
    )
    assert.match(
      r.out,
      /少判\(crossPrefix.*POST \/api\/ranking\/chat/,
      `POST /api/ranking/chat 是把 ai.ts 的 localPath 拼到 ranking 前缀上造出的假组合,必须逐条报名\nstdout: ${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── D2 防过度收紧:真挂载路径仍在册,且不得进「少判」清单 ───
test('O87g-D2 防过度收紧:真挂载 /api/ranking/courses 仍在册(exit 0)且不被列进少判清单', () => {
  const dir = createTempRoot()
  try {
    twoPluginFixture(dir)
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/ranking/courses')`)
    const r = runScript(dir)
    assert.equal(r.status, 0, `真实挂载路径不得被精确档吞掉(漏读=恒红门)\nstdout: ${r.out}`)
    assert.doesNotMatch(
      r.out,
      /少判\(\w+,.*GET \/api\/ranking\/courses/,
      '在册路径不得出现在「少判」样例里(否则报数在说谎)',
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── D3 兜底档:server.ts 不在面 ⇒ 退笛卡尔绿档,「少判」读数必须消失 ───
test('O87g-D3 兜底档:server.ts 不在面 ⇒ 点名兜底档且不产出「少判」行(精确档专属读数)', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/ranking.ts',
      `export async function rankingRoutes(server) {\n  server.get('/courses', async () => ({ items: [] }))\n}\n`,
    )
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/courses')`)
    const r = runScript(dir)
    assert.match(r.out, /兜底档/, '无挂载起点必须大声点名兜底档')
    assert.doesNotMatch(r.out, /少判 \d+ 个组合/, '兜底档下 composite 就是绿档,不得冒充"少判"读数')
  } finally {
    rmScratch(dir)
  }
})

// ─── D4 源码锁:报数块由 GRAPH_AVAILABLE 把门,且只报数不判红 ───
test('O87g-D4 源码锁:少判报数块必须挂在 GRAPH_AVAILABLE 上且不含判红动作', () => {
  const SRC = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(
    SRC,
    /const compositeDelta = \(\(\) => \{\s*\n\s*if \(!GRAPH_AVAILABLE\) return null/,
    '报数块必须在兜底档直接返回 null(否则兜底档会冒充精确档读数)',
  )
  const start = SRC.indexOf('const compositeDelta = (() => {')
  assert.ok(start > 0, '报数块必须存在')
  const block = SRC.slice(start, SRC.indexOf('/** `--dump-undetermined`', start))
  assert.doesNotMatch(block, /\bmissing\.push|\bprocess\.exit\b|exitCode\s*=/, '报数块不得参与判红/RIC')
  // 兜底档仍保留旧 composite(§12e:不是删掉兜底,而是把它的假绿喊出来)
  assert.match(SRC, /for \(const e of assumptionPathSet\) backendPathSet\.add\(e\)/, '兜底档接线不得被静默摘除')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
