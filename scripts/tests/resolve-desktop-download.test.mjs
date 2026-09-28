// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// §22c 镜像测试:scripts/resolve-desktop-download.mjs 的「updaterPlatforms 变窄 ⇒ 拒写」护栏。
//
// 为什么必须存在:该护栏是 2026-09-27(e52f0ae3a)加的,加的当轮**一次也没端到端触发过**
// —— 降级条件当时没再现,它只经过代码审阅。而线上 https://aizhs.top/desktop-feed.json 此刻
// 真的只剩 windows-x86_64 一键(Gitee 的 desktop-v0.1.49 只有 Windows 安装包,GitHub 源一旦
// 取不到,解析器就产出单键快照并写盘)。判据失效的表现永远是安静:这里把它变成"喂进少一键
// 的构造面当场必红"。测试不碰网络 —— 线上数据经 runCli 的 deps.resolveOnlineImpl 注入。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as rdd } from '../resolve-desktop-download.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const REPO_SNAPSHOT = join(ROOT, 'apps', 'web', 'src', 'config', 'desktop-feed.generated.ts')
const SRC = join(ROOT, 'scripts', 'resolve-desktop-download.mjs')
const SELF = join(HERE, 'resolve-desktop-download.test.mjs')

const KEYS4 = ['windows-x86_64', 'linux-x86_64', 'darwin-x86_64', 'darwin-aarch64']
const FORMAT_OF = {
  'windows-x86_64': 'Windows NSIS exe',
  'linux-x86_64': 'Linux AppImage',
  'darwin-x86_64': 'macOS DMG',
  'darwin-aarch64': 'macOS DMG',
}

/** 构造一份与真实快照同形状的 feed 对象(assets 与 updaterPlatforms 按键派生)。 */
function feed(keys, sigSuffix = 'a') {
  return {
    version: '0.1.49',
    releaseDate: '2026-09-27',
    githubReleasesUrl: 'https://example.invalid/releases',
    resolvedFromTag: 'desktop-v0.1.49',
    resolvedAt: '2026-09-27T00:00:00.000Z',
    assets: keys.map((k) => ({
      href: `https://example.invalid/${k}-${sigSuffix}.bin`,
      sizeBytes: 1024,
      format: FORMAT_OF[k] || 'Linux DEB',
      arch: 'x64',
      signature: `sig-${k}-${sigSuffix}`,
    })),
    updaterPlatforms: Object.fromEntries(
      keys.map((k) => [
        k,
        {
          url: `https://example.invalid/${k}-${sigSuffix}.bin`,
          signature: `sig-${k}-${sigSuffix}`,
        },
      ]),
    ),
  }
}

/** 捕获 console.log(判据要点名丢了哪个键 —— 只看退出码会把"为错理由判红"读成对)。 */
/* eslint-disable no-console -- 捕获器必须替换 console 本体:源脚本的 log() 就走这一道 */
async function capture(fn) {
  const lines = []
  const orig = console.log
  const origErr = console.error
  console.log = (...a) => lines.push(a.join(' '))
  console.error = (...a) => lines.push(a.join(' '))
  try {
    return { out: await fn(), log: lines.join('\n') }
  } finally {
    console.log = orig
    console.error = origErr
  }
}
/* eslint-enable no-console */

/* ────────────── 判据构造面:四条正反对照(纯函数,不碰盘不碰网) ────────────── */

test('N1 少一键 ⇒ blocked,且点名丢的就是那一键', () => {
  const r = rdd.decidePlatformNarrowing({
    baselineExists: true,
    baseline: feed(KEYS4),
    online: feed(KEYS4.slice(1)),
  })
  assert.equal(r.verdict, 'blocked')
  assert.equal(r.reason, 'narrowed')
  assert.deepEqual(r.lost, [KEYS4[0]])
})

