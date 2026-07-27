import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-ignore-todos.mjs')

// ─── 辅助:创建临时项目根目录 ─────────────────────────────
function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'ihui-ignore-todos-'))
}

// 辅助:写入 .check-api-routes-ignore.json(脚本从 process.cwd() 读取)
function writeIgnoreFile(root, obj) {
  writeFileSync(
    join(root, '.check-api-routes-ignore.json'),
    JSON.stringify(obj, null, 2),
  )
}

// 辅助:运行 check-ignore-todos.mjs(脚本无 CLI 参数,cwd 决定读取位置)
function runScript(opts = {}) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
  })
}

// 辅助:去除 ANSI 颜色码(脚本输出含 \x1B[33m 等)
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '')
}

// ─── 1. 文件不存在 → exit 0 + "跳过"(catch 兜底) ────────────────
test('文件不存在 → exit 0 + "跳过"(catch 兜底)', () => {
  const root = createTempProject()
  try {
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0, `文件不存在应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /跳过/, '应输出"跳过"')
    assert.match(out, /不存在或解析失败/, '应说明跳过原因')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 2. 文件存在但 JSON 解析失败 → exit 0 + "跳过" ────────────────
test('文件存在但无效 JSON → exit 0 + "跳过"(JSON.parse 抛错)', () => {
  const root = createTempProject()
  try {
    writeFileSync(
      join(root, '.check-api-routes-ignore.json'),
      '{ "ignorePatterns": [ invalid json ',
    )
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0, `无效 JSON 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /跳过/)
    assert.match(out, /不存在或解析失败/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. ignorePatterns 字段不存在 → exit 0 + "ignore 文件为空" ────
test('ignorePatterns 字段不存在 → exit 0 + "ignore 文件为空"', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, { someOtherKey: [] })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0, `字段不存在应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /ignore 文件为空/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. ignorePatterns 为空数组 → exit 0 + "ignore 文件为空" ─────
test('ignorePatterns 为空数组 → exit 0 + "ignore 文件为空"', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, { ignorePatterns: [] })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0, `空数组应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /ignore 文件为空/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. ignorePatterns 不是数组(对象)→ exit 0 + "ignore 文件为空" ─
test('ignorePatterns 不是数组(对象)→ exit 0 + "ignore 文件为空"', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, { ignorePatterns: { foo: 'bar' } })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0, `非数组应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /ignore 文件为空/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. 单个 TODO 条目(reason 含"待实装")→ exit 0 + TODO 计数 1 ──
test('单个 TODO 条目(reason 含"待实装")→ TODO 计数 1', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, {
      ignorePatterns: [
        {
          method: 'GET',
          pathPattern: '/api/v1/admin/users',
          reason: 'TODO 后端待实装',
        },
      ],
    })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0, `TODO 条目应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /TODO 后端待实装: 1/)
    assert.match(out, /总豁免条目: 1/)
    assert.match(out, /TODO 后端待实装清单/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. 单个守门脚本 bug 条目(reason 含"守门脚本")→ 计数 1 ──────
test('单个守门脚本 bug 条目(reason 含"守门脚本")→ 守门 bug 计数 1', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, {
      ignorePatterns: [
        {
          method: 'GET',
          pathPattern: '/api/self-media/koubo/list',
          reason: '守门脚本 method 推断误报,后端已实装',
        },
      ],
    })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0, `守门 bug 条目应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /守门脚本 bug 标注: 1/)
    assert.match(out, /守门脚本 bug 标注清单/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. 单个其他条目(reason 不含两类关键词)→ 其他计数 1 ─────────
test('单个其他条目(reason 不含两类关键词)→ 其他计数 1', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, {
      ignorePatterns: [
        {
          method: 'POST',
          pathPattern: '/api/v1/health',
          reason: '已知豁免:健康检查端点',
        },
      ],
    })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0, `其他条目应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /其他\(已知豁免\): 1/)
    // 不应出现 TODO / 守门脚本 清单段
    assert.ok(!out.includes('TODO 后端待实装清单'), '其他条目不应触发 TODO 清单')
    assert.ok(
      !out.includes('守门脚本 bug 标注清单'),
      '其他条目不应触发守门 bug 清单',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. 混合条目(各 1 个)→ 三个分类计数都为 1 + 总数 3 ─────────
test('混合条目(TODO/守门 bug/其他 各 1 个)→ 计数分别 1 + 总数 3', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, {
      ignorePatterns: [
        { method: 'GET', pathPattern: '/a', reason: 'TODO 后端待实装' },
        { method: 'GET', pathPattern: '/b', reason: '守门脚本误报' },
        { method: 'POST', pathPattern: '/c', reason: '已知豁免' },
      ],
    })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /总豁免条目: 3/)
    assert.match(out, /TODO 后端待实装: 1/)
    assert.match(out, /守门脚本 bug 标注: 1/)
    assert.match(out, /其他\(已知豁免\): 1/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. reason 不是字符串(数字/null/缺失)→ 归入"其他" ─────────
test('reason 不是字符串(数字/null/缺失)→ 归入"其他"', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, {
      ignorePatterns: [
        { method: 'GET', pathPattern: '/a', reason: 123 },
        { method: 'GET', pathPattern: '/b', reason: null },
        { method: 'GET', pathPattern: '/c' },
      ],
    })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /总豁免条目: 3/)
    assert.match(out, /TODO 后端待实装: 0/)
    assert.match(out, /守门脚本 bug 标注: 0/)
    assert.match(out, /其他\(已知豁免\): 3/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. 健康度:全部 TODO → 0% ──────────────────────────────
test('健康度:全部 TODO → 0%', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, {
      ignorePatterns: [
        { method: 'GET', pathPattern: '/a', reason: 'TODO 待实装' },
        { method: 'GET', pathPattern: '/b', reason: 'TODO 待实装 2' },
      ],
    })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /健康度: 0%/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. 健康度:全部非 TODO(守门 bug + 其他)→ 100% ────────────
test('健康度:全部非 TODO → 100%', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, {
      ignorePatterns: [
        { method: 'GET', pathPattern: '/a', reason: '守门脚本误报' },
        { method: 'POST', pathPattern: '/b', reason: '已知豁免' },
      ],
    })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /健康度: 100%/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. 健康度:半 TODO(2 TODO + 2 非TODO)→ 50% ──────────────
test('健康度:半 TODO(2 TODO + 2 非TODO)→ 50%', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, {
      ignorePatterns: [
        { method: 'GET', pathPattern: '/a', reason: 'TODO 待实装' },
        { method: 'GET', pathPattern: '/b', reason: 'TODO 待实装 2' },
        { method: 'GET', pathPattern: '/c', reason: '守门脚本误报' },
        { method: 'POST', pathPattern: '/d', reason: '已知豁免' },
      ],
    })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /健康度: 50%/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. 始终 exit 0(warn-only,即使全是 TODO 也不阻塞) ─────────
test('始终 exit 0: 全是 TODO 也不阻塞(warn-only 硬约束)', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, {
      ignorePatterns: [
        { method: 'GET', pathPattern: '/a', reason: 'TODO 待实装' },
        { method: 'GET', pathPattern: '/b', reason: 'TODO 待实装 2' },
        { method: 'GET', pathPattern: '/c', reason: 'TODO 待实装 3' },
      ],
    })
    const r = runScript({ cwd: root })
    // warn-only: 即使 TODO 数 > 0 也不阻塞 commit
    assert.equal(r.status, 0, `warn-only 应始终 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /退出码 0 \(warn-only\),不阻塞 commit/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 15. 输出格式:含报告标题 + 文件路径 + 健康度 ─────────────────
test('输出格式:含报告标题 + 文件路径 + 健康度', () => {
  const root = createTempProject()
  try {
    writeIgnoreFile(root, {
      ignorePatterns: [
        { method: 'GET', pathPattern: '/a', reason: '已知豁免' },
      ],
    })
    const r = runScript({ cwd: root })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /check-api-routes-ignore\.json 监控报告/)
    // 文件路径应展示(脚本用 resolve(process.cwd(), ...) 推导)
    assert.match(out, /\.check-api-routes-ignore\.json/)
    assert.match(out, /健康度: \d+%/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
