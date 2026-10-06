// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:scripts/check-i18n-locale-content-language.mjs
 * 跑法:node --test scripts/tests/check-i18n-locale-content-language.test.mjs
 *
 * 本文件只管 `--self-test` 管不到的那一半:**取材面纪律与端到端装车**。判据函数一律
 * `import { __test__ }` 拿(§22c:测试里再抄一份实现,它就是复读机不是防线);真 git 现场一律用
 * mkScratch 临时仓(§26:不落 os.tmpdir、不落仓库树内)。
 *
 * 为什么必须有"三面三答"(M4):本门判的是语言包**内容**,而共享工作树常年滞后 HEAD ——
 * 按磁盘判会在恒红/假绿之间来回跳(AGENTS §19、守门 83 都记过同型)。M4 把"默认判 HEAD、
 * --staged 判索引、取不到不回落另一个面"钉成机器事实。
 *
 * 为什么必须有 L2 的"棘轮方向"证明(M6):存量若被当新增判红就是一台恒红门(§12e);反过来锚点
 * 若写成手工清单就会腐烂。这里造一次真实现场:同一份内容,**入库前判红、入库后判绿、再加一处
 * 又判红** —— 这才叫棘轮,而不是"我相信代码写对了"。
 *
 * M9 是本门第一次真仓实跑咬出来的缺陷的锁:块上限同时套在文件级时,`web/*.json`(22,702 叶)
 * 只扫前 4,000 叶,而 ②③ 号真事故(zh-TW 装谚文、ko 装假名)全在被截掉的那 80% 里 ——
 * 门一路报绿。"少扫不红"是本仓最高频失效型,所以这条锁必须**跨文件**(在镜像测试里)也在。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-i18n-locale-content-language.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = join(HERE, '..')
const REPO_ROOT = join(SCRIPTS_DIR, '..')
const SCRIPT = join(SCRIPTS_DIR, 'check-i18n-locale-content-language.mjs')
const JA_REL = 'packages/i18n/messages/web/ja.json'
const LOCALE_CODES = ['zh-CN', 'zh-TW', 'ja', 'ko', 'en']

/** 门侧的 E3 判据(叶子级专名豁免)。走 __test__ 导出,不重抄一份实现(§22c)。 */
const properNounLeaf = gate.properNounLeaf

