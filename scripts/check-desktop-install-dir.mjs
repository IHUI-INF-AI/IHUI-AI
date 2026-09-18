#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 桌面端安装器「默认安装目录 / 安装语言」回归守门(第一层:静态不变量)。
 *
 * ## 为什么需要它
 * 2026-09-18 真实事故:中文系统上 Windows 安装包(i)向导语言是英文、(ii)默认安装目录
 * 不是期望的 D 盘根目录。根因是 Tauri v2 的 `nsis.installerHooks` 四个宏都跑在 Section 内,
 * 管不到向导"选择安装位置"页的默认值;唯一官方接管点是 `bundle.windows.nsis.template`
 * 整体替换内置模板(实现见 scripts/desktop-nsis-template.mjs)。另一历史事故:`languages`
 * 曾被填成 `zh-CN`(非法 MUI 语言名)→ makensis "语言文件缺失" 被 CI 静默吞掉 →
 * 0.1.35 release 无任何 Windows 资产。
 *
 * 修复本身很简单,但**极易被静默回退**:上游模板漂移、Tauri CLI 升级、有人"顺手调整"
 * tauri.conf.json、有人误以为写 installerHooks 就能改目录…… 任何一处都能让用户看到的
 * 向导又变回英文、路径又变回 Program Files,而且构建照旧成功。本脚本把这些不变量
 * 固化成可执行断言,让回退在**提交时**和**CI**就炸出来,而不是等用户装上才发现。
 *
 * ## 校验项(全部离线,不需要 node_modules)
 *   A1 tauri.conf.json 可解析且 bundle.windows.nsis 存在
 *   A2 nsis.template 指向仓库内的 windows/installer.nsi
 *   A3 nsis.installerHooks 指向存在的 windows/hooks.nsi
 *   A4 nsis.languages 全部是合法 MUI 语言名,且含 SimpChinese(拦 zh-CN 类回归)
 *   A5 nsis.installMode 不得为 "both"(否则 MULTIUSER_INIT 会在定制块之后按
 *      ${PROGRAMFILES}/${LOCALAPPDATA} 重算 $INSTDIR,D 盘默认值被静默击穿)
 *   A6 nsis.compression == "none"(产物级校验 assert-installer-strings.mjs 依赖数据块
 *      未压缩才能 grep 到路径字符串;改压缩会等于自愿放弃最后一道端到端防线)
 *   B1 模板存在,且 IHUI 定制块起止标记各一份、顺序正确
 *   B2 定制块内恰有一处 `StrCpy $INSTDIR "D:\智汇AI"` 与一处 `... "D:\IHUI AI"`
 *   B3 定制块以 `$LANGUAGE == 2052` 判别(中文 → 中文目录),且 If/Else/EndIf 成对
 *   B4 定制块内保留无条件 `Call RestorePreviousInstallLocation`(重装/静默升级沿用既有位置)
 *   B5 定制块位于 Function .onInit 内、且在任何 Section 之前(向导首屏即生效的必要条件)
 *   B6 上游包裹层 `${If} $INSTDIR == "${PLACEHOLDER_INSTALL_DIR}"` 仍在块前
 *      (上游若改结构,定制块会被条件跳过而"看似存在、实际不生效")
 *   B7 模板内每个 `!insertmacro MULTIUSER_INIT` 都被 `!if "${INSTALLMODE}" == "both"` 包着
 *   C1 hooks.nsi 不得出现 `StrCpy $INSTDIR`(那是死路:Section 内改目录不影响向导首屏)
 *
 * 可选:
 *   --template        追加运行 scripts/desktop-nsis-template.mjs --check(与 Tauri CLI
 *                     内置模板逐字节比对,拦上游漂移)。需要能定位 @tauri-apps/cli。
 *   --require-cli     --template 模式下,定位不到 Tauri CLI 视为失败(CI/发版用;
 *                     默认容忍缺失,便于离线开发机提交)。
 *
 * 用法:
 *   node scripts/check-desktop-install-dir.mjs
 *   node scripts/check-desktop-install-dir.mjs --template
 *   node scripts/check-desktop-install-dir.mjs --template --require-cli
 *   exit 0 = 不变量成立;exit 1 = 发现回退
 *
 * 跳过(应急,慎用): HUSKY_SKIP_DESKTOP_INSTALL_DIR=1 git commit ...
 */
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = process.cwd()
const DESKTOP = join(ROOT, 'apps', 'desktop', 'src-tauri')
const CONF = join(DESKTOP, 'tauri.conf.json')
const TEMPLATE = join(DESKTOP, 'windows', 'installer.nsi')
const HOOKS = join(DESKTOP, 'windows', 'hooks.nsi')

