// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 灰度产物来源对账(2026-11-01 立,g1222561 值守轮)。
 *
 * 它治的那件事是实测出来的,不是假想:生产部署日志里连续 20 轮打
 *   「未判定:.next-staging 没有 BUILD_ID ⇒ 灰度实例无产物可服务」
 * 而同一轮照样打「GRAY 动作=advance … 依据=判定通过」。根因是**顺序**——
 * ihui-deploy.ps1 换流那一步是 `Move-Item .next-staging → .next-<色>`(整份搬走,不是复制),
 * 而灰度实例排在换流**之后**才起 ⇒ staging 永远不存在。灰度槽位从来没有产物,
 * "先小流量"这一整格一直是空的,却没有任何一把尺子看得见它(§0.3 的反面:没判的那格被读成判过)。
 *
 * 本判据只管**来源与顺序**这一维(它是最初失守的那一格):
 *   A1 deploy 侧必须在换流前把 staging 镜像进 .next-canary;
 *   A2 镜像必须排在 `Move-Item .next-staging` **之前**(搬完再镜像 = 镜到空目录);
 *   A3 robocopy 的失败档必须被显式区分(0-7 成功 / ≥8 失败),失败只降级不阻断部署;
 *   A4 灰度实例的产物来源只能是 .next-canary,不得再把 .next-staging 当代码里的来源;
 *   A5 在位的灰度实例必须先比对产物 buildId 才许"不重复起"(长驻进程会拿上一轮的构建冒充本轮候选,
 *      而 pass 分支根本不 -Action stop ⇒ 不比对就是"候选永远比现网旧")。
 *
 * 判"灰度缺席时不得记判定通过"那一格不归这里 —— 那是 deploy/win/ihui-canary-wiring.mjs 的 W10。
 *
 * 用法:
 *   node deploy/win/ihui-canary-artifact.mjs              # 判现仓两面(缺文件即未判定)
 *   node deploy/win/ihui-canary-artifact.mjs --self-test   # 纯函数夹具自证(含摘掉即翻红)
 *   node deploy/win/ihui-canary-artifact.mjs --json
 * 退出码:0 全中 / 1 有缺口 / 2 未判定(取不到被审面)。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DEPLOY_PS1 = join(ROOT, 'deploy', 'win', 'ihui-deploy.ps1')
export const GRAY_PS1 = join(ROOT, 'deploy', 'win', 'ihui-canary-gray.ps1')

const EXIT_OK = 0
const EXIT_GAP = 1
const EXIT_UNDETERMINED = 2

/** 去掉整行注释(PowerShell 的 `#` 行注释),只留代码面 —— 解释性注释里出现 staging 是应有之义。 */
function codeLines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')
}

/**
 * 纯判据:输入两面文本,输出缺口数组(空数组 = 来源与顺序都对)。
 * 不做任何 IO ⇒ 可被镜像用例与 --self-test 直接钉住(§22c:判据只许住在这一份)。
 */
