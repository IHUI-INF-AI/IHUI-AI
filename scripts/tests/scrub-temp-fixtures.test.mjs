/**
 * scripts/scrub-temp-fixtures.mjs 的镜像测试(§22c:源文件 export + 测试 import + isDirectRun 守卫)。
 *
 * 本工具会**删文件**,所以每条正向判定都必须配一条"绝不该被删"的诱饵负向对照:
 *   - 账龄未到 / 前缀不命中 → 不得进候选
 *   - 夹具内部藏着 `密钥` 目录 → 整条不许删,且必须点名
 *   - 夹具内部藏着 junction → 不得穿透(canary 必须活着)
 * junction 建不成时(非 win32 / 无权限)判"未判定"并**显式 skip**,绝不退化成"通过"。
 *
 * T14–T25 是第二腿(宿主自产散文件具名族)的证明面:前两族(`qoder-<4hex>-cwd` / `<uuid>.tmp.md`)
 * 各一条正控 + 三重闸(内容/大小/账龄)与保护名/到期/熔断各一条变异反控,
 * 再加默认档与 `--apply --dry-run` 两把"零删除"锁(T22)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  lstatSync,
  readdirSync,
  statSync,
  utimesSync,
  readFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  scan,
  del,
  formatReport,
  defaultRoots,
  scanHostStrays,
  formatHostStrayReport,
  isPathLikeBreadcrumb,
  hostStrayEffectiveMinAgeDays,
  hostStrayExpired,
  HOST_STRAY_FAMILIES,
  HOST_STRAY_ROUND_CAP,
} from '../scrub-temp-fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const keyish = (p) => resolve(p).toLowerCase().replace(/[\\/]+$/, '')
const DAY = 86400000
/** 用 utimesSync 改 mtime(目录也算),不依赖 shell */
const touchOld = (p, daysAgo = 30) => {
  const t = new Date(Date.now() - daysAgo * DAY)
  utimesSync(p, t, t)
}

const mkFixture = (root, name, { files = 1, ageDays = 30 } = {}) => {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  for (let i = 0; i < files; i++) writeFileSync(join(dir, `f${i}.bin`), Buffer.alloc(2048, i))
  touchOld(dir, ageDays)
  return dir
}

test('T1 老夹具进候选,且报告量到字节', () => {
  const root = mkScratch('scrub-t1')
  try {
    mkFixture(root, 'ihui-agents-ABC123', { files: 3 })
    mkdirSync(join(root, 'someone-else-workdir'), { recursive: true })
    writeFileSync(join(root, 'someone-else-workdir', 'keep.txt'), 'not ours')
    const r = scan({ root, minAgeDays: 7 })
    assert.equal(r.error, null)
    assert.deepEqual(r.candidates.map((c) => c.name), ['ihui-agents-ABC123'])
    assert.ok(r.candidates[0].bytes >= 3 * 2048, '字节必须量到,不得一律记 0')
    assert.equal(r.skipped.notOurs, 1)
    const line = formatReport(r, { apply: false, minAgeDays: 7 }).join('\n')
    assert.match(line, /候选 1/, '结论行必须报候选数')
  } finally {
    rmScratch(root)
  }
})

test('T2 账龄未到的夹具不得进候选(当日在跑的测试不许被删)', () => {
  const root = mkScratch('scrub-t2')
  try {
    mkFixture(root, 'ihui-fresh-now', { ageDays: 0 })
    mkFixture(root, 'ihui-old-then', { ageDays: 30 })
    const r = scan({ root, minAgeDays: 7 })
    assert.deepEqual(r.candidates.map((c) => c.name), ['ihui-old-then'])
    assert.equal(r.skipped.fresh, 1)
  } finally {
    rmScratch(root)
  }
})

test('T3 保护区硬阻断:夹具内含 `密钥` 子目录 ⇒ 整条不删且点名', () => {
  const root = mkScratch('scrub-t3')
  try {
    const dir = mkFixture(root, 'ihui-with-secrets', { files: 2 })
    mkdirSync(join(dir, '密钥'), { recursive: true })
    writeFileSync(join(dir, '密钥', 'master.txt'), 'DO NOT DELETE')
    touchOld(dir, 30) // 同 T4:造完内层再设龄,否则测到的是账龄闸而不是保护区闸
    const r = scan({ root, minAgeDays: 7 })
    assert.equal(r.candidates.length, 0, '藏着凭据目录的整条候选必须被拒')
    assert.equal(r.skipped.protected, 1)
    assert.equal(r.protectedPaths.length, 1)
    assert.match(r.protectedPaths[0].path, /密钥/)
    assert.equal(r.protectedPaths[0].name, 'ihui-with-secrets')
    assert.ok(r.protectedPaths[0].bytes > 0, '被保护闸挡住的条也必须量出体积(只报名字会把 11 GB 读成"没多少")')
    assert.equal(existsSync(join(dir, '密钥', 'master.txt')), true)
    assert.match(formatReport(r, { apply: true, minAgeDays: 7 }).join('\n'), /整条不删/)
  } finally {
    rmScratch(root)
  }
})