// === 期望值(必须与 scripts/desktop-nsis-template.mjs 的 IHUI_BLOCK 同源)===
const ZH_DIR = 'D:\\智汇AI'
const EN_DIR = 'D:\\IHUI AI'
const ZH_LANGUAGE_ID = 2052
const BLOCK_START = '; ==== IHUI 定制:默认安装目录(向导首屏即生效)===='
const BLOCK_END = '; ==== IHUI 定制结束 ===='

// NSIS MUI 合法语言名:形如 SimpChinese / English / Dutch / French。
// 不含连字符/下划线 —— `zh-CN` / `zh_CN` 这类 BCP-47 标签会被 makensis 判为找不到语言文件。
const MUI_LANGUAGE_NAME = /^[A-Z][A-Za-z0-9]*$/
const REQUIRED_LANGUAGE = 'SimpChinese'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const failures = []
const infos = []

/** 记一条失败:标题 + 证据 + 修复指引 */
function fail(id, title, evidence, fix) {
  failures.push({ id, title, evidence, fix })
}

/** 统计子串出现次数(纯字面量,非正则,避免路径里的反斜杠被当转义) */
function countOf(haystack, needle) {
  return haystack.split(needle).length - 1
}

function readText(path, label) {
  if (!existsSync(path)) {
    fail(`X-${label}`, `${label} 不存在`, path, `确认文件是否被误删;模板可用 node scripts/desktop-nsis-template.mjs --write 重新生成`)
    return null
  }
  return readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
}

// === A. tauri.conf.json 配置不变量 ===