export function artifactGaps({ deployText = null, grayText = null } = {}) {
  if (deployText === null || grayText === null) {
    return { undetermined: true, gaps: [], why: '被审面取不到 ⇒ 未判定(不记绿也不冒红)' }
  }
  const dFull = String(deployText)
  const dCode = codeLines(dFull)
  const gCode = codeLines(String(grayText))
  const gaps = []
  const need = (id, re, where, why, fix) => {
    if (!re.test(where)) gaps.push({ id, why, fix })
  }
  const forbid = (id, re, where, why, fix) => {
    if (re.test(where)) gaps.push({ id, why, fix })
  }

  need(
    'A1',
    /& robocopy\.exe/,
    dCode,
    'deploy 侧没有把 staging 镜像给灰度槽位的动作 ⇒ 灰度实例在换流后必然拿不到产物',
    '在 `Move-Item "$WebDir\\.next-staging"` 之前加 `& robocopy.exe …  /MIR`',
  )
  need(
    'A1b',
    /Join-Path \$WebDir '\.next-canary'/,
    dCode,
    '镜像目标不是 $WebDir 下的 .next-canary',
    "目标目录必须与 gray 侧的 $GrayDist 同名同值:`$grayCanaryDist = Join-Path $WebDir '.next-canary'`",
  )

  const mirrorAt = dCode.search(/& robocopy\.exe/)
  const moveAt = dCode.search(/Move-Item\s+"\$WebDir\\\.next-staging"/)
  if (mirrorAt < 0 || moveAt < 0) {
    gaps.push({
      id: 'A2',
      why: `镜像与换流的先后无从判定(robocopy=${mirrorAt} Move-Item=${moveAt})⇒ 记缺口不记绿`,
      fix: 'robocopy 必须在 Move-Item .next-staging 之前',
    })
  } else if (mirrorAt > moveAt) {
    gaps.push({
      id: 'A2',
      why: `镜像排在搬走之后(robocopy 在第 ${mirrorAt} 字、Move-Item 在第 ${moveAt} 字)⇒ 镜到的是空目录`,
      fix: '把 robocopy 提到 Move-Item 之前',
    })
  }

  // A3 只在镜像调用那一段里判:整文件搜 "-ge 8" 会被 deploy 里别的退出码分流糊过去(实测会)。
  const mirrorBlock = blockAfter(dCode, /& robocopy\.exe/, 12)
  if (!mirrorBlock) {
    gaps.push({
      id: 'A3',
      why: '取不到镜像调用那一段 ⇒ 无法判退出码有没有分档(未判定不记绿)',
      fix: '保持 `& robocopy.exe` 这一行可被行级定位',
    })
  } else {
    need(
      'A3',
      /-ge\s+8\b/,
      mirrorBlock,
      'robocopy 的退出码没有按成功档(0-7)与失败档(>=8)分开 ⇒ 要么把复制失败当没事,要么把正常复制当部署失败',
      '用 `$rcRc -ge 8` 分流:失败只 WARN 并让灰度进未判定,不阻断部署',
    )
  }

  need(
    'A4',
    /Get-GrayCanaryCommand[\s\S]*Test-Path[^\n]*\$GrayDistDir[^\n]*BUILD_ID/,
    gCode,
    '灰度实例的产物存在性判据没有落在 $GrayDist(.next-canary)上',
    'Get-GrayCanaryCommand 必须检 $GrayDistDir\\BUILD_ID',
  )
  forbid(
    'A4b',
    /\.next-staging/,
    gCode,
    'gray 侧代码面仍把 .next-staging 当产物来源 ⇒ 换流把它搬走后,灰度永远无产物',
    '来源改成 $GrayDist = .next-canary(注释里提 staging 说明成因不受本条限制)',
  )
  need(
    'A4c',
    /\$env:IHUI_BUILD_DIST\s*=\s*\$GrayDist\b/,
    gCode,
    '灰度实例的 IHUI_BUILD_DIST 没有指到 $GrayDist ⇒ next.config 的 distDir 与存在性判据读两份',
    '$env:IHUI_BUILD_DIST = $GrayDist',
  )

  // A5 只在 Start-GrayCanary 这一格里判:整文件级 co-occurrence 会被函数定义处糊过去(判据必须落在动作那一格)。
  const startBody = sectionOf(gCode, /^function Start-GrayCanary\b/)
  if (!startBody) {
    gaps.push({
      id: 'A5',
      why: '取不到 function Start-GrayCanary 这一段 ⇒ 无法判"在位实例是否核对过产物"(未判定不记绿)',
      fix: '保持 `function Start-GrayCanary {` 这一行可被行级定位',
    })
  } else {
    need(
      'A5',
      /\$artifact[\s\S]{0,400}\$served\s+-eq\s+\$artifact/,
      startBody,
      '在位的灰度实例没有先比对产物 buildId ⇒ 长驻进程会拿上一轮的构建冒充本轮候选(pass 分支根本不 -Action stop)',
      '端口在位时:读 $GrayDist 的 BUILD_ID 与在位记录($GrayBuildFile)比,不等才继续起',
    )
    need(
      'A5b',
      /Stop-GrayProcess/,
      startBody,
      '比对不等却没有停旧实例 ⇒ 新构建永远起不来,"不冒充"只是说说',
      '不等时先 Stop-GrayProcess -PidFile $CanaryPidFile,再走启动',
    )
  }

  return { undetermined: false, gaps }
}