test('N2 键集相同、只有值(签名/URL)变了 ⇒ 不得判红(否则每次正常发版都被拦死)', () => {
  const r = rdd.decidePlatformNarrowing({
    baselineExists: true,
    baseline: feed(KEYS4, 'a'),
    online: feed(KEYS4, 'b'),
  })
  assert.equal(r.verdict, 'allow', `正常发版被判红:${JSON.stringify(r)}`)
  assert.deepEqual(r.lost, [])
})

test('N3 线上是基线的超集(平台变多)⇒ 不得判红', () => {
  const r = rdd.decidePlatformNarrowing({
    baselineExists: true,
    baseline: feed(KEYS4.slice(0, 3)),
    online: feed(KEYS4),
  })
  assert.equal(r.verdict, 'allow')
  assert.equal(r.reason, 'not-narrowed')
})

test('N4 显式 ALLOW_NARROWER_FEED ⇒ 放行(人工出口必须是活的)', () => {
  const blocked = rdd.decidePlatformNarrowing({
    baselineExists: true,
    baseline: feed(KEYS4),
    online: feed(['windows-x86_64']),
  })
  assert.equal(blocked.verdict, 'blocked', '前提不成立:这一份构造面本来就该判窄,放行对照无意义')
  const allowed = rdd.decidePlatformNarrowing({
    baselineExists: true,
    baseline: feed(KEYS4),
    online: feed(['windows-x86_64']),
    allowNarrower: true,
  })
  assert.equal(allowed.verdict, 'allow')
  assert.equal(allowed.reason, 'explicit-allow')
})

test('N5 基线文件本就不存在 ⇒ 判"没判"(blind),既不冒绿也不冒红', () => {
  const r = rdd.decidePlatformNarrowing({
    baselineExists: false,
    baseline: null,
    online: feed(['windows-x86_64']),
  })
  assert.equal(r.verdict, 'blind')
  assert.equal(r.reason, 'no-baseline')
})

test('N6 基线在位但读不出 ⇒ 拒写(旧实现在这里差集恒空,护栏对整型永不触发)', () => {
  const r = rdd.decidePlatformNarrowing({
    baselineExists: true,
    baseline: null,
    online: feed(['windows-x86_64']),
  })
  assert.equal(r.verdict, 'blocked')
  assert.equal(r.reason, 'baseline-unreadable')
})

test('N7 线上 updaterPlatforms 整个空掉 ⇒ blocked 且丢的是全部基线键', () => {
  const empty = feed(KEYS4)
  delete empty.updaterPlatforms
  const r = rdd.decidePlatformNarrowing({
    baselineExists: true,
    baseline: feed(KEYS4),
    online: empty,
  })
  assert.equal(r.verdict, 'blocked')
  assert.deepEqual(r.lost, KEYS4)
})

/* ────────────── 端到端:真退出码 + 真字节(注入快照落点,不碰仓库) ────────────── */

/** 在临时目录里造一份"4 键旧快照",返回 {dir, snap, before}。 */
function scratchSnapshot(keys) {
  const dir = mkScratch('resolve-feed-')
  const snap = join(dir, 'desktop-feed.generated.ts')
  writeFileSync(snap, rdd.serializeSnapshot(feed(keys)), 'utf-8')
  return { dir, snap, before: readFileSync(snap, 'utf-8') }
}

test('E1 端到端:基线 4 键 + 线上只回 1 键 ⇒ 退出码 1,且快照文件一个字节都没动', async () => {
  const { dir, snap, before } = scratchSnapshot(KEYS4)
  const repoBefore = readFileSync(REPO_SNAPSHOT, 'utf-8')
  try {
    const { out, log } = await capture(() =>
      rdd.runCli(
        [],
        { [rdd.IHUI_FEED_SNAPSHOT_ENV]: snap },
        { resolveOnlineImpl: async () => feed(['windows-x86_64']) },
      ),
    )
    assert.equal(out, 1, `变窄没拦住:护栏只经过审阅、没有实证的那一型。输出:\n${log}`)
    assert.match(
      log,
      /updaterPlatforms 比现有快照少/,
      `退出码对但理由不对(必须是"变窄"而不是"基线读不出"):\n${log}`,
    )
    assert.match(log, /linux-x86_64/, '必须点名丢掉的键,否则报告无法定位')
    assert.doesNotMatch(log, /解不出 DESKTOP_FEED/, '把"读不出基线"当理由也是拦对了但说错了')
    assert.equal(readFileSync(snap, 'utf-8'), before, '被拒的写入仍然改了快照文件')
    assert.equal(
      readFileSync(REPO_SNAPSHOT, 'utf-8'),
      repoBefore,
      '注入通道没生效,写到了仓库内快照 ⇒ 测试在改真产物',
    )
  } finally {
    rmScratch(dir)
  }
})