let nsis = null
if (!existsSync(CONF)) {
  fail('A1', 'tauri.conf.json 不存在', CONF, '确认 apps/desktop/src-tauri 是否完整')
} else {
  let conf = null
  try {
    conf = JSON.parse(readFileSync(CONF, 'utf8'))
  } catch (error) {
    fail('A1', 'tauri.conf.json 不是合法 JSON', error.message, '修复 JSON 语法(注意尾随逗号)')
  }

  if (conf) {
    nsis = conf?.bundle?.windows?.nsis ?? null

    if (!nsis || typeof nsis !== 'object') {
      fail(
        'A1',
        'bundle.windows.nsis 缺失',
        `bundle.windows = ${JSON.stringify(conf?.bundle?.windows ?? null)}`,
        '补回 nsis 配置(template / installerHooks / languages 三项,见 scripts/desktop-nsis-template.mjs 头部说明)',
      )
    } else {
      // A2 模板接管
      if (nsis.template !== 'windows/installer.nsi') {
        fail(
          'A2',
          'nsis.template 未指向仓库内定制模板',
          `实际值: ${JSON.stringify(nsis.template)}`,
          '设为 "windows/installer.nsi"。这是改向导默认目录的**唯一**官方接管点,' +
            '清空/改错会退回 Tauri CLI 内置模板 → 默认安装目录又变回 Program Files。',
        )
      }

      // A3 hooks 落盘兜底
      if (nsis.installerHooks !== 'windows/hooks.nsi') {
        fail(
          'A3',
          'nsis.installerHooks 未指向 windows/hooks.nsi',
          `实际值: ${JSON.stringify(nsis.installerHooks)}`,
          '设为 "windows/hooks.nsi"(仅承担安装落盘阶段兜底,不负责默认目录)',
        )
      } else if (!existsSync(HOOKS)) {
        fail('A3', 'installerHooks 指向的文件不存在', HOOKS, '补回 apps/desktop/src-tauri/windows/hooks.nsi')
      }

      // A4 语言名合法性 —— zh-CN 事故的正面拦截
      const languages = nsis.languages
      if (!Array.isArray(languages) || languages.length === 0) {
        fail(
          'A4',
          'nsis.languages 缺失或为空',
          `实际值: ${JSON.stringify(languages)}`,
          '设为 ["SimpChinese", "English"](中文系统才会走 D:\\智汇AI 分支)',
        )
      } else {
        const illegal = languages.filter((l) => typeof l !== 'string' || !MUI_LANGUAGE_NAME.test(l))
        if (illegal.length > 0) {
          fail(
            'A4',
            'nsis.languages 含非法 MUI 语言名',
            `非法项: ${JSON.stringify(illegal)};全会话: ${JSON.stringify(languages)}`,
            '必须用 NSIS MUI 语言名(如 SimpChinese / English),不能用 BCP-47 标签(zh-CN / zh_CN)。' +
              '反例后果:makensis 报"语言文件缺失"、Windows 资产静默缺失(0.1.35 事故)。',
          )
        }
        if (!languages.includes(REQUIRED_LANGUAGE)) {
          fail(
            'A4',
            `nsis.languages 不含 ${REQUIRED_LANGUAGE}`,
            `实际值: ${JSON.stringify(languages)}`,
            `补回 "${REQUIRED_LANGUAGE}":中文系统安装时 $LANGUAGE 才会是 ${ZH_LANGUAGE_ID},` +
              `否则向导回退英文、目录落到 ${EN_DIR}`,
          )
        }
      }

      // A5 installMode:both 会击穿定制块(见文件头 A5 说明)
      if (nsis.installMode === 'both') {
        fail(
          'A5',
          'nsis.installMode = "both" 会导致默认安装目录被覆盖',
          'INSTALLMODE == "both" 时模板会插入 MULTIUSER_INIT,其中 MULTIUSER_INSTALLMODE_INSTDIR' +
            ' 会把 $INSTDIR 重算为 ${PROGRAMFILES}\\智汇AI 或 ${LOCALAPPDATA}\\智汇AI,' +
            '而该插入点在 IHUI 定制块之后 → D 盘默认值静默失效。',
          '改用 "currentUser" 或 "perMachine";确需 both 时必须把 IHUI 定制块移到 MULTIUSER_INIT 之后,' +
            '并同步更新 scripts/desktop-nsis-template.mjs 的 IHUI_BLOCK 与本脚本。',
        )
      }

      // A6 压缩方式:产物级校验的前提
      if (nsis.compression !== 'none') {
        fail(
          'A6',
          'nsis.compression 不是 "none",产物级校验会失效',
          `实际值: ${JSON.stringify(nsis.compression)}`,
          '设为 "none"。scripts/assert-installer-strings.mjs 靠"数据块未压缩"直接在 .exe 里' +
            '搜 D:\\智汇AI 字样来证明定制真的编译进去了;开启压缩后该证据不可得,' +
            '等于放弃最后一道端到端防线(如需改压缩,请先为该脚本提供等价的产物级校验手段)。',
        )
      }
    }
  }
}

// === B. installer.nsi 模板不变量 ===

const nsi = readText(TEMPLATE, 'installer.nsi')