function run(args, opts = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * 造 5 份语言包。三个开关各自对应一类真事故形态:
 *  - `jaHanOnlyBlock` ja 的某块整体是繁体中文(① 号形态;默认开着,便于 M4/M5 直接看见)
 *  - `wrongLang`      zh-TW 的那一块整体是谚文(② 号形态)
 *  - `nesting`        `toast.orgSaved:{orgSaved:"…"}` 同名自套一层(④ 号形态)
 *  - `endonym`        语言选择器键(`settings.ko`)按设计显示该语言本名 —— E2 必须放行它
 */
function writeLocale(dir, o = {}) {
  const { jaHanOnlyBlock = true, wrongLang = false, nesting = false, endonym = false } = o
  const web = join(dir, 'packages', 'i18n', 'messages', 'web')
  mkdirSync(web, { recursive: true })
  const cnOrg = { title: '整理会话', folderLabel: '文件夹', tagsLabel: '标签' }
  const jaOrg = jaHanOnlyBlock
    ? { title: '整理會話', folderLabel: '資料夾', tagsLabel: '標籤' }
    : { title: '会話を整理', folderLabel: 'フォルダー', tagsLabel: 'ラベル' }
  const twOrg = wrongLang
    ? { title: '대화 정리', folderLabel: '폴더', tagsLabel: '태그' }
    : { title: '對話整理', folderLabel: '資料夾', tagsLabel: '標籤' }
  const koOrg = { title: '대화 정리', folderLabel: '폴더', tagsLabel: '태그' }
  const settings = endonym ? { ko: '한국어', ja: '日本語' } : { ko: '한국어', ja: '日本語' }
  const files = {
    'zh-CN.json': { aiChat: { org: cnOrg, toast: { orgSaved: '已整理会话' } }, settings },
    'ja.json': {
      aiChat: {
        org: jaOrg,
        toast: nesting
          ? { orgSaved: { orgSaved: '会話を整理しました' } }
          : { orgSaved: '会話を整理しました' },
      },
      settings,
    },
    'zh-TW.json': { aiChat: { org: twOrg, toast: { orgSaved: '已整理會話' } }, settings },
    'ko.json': { aiChat: { org: koOrg, toast: { orgSaved: '정리 완료' } }, settings },
    'en.json': {
      aiChat: {
        org: { title: 'Organize', folderLabel: 'Folder', tagsLabel: 'Tag' },
        toast: { orgSaved: 'Saved' },
      },
      settings,
    },
  }
  for (const [name, obj] of Object.entries(files))
    writeFileSync(join(web, name), JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

function gitIn(dir, args) {
  return execFileSync(
    gitBinary(),
    ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', '-C', dir, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

/** 临时仓自带一份常用汉字表:表也在**被审面**上读,夹具不给表的话 L1b 会正确地判"未判定"。
 *  ⚠️ 必须**超过判据的 ≥2000 字护栏**,否则 `joyoSetFromRaw` 会按"半张表"拒收(夹具第一版就是
 *  只写了 19 个字,于是 L1b 全程"未判定",M4/M5 的阳性对照什么都没验到却看似在验)。
 *  填充码位刻意取 **0x370–0x2000 的非汉字段**(希腊/西里尔/符号),它们永远不可能成为"嫌疑字",
 *  所以判据实际只由下面那串显式字种决定 —— 夹具的语义必须与夹具的体积无关。 */
function initRepo(dir) {
  gitIn(dir, ['init', '-q', '-b', 'main'])
  gitIn(dir, ['config', 'core.autocrlf', 'false'])
  gitIn(dir, ['config', 'core.quotepath', 'false'])
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  const wanted = '会話整理夾標籤削除保存確認月火水木金土'
  const filler = []
  for (let cp = 0x370; cp < 0x2000; cp++) filler.push(cp)
  const codepoints = [...new Set([...[...wanted].map((c) => c.codePointAt(0)), ...filler])]
  assert.ok(codepoints.length >= 2000, `夹具表必须过 ≥2000 字护栏,实得 ${codepoints.length}`)
  writeFileSync(join(dir, 'scripts', 'joyo-kanji.json'), JSON.stringify({ codepoints }), 'utf8')
}

/**
 * 在临时仓的表上**追加** `properNouns`(E3 的数据源)。
 * ⚠️ 只加 `chars`、**一个字都不动 `codepoints`** —— 这正是"防假修法"在夹具层的形态:
 * 若实现偷偷把专名塞进 codepoints 让门变绿,本夹具的阳性对照(钉钉必须红)会立刻失败。
 */
function addProperNouns(dir, chars) {
  const p = join(dir, 'scripts', 'joyo-kanji.json')
  const obj = JSON.parse(readFileSync(p, 'utf8'))
  obj.properNouns = { chars, note: 'fixture' }
  writeFileSync(p, JSON.stringify(obj), 'utf8')
}

/** 用导出的面函数跑一遍完整判定(跨仓取证只能这么做:CLI 的 ROOT 由脚本自身位置推导) */
function fullScan(dir, face) {
  const list = gate.listLocaleRels(dir, face)
  const texts = gate.readFaceTexts(dir, face, list.rels)
  const zh = new Map()
  for (const rel of list.rels) {
    const { target, locale } = gate.parseLocalePath(rel)
    if (locale === 'zh-CN') {
      try {
        zh.set(target, JSON.parse(texts.get(rel)))
      } catch {
        zh.set(target, null)
      }
    }
  }
  const results = []
  const joyo = gate.loadJoyo(dir, face)
  for (const rel of list.rels) {
    const { target, locale } = gate.parseLocalePath(rel)
    let obj = null
    try {
      obj = JSON.parse(texts.get(rel))
    } catch {
      obj = null
    }
    results.push(
      gate.scanLocaleContent(rel, obj, {
        locale,
        localeCodes: LOCALE_CODES,
        zhCnObj: locale === 'zh-CN' ? null : (zh.get(target) ?? null),
        zhCnMissing: locale !== 'zh-CN' && !zh.has(target),
        joyo: joyo.set,
        proper: joyo.proper,
      }),
    )
  }
  const anchors = new Map(list.rels.map((r) => [r, 0]))
  return { list, s: gate.summarize(results, anchors) }
}

const lastLine = (s) => String(s).trim().split(/\r?\n/).pop()

test('M1 ROOT 由脚本自身位置推导:默认根 = 仓库根,与 cwd 无关', () => {
  assert.equal(gate.DEFAULT_ROOT.split('\\').join('/'), REPO_ROOT.split('\\').join('/'))
  assert.equal(gate.rootFromArgv([]).root, gate.DEFAULT_ROOT)
  assert.equal(gate.rootFromArgv(['--staged']).root, gate.DEFAULT_ROOT)
  assert.match(String(gate.rootFromArgv(['--root']).error), /不得静默退回仓库根/)
  assert.match(String(gate.rootFromArgv(['--root=']).error), /目录参数|必须给目录/)
})

test('M2 从仓库外的 cwd 运行仍扫真仓,并说出判的是哪一面(旧 cwd 定根那一型不得回来)', () => {
  const dir = mkScratch('i18n-lang-cwd')
  try {
    const r = run([], { cwd: dir })
    assert.doesNotMatch(
      r.stdout,
      /没有 packages|枚举到 0 个/,
      `cwd 在仓库外时又找不到语料 ⇒ ROOT 又跟着 cwd 走了:\n${r.stdout}`,
    )
    assert.match(r.stdout, /判定面:HEAD blob/, '默认档必须如实说出判的是 HEAD blob')
    assert.match(
      lastLine(r.stdout),
      /^\[i18n-locale-lang\] 判定面:/,
      '末行必须是可被机器断言的结论行',
    )
  } finally {
    rmScratch(dir)
  }
})

test('M3 形状锁:定根 / §22d 守卫 / 取材必须走面层 / 族表必须是唯一源 / 头注不得谎称已接线', () => {
  const text = readFileSync(SCRIPT, 'utf8')
  assert.match(
    text,
    /pathToFileURL\(process\.argv\[1\]\)\.href/,
    '§22d 守卫不得被删(删了 import 即 process.exit,测试会被无声结束)',
  )
  assert.match(text, /from '\.\/lib\/face-reader\.mjs'/, '取材必须走面层')
  assert.match(text, /catBatch\(/, '内容必须来自同一次 cat-file --batch(同面同轮)')
  assert.doesNotMatch(text, /^const ROOT = process\.cwd\(\)/m, 'cwd 定根那一型又回来了')
  assert.match(
    text,
    /from '\.\/lib\/i18n-script-families\.mjs'/,
    '码位族表必须走唯一源 —— 在门里再抄一份区间就是本仓反复登记的"两份表必然漂移"',
  )
  assert.match(text, /判定面|FACE_TXT/, '面声明必须在位:未说面的门会被读成"当然判磁盘"')
  // 本票**刻意不接线**(runner / package.json / AGENTS 由主会话统一改)。头注若声称"已接 pre-commit"
  // 而注册表里没有,守门 89 的 R1 就会判红 —— 这里反向钉住"不得出现已接线的声称"。
  // 判据必须**放得下"尚未接入"这句实话**:第一版写成 /接入\s?guardian/ 把自家那句"尚未接入
  // guardian-runner"也判红了 —— 一条拦谎报的尺子如果连"我没做"都读成"我声称做了",
  // 它教出来的就是谎报。故只拦**肯定式**声称。
  assert.match(text, /尚未接入/, '头注必须明说未接线(而不是留白让人猜)')
  assert.doesNotMatch(
    text,
    /已接\s?pre-commit|已接入\s?guardian|接线完成|第\s?\d+\s?项[^）]{0,14}blocking/,
    '头注不得声称已接线(接线属主会话;谎称已接线是守门 89 R1 的立论形态)',
  )
})

test('M4 三面三答:同一棵树 HEAD 干净 / 索引与磁盘带真事故 ⇒ 各自独立回答,且不得借面凑数', () => {
  const dir = mkScratch('i18n-lang-faces')
  try {
    initRepo(dir)
    writeLocale(dir, { jaHanOnlyBlock: true, wrongLang: false, nesting: false })
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-qm', 'clean base'])
    // 只把"脏内容"写进磁盘并 add —— HEAD 仍是干净的
    writeLocale(dir, { jaHanOnlyBlock: true, wrongLang: true, nesting: true })
    gitIn(dir, [
      'add',
      'packages/i18n/messages/web/ja.json',
      'packages/i18n/messages/web/zh-TW.json',
    ])

    const head = gate.listLocaleRels(dir, 'head')
    assert.ok(head && head.rels.length === 5, `HEAD 面应枚举到 5 份,实得 ${JSON.stringify(head)}`)
    const fromHead = fullScan(dir, 'head')
    const fromStaged = fullScan(dir, 'staged')
    const fromWork = fullScan(dir, 'worktree')
    assert.equal(fromHead.s.l1a.length, 0, 'HEAD 面必须干净(它没见过那次编辑)')
    assert.ok(
      fromStaged.s.l1a.length >= 3,
      `索引面必须看见 zh-TW 装谚文那几处,实得 ${JSON.stringify(fromStaged.s.l1a.map((x) => x.path))}`,
    )
    assert.ok(fromWork.s.l1a.length >= 3, '工作树面同样看得见磁盘上那份脏内容')
    assert.equal(fromHead.s.l1b.length, 1, 'ja 整块繁体中文在 HEAD 面就已存在 ⇒ L1b 三面都该抓到')
    assert.equal(fromStaged.s.l1b.length, 1)
    assert.equal(fromWork.s.l1b.length, 1)

    // 索引里摘除 ⇒ 索引面枚举不到它(不得借 HEAD 的内容凑数)
    gitIn(dir, ['rm', '-r', '--cached', '-q', 'packages/i18n/messages'])
    assert.equal(gate.listLocaleRels(dir, 'staged').rels.length, 0, '索引面枚举应为 0')
    assert.ok(gate.listLocaleRels(dir, 'head').rels.length > 0, 'HEAD 面仍应看得见(两面各自独立)')
    assert.throws(() => gate.readFaceTexts(dir, 'staged', ['packages/i18n/messages/web/ja.json']))
  } finally {
    rmScratch(dir)
  }
})

test('M5 CLI 级 --worktree + --root 指夹具:点名到键路径,默认档只报数、--strict 才判红', () => {
  const dir = mkScratch('i18n-lang-cli')
  try {
    initRepo(dir)
    writeLocale(dir, { jaHanOnlyBlock: true, wrongLang: true })
    const rep = run(['--worktree', '--root', dir])
    assert.equal(rep.status, 0, `默认档(L1 存量只报数)必须 0:\n${rep.stdout}`)
    assert.match(rep.stdout, /判定面:工作树/, '换根不换面:这条路径判的仍是磁盘,必须说出来')
    assert.match(rep.stdout, /L1a 叶级跨族候选/, '夹具里 zh-TW 装谚文必须被点名')
    assert.match(rep.stdout, /aiChat\.org\.title/, '点名的必须是那条键路径(证据要能复核)')
    assert.match(rep.stdout, /L1b ja 整块汉字且含非日本常用汉字/, '夹具里 ja 装繁体中文必须被点名')
    assert.match(
      lastLine(rep.stdout),
      /候选 4 判红 0/,
      `默认档只报数,末行读数应为候选 4:\n${lastLine(rep.stdout)}`,
    )
    assert.match(rep.stdout, /E2 语言本名 \d+ 处/, '豁免命中必须打印计数(不静默)')

    const strict = run(['--worktree', '--root', dir, '--strict'])
    assert.equal(strict.status, 1, `--strict 必须把同一批候选判红:\n${strict.stdout}`)
    assert.match(lastLine(strict.stdout), /判红 4/)
  } finally {
    rmScratch(dir)
  }
  // 全绿夹具:ja 用真日语(汉字+假名)、zh-TW 用繁体、语言本名键 ⇒ 零候选。
  // 这一条是"门不会把正常文案判红"的正向证明,与 M5 上半的阳性对照成对。
  const clean = mkScratch('i18n-lang-clean')
  try {
    initRepo(clean)
    writeLocale(clean, { jaHanOnlyBlock: false, wrongLang: false, nesting: false, endonym: true })
    const ok = run(['--worktree', '--root', clean])
    assert.equal(ok.status, 0, `干净夹具必须 0:\n${ok.stdout}`)
    assert.match(lastLine(ok.stdout), /候选 0 判红 0/, lastLine(ok.stdout))
    assert.match(ok.stdout, /未发现语种内容矛盾/)
    assert.match(ok.stdout, /E2 语言本名 \d+ 处/, '语言本名被 E2 放行(而不是判红),且必须报数')
  } finally {
    rmScratch(clean)
  }
})

test('M6 L2 棘轮方向的装车证明:同一份内容,入库前判红、入库后判绿、再加一处又判红', () => {
  const dir = mkScratch('i18n-lang-ratchet')
  const JA = 'packages/i18n/messages/web/ja.json'
  const scanJa = (obj, anchors, face) =>
    gate.summarize(
      [
        gate.scanLocaleContent(JA, obj, {
          locale: 'ja',
          localeCodes: LOCALE_CODES,
          zhCnObj: null,
          zhCnMissing: false,
          joyo: gate.loadJoyo(dir, face).set,
        }),
      ],
      anchors,
    )
  try {
    initRepo(dir)
    writeLocale(dir, { jaHanOnlyBlock: false, nesting: false })
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-qm', 'no nesting in HEAD'])
    writeLocale(dir, { jaHanOnlyBlock: false, nesting: true })
    gitIn(dir, ['add', JA])

    const list = gate.listLocaleRels(dir, 'staged')
    const anchors0 = gate.readL2Anchors(dir, list.rels)
    assert.equal(anchors0.anchors.get(JA), 0, 'HEAD 里没有那处嵌套 ⇒ 锚点应为 0')
    assert.equal(anchors0.missingFromHead, 0, '本仓的 locale 文件都已在 HEAD ⇒ 不应计缺失')
    const obj = JSON.parse(gate.readFaceTexts(dir, 'staged', list.rels).get(JA))
    const found = gate.findSelfNesting(obj).sole
    assert.equal(found.length, 1, `索引里应看见 1 处同名自套,实得 ${JSON.stringify(found)}`)
    assert.equal(found[0].path, 'aiChat.toast.orgSaved')
    const red = scanJa(obj, anchors0.anchors, 'staged')
    assert.equal(red.l2.length, 1, '锚点 0 而索引 1 ⇒ 必须点名')
    assert.equal(red.l2[0].count, 1)
    assert.equal(red.l2[0].anchor, 0)
    assert.equal(gate.decide(red, {}).code, 1, 'L2 新增在**默认档**就判红(定级依据:新增不等于存量)')

    gitIn(dir, ['commit', '-qm', 'nesting landed'])
    const list2 = gate.listLocaleRels(dir, 'head')
    const anchors1 = gate.readL2Anchors(dir, list2.rels)
    assert.equal(
      anchors1.anchors.get(JA),
      1,
      'HEAD 现在含那处嵌套 ⇒ 锚点跟着升到 1(存量只报数,§12e)',
    )
    const obj1 = JSON.parse(gate.readFaceTexts(dir, 'head', list2.rels).get(JA))
    const green = scanJa(obj1, anchors1.anchors, 'head')
    assert.equal(green.l2.length, 0, '同一份内容入库后不得再拦任何提交 —— 否则就是恒红门')
    assert.equal(gate.decide(green, {}).code, 0)

    const obj2 = JSON.parse(JSON.stringify(obj1))
    obj2.aiChat.toast.orgSaved = { orgSaved: obj2.aiChat.toast.orgSaved }
    obj2.aiChat.toast.renameEmpty = { renameEmpty: '空です' }
    const more = scanJa(obj2, anchors1.anchors, 'head')
    assert.equal(gate.decide(more, {}).code, 1, '锚点 1 而索引 2 ⇒ 重新判红(棘轮只减不增)')
  } finally {
    rmScratch(dir)
  }
})

test('M7 空扫与形态外路径:枚举到 0 个 locale 文件 ⇒ 判死;形态外的 .json 计入不闷扫', () => {
  const dir = mkScratch('i18n-lang-empty')
  try {
    const r = run(['--worktree', '--root', dir])
    assert.equal(r.status, 2, `空目录必须 exit 2,实得 ${r.status}\n${r.stdout}`)
    assert.match(
      `${r.stdout}${r.stderr}`,
      /无法判定|没有 packages|0 个/,
      `空目录必须给出可诊断结论:\n${r.stdout}`,
    )
    assert.doesNotMatch(
      r.stdout,
      /未发现语种内容矛盾/,
      '什么都没扫到却报"未发现" = 把"没判"写成"判过了"',
    )

    const d2 = mkScratch('i18n-lang-unparsed')
    try {
      const w = join(d2, 'packages', 'i18n', 'messages', 'web')
      mkdirSync(w, { recursive: true })
      writeFileSync(join(w, 'README.json'), '{}', 'utf8')
      writeFileSync(join(w, 'ja.bak.json'), '{}', 'utf8')
      const list = gate.listLocaleRels(d2, 'worktree')
      assert.equal(list.rels.length, 0, '两个 .json 都不该被当成 locale 文件')
      assert.equal(list.unparsed, 2, '但必须如实计入"跳过"的条数(否则就是静默少扫)')
      const r2 = run(['--worktree', '--root', d2])
      assert.equal(r2.status, 2, `枚举到 0 个 locale 必须 exit 2,实得 ${r2.status}\n${r2.stdout}`)
    } finally {
      rmScratch(d2)
    }
  } finally {
    rmScratch(dir)
  }
})

test('M8 未判定不得被读成通过:缺常用汉字表 ⇒ L1b 记未判定,--strict 判死', () => {
  const dir = mkScratch('i18n-lang-nojoyo')
  try {
    initRepo(dir)
    writeLocale(dir, { jaHanOnlyBlock: true })
    rmSync(join(dir, 'scripts', 'joyo-kanji.json'))
    const j = gate.loadJoyo(dir, 'worktree')
    assert.equal(j.set, null, '表不在 ⇒ 必须是 null(不得返回空集,那会把"没读到"变成"字不在表里")')
    assert.ok(j.error && /joyo-kanji\.json/.test(j.error), '并且必须带一句可诊断的原因')
    const r = run(['--worktree', '--root', dir])
    assert.match(r.stdout, /未判定 \d+/, `结论行必须喊出未判定:\n${r.stdout}`)
    assert.match(r.stdout, /L1b 未判定|常用汉字表/, '要点名是哪条判据判不出')
    const strict = run(['--worktree', '--root', dir, '--strict'])
    assert.equal(
      strict.status,
      2,
      `--strict 下有未判定项必须 exit 2 而不是记绿,实得 ${strict.status}\n${strict.stdout}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('M9 反向回归锁:文件级扫描不得受块上限截断(本门第一次真仓实跑就栽在这里)', () => {
  const N = gate.MAX_LEAVES_PER_BLOCK + 30
  const deep = {}
  for (let i = 0; i < N; i++) deep[`k${i}`] = `plain ${i}`
  deep[`k${N - 1}`] = '한국어입니다'
  const obj = { root: { nested: deep } }
  const seen = gate.scanLocaleContent('x/web/zh-TW.json', obj, {
    locale: 'zh-TW',
    localeCodes: LOCALE_CODES,
    zhCnObj: null,
    zhCnMissing: false,
    joyo: new Set(),
  })
  assert.ok(seen.leaves >= N, `文件级叶子数应 ≥ ${N},实得 ${seen.leaves}(又被块上限截断了)`)
  assert.equal(
    seen.l1a.length,
    1,
    `最后一叶必须被点名,实得 ${JSON.stringify(seen.l1a.map((x) => x.path))}`,
  )
  assert.equal(seen.l1a[0].path, 'root.nested.k' + (N - 1))
  const noZh = gate.scanLocaleContent('x/web/zh-TW.json', obj, {
    locale: 'zh-TW',
    localeCodes: LOCALE_CODES,
    zhCnObj: null,
    zhCnMissing: true,
    joyo: new Set(),
  })
  assert.ok(noZh.undetermined.length >= 1, '无对照文件时那一叶必须落进未判定,不能静默')
  // 块级上限**仍然**生效,并且截断必须落进未判定(不是静默少扫)
  const bigBlock = {}
  for (let i = 0; i < gate.MAX_LEAVES_PER_BLOCK + 5; i++) bigBlock[`k${i}`] = `x ${i}`
  const tr = gate.scanLocaleContent(
    'x/web/ko.json',
    { huge: { inner: bigBlock } },
    {
      locale: 'ja',
      localeCodes: LOCALE_CODES,
      zhCnObj: null,
      zhCnMissing: false,
      joyo: new Set(['x']),
    },
  )
  assert.ok(
    tr.truncatedBlocks >= 1 && tr.undetermined.some((t) => /上限/.test(t)),
    `块级截断必须报数并进未判定,实得 ${JSON.stringify(tr.undetermined)}`,
  )
})

test('M10 对外行为:两面旗同给判死、skipEnv 必须说出来、判定面纯函数四态成套', () => {
  const both = run(['--staged', '--worktree'])
  assert.equal(both.status, 2, `两面旗同给必须判死,实得 ${both.status}`)
  assert.match(both.stdout, /不得同用/)
  const skipped = spawnSync(process.execPath, [SCRIPT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    env: { ...process.env, HUSKY_SKIP_I18N_LOCALE_CONTENT_LANGUAGE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(skipped.status, 0)
  assert.match(skipped.stdout, /已跳过/, '应急通道必须说出来,不能静默绿')
  assert.equal(gate.faceFromArgv([]).face, 'head')
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  assert.ok(gate.faceFromArgv(['--staged', '--worktree']).error)
  // runner 会追加的无关旗标不得改变判定面(否则同一枚提交在钩子内与人工复核时结论不同)
  assert.equal(gate.faceFromArgv(['--staged', '--quiet', '--exit', '1']).face, 'staged')
})

test('M11 E3 专名豁免:叶子级放过专名、抓住真残留,且 codepoints 一个字都不许动', () => {
  const dir = mkScratch('i18n-lang-proper')
  const JA = 'packages/i18n/messages/web/ja.json'
  try {
    initRepo(dir)
    // ⚠️ 夹具的 `wanted` 串里已有 会話整理夾標籤削除保存確認月火水木金土 —— 那些字在表**内**,
    // 永远不是嫌疑字。所以"真残留"必须挑 `wanted` 之外的字(資/料/釘/谱/视/频…),
    // 否则阳性对照会静默退化成"什么都没验到却看着在验"。
    addProperNouns(dir, '智匯硅')
    const web = join(dir, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(web, { recursive: true }) // initRepo 只造 scripts/,语言包目录得自己建
    const ja = {
      // 专名块:三叶的表外字全部落在 properNouns 内 ⇒ 豁免 ⇒ usable 不足 ⇒ 不判
      brand: { badge: '智匯', vendor: '智匯硅', again: '智匯騰' },
      // 对照组:釘釘 同为表外、同方向,但**不在** properNouns 内 ⇒ 必须红
      residue: { ding: '釘釘', zhipu: '智谱', shipinhao: '视频' },
      // 反向防线:专名叶与真残留叶同块 ⇒ 专名叶豁免,真残留叶仍被抓(不得整块放过)
      // ⚠️ 真残留叶必须 **≥3 个**(即豁免后 usable 仍过 MIN_BLOCK_LEAVES)。实测(2026-10-06):
      //   豁免会把叶子从 usable 里剔掉,于是"专名叶 1 + 真残留叶 2"整块落到 usable=2 < 3 ⇒ 不判。
      //   这**不是 E3 引入的新洞**,E1/E2 完全同形(逐个构造验过),是 MIN_BLOCK_LEAVES 的原语义
      //   ("1~2 叶的块汉字是日语常态,样本不足以定性")。所以这里用能过门槛的形状,
      //   门槛那一格由上面那行 pureNounLeaf 断言与 T2b 覆盖。
      mixed: { ok: '智匯', bad: '資料夾', worse: '標籤', third: '檔案夾' },
    }
    writeFileSync(join(web, 'ja.json'), JSON.stringify(ja, null, 2) + '\n', 'utf8')
    for (const l of ['zh-CN', 'zh-TW', 'ko', 'en'])
      writeFileSync(join(web, l + '.json'), JSON.stringify({}, null, 2) + '\n', 'utf8')

    const j = gate.loadJoyo(dir, 'worktree')
    assert.ok(j.set && j.proper, '表与专名集必须一起取到(同一个 raw、同一个面)')
    assert.deepEqual([...j.proper], ['智', '匯', '硅'], '专名集出口必须独立于 2136 集合')
    for (const c of j.proper)
      assert.ok(!j.set.has(c), `防假修法:专名字 ${c} 不许出现在 2136 表内`)

    // 判据纯函数:掺一个非专名表外字 ⇒ 整叶仍判(这是 E3 必须是叶子级的那条命)。
    // 用 資料夾 而不是 夾:夾 在夹具表内,表内字永远不是嫌疑字,拿它测"掺字"等于测了个空分支。
    assert.equal(properNounLeaf('智匯', j.proper, j.set).ok, true)
    assert.equal(properNounLeaf('智匯硅', j.proper, j.set).ok, true)
    assert.equal(properNounLeaf('智匯資料夾', j.proper, j.set).ok, false, '掺非专名表外字必须仍判')
    assert.equal(properNounLeaf('資料夾', j.proper, j.set).ok, false)
    assert.equal(properNounLeaf('智匯', null, j.set).ok, false, '专名集取不到 ⇒ 判不出,不得放行')
    assert.equal(properNounLeaf('智匯', j.proper, null).ok, false)

    const r = gate.scanLocaleContent(JA, ja, {
      locale: 'ja',
      localeCodes: LOCALE_CODES,
      zhCnObj: null,
      zhCnMissing: false,
      joyo: j.set,
      proper: j.proper,
    })
    const paths = r.l1b.map((x) => x.path).sort()
    assert.ok(!paths.includes('brand'), `专名块必须不红,实得 ${JSON.stringify(r.l1b)}`)
    const residue = r.l1b.find((x) => x.path === 'residue')
    assert.ok(residue, `对照组必须红,实得 ${JSON.stringify(r.l1b)}`)
    assert.match(residue.suspects, /釘/, '必须点名键与嫌疑字')
    const mixed = r.l1b.find((x) => x.path === 'mixed')
    assert.ok(mixed, '混合块必须仍红')
    assert.ok(
      mixed.suspects.includes('資') && mixed.suspects.includes('料'),
      `混合块必须仍抓到真残留,实得 ${mixed.suspects}`,
    )
    assert.ok(
      !mixed.suspects.includes('智') && !mixed.suspects.includes('匯'),
      `专名字不得出现在混合块的嫌疑字里(豁免必须生效),实得 ${mixed.suspects}`,
    )
    // 门槛交互(E1/E2/E3 共形,非 E3 独有):豁免会把叶子剔出 usable,不足 3 叶的块整块不判。
    // 钉死这一格,免得以后有人把门槛调小/调大时没人发现 E3 的判红面积被悄悄改了。
    const thin = gate.scanLocaleContent(
      JA_REL,
      { mixed: { ok: '智匯', bad: '資料夾', worse: '標籤' } },
      {
        locale: 'ja',
        localeCodes: LOCALE_CODES,
        zhCnObj: null,
        zhCnMissing: false,
        joyo: j.set,
        proper: j.proper,
      },
    )
    assert.equal(
      thin.exemptProper.length,
      1,
      '薄块里专名叶照样豁免并计数(豁免不因块小而消失)',
    )
    assert.equal(
      thin.l1b.length,
      0,
      '豁免后 usable=2 < MIN_BLOCK_LEAVES ⇒ 整块不判(E1/E2/E3 共有的 MIN_BLOCK_LEAVES 语义)',
    )
    // 豁免必须**单列计数**并带得上键路径(报数可定位,不许只报一个总数)
    const exPaths = r.exemptProper.map((x) => x.path)
    assert.ok(exPaths.includes('brand.badge') && exPaths.includes('mixed.ok'), JSON.stringify(exPaths))
    assert.equal(
      new Set(exPaths).size,
      exPaths.length,
      '豁免计数必须按路径去重(块是递归遍历的,否则一个叶子被每个祖先块各数一次)',
    )
    const s = gate.summarize([r], new Map())
    assert.equal(s.exemptProper.length, exPaths.length, 'summarize 必须把豁免并进结论对象')
  } finally {
    rmScratch(dir)
  }
})

test('M12 专名集缺失 ⇒ 记未判定且照判(不得因判不出就静默放行整块)', () => {
  const dir = mkScratch('i18n-lang-noproper')
  try {
    initRepo(dir) // 不调 addProperNouns ⇒ 表里没有 properNouns
    const web = join(dir, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(web, { recursive: true })
    writeFileSync(
      join(web, 'ja.json'),
      JSON.stringify({ brand: { a: '智匯', b: '智匯硅', c: '智匯騰' } }, null, 2) + '\n',
      'utf8',
    )
    for (const l of ['zh-CN', 'zh-TW', 'ko', 'en'])
      writeFileSync(join(web, l + '.json'), JSON.stringify({}, null, 2) + '\n', 'utf8')
    const j = gate.loadJoyo(dir, 'worktree')
    assert.equal(j.proper, null, '表里没有 properNouns ⇒ 必须 null(不得返回空集冒充"没有专名")')
    const r = gate.scanLocaleContent(JA_REL, JSON.parse(readFileSync(join(web, 'ja.json'), 'utf8')), {
      locale: 'ja',
      localeCodes: LOCALE_CODES,
      zhCnObj: null,
      zhCnMissing: false,
      joyo: j.set,
      proper: j.proper,
    })
    assert.equal(r.exemptProper.length, 0, '判不出时不得豁免任何叶子')
    assert.equal(r.l1b.length, 1, '判不出时必须照判(不得因 E3 失效而静默放过)')
    assert.ok(
      r.undetermined.some((t) => /properNouns/.test(t)),
      `必须点名是哪条判据判不出,实得 ${JSON.stringify(r.undetermined)}`,
    )
    // CLI 侧同样必须说出来。判红**优先于**未判定(T9f 的定级),所以这里 rc=1 而不是 2:
    // 判不出 E3 ⇒ 照判 ⇒ 判红,这条链正是"不得因判不出就静默放过"的机器读数。
    const rep = run(['--worktree', '--root', dir])
    assert.match(rep.stdout, /专名字集|properNouns/, `结论必须喊出 E3 判不出:\n${rep.stdout}`)
    assert.match(rep.stdout, /L1b ja 整块汉字/, '判不出时必须照判并点名')
    assert.equal(rep.status, 0, '默认档 L1 只报数')
    const strict = run(['--worktree', '--root', dir, '--strict'])
    assert.equal(strict.status, 1, `--strict 下判不出 E3 的块必须判红,实得 ${strict.status}`)
    assert.match(lastLine(strict.stdout), /判红 1/, lastLine(strict.stdout))
  } finally {
    rmScratch(dir)
  }
})