test('T4 junction 不得被穿透:canary 在 apply 之后必须原样活着', () => {
  const root = mkScratch('scrub-t4')
  const outside = mkScratch('scrub-t4-outside')
  try {
    const target = join(outside, 'real-user-data')
    mkdirSync(target, { recursive: true })
    const canary = join(target, 'canary.txt')
    writeFileSync(canary, 'must survive')

    const fixture = mkFixture(root, 'ihui-has-junction', { files: 1 })
    const link = join(fixture, 'link-into-real')
    // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
    const mk = spawnSync('cmd.exe', ['/c', 'mklink', '/J', link, target], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      encoding: 'utf8',
    })
    let madeLink = false
    try {
      madeLink = lstatSync(link).isSymbolicLink()
    } catch {
      madeLink = false
    }
    if (!madeLink) {
      // 建不成 link 就不能假装测过:显式判"未判定"
      assert.ok(
        mk.status !== 0 || process.platform !== 'win32',
        'lstat 未认作符号链接,但 mklink 报了 0 —— 尺子失效,须排查',
      )
      console.log('  ℹ️ T4 未判定:本机建不出 junction(非 win32 或无权限),该护栏未被证明')
      return
    }
    // 往目录里加条目会把它的 mtime 顶回当天 —— 必须在造完内容之后再设龄,
    // 否则测的是"账龄闸跳过新改动"这条正确行为,而不是 junction 护栏。
    touchOld(fixture, 30)
    const r = scan({ root, minAgeDays: 7 })
    const c = r.candidates.find((x) => x.name === 'ihui-has-junction')
    assert.ok(c, '夹具本身仍应是候选(link 只是它内部的一个条目)')
    assert.equal(c.links, 1, '内部重解析点必须被数出来')
    const d = del(root, [c])
    assert.equal(d.ok, 1)
    assert.equal(existsSync(canary), true, '❌ junction 被穿透,真实目标被删 —— 这是 §26 记过的自毁型事故')
    assert.equal(statSync(canary).size, 'must survive'.length)
  } finally {
    rmScratch(root)
    rmScratch(outside)
  }
})

test('T5 dry-run 不得产生任何删除(默认即只报告)', () => {
  const root = mkScratch('scrub-t5')
  try {
    mkFixture(root, 'ihui-old-a')
    mkFixture(root, 'ihui-old-b')
    const before = readdirSync(root).length
    const r = scan({ root, minAgeDays: 7 })
    formatReport(r, { apply: false, minAgeDays: 7 })
    assert.equal(readdirSync(root).length, before, 'scan + 报告必须是零副作用')
    assert.equal(r.candidates.length, 2)
  } finally {
    rmScratch(root)
  }
})

test('T6 del 只删候选,越出 root 的路径一律拒', () => {
  const root = mkScratch('scrub-t6')
  try {
    const keep = mkFixture(root, 'ihui-keep-me')
    const d = del(root, [{ name: 'escape', path: join(root, '..', 'definitely-not-inside'), dir: true, bytes: 0 }])
    assert.equal(d.ok, 0)
    assert.equal(d.fail, 1)
    assert.equal(existsSync(keep), true)
  } finally {
    rmScratch(root)
  }
})

test('T7 取不到目录 ⇒ 判"无法判定",不冒绿也不冒红', () => {
  const r = scan({ root: join(process.cwd(), 'no-such-dir-xyz-42'), minAgeDays: 7 })
  assert.ok(r.error, '必须给出原因')
  assert.equal(r.candidates.length, 0)
  const line = formatReport(r, { apply: false, minAgeDays: 7 }).join('\n')
  assert.match(line, /无法判定/)
})

test('T8 前缀围栏按"起始"判定:近似名与含前缀的他名不得被当成我们的', () => {
  const root = mkScratch('scrub-t8')
  try {
    // 这三个都不是以本项目前缀开头 —— 混进 TEMP 的他人产物,一条都不许进候选
    for (const n of ['my-ihui-workdir', 'ihui2-cache', 'xIHUI-tool']) mkdirSync(join(root, n), { recursive: true })
    mkdirSync(join(root, 'ihui-really-ours'), { recursive: true })
    for (const n of ['my-ihui-workdir', 'ihui2-cache', 'xIHUI-tool', 'ihui-really-ours']) touchOld(join(root, n), 40)
    const r = scan({ root, minAgeDays: 7 })
    assert.deepEqual(r.candidates.map((c) => c.name), ['ihui-really-ours'])
    assert.equal(r.skipped.notOurs, 3)
  } finally {
    rmScratch(root)
  }
})

test('T9 变异对照:把账龄闸改成 0 天会让当日夹具进候选(证明那条闸真的有牙)', () => {
  const root = mkScratch('scrub-t9')
  try {
    mkFixture(root, 'ihui-today', { ageDays: 0 })
    assert.equal(scan({ root, minAgeDays: 7 }).candidates.length, 0)
    assert.equal(scan({ root, minAgeDays: 0 }).candidates.length, 1)
  } finally {
    rmScratch(root)
  }
})