test('E2 端到端:带 ALLOW_NARROWER_FEED=1 ⇒ 退出码 0 且写的就是注入路径那份(证明通道管写,不只是管读)', async () => {
  const { dir, snap, before } = scratchSnapshot(KEYS4)
  const repoBefore = readFileSync(REPO_SNAPSHOT, 'utf-8')
  try {
    const { out } = await capture(() =>
      rdd.runCli(
        [],
        { [rdd.IHUI_FEED_SNAPSHOT_ENV]: snap, [rdd.ALLOW_NARROWER_ENV]: '1' },
        { resolveOnlineImpl: async () => feed(['windows-x86_64']) },
      ),
    )
    assert.equal(out, 0, '人工放行出口是死的 ⇒ 护栏就没有出路')
    const after = readFileSync(snap, 'utf-8')
    assert.notEqual(after, before, '放行后没写盘 ⇒ E1 的"没改写"证据不成立(可能根本没走到写路径)')
    const parsed = await rdd.readLocalSnapshot(snap)
    assert.deepEqual(
      Object.keys(parsed.updaterPlatforms),
      ['windows-x86_64'],
      '写进去的不是线上那份数据',
    )
    assert.equal(
      readFileSync(REPO_SNAPSHOT, 'utf-8'),
      repoBefore,
      '放行档把仓库内快照写掉了 ⇒ 通道只管读不管写',
    )
  } finally {
    rmScratch(dir)
  }
})

test('E3 端到端:注入路径指向不存在的文件 ⇒ 退出码 0 且报告里喊"护栏无基线可比"(不得静默算通过)', async () => {
  const dir = mkScratch('resolve-feed-')
  const snap = join(dir, 'nope-generated.ts')
  try {
    const { out, log } = await capture(() =>
      rdd.runCli(
        [],
        { [rdd.IHUI_FEED_SNAPSHOT_ENV]: snap },
        { resolveOnlineImpl: async () => feed(['windows-x86_64']) },
      ),
    )
    assert.equal(out, 0, '首次生成属正当路径,不该被护栏拦死')
    assert.match(
      log,
      /护栏无基线可比|无基线可比/,
      `没有基线却没喊出来 = 把"没判"写成"判过了":\n${log}`,
    )
  } finally {
    rmScratch(dir)
  }
})

/* ────────────── 阳性对照:判据必须看得见真实入库快照(§22c 反"夹具只复读实现") ────────────── */

const headSnapshot = execFileSync(
  'git',
  [
    '-c',
    'safe.directory=*',
    '-C',
    ROOT,
    'show',
    'HEAD:apps/web/src/config/desktop-feed.generated.ts',
  ],
  {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    timeout: 120_000,
  },
)

test('P1 真仓 HEAD 快照必须被 parseSnapshot 解出非空平台键集(解不出=判据对该文件失明)', () => {
  const real = rdd.parseSnapshot(headSnapshot)
  assert.ok(real, 'parseSnapshot 对真实入库文件返回 null ⇒ 护栏拿不到基线,测试夹具再怎么绿都没用')
  const keys = Object.keys(real.updaterPlatforms || {})
  assert.ok(
    keys.length >= 1,
    `真实快照解出 0 键 —— 先怀疑尺子(解析式漂了),再相信世界:${JSON.stringify(Object.keys(real))}`,
  )
})