if (nsi) {
  const startIdx = nsi.indexOf(BLOCK_START)
  const endIdx = nsi.indexOf(BLOCK_END)

  // B1 起止标记
  if (startIdx < 0) {
    fail(
      'B1',
      'IHUI 定制块起始标记缺失',
      `未找到: ${BLOCK_START}`,
      '模板被上游或人工改写覆盖了。重新生成: node scripts/desktop-nsis-template.mjs --write' +
        '(如需保留自定义逻辑,请改 scripts/desktop-nsis-template.mjs 的 IHUI_BLOCK 常量)',
    )
  } else if (endIdx < 0 || endIdx < startIdx) {
    fail(
      'B1',
      'IHUI 定制块结束标记缺失或次序颠倒',
      `起始 @${startIdx}, 结束 @${endIdx}`,
      '重新生成: node scripts/desktop-nsis-template.mjs --write',
    )
  } else if (countOf(nsi, BLOCK_START) !== 1 || countOf(nsi, BLOCK_END) !== 1) {
    fail(
      'B1',
      'IHUI 定制块标记重复',
      `起始 ×${countOf(nsi, BLOCK_START)}, 结束 ×${countOf(nsi, BLOCK_END)}`,
      '只允许一处定制块;重新生成模板以恢复唯一性',
    )
  }

  const block = startIdx >= 0 && endIdx > startIdx ? nsi.slice(startIdx, endIdx) : ''

  if (block) {
    // B2 两条路径赋值,各恰好一次
    const zhAssign = `StrCpy $INSTDIR "${ZH_DIR}"`
    const enAssign = `StrCpy $INSTDIR "${EN_DIR}"`
    for (const [label, expr, expected] of [
      ['中文目录', zhAssign, 1],
      ['英文目录', enAssign, 1],
    ]) {
      const n = countOf(block, expr)
      if (n !== expected) {
        fail(
          'B2',
          `定制块内 ${label} 赋值出现 ${n} 次(期望 ${expected})`,
          expr,
          '定制块应由 scripts/desktop-nsis-template.mjs 的 IHUI_BLOCK 生成,请核对后 --write 重建',
        )
      }
    }
    // 反向:两处赋值不得逸出定制块(逸出=可能落到 Section 内,首屏不生效)
    if (countOf(nsi, zhAssign) !== countOf(block, zhAssign) || countOf(nsi, enAssign) !== countOf(block, enAssign)) {
      fail(
        'B2',
        '安装目录赋值逸出 IHUI 定制块',
        `全模板 中文×${countOf(nsi, zhAssign)} 英文×${countOf(nsi, enAssign)};` +
          `块内 中文×${countOf(block, zhAssign)} 英文×${countOf(block, enAssign)}`,
        '赋值必须在 .onInit 的定制块内;块外出现通常意味着有人挪进了 Section(向导首屏不生效)',
      )
    }

    // B3 语言判别
    const guard = `$LANGUAGE == ${ZH_LANGUAGE_ID}`
    if (!block.includes(`\${If} ${guard}`)) {
      fail(
        'B3',
        `定制块缺少 \${If} ${guard} 语言判别`,
        '未找到该行',
        '中文必须映射到中文目录、其余语言映射到英文目录;判别变量只用 $LANGUAGE' +
          '(NSIS 启动即按系统语言选中),不要改用 kernel32::GetUserDefaultUILanguage',
      )
    }
    for (const macro of ['${If}', '${Else}', '${EndIf}']) {
      if (!block.includes(macro)) {
        fail('B3', `定制块缺少 ${macro}`, '未找到该行', 'If/Else/EndIf 必须成对,否则 makensis 编译报错')
      }
    }
    if (!block.includes(ZH_DIR) || !block.includes(EN_DIR)) {
      fail('B3', '定制块内缺少目标目录字面量', `zh=${block.includes(ZH_DIR)} en=${block.includes(EN_DIR)}`, '重新生成模板')
    }

    // B4 重装/升级沿用既有位置
    const restore = 'Call RestorePreviousInstallLocation'
    if (!block.includes(restore)) {
      fail(
        'B4',
        '定制块丢失无条件的 RestorePreviousInstallLocation',
        '未找到该行',
        '该调用承担两个职责:① 已装过则沿用既有安装位置(避免产生第二份安装);' +
          '② /UPDATE 静默升级回原位置。注册表无记录时它不动 $INSTDIR,全新机器仍走 D 盘默认目录。' +
          '上游是无条件调用,不要包进任何条件分支。',
      )
    }

    // B5 时机:必须在 .onInit 内、任何 Section 之前
    const onInitIdx = nsi.indexOf('Function .onInit')
    const firstSectionMatch = nsi.match(/^Section\s/m)
    const firstSectionIdx = firstSectionMatch ? firstSectionMatch.index : -1
    const onInitEndIdx = onInitIdx >= 0 ? nsi.indexOf('FunctionEnd', onInitIdx) : -1

    if (onInitIdx < 0) {
      fail('B5', '模板缺少 Function .onInit', '未找到', '重新生成模板')
    } else if (startIdx < onInitIdx) {
      fail(
        'B5',
        'IHUI 定制块不在 Function .onInit 内(位于其之前)',
        `onInit @${onInitIdx}, 定制块 @${startIdx}`,
        '赋值必须发生在 .onInit —— 向导"选择安装位置"页在 .onInit 之后才展示,否则首屏仍是上游默认值',
      )
    } else if (onInitEndIdx > 0 && endIdx > onInitEndIdx) {
      fail(
        'B5',
        'IHUI 定制块越出 Function .onInit(越过 FunctionEnd)',
        `.onInit FunctionEnd @${onInitEndIdx}, 定制块结束 @${endIdx}`,
        '重新生成模板',
      )
    } else if (firstSectionIdx > 0 && startIdx > firstSectionIdx) {
      fail(
        'B5',
        'IHUI 定制块落在 Section 之内',
        `首个 Section @${firstSectionIdx}, 定制块 @${startIdx}`,
        'Section 内执行时机过晚:只影响落盘,不影响向导首屏显示的默认目录。必须留在 .onInit。',
      )
    }

    // B6 上游包裹层
    const wrapper = '${If} $INSTDIR == "${PLACEHOLDER_INSTALL_DIR}"'
    const wrapperIdx = nsi.indexOf(wrapper)
    if (wrapperIdx < 0) {
      fail(
        'B6',
        '上游包裹层 ${If} $INSTDIR == "${PLACEHOLDER_INSTALL_DIR}" 缺失',
        '未找到',
        '定制块依赖这层包裹(与上游 InstallDir/PLACEHOLDER_INSTALL_DIR 机制配合)。' +
          '上游模板若改结构,定制块会被条件跳过 —— 即"代码还在、实际不生效"。' +
          '请对照新上游模板修订 scripts/desktop-nsis-template.mjs 的 UPSTREAM_BLOCK 常量。',
      )
    } else if (wrapperIdx > startIdx) {
      fail(
        'B6',
        '包裹层出现在定制块之后(结构已变)',
        `包裹层 @${wrapperIdx}, 定制块 @${startIdx}`,
        '核对上游模板结构,必要时执行 node scripts/desktop-nsis-template.mjs --check 查看漂移',
      )
    } else {
      const between = nsi.slice(wrapperIdx, startIdx)
      if (between.includes('EndIf')) {
        fail(
          'B6',
          '包裹层与定制块之间出现 EndIf,定制块已被排除在包裹之外',
          between.trim().split('\n').slice(-3).join(' / '),
          '重新生成模板并对照上游 diff',
        )
      }
    }

    // B7 MULTIUSER_INIT 必须有 INSTALLMODE 条件守卫
    const muLines = nsi.split('\n')
    muLines.forEach((line, i) => {
      if (!/!insertmacro\s+MULTIUSER_INIT/.test(line)) return
      const context = muLines.slice(Math.max(0, i - 4), i).join('\n')
      if (!/!if\s+"\$\{INSTALLMODE\}"\s*==\s*"both"/.test(context)) {
        fail(
          'B7',
          `第 ${i + 1} 行的 MULTIUSER_INIT 没有 INSTALLMODE == "both" 条件守卫`,
          line.trim(),
          '无条件插入 MULTIUSER_INIT 会在定制块之后重算 $INSTDIR,击穿 D 盘默认目录',
        )
      }
      if (i > startIdx) {
        infos.push(
          `MULTIUSER_INIT(@${i + 1}) 在定制块之后 —— 当前由 INSTALLMODE 条件编译排除(installMode 非 both 时不存在),` +
            '故不影响默认目录;若将来启用 installMode: "both" 必须调整顺序(见校验项 A5)。',
        )
      }
    })
  }
}