test('T10 多根并集、去重与跨盘探测:只按工作树盘推导会安静少扫整块盘(实测 18 GB 在另一块盘上)', () => {
  const dev = join(mkScratch('scrub-t10-dev'), 'DevEnv')
  try {
    mkdirSync(dev, { recursive: true })
    // 造两块"盘":A 上有历史落点,B 上只有一个 —— 判据必须是"存在才进集合",不得写死盘符
    const present = new Set([
      'a:\\',
      'b:\\',
      'a:\\caches\\temp',
      'a:\\devenv\\temp',
      'b:\\tmp',
      dev.toLowerCase(),
      join(dev, 'Temp').toLowerCase(),
    ])
    const exists = (p) => present.has(resolve(p).toLowerCase())
    const r = defaultRoots({ env: {}, tmp: join(dev, 'Temp'), devEnv: dev, exists, platform: 'win32' })
    const keys = r.roots.map((p) => p.toLowerCase())
    assert.ok(keys.includes('a:\\caches\\temp'.toLowerCase()), '另一块盘上的历史根必须进集合')
    assert.ok(keys.includes('b:\\tmp'), 'B 盘存在的那个形状也要进集合')
    assert.equal(keys.includes('a:\\tmp'), false, '盘上没有的形状不得凭空造一个根')
    assert.equal(r.roots.filter((p) => keyish(p) === keyish(join(dev, 'Temp'))).length, 1, '派生根与活 tmpdir 重合必须去重')
    assert.deepEqual(r.undetermined, [])
    // 额外声明根参与并集且同样去重
    const r2 = defaultRoots({ env: { IHUI_TEMP_SCRUB_ROOTS: `${dev};  ` }, tmp: '/nonexistent-tmp', devEnv: dev, exists, platform: 'win32' })
    assert.equal(r2.roots.filter((p) => resolve(p) === resolve(dev)).length, 1)
    // 非 win32 不做 26 盘探测(路径体系里没有盘符),只留 活 tmp + devEnv/Temp + 同盘两个历史形状。
    // 判据写成"条数"而不是"有没有盘符":本机跑测试时 resolve() 会给 posix 风格路径补上盘符前缀,
    // 拿字面盘符断言就会把宿主平台当成结论(该断的跨平台行为是"探测没跑",不是"路径长什么样")。
    const r3 = defaultRoots({ env: {}, tmp: '/var/tmp', devEnv: '/srv/.DevEnv', exists: () => true, platform: 'linux' })
    assert.equal(r3.roots.length, 4, `非 win32 只应有 4 个根(探测没跑),实测 ${JSON.stringify(r3.roots)}`)
    const r4 = defaultRoots({ env: {}, tmp: '/var/tmp', devEnv: '/srv/.DevEnv', exists: () => true, platform: 'win32' })
    assert.ok(r4.roots.length > 26, `win32 必须逐盘探过(A..Z 各 3 形状,存在即进),实测 ${r4.roots.length}`)
  } finally {
    rmScratch(join(dev, '..'))
  }
})

test('T11 推导失败必须落「未判定」而不是安静少扫两个根', () => {
  const r = defaultRoots({
    env: {},
    tmp: '/tmp/alive',
    exists: () => false,
    platform: 'win32',
    deriveDevEnv: () => {
      throw new Error('仓库根本身位于 scratch 夹具内')
    },
  })
  assert.equal(r.roots.length, 1, '派生根一律不进集合')
  assert.equal(r.undetermined.length, 1, '推导失败却什么都没记 ⇒ 这一格读起来像"没有别的根"')
  assert.match(r.undetermined[0], /夹具/)
})