test('P2 用真实快照当基线喂同一判据:任意少一键都必须 blocked 并点名那一键', () => {
  const real = rdd.parseSnapshot(headSnapshot)
  const keys = Object.keys(real.updaterPlatforms)
  const dropped = keys[keys.length - 1]
  const online = {
    ...real,
    updaterPlatforms: Object.fromEntries(
      keys.filter((k) => k !== dropped).map((k) => [k, real.updaterPlatforms[k]]),
    ),
  }
  const r = rdd.decidePlatformNarrowing({ baselineExists: true, baseline: real, online })
  assert.equal(r.verdict, 'blocked', `真实形状的收窄没被判红(键:${keys.join(',')} / 丢:${dropped})`)
  assert.deepEqual(r.lost, [dropped])
  // 反向半边:同一份真实基线原样喂回去必须不红,否则 P2 只是"任何输入都红"。
  const same = rdd.decidePlatformNarrowing({
    baselineExists: true,
    baseline: real,
    online: { ...real },
  })
  assert.equal(same.verdict, 'allow', '把真实基线原样当线上数据被判红 ⇒ 判据在拦"每一次正常发版"')
})

/* ────────────── 形状锁:通道与调度必须成套(函数在而无人调 = 没有) ────────────── */

const src = readFileSync(SRC, 'utf8')
const self = readFileSync(SELF, 'utf8')