// === C. hooks.nsi 职责边界 ===

const hooks = readText(HOOKS, 'hooks.nsi')
if (hooks) {
  const assignRe = /StrCpy\s+\$INSTDIR\s+/g
  if (assignRe.test(hooks)) {
    fail(
      'C1',
      'hooks.nsi 里出现 StrCpy $INSTDIR(死路修复)',
      hooks
        .split('\n')
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => /StrCpy\s+\$INSTDIR/.test(l))
        .map(({ l, i }) => `L${i + 1}: ${l.trim()}`)
        .join(' / '),
      'installerHooks 的宏全部在 Section 内执行,改不了向导"选择安装位置"页的**首屏默认值**。' +
        '在这里改目录会让人误以为已修复。默认目录请只改 windows/installer.nsi(经 scripts/desktop-nsis-template.mjs 生成)。',
    )
  }
}

// === 可选:与 Tauri CLI 内置模板比对(上游漂移) ===

const wantTemplate = process.argv.includes('--template')
const requireCli = process.argv.includes('--require-cli')

if (wantTemplate) {
  const args = ['scripts/desktop-nsis-template.mjs', '--check']
  if (requireCli) args.push('--require-cli')
  try {
    const out = execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    // 子脚本会打印多行;优先挑"最说明问题"的那行(跳过原因 / OK / DRIFT)
    const lines = out.trim().split('\n').filter(Boolean)
    const pick =
      lines.find((l) => l.includes('跳过漂移校验')) ??
      lines.find((l) => l.includes('OK:')) ??
      lines[lines.length - 1]
    infos.push(`模板漂移校验: ${pick}`)
  } catch (error) {
    const out = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
    fail(
      'D1',
      'installer.nsi 与 Tauri CLI 内置模板不一致(上游漂移 / CLI 定位失败)',
      out || error.message,
      '先看证据首行区分两种情况:① 上游模板变了 → diff 后 node scripts/desktop-nsis-template.mjs --write 重建' +
        '(会自动套回 IHUI 定制块);若上游改了"默认安装目录"段落 → 需人工复核 IHUI_BLOCK 后再 --write。' +
        '② 只是 CLI 定位失败 → 检查依赖是否装好(本平台需装 @tauri-apps/cli;注意 NSIS 模板只在 Windows 版二进制里,' +
        '非 Windows 平台本脚本会自动跳过漂移校验而不会走到这里)。',
    )
  }
}