test('T12 形状锁:根只能由共用出口推,不得写死盘符;汇总行必须是首条可读数', () => {
  const src = readFileSync(join(HERE, '..', 'scrub-temp-fixtures.mjs'), 'utf8')
  assert.match(src, /from '\.\/seal-c-root-stray\.mjs'/, '没引共用外置根出口 ⇒ 盘符推导就是第二份真相')
  assert.match(src, /deriveDevEnv\(\)/, 'defaultRoots 必须真调用那一份出口')
  // 写死的根清单必然腐烂(§4 对 RN_ONLY_BRAND_KEYS 同一条教训)
  assert.doesNotMatch(src, /(?:ROOTS|roots)\s*=\s*\[\s*['"`][A-Za-z]:[\\/]/, '出现写死盘符的根数组')
  assert.match(src, /console\.log\(\n?\s*`汇总 ·/, '汇总行必须真的打印出来 —— 调度器只认这一行的合计')
})

test('T13 端到端:--root 显式多根 + --apply 只动声明的根,汇总行给出跨根合计', () => {
  const a = mkScratch('scrub-t13-a')
  const b = mkScratch('scrub-t13-b')
  const gone = join(mkScratch('scrub-t13-gone'), 'no-longer-here')
  try {
    mkFixture(a, 'ihui-old-a', { files: 2 })
    mkFixture(b, 'ihui-old-b', { files: 1 })
    mkdirSync(join(b, 'not-ours'), { recursive: true })
    rmScratch(join(gone, '..'))
    const script = join(HERE, '..', 'scrub-temp-fixtures.mjs')
    // 会变异的脚本不接管道(SIGPIPE 会让它中途退出而账面看不出来)
    const run = spawnSync(process.execPath, [script, '--root', `${a};${b};${gone}`, '--apply', '--older-than', '7'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    })
    const out = `${run.stdout || ''}\n${run.stderr || ''}`
    assert.equal(run.status, 0, `退出码应为 0,实测 ${run.status}\n${out}`)
    assert.match(out, /该根不存在/, '不存在的根必须点名,不得被读成"已清扫"')
    assert.match(out, /汇总 · 根 3\(可判 2 \/ 不存在 1 \/ 取不到 0\)/, `汇总行形状不符\n${out}`)
    assert.match(out, /候选 2 ·/, '跨根候选必须相加,不得只报第一个根')
    assert.match(out, /已删 2 条 \/ 失败 0 条/)
    assert.equal(existsSync(join(a, 'ihui-old-a')), false)
    assert.equal(existsSync(join(b, 'ihui-old-b')), false)
    assert.equal(existsSync(join(b, 'not-ours')), true, '前缀不命中的他人条目一条都不许动')
    // 反向对照:不带 --apply 时零删除
    const a2 = mkScratch('scrub-t13-dry')
    try {
      mkFixture(a2, 'ihui-old-c')
      const dry = spawnSync(process.execPath, [script, '--root', a2, '--older-than', '7'], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      })
      assert.equal(dry.status, 0)
      assert.equal(existsSync(join(a2, 'ihui-old-c')), true, '默认档必须零副作用')
      assert.match(`${dry.stdout}`, /本轮未删除任何东西|候选 1/)
    } finally {
      rmScratch(a2)
    }
  } finally {
    rmScratch(a)
    rmScratch(b)
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * 第二腿:宿主自产散文件的具名族(2026-10-16 立)
 *
 * 这一腿碰的是**别人的程序**写进 TEMP 的散文件,所以每一族都必须同时有:
 *   ① 一条"该删的确实被删"正控(证明判据不是恒拒的摆设),
 *   ② 一条"摘掉这道闸就翻红"的变异反控(证明那道闸真的有牙 —— 大小闸/内容闸/账龄闸/保护名/到期/熔断各一条),
 *   ③ 默认档零删除的锁(本仓记过"预演照样真删了 29.8 MB")。
 * 夹具一律 mkScratch(§15b/§15c:不落仓库树、不落盘根、不跟随 os.tmpdir())。
 * ───────────────────────────────────────────────────────────────────────────── */

const QODER = 'qoder-cwd-breadcrumb'
const UUIDMD = 'uuid-tmp-md-fragment'
const famOf = (name, over = {}) => ({ ...HOST_STRAY_FAMILIES.find((f) => f.name === name), ...over })
/** 造一枚宿主散文件(普通文件 + 可控字节数 + 可控账龄) */
const mkStray = (root, name, { content = '/d/IHUI-AI\n', bytes = null, ageDays = 10 } = {}) => {
  const p = join(root, name)
  writeFileSync(p, bytes === null ? content : Buffer.alloc(bytes, 0x61))
  touchOld(p, ageDays)
  return p
}
const UUID_OK = '0f8e2a6b-1c3d-4e5f-8a9b-0c1d2e3f4a5b.tmp.md'

test('T14 内容闸纯函数:单行且像路径才过;不写死盘符、不把 \\ 归一(跨平台可测)', () => {
  const yes = ['/d/IHUI-AI\n', 'D:\\x\\y', 'd:/x/y', 'C:\\\\Users\\\\me', '\\\\srv\\share\\a', '//srv/share/a', '/x']
  const no = ['', '   \n', '/d/a\n/d/b\n', 'https://a.example/b', './relative/x', '---\nname: skill\n---\n', '12345', 'x', '/d/a\n\x07bad']
  for (const t of yes) assert.equal(isPathLikeBreadcrumb(t), true, `应判为路径面包屑:${JSON.stringify(t)}`)
  for (const t of no) assert.equal(isPathLikeBreadcrumb(t), false, `不应判为路径面包屑:${JSON.stringify(t)}`)
  // 反证"没把 \ 归一成 /":同一含义的两种写法必须都接受(判据是文本形状,与宿主平台无关)
  assert.equal(isPathLikeBreadcrumb('D:\\x'), isPathLikeBreadcrumb('D:/x'))
})

test('T15 族 qoder-cwd-breadcrumb:正控该删的被删 + 四道闸各一条反控(摘闸即翻红)', () => {
  const root = mkScratch('scrub-t15')
  try {
    mkStray(root, 'qoder-0a1b-cwd', { content: '/d/IHUI-AI\n', ageDays: 10 }) // ① 唯一正控
    mkStray(root, 'qoder-0a1c-cwd', { content: '/d/' + 'x'.repeat(62) }) // 大小闸:65 B(内容仍是合格面包屑)
    mkStray(root, 'qoder-0a1d-cwd', { content: '/d/a\n/d/b\n' }) // 内容闸:两行
    mkStray(root, 'qoder-0a1e-cwd', { ageDays: 2 }) // 账龄闸:族档 3 天未到
    mkdirSync(join(root, 'qoder-0a1f-cwd')) // 形状闸:同名目录(这一腿绝不递归)
    touchOld(join(root, 'qoder-0a1f-cwd'), 30)
    mkStray(root, 'qoder-xyzw-cwd') // 名不吻合(非 4 位 hex)⇒ 连候选都不进
    const h = scanHostStrays({ root, families: [famOf(QODER)], minAgeDays: 0 })
    assert.equal(h.error, null)
    assert.deepEqual(h.candidates.map((c) => c.name), ['qoder-0a1b-cwd'], '只有四道闸全过的才进候选')
    assert.equal(h.candidates[0].dir, false, '候选必须是散文件形状(删除出口 recursive:false)')
    const f = h.families[0]
    assert.equal(f.rejected.tooBig, 1)
    assert.equal(f.rejected.content, 1)
    assert.equal(f.rejected.fresh, 1)
    assert.equal(f.rejected.notPlainFile, 1)
    assert.equal(h.other, 1, '名字不吻合的散文件必须计入"族外不判",不得静默')
    // 反控(变异对照):把大小闸摘掉 ⇒ 那枚 65 B 的就进候选 —— 证明拦住它的是大小闸,不是别处
    const loose = scanHostStrays({ root, families: [famOf(QODER, { maxBytes: 4096 })], minAgeDays: 0 })
    assert.deepEqual(loose.candidates.map((c) => c.name), ['qoder-0a1b-cwd', 'qoder-0a1c-cwd'])
    // 反控:把账龄闸摘到 0 天 ⇒ 两日龄的进候选(证明账龄闸有牙)
    const noAge = scanHostStrays({ root, families: [famOf(QODER, { minAgeDays: 0 })], minAgeDays: 0 })
    assert.ok(
      noAge.candidates.some((c) => c.name === 'qoder-0a1e-cwd'),
      `账龄闸摘掉后 2 日龄的必须进候选,实测 ${JSON.stringify(noAge.candidates.map((c) => c.name))}`,
    )
    assert.equal(noAge.families[0].rejected.fresh, 0)
    // 反控:内容闸摘掉(family 不声明 content)⇒ 两行那枚也进候选
    const noContent = scanHostStrays({ root, families: [famOf(QODER, { content: null })], minAgeDays: 0 })
    assert.ok(noContent.candidates.some((c) => c.name === 'qoder-0a1d-cwd'))
    // 正控的删除侧:候选交给唯一删除出口后必须真消失,且反控那些一条都不动
    const d = del(root, h.candidates)
    assert.equal(d.ok, 1)
    assert.equal(d.fail, 0)
    assert.equal(existsSync(join(root, 'qoder-0a1b-cwd')), false)
    for (const keep of ['qoder-0a1c-cwd', 'qoder-0a1d-cwd', 'qoder-0a1e-cwd', 'qoder-0a1f-cwd', 'qoder-xyzw-cwd'])
      assert.equal(existsSync(join(root, keep)), true, `${keep} 不该被动`)
  } finally {
    rmScratch(root)
  }
})

test('T16 族 uuid-tmp-md:正控 + 大小闸/账龄闸/形状反控(摘闸即翻红)', () => {
  const root = mkScratch('scrub-t16')
  try {
    mkStray(root, UUID_OK, { content: '---\nname: skill\n---\n正文\n', ageDays: 10 })
    mkStray(root, '11111111-1111-4111-8111-111111111111.tmp.md', { bytes: 65537 }) // > 64 KB
    mkStray(root, '22222222-2222-4222-8222-222222222222.tmp.md', { ageDays: 6 }) // 账龄未到(族档 7 天)
    mkStray(root, '3333333g-3333-4333-8333-333333333333.tmp.md') // 非法 UUID 形状
    mkdirSync(join(root, '44444444-4444-4444-8444-444444444444.tmp.md')) // 同名目录
    touchOld(join(root, '44444444-4444-4444-8444-444444444444.tmp.md'), 30)
    const h = scanHostStrays({ root, families: [famOf(UUIDMD)], minAgeDays: 0 })
    assert.deepEqual(h.candidates.map((c) => c.name), [UUID_OK])
    const f = h.families[0]
    assert.equal(f.rejected.tooBig, 1)
    assert.equal(f.rejected.fresh, 1)
    assert.equal(f.rejected.notPlainFile, 1)
    assert.equal(h.other, 1, '非法 UUID 形状一律族外不判(严格式比简报的宽松式紧,不收 secret 之类名字)')
    assert.equal(f.content, null, '这一族的简报只要求大小闸 ⇒ 内容闸必须显式记"未声明",不得假装判过')
    const loose = scanHostStrays({ root, families: [famOf(UUIDMD, { maxBytes: 1 << 20 })], minAgeDays: 0 })
    assert.ok(loose.candidates.some((c) => c.name.startsWith('11111111')), '大小闸是唯一拦住它的闸')
    const d = del(root, h.candidates)
    assert.equal(d.ok, 1)
    assert.equal(existsSync(join(root, UUID_OK)), false)
    assert.equal(existsSync(join(root, '22222222-2222-4222-8222-222222222222.tmp.md')), true)
  } finally {
    rmScratch(root)
  }
})

test('T17 名称保护词 / PROTECTED_NAMES 硬拒:同形对照证明拒它的是名字闸', () => {
  const root = mkScratch('scrub-t17')
  try {
    // 注入一族群名够松的族,让"带保护词的名字"真能落进射程(生产族形吻合 ⇒ 落不进来)
    const looseFam = { ...famOf(QODER), re: /^probe-(plain|secret|token|apikey)-cwd$/i }
    for (const n of ['probe-plain-cwd', 'probe-secret-cwd', 'probe-token-cwd', 'probe-apikey-cwd', 'backups'])
      mkStray(root, n)
    mkStray(root, 'probe-secret-cwd', { content: '/d/keys/id_rsa\n' })
    const h = scanHostStrays({ root, families: [looseFam, { ...famOf(QODER), re: /^backups$/i }], minAgeDays: 0 })
    assert.deepEqual(h.candidates.map((c) => c.name), ['probe-plain-cwd'], '命中 key/secret/token/apikey 或保护名的一律不碰')
    const rej = h.families.reduce((a, f) => a + f.rejected.nameGuard, 0)
    assert.equal(rej, 4, `四条带保护词的都必须被名字闸拒收,实测 ${rej}`)
    const d = del(root, h.candidates)
    assert.equal(d.ok, 1)
    for (const keep of ['probe-secret-cwd', 'probe-token-cwd', 'probe-apikey-cwd', 'backups'])
      assert.equal(existsSync(join(root, keep)), true, `${keep} 必须原样活着`)
  } finally {
    rmScratch(root)
  }
})

test('T18 到期即回退:reviewBy 过期 ⇒ 整族不碰并报名;日期写坏也当作已到期(失效方向 = 少删)', () => {
  const root = mkScratch('scrub-t18')
  try {
    mkStray(root, 'qoder-0b1b-cwd')
    const expired = { ...famOf(QODER), reviewBy: '2020-01-01' }
    const h = scanHostStrays({ root, families: [expired], minAgeDays: 0, today: new Date('2026-10-16T00:00:00Z') })
    assert.equal(h.candidates.length, 0)
    assert.equal(h.families[0].rejected.expired, 1)
    assert.match(formatHostStrayReport(h, { apply: true }).join('\n'), /已到期/, '到期必须报名,不能被读成"没有残留"')
    // 同一条夹具,族未到期 ⇒ 进候选(证明拦住它的是到期闸)
    const live = scanHostStrays({ root, families: [famOf(QODER)], minAgeDays: 0, today: new Date('2026-10-16T00:00:00Z') })
    assert.equal(live.candidates.length, 1)
    assert.equal(hostStrayExpired({ reviewBy: '不是日期' }, new Date('2026-10-16T00:00:00Z')), true)
    assert.equal(hostStrayExpired({ reviewBy: '2099-01-01' }, new Date('2026-10-16T00:00:00Z')), false)
  } finally {
    rmScratch(root)
  }
})

test('T19 族级熔断:单轮候选超上限 ⇒ 整族本轮不删(不是删到上限为止)', () => {
  const root = mkScratch('scrub-t19')
  try {
    for (let i = 0; i < 5; i++) mkStray(root, `qoder-0c1${i}-cwd`)
    const tripped = scanHostStrays({ root, families: [famOf(QODER)], minAgeDays: 0, cap: 3 })
    assert.equal(tripped.candidates.length, 0, '熔断是整族不删')
    assert.equal(tripped.families[0].breakerTripped, true)
    assert.equal(tripped.families[0].rejected.breaker, 5)
    assert.equal(tripped.families[0].bytes, 0, '熔断后族体积也必须归零,否则报告读成" candidate 0 · 却有 MB"')
    assert.match(formatHostStrayReport(tripped, { apply: true }).join('\n'), /熔断/)
    const under = scanHostStrays({ root, families: [famOf(QODER)], minAgeDays: 0, cap: 5 })
    assert.equal(under.candidates.length, 5, '上限之内照删:熔断不是恒拒')
    for (let i = 0; i < 5; i++) assert.equal(existsSync(join(root, `qoder-0c1${i}-cwd`)), true, '预演档一条都不许删')
    assert.ok(HOST_STRAY_ROUND_CAP >= 20000, '上限出处 = 实测日新增峰值 2,100 枚 × 7 天账龄 ≈ 14,700 的 1.36 倍')
  } finally {
    rmScratch(root)
  }
})

test('T20 账龄闸合成:族档是下限,命令行只许加严、调不穿', () => {
  assert.equal(hostStrayEffectiveMinAgeDays({ minAgeDays: 3 }, 0), 3)
  assert.equal(hostStrayEffectiveMinAgeDays({ minAgeDays: 3 }, 7), 7)
  // 要求值读成 NaN(调用方参数坏掉)⇒ 回落默认 7 天:**加严**而非放到 0(失效方向必须是要一次定向说明)
  assert.equal(hostStrayEffectiveMinAgeDays({ minAgeDays: 3 }, Number.NaN), 7)
  assert.equal(hostStrayEffectiveMinAgeDays({ minAgeDays: Number.NaN }, 0), 7)
  const root = mkScratch('scrub-t20')
  try {
    mkStray(root, 'qoder-0d1a-cwd', { ageDays: 4 })
    // 就算 --older-than 0,族档 3 天仍在(4 天龄 ⇒ 过);但把族档当 7 天时它就被拒
    assert.equal(scanHostStrays({ root, families: [famOf(QODER)], minAgeDays: 0 }).candidates.length, 1)
    const strict = scanHostStrays({ root, families: [famOf(QODER)], minAgeDays: 7 })
    assert.equal(strict.candidates.length, 0)
    assert.equal(strict.families[0].minAgeDays, 7)
    assert.equal(strict.families[0].rejected.fresh, 1)
  } finally {
    rmScratch(root)
  }
})

test('T21 重解析点绝不穿透:具名族遇 junction 只拒收,canary 必须活着', () => {
  const root = mkScratch('scrub-t21')
  const outside = mkScratch('scrub-t21-outside')
  try {
    const target = join(outside, 'real-host-data')
    mkdirSync(target, { recursive: true })
    const canary = join(target, 'canary.txt')
    writeFileSync(canary, 'must survive')
    const link = join(root, 'qoder-0e1a-cwd')
    const mk = spawnSync('cmd.exe', ['/c', 'mklink', '/J', link, target], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      encoding: 'utf8',
    })
    let made = false
    try {
      made = lstatSync(link).isSymbolicLink()
    } catch {
      made = false
    }
    if (!made) {
      assert.ok(
        mk.status !== 0 || process.platform !== 'win32',
        'lstat 未认作符号链接,但 mklink 报了 0 —— 尺子失效,须排查',
      )
      console.log('  ℹ️ T21 未判定:本机建不出 junction,该护栏未被证明')
      return
    }
    const h = scanHostStrays({ root, families: [famOf(QODER)], minAgeDays: 0 })
    assert.equal(h.candidates.length, 0)
    assert.equal(h.families[0].rejected.reparse, 1)
    assert.match(formatHostStrayReport(h, { apply: true }).join('\n'), /reparse 1/)
    assert.equal(existsSync(canary), true, '❌ 顺着 junction 递归 = §26 的自毁型事故')
    assert.equal(existsSync(link), true, '这一腿不断链,只拒收')
  } finally {
    rmScratch(root)
    rmScratch(outside)
  }
})

test('T22 默认档零删除 + --apply --dry-run 覆盖:删除出口 del() 一次都不许被走到', () => {
  const root = mkScratch('scrub-t22')
  const script = join(HERE, '..', 'scrub-temp-fixtures.mjs')
  const run = (extra) =>
    spawnSync(process.execPath, [script, '--root', root, '--older-than', '7', ...extra], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    })
  try {
    mkStray(root, 'qoder-0f1a-cwd')
    mkStray(root, UUID_OK, { content: '---\nname: skill\n---\n' })
    mkFixture(root, 'ihui-old-prefix')
    const def = run([])
    assert.equal(def.status, 0, def.stdout + def.stderr)
    assert.match(def.stdout, /宿主散文件具名族/)
    assert.match(def.stdout, /候选 3 ·/, `汇总行必须把两腿相加(前缀 1 + 具名族 2)\n${def.stdout}`)
    assert.match(def.stdout, /本轮未删除任何东西/)
    assert.match(def.stdout, /已删 0 条 \/ 失败 0 条/, '默认档汇总行的删除计数必须是 0')
    for (const n of ['qoder-0f1a-cwd', UUID_OK, 'ihui-old-prefix'])
      assert.equal(existsSync(join(root, n)), true, `${n} 在默认档被删了 ⇒ 预演真删事故回潮`)
    const dry = run(['--apply', '--dry-run'])
    assert.equal(dry.status, 0, dry.stdout + dry.stderr)
    assert.match(dry.stdout, /--dry-run 覆盖 --apply/)
    assert.match(dry.stdout, /已删 0 条/)
    for (const n of ['qoder-0f1a-cwd', UUID_OK, 'ihui-old-prefix'])
      assert.equal(existsSync(join(root, n)), true, `${n} 在 --dry-run 档被删了`)
  } finally {
    rmScratch(root)
  }
})

test('T23 --apply 端到端:两腿合计进汇总行(调度器只读那一行)', () => {
  const root = mkScratch('scrub-t23')
  try {
    mkFixture(root, 'ihui-old-leg1')
    mkStray(root, 'qoder-1a1a-cwd')
    mkStray(root, UUID_OK, { content: '---\nname: skill\n---\n' })
    mkStray(root, 'qoder-1b1b-cwd', { bytes: 65 }) // 大小闸外,必须留着
    const script = join(HERE, '..', 'scrub-temp-fixtures.mjs')
    const out = spawnSync(process.execPath, [script, '--root', root, '--apply', '--older-than', '7'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    })
    assert.equal(out.status, 0, out.stdout + out.stderr)
    assert.match(out.stdout, /候选 3 ·/, `汇总行必须把两腿候选相加\n${out.stdout}`)
    assert.match(out.stdout, /已删 3 条 \/ 失败 0 条/)
    assert.match(out.stdout, /宿主散文件已删 2 条/)
    assert.equal(existsSync(join(root, 'ihui-old-leg1')), false)
    assert.equal(existsSync(join(root, 'qoder-1a1a-cwd')), false)
    assert.equal(existsSync(join(root, UUID_OK)), false)
    assert.equal(existsSync(join(root, 'qoder-1b1b-cwd')), true, '大小闸外的一枚必须原样活着')
    // 根取不到目录清单(指到一个文件上)⇒ 汇总行"取不到 1",退出码 2:两腿都不许冒绿
    const bad = spawnSync(process.execPath, [script, '--root', join(root, 'qoder-1b1b-cwd'), '--apply'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    })
    assert.equal(bad.status, 2, `取不到根必须以 2 出局\n${bad.stdout}`)
    assert.match(bad.stdout, /取不到 1/, `汇总行必须点名取不到的根\n${bad.stdout}`)
  } finally {
    rmScratch(root)
  }
})

test('T24 删除失败必须响:del() 记下枚数与首个原因', () => {
  const root = mkScratch('scrub-t24')
  try {
    const dir = join(root, 'qoder-1c1c-cwd')
    mkdirSync(dir)
    writeFileSync(join(dir, 'inner.txt'), 'x')
    touchOld(dir, 30)
    // 把目录伪装成散文件候选(dir:false)⇒ 唯一删除出口必须失败并给出原因,不是静默 ok
    const d = del(root, [{ name: 'qoder-1c1c-cwd', path: dir, dir: false, bytes: 1 }])
    assert.equal(d.ok, 0)
    assert.equal(d.fail, 1)
    assert.ok(d.firstError, '失败原因必须被记下来,否则"失败 1 条"在日志里是哑的')
    assert.match(d.firstError, /qoder-1c1c-cwd/)
    const d2 = del(root, [{ name: 'escape', path: join(root, '..', 'outside-me'), dir: false, bytes: 0 }])
    assert.equal(d2.fail, 1)
    assert.match(d2.firstError, /越出/, '路径越出 root 的原因必须与 I/O 故障分得开')
  } finally {
    rmScratch(root)
  }
})

test('T25 表锁:每条族必须带 why/owner/reviewBy 且两头锚定,射程不得吃进前缀族', () => {
  assert.ok(HOST_STRAY_FAMILIES.length >= 2, `具名族至少两条,实测 ${HOST_STRAY_FAMILIES.length}`)
  const names = new Set()
  for (const f of HOST_STRAY_FAMILIES) {
    assert.ok(f.name && !names.has(f.name), `族名缺失或重复:${f.name}`)
    names.add(f.name)
    assert.ok(f.re instanceof RegExp && f.re.source.startsWith('^') && f.re.source.endsWith('$'), `${f.name} 正则必须两头锚定`)
    assert.ok(f.maxBytes > 0 && f.maxBytes <= 65536, `${f.name} 大小闸必须显式且 ≤64KB`)
    assert.ok(Number.isFinite(f.minAgeDays) && f.minAgeDays >= 3, `${f.name} 账龄下限不得比 3 天更激进`)
    assert.ok(String(f.why).length >= 20, `${f.name} 缺 why ⇒ 凭什么可删没人答`)
    assert.ok(String(f.owner).trim().length > 0, `${f.name} 缺 owner`)
    assert.ok(Number.isFinite(Date.parse(f.reviewBy)), `${f.name} 的 reviewBy 必须是可解析日期`)
    assert.ok(f.content === null || f.content === 'singlePathLine', `${f.name} 声明了没实现的内容闸`)
  }
  // 两族都不得把前缀族的条目一起带走(第二腿不是放宽第一腿的通道)
  for (const probe of ['ihui-abcd-cwd', 'IHUI-0a1b-cwd', 'next-backup-1a2b-cwd', 'probe-abcd-cwd', 'ihui-0f8e2a6b-1c3d-4e5f-8a9b-0c1d2e3f4a5b.tmp.md'])
    for (const f of HOST_STRAY_FAMILIES) assert.equal(f.re.test(probe), false, `${f.name} 吃进了前缀族条目:${probe}`)
})