test('S1 §22d:CLI 与 import 双形态必须靠 isDirectRun 守卫隔开,且经 pathToFileURL 归一', () => {
  assert.match(
    src,
    /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/,
    '缺 isDirectRun 判定 ⇒ 测试 import 就会真跑一次解析并写盘',
  )
  assert.match(
    src,
    /if \(isDirectRun\) \{\s*main\(\)\.catch/,
    'main() 必须只在 isDirectRun 分支里被调',
  )
  assert.doesNotMatch(
    src,
    /import\.meta\.url === ['"]file:\/\/\/?/,
    '裸拼 file:// 在 Windows 反斜杠路径上永不匹配 ⇒ CLI 永不触发 = 静默失控',
  )
  assert.ok(
    src.indexOf('export const __test__') > src.indexOf('if (isDirectRun)'),
    '__test__ 导出须在 isDirectRun 之后(§22d 位置约束)',
  )
})

test('S2 判据必须真被调度:runCli 里必须有 decidePlatformNarrowing 调用点', () => {
  const at = src.indexOf('async function runCli(')
  assert.ok(at >= 0, 'runCli 不见了')
  const body = src.slice(at, src.indexOf('async function main()', at))
  assert.match(
    body,
    /decidePlatformNarrowing\(/,
    '护栏函数在而无人调 ⇒ 提交链/CI 上一路绿灯(守门 70/76/81 同型)',
  )
  assert.match(
    body,
    /env\[ALLOW_NARROWER_ENV\]/,
    'env 必须走传入的 env,读 process.env 会让测试注入的放行档失效',
  )
})

test('S3 注入通道必须同时管读与写(仓库常量不得再出现在取数/落盘处)', () => {
  assert.doesNotMatch(
    src,
    /writeFile\(SNAPSHOT_PATH/,
    '写盘仍钉在仓库常量 ⇒ 测试会改仓库产物,且 E1 的"没改写"是假证据',
  )
  assert.doesNotMatch(
    src,
    /readFile\(SNAPSHOT_PATH/,
    '读盘仍钉在仓库常量 ⇒ IHUI_FEED_SNAPSHOT 只管写不管读,护栏比的是别处的文件',
  )
  assert.match(
    src,
    /await writeFile\(snapshotPath,/,
    '写路径必须经 snapshotPathFor(env) 解析出的那份',
  )
})

test('S4 本测试不得复制一份判据实现(§22c 红线:镜像常量漂移 = 测试只复读实现)', () => {
  assert.match(
    self,
    /from '\.\.\/resolve-desktop-download\.mjs'/,
    '没 import 生产实现 ⇒ 这里断言的是自己的副本',
  )
  assert.match(self, /__test__ as rdd/)
  assert.doesNotMatch(self, /function decidePlatformNarrowing\(/, '测试里重写了护栏函数')
  assert.doesNotMatch(self, /!after\.includes\(/, '测试里重写了差集算法')
  assert.match(
    src,
    /export const __test__ = \{[\s\S]*decidePlatformNarrowing,[\s\S]*runCli,/,
    '__test__ 必须导出被测的两个入口',
  )
})

test('S5 人工放行与快照注入两个 env 名必须与源同值(名字漂了测试就只是在绿自己)', () => {
  assert.equal(rdd.ALLOW_NARROWER_ENV, 'ALLOW_NARROWER_FEED')
  assert.equal(rdd.IHUI_FEED_SNAPSHOT_ENV, 'IHUI_FEED_SNAPSHOT')
  assert.doesNotMatch(
    src,
    /process\.env\.ALLOW_NARROWER_FEED/,
    '仍有裸 process.env 读取 ⇒ 注入的 env 对象对它无效',
  )
})

// ---------- FS:fetchSignature 必须把"取不到"与"没有"分开(2026-09-27 补) ----------
/** 用假 fetch 替换全局实现,返回取调用次数的闭包以便验证"确实重试过" */
function withFetch(impl, fn) {
  const real = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (...args) => {
    calls += 1
    return impl(...args)
  }
  return Promise.resolve(fn(() => calls)).finally(() => {
    globalThis.fetch = real
  })
}

test('FS1 200 ⇒ 返回去空白的签名文本且 failed=false', async () => {
  await withFetch(
    async () => ({ ok: true, status: 200, text: async () => '  dW50cnVzdGVk  \n' }),
    async () => {
      const r = await rdd.fetchSignature('https://example.test/AI.sig', { retries: 0 })
      assert.equal(r.sig, 'dW50cnVzdGVk')
      assert.equal(r.failed, false)
    },
  )
})

test('FS2 404 ⇒ 该 release 真的没挂签名:failed=false(不得算成网络故障)', async () => {
  await withFetch(
    async () => ({ ok: false, status: 404, text: async () => '' }),
    async () => {
      const r = await rdd.fetchSignature('https://example.test/missing.sig', { retries: 2 })
      assert.deepEqual(r, { sig: '', failed: false })
    },
  )
})

test('FS3 限流(429)重试后仍失败 ⇒ failed=true,且真的重试过', async () => {
  await withFetch(
    async () => ({ ok: false, status: 429, text: async () => '' }),
    async (calls) => {
      const r = await rdd.fetchSignature('https://example.test/rate-limited.sig', { retries: 2 })
      assert.equal(r.sig, '')
      assert.equal(r.failed, true)
      assert.ok(calls() >= 3, `429 应至少尝试 3 次,实得 ${calls()}`)
    },
  )
})

test('FS4 断网/抛异常 ⇒ failed=true(旧写法在这里折成空串,与 404 完全同形)', async () => {
  await withFetch(
    async () => {
      throw new Error('socket hang up')
    },
    async () => {
      const r = await rdd.fetchSignature('https://example.test/down.sig', { retries: 0 })
      assert.equal(r.failed, true)
    },
  )
})

test('FS5 反向锁:签名出口不得再退化为"单值空串"(否则 N1/N6 的护栏永远看不见这一型)', () => {
  const start = src.indexOf('async function fetchSignature')
  const body = src.slice(start, src.indexOf('读取 tauri.conf.json', start))
  assert.doesNotMatch(
    body,
    /return res\.ok \? \(await res\.text\(\)\)\.trim\(\) : ''/,
    '旧的"ok 与不 ok 都只产字符串"形态不得回来',
  )
  assert.match(body, /failed:\s*true/, '失败分支必须显式上报 failed:true')
})