// === 输出 ===

if (failures.length > 0) {
  console.log(`${C.red}✗ 桌面端安装器回归守门未通过:${failures.length} 项${C.reset}`)
  console.log()
  failures.forEach((f, i) => {
    console.log(`  ${C.red}${i + 1}. [${f.id}] ${f.title}${C.reset}`)
    if (f.evidence) console.log(`     ${C.dim}证据: ${f.evidence}${C.reset}`)
    if (f.fix) console.log(`     ${C.yellow}修复: ${f.fix}${C.reset}`)
    console.log()
  })
  console.log(
    `  ${C.dim}说明:本守门防止"向导又变回英文 / 默认安装目录又变回 Program Files"的静默回退。${C.reset}`,
  )
  console.log(`  ${C.dim}如确认要临时绕过(应急): HUSKY_SKIP_DESKTOP_INSTALL_DIR=1 git commit ...${C.reset}`)
  process.exit(1)
}

console.log(
  `${C.green}✓${C.reset} 桌面端安装器不变量成立:向导默认目录 ${ZH_DIR}(${ZH_LANGUAGE_ID}/SimpChinese)` +
    ` / ${EN_DIR}(其余语言),语言表含 ${REQUIRED_LANGUAGE},RestorePreviousInstallLocation 保留`,
)
infos.forEach((s) => console.log(`  ${C.dim}· ${s}${C.reset}`))
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
