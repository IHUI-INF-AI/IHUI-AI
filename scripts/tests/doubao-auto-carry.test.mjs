// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 豆包一键切号自动回放两阶段单测(全注入:零真 cookie 库、零真网络)。
import assert from 'node:assert/strict'
import test from 'node:test'
import { exportBeforeSwitch, prepareImport, replayAfterSwitch } from '../lib/doubao-auto-carry.mjs'

const COOKIE = 'sessionid=SECRET_SHOULD_NOT_LEAK; uid_tt=TOP_SECRET_VALUE'

/** 假依赖:可分别控制 cookie/export/replay 的返回与抛错 */
function deps(over = {}) {
  return {
    readCookie: async () => ({ code: 'ok', cookieHeader: COOKIE, count: 2, source: 'fake-cookies' }),
    exportArchive: async ({ outDir }) => ({
      code: 'ok',
      dir: outDir,
      exported: 3,
      totalMessages: 30,
    }),
    replayArchive: async () => ({ code: 'ok', replayed: 2, skipped: 1, failed: 0 }),
    defaultArchiveDir: () => '/fake/archive/root',
    ...over,
  }
}

test('① export 正常:用默认归档目录,导出枚数/消息数与 cookie 来源都进 note,零 cookie 明文', async () => {
  const r = await exportBeforeSwitch({ deps: deps() })
  assert.equal(r.ok, true)
  assert.equal(r.code, 'ok')
  assert.equal(r.archiveDir, '/fake/archive/root')
  assert.equal(r.exported, 3)
  assert.equal(r.totalMessages, 30)
  assert.match(r.note, /3 个会话/)
  assert.match(r.note, /fake-cookies/)
  // 零明文:cookie 值不许出现在任何返回字段
  assert.ok(!JSON.stringify(r).includes('SECRET_SHOULD_NOT_LEAK'))
  assert.ok(!JSON.stringify(r).includes('TOP_SECRET_VALUE'))
})

test('② export 指定归档目录:原样透传,不自己造第二个目录', async () => {
  let seen
  const r = await exportBeforeSwitch({
    archiveDir: '/given/dir',
    deps: deps({ exportArchive: async ({ outDir }) => ((seen = outDir), { code: 'ok', dir: outDir, exported: 1, totalMessages: 1 }) }),
  })
  assert.equal(seen, '/given/dir')
  assert.equal(r.archiveDir, '/given/dir')
})