/** 取某一行(及其后 n 行)那一小块。找不到该行 ⇒ null(调用方落未判定,不空串记绿)。 */
function blockAfter(text, openerRe, n = 10) {
  const lines = String(text ?? '').split(/\r?\n/)
  const start = lines.findIndex((l) => openerRe.test(l))
  if (start < 0) return null
  return lines.slice(start, start + n + 1).join('\n')
}

/** 取某个顶格 function 到下一个顶格 function 之间的整段(行级,不做花括号配平)。取不到 ⇒ null。 */
function sectionOf(text, openerRe) {
  const lines = String(text ?? '').split(/\r?\n/)
  const start = lines.findIndex((l) => openerRe.test(l))
  if (start < 0) return null
  const out = [lines[start]]
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^function\s/.test(lines[i])) break
    out.push(lines[i])
  }
  return out.join('\n')
}

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push([name, fn])
  const realDeploy = () => readFileSync(DEPLOY_PS1, 'utf8')
  const realGray = () => readFileSync(GRAY_PS1, 'utf8')

  t('正向:真仓两面全中', () => {
    const r = artifactGaps({ deployText: realDeploy(), grayText: realGray() })
    if (r.undetermined) throw new Error('未判定')
    return r.gaps.length === 0 || `实得 ${JSON.stringify(r.gaps.map((g) => g.id))}`
  })
  t('被审面取不到 ⇒ 未判定(不记绿)', () => {
    const r = artifactGaps({ deployText: null, grayText: realGray() })
    return r.undetermined === true && r.gaps.length === 0
  })
  const MUTES = [
    {
      want: 'A1',
      side: 'deploy',
      name: '摘掉镜像',
      text: (s) => s.replace(/& robocopy\.exe/g, '& 已摘镜像.exe'),
    },
    {
      want: 'A1b',
      side: 'deploy',
      name: '镜像目标改名',
      text: (s) => s.replace(/'\.next-canary'/, "'.next-whatever'"),
    },
    {
      want: 'A2',
      side: 'deploy',
      name: '把镜像挪到换流之后',
      text: (s) => {
        const mirror = /\r?\n(\s*& robocopy\.exe[^\n]*)/
        const m0 = s.match(mirror)
        if (!m0) throw new Error('夹具前提:找不到可挪的 robocopy 行')
        const moved = s.replace(mirror, '')
        const mv = /(Move-Item "\$WebDir\\\.next-staging"[^\n]*)/
        if (!moved.match(mv)) throw new Error('夹具前提:找不到 Move-Item staging 换流行')
        return moved.replace(mv, `$1${m0[0]}`)
      },
    },
    {
      want: 'A3',
      side: 'deploy',
      name: '摘掉 robocopy 失败档分流',
      text: (s) => s.replace(/\$rcRc -ge 8/, '$rcRc -ne 0'),
    },
    {
      want: 'A4b',
      side: 'gray',
      name: '灰度来源退回 staging',
      text: (s) => s.replace(/\$GrayDist = '\.next-canary'/, "$GrayDist = '.next-staging'"),
    },
    {
      want: 'A4c',
      side: 'gray',
      name: '启动环境变量与来源判据分家',
      text: (s) =>
        s.replace(/\$env:IHUI_BUILD_DIST = \$GrayDist/, "$env:IHUI_BUILD_DIST = '.next'"),
    },
    {
      want: 'A5',
      side: 'gray',
      name: '摘掉在位实例的 buildId 比对',
      text: (s) => s.replace(/\$served -eq \$artifact/, '$served -ne $artifact'),
    },
    {
      want: 'A5b',
      side: 'gray',
      name: '比对不等却不先停旧实例',
      text: (s) =>
        s.replace(
          /Stop-GrayProcess -PidFile \$CanaryPidFile -What '灰度实例' \| Out-Null/,
          '# 已摘停旧实例',
        ),
    },
  ]
  for (const m of MUTES) {
    t(`变异:${m.name} ⇒ ${m.want} 翻红`, () => {
      const d = realDeploy()
      const g = realGray()
      const mutated = m.text(m.side === 'deploy' ? d : g)
      // 变异没生效 = 夹具腐烂,不是判据绿了。把它单独报出来,免得"仍判绿"把两种成因混成一格。
      if (mutated === (m.side === 'deploy' ? d : g)) {
        throw new Error(`变异未生效(原文里没有这一格 ⇒ 本自证假绿):${m.name}`)
      }
      // 每条变异只动它归属的那一面,另一面保持真值 ⇒ 翻红只能来自被摘那一格
      const r = artifactGaps({
        deployText: m.side === 'deploy' ? mutated : d,
        grayText: m.side === 'gray' ? mutated : g,
      })
      return (
        r.gaps.some((x) => x.id === m.want) ||
        `摘掉 ${m.want} 仍判绿(实得 ${JSON.stringify(r.gaps.map((x) => x.id))})`
      )
    })
  }
  t(
    '夹具自证:两面都缺关键构造 ⇒ 每一"必须存在"格各自翻红(forbid 格不参与这一例,它靠 A4b 变异证)',
    () => {
      const r = artifactGaps({
        deployText: '$x = 1',
        grayText: 'function Start-GrayCanary { return $true }',
      })
      const ids = r.gaps.map((g) => g.id)
      return (
        ['A1', 'A1b', 'A2', 'A3', 'A4', 'A4c', 'A5', 'A5b'].every((i) => ids.includes(i)) ||
        `实得 ${JSON.stringify(ids)}`
      )
    },
  )
  let pass = 0
  for (const [name, fn] of cases) {
    let ok = false
    let note = ''
    try {
      const v = fn()
      ok = v === true
      if (!ok) note = String(v)
    } catch (e) {
      ok = false
      note = String(e?.message ?? e)
    }
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${note ? ` — ${note}` : ''}`)
    if (ok) pass++
  }
  console.log(`通过 ${pass} / 失败 ${cases.length - pass}`)
  return pass === cases.length ? EXIT_OK : EXIT_GAP
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) return selfTest()
  if (!existsSync(DEPLOY_PS1) || !existsSync(GRAY_PS1)) {
    console.log(
      `CANARY-ARTIFACT unjudged 取不到被审面(deploy=${existsSync(DEPLOY_PS1)} gray=${existsSync(GRAY_PS1)})`,
    )
    return EXIT_UNDETERMINED
  }
  const r = artifactGaps({
    deployText: readFileSync(DEPLOY_PS1, 'utf8'),
    grayText: readFileSync(GRAY_PS1, 'utf8'),
  })
  if (r.undetermined) {
    console.log(`CANARY-ARTIFACT unjudged ${r.why}`)
    return EXIT_UNDETERMINED
  }
  if (args.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    return r.gaps.length ? EXIT_GAP : EXIT_OK
  }
  if (r.gaps.length === 0) {
    console.log(`CANARY-ARTIFACT ok 灰度产物来源与顺序全格命中(${DEPLOY_PS1} / ${GRAY_PS1})`)
    return EXIT_OK
  }
  console.log(`CANARY-ARTIFACT gap 缺口 ${r.gaps.length} 处:`)
  for (const g of r.gaps) console.log(`  · ${g.id} ${g.why}\n    出路:${g.fix}`)
  return EXIT_GAP
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(EXIT_UNDETERMINED)
  }
}

export const __test__ = { artifactGaps, codeLines, DEPLOY_PS1, GRAY_PS1 }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