test('③ export 旧号 cookie 不可用 ⇒ ok=false 但该轮不抛异常(写回照常的降级承诺)', async () => {
  const r = await exportBeforeSwitch({
    deps: deps({ readCookie: async () => ({ code: 'cookie-app-bound', message: 'app-bound 解不开' }) }),
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'cookie-app-bound')
  assert.equal(r.archiveDir, null)
  assert.match(r.note, /旧号登录态不可用/)
  assert.match(r.note, /写回照常/)
})

test('④ export 导出腿抛异常 ⇒ 归一化成 export-threw note,不冒泡', async () => {
  const r = await exportBeforeSwitch({
    deps: deps({ exportArchive: async () => { throw new Error('网络断了') } }),
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'export-threw')
  assert.match(r.note, /网络断了/)
})

test('⑤ replay 正常:传入归档目录,回放/跳过/失败计数进 note,零 cookie 明文', async () => {
  const r = await replayAfterSwitch({ archiveDir: '/fake/a', deps: deps() })
  assert.equal(r.ok, true)
  assert.equal(r.replayed, 2)
  assert.equal(r.skipped, 1)
  assert.equal(r.failed, 0)
  assert.match(r.note, /新会话 2/)
  assert.ok(!JSON.stringify(r).includes('SECRET_SHOULD_NOT_LEAK'))
})

test('⑥ replay 干跑(apply=false):标注未发送,不谎报已迁移', async () => {
  let seenApply
  const r = await replayAfterSwitch({
    archiveDir: '/fake/a',
    apply: false,
    deps: deps({ replayArchive: async ({ apply }) => ((seenApply = apply), { code: 'ok', replayed: 0, skipped: 0, failed: 0 }) }),
  })
  assert.equal(seenApply, false)
  assert.equal(r.ok, true)
  assert.match(r.note, /干跑/)
  assert.match(r.note, /未发送/)
})

test('⑦ replay 无归档目录(导出失败的下游):明确 no-archive,点名需手动补跑', async () => {
  const r = await replayAfterSwitch({ deps: deps() })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'no-archive')
  assert.match(r.note, /需手动补跑/)
})

test('⑧ replay 新号 cookie 不可用 ⇒ ok=false,不抛异常,登录态已切好的事实说清', async () => {
  const r = await replayAfterSwitch({
    archiveDir: '/fake/a',
    deps: deps({ readCookie: async () => ({ code: 'cookie-missing', message: '未登录' }) }),
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'cookie-missing')
  assert.match(r.note, /登录态已切好/)
})

test('⑨ 两阶段串联:export 的 archiveDir 直接喂给 replay,时序由调用方保证、模块不存全局态', async () => {
  const calls = []
  const shared = deps({
    exportArchive: async ({ outDir }) => {
      calls.push('export')
      return { code: 'ok', dir: outDir, exported: 1, totalMessages: 1 }
    },
    replayArchive: async ({ archiveDir, cookieHeader }) => {
      calls.push(`replay:${archiveDir}`)
      // export 用旧号、replay 用新号:这里只验 cookie 确实被逐阶段读取并传入,不验值本身
      assert.ok(cookieHeader)
      return { code: 'ok', replayed: 1, skipped: 0, failed: 0 }
    },
  })
  const e = await exportBeforeSwitch({ archiveDir: '/chain', deps: shared })
  const r = await replayAfterSwitch({ archiveDir: e.archiveDir, deps: shared })
  assert.equal(e.ok, true)
  assert.equal(r.ok, true)
  assert.deepEqual(calls, ['export', 'replay:/chain'])
})

// ===== 2026-11-24 导入入口分流 + 留档/交接单 测试 =====
test('⑩ export 成功后自动产出 ChatGPT 格式留档文件(逐条,非文本压包)', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const nodePath = await import('node:path')
  const tmp = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'doubao-import-'))
  try {
    const archive = nodePath.join(tmp, 'archive')
    fs.mkdirSync(archive, { recursive: true })
    fs.writeFileSync(
      nodePath.join(archive, 'index.json'),
      JSON.stringify({ conversations: [{ conversationId: 'c1', name: '旧会话', file: 'c1.json' }] }),
    )
    fs.writeFileSync(
      nodePath.join(archive, 'c1.json'),
      JSON.stringify({
        conversationId: 'c1',
        name: '旧会话',
        messages: [
          { role: 'user', content: '问', index: 1, createTime: 1763900000 },
          { role: 'assistant', content: '答', index: 2, createTime: 1763900005 },
        ],
      }),
    )
    const r = await exportBeforeSwitch({
      archiveDir: archive,
      deps: deps({
        exportArchive: async ({ outDir }) => ({ code: 'ok', dir: outDir, exported: 1, totalMessages: 2 }),
      }),
    })
    assert.equal(r.ok, true)
    assert.equal(r.importConversations, 1)
    assert.ok(r.importFile && r.importFile.endsWith('conversations.json'))
    const generated = JSON.parse(fs.readFileSync(r.importFile, 'utf8'))
    assert.equal(generated.length, 1)
    assert.equal(generated[0].title, '旧会话')
    assert.deepEqual(generated[0].mapping.n1.message.content.parts, ['问'])
    assert.deepEqual(generated[0].mapping.n2.message.content.parts, ['答'])
    assert.ok(!JSON.stringify(r).includes('SECRET_SHOULD_NOT_LEAK'))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('⑪ 双格式：realBuildImportFile 同时产出裸 JSON 与 ZIP', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const nodePath = await import('node:path')
  const tmp = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'doubao-dual-'))
  try {
    const archive = nodePath.join(tmp, 'archive')
    fs.mkdirSync(archive, { recursive: true })
    fs.writeFileSync(
      nodePath.join(archive, 'index.json'),
      JSON.stringify({ conversations: [{ conversationId: 'c1', name: '会话', file: 'c1.json' }] }),
    )
    fs.writeFileSync(
      nodePath.join(archive, 'c1.json'),
      JSON.stringify({
        conversationId: 'c1', name: '会话',
        messages: [{ role: 'user', content: '问', index: 1 }],
      }),
    )
    const out = nodePath.join(tmp, 'out', 'conversations.json')
    const { realBuildImportFile } = await import('../lib/doubao-auto-carry.mjs')
    const r = realBuildImportFile({ archiveDir: archive, outFile: out })
    assert.equal(r.ok, true)
    assert.equal(r.file, out)
    assert.equal(r.zipFile, nodePath.join(tmp, 'out', 'conversations.zip'))
    assert.ok(fs.existsSync(r.file), '裸 JSON 存在')
    assert.ok(fs.existsSync(r.zipFile), 'ZIP 存在')
    // ZIP 用 Python 风格魔数校验头
    const z = fs.readFileSync(r.zipFile)
    assert.equal(z.readUInt32LE(0), 0x04034b50, 'ZIP local header 魔数')
    assert.ok(r.note.includes('ZIP'), 'note 点名 ZIP(留档双载体,不是导入承诺)')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('⑫ profile 透传:exportBeforeSwitch 把 profile 原样交给 readCookie,note 点名 profile', async () => {
  let seen = null
  const r = await exportBeforeSwitch({
    profile: 'Profile 2',
    deps: deps({
      readCookie: async (opts) => {
        seen = opts
        return { code: 'ok', cookieHeader: COOKIE, count: 2, source: 'fake', profile: 'Profile 2' }
      },
      buildHandoffFile: () => ({ ok: true, file: '/fake/handoff.md', conversationId: 'c1', messages: 2, note: '交接单 ok' }),
    }),
  })
  assert.deepEqual(seen, { profile: 'Profile 2' })
  assert.equal(r.ok, true)
  assert.equal(r.profile, 'Profile 2')
  assert.match(r.note, /profile=Profile 2/)
  assert.equal(r.handoffFile, '/fake/handoff.md')
})

test('⑬ 导入清单按安装包形态分流:scan-apps 不承诺原生导入,file-pick 才给选文件', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const nodePath = await import('node:path')
  const tmp = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'doubao-import-mode-'))
  try {
    const file = nodePath.join(tmp, 'conversations.json')
    const zip = nodePath.join(tmp, 'conversations.zip')
    const handoff = nodePath.join(tmp, 'handoff.md')
    fs.writeFileSync(file, '[]')
    fs.writeFileSync(zip, 'PK')
    fs.writeFileSync(handoff, '# handoff')
    const exportResult = { ok: true, importFile: file, importZipFile: zip, handoffFile: handoff, importConversations: 2 }

    const scan = prepareImport({
      exportResult,
      deps: { probeImportSurface: () => ({ ok: true, mode: 'scan-apps', scanHits: ['a', 'b'], fileHits: [], note: 'scan' }) },
    })
    assert.equal(scan.ok, false)
    assert.equal(scan.code, 'import-surface-scan-only')
    assert.equal(scan.importMode, 'scan-apps')
    assert.match(scan.steps.join(' '), /粘贴/)
    assert.match(scan.note, /手搓文件无入口/)

    const pick = prepareImport({
      exportResult,
      deps: { probeImportSurface: () => ({ ok: true, mode: 'file-pick', scanHits: [], fileHits: ['a', 'b'], note: 'pick' }) },
    })
    assert.equal(pick.ok, true)
    assert.equal(pick.code, 'ok')
    assert.match(pick.steps.join(' '), /来源选 ChatGPT/)

    const unknown = prepareImport({
      exportResult,
      deps: { probeImportSurface: () => ({ ok: true, mode: 'unknown', scanHits: [], fileHits: [], note: 'unknown' }) },
    })
    assert.equal(unknown.ok, false)
    assert.equal(unknown.code, 'import-surface-unknown')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
