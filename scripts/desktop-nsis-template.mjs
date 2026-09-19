#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 模板生成/校验脚本为 CLI 工具,需 console 输出诊断信息 */
// 桌面端 NSIS 安装器模板:生成 / 漂移校验。
//
// 背景:Tauri v2 的 nsis.installerHooks 只暴露 PREINSTALL/POSTINSTALL/PREUNINSTALL/POSTUNINSTALL
// 四个宏,全部在 Section 内执行 —— 改不了安装向导的页面结构。
// 唯一官方接管方式是 bundle.windows.nsis.template 整体替换模板。因此本仓库维护一份
// "上游模板 + IHUI 补丁集"的副本,并由本脚本保证两者不漂移。
//
// IHUI 补丁集(见下方 PATCHES,依序应用):
//   P0 默认安装目录      .onInit 内,语言化 D: 盘默认目录(重装沿用旧位置语义不变)
//   P1 欢迎页            → Page custom IHUIWelcomePage IHUIWelcomeLeave(品牌深色页)
//   P2 目录页            → Page custom IHUIDirPage IHUIDirLeave(品牌深色页)
//   P3 安装页            → SHOW/LEAVE 回调(深色化 + 进度条品牌重着色)
//   P4 完成页            → Page custom IHUIFinishPage IHUIFinishLeave
//                          (MUI_FINISHPAGE_* 移除;快捷方式/启动逻辑移入 IHUIOnFinish/IHUIOnLaunch)
//   P5 重装/升级确认页    → PageReinstall 内插 IHUI_REINSTALLTHEME 主题宏
//   P6 .onInit 开屏      → 尾部插 IHUI_INITSPLASH(AdvSplash 多帧品牌动画 + 资产预解压)
//   页面/宏/函数实现全部在 windows/ihui-ui.nsi,经 hooks.nsi include 接线。
//
// 用法:
//   node scripts/desktop-nsis-template.mjs --check   # 校验仓库模板 == 上游模板 + IHUI 补丁(不一致 exit 1)
//   node scripts/desktop-nsis-template.mjs --write   # 从当前 Tauri CLI 重新生成仓库模板
//
// 触发时机:升级 Tauri CLI 后必须跑一次 --check;不一致则看 diff 决定是否 --write。

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TARGET = join(ROOT, 'apps/desktop/src-tauri/windows/installer.nsi');

// 目标模板头部:标注来源与定制范围。--check 时连同上游正文一起参与比对。
const HEADER = [
  '; ⚠️ 本文件是 Tauri v2 NSIS 安装器模板的定制副本,上游版权归 tauri-apps/tauri(MIT / Apache-2.0)。',
  '; 来源:tauri-bundler · crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi(tauri-cli 内置,include_str!)',
  ';',
  '; IHUI 定制范围(补丁集 P0-P6,由 scripts/desktop-nsis-template.mjs 维护,其余与上游逐字节一致):',
  ';   P0 .onInit 默认安装目录:安装语言为简体中文($LANGUAGE = 2052)→ D:\\智汇AI,其余 → D:\\IHUI AI。',
  ';      上游紧跟其后的 Call RestorePreviousInstallLocation 原样保留,',
  ';      因此"已装过则沿用既有安装位置"(重装不产生第二份安装、/UPDATE 静默升级回原位置)的语义不变。',
  ';      目的是让安装向导"选择安装位置"页的首屏默认值即为该路径。',
  ';   P1-P4,P6 安装向导全面品牌化(无边框深色窗口/每页满幅品牌位图/位图按钮/进度条重着色/',
  ';      AdvSplash 多帧开屏),实现见 windows/ihui-ui.nsi(经 hooks.nsi include 接线)。',
  ';   P5 重装/升级确认页深色主题宏。',
  ';',
  '; ⚠️ 升级 Tauri CLI 后必须执行:node scripts/desktop-nsis-template.mjs --check',
  ';   禁止手工编辑本文件的非定制段落;要改定制逻辑请改本脚本内的常量后重新 --write。',
  '',
  '',
].join('\n');

// ---- P0:默认安装目录(上游片段 → IHUI 片段) ----
const P0_UPSTREAM = [
  '    ; Set default install location',
  '    !if "${INSTALLMODE}" == "perMachine"',
  '      ${If} ${RunningX64}',
  '        !if "${ARCH}" == "x64"',
  '          StrCpy $INSTDIR "$PROGRAMFILES64\\${PRODUCTNAME}"',
  '        !else if "${ARCH}" == "arm64"',
  '          StrCpy $INSTDIR "$PROGRAMFILES64\\${PRODUCTNAME}"',
  '        !else',
  '          StrCpy $INSTDIR "$PROGRAMFILES\\${PRODUCTNAME}"',
  '        !endif',
  '      ${Else}',
  '        StrCpy $INSTDIR "$PROGRAMFILES\\${PRODUCTNAME}"',
  '      ${EndIf}',
  '    !else if "${INSTALLMODE}" == "currentUser"',
  '      StrCpy $INSTDIR "$LOCALAPPDATA\\${PRODUCTNAME}"',
  '    !endif',
  '',
  '    Call RestorePreviousInstallLocation',
].join('\n');

// 设计原则:只替换「默认目录的推导方式」,其余与上游逐字一致 —— 尤其是末尾那句
// 无条件的 Call RestorePreviousInstallLocation 必须原样保留,它承担两个职责:
//   ① 已安装过 → 沿用既有安装位置(重装不产生第二份安装);
//   ② /UPDATE 静默升级 → 回到原位置。
// 注册表无记录时该函数不改动 $INSTDIR(ReadRegStr 得空串则跳过),故全新机器上仍是 D: 盘默认目录。
const P0_IHUI = [
  '    ; ==== IHUI 定制:默认安装目录(向导首屏即生效)====',
  '    ; 上游按 INSTALLMODE 推导(currentUser → %LOCALAPPDATA%,perMachine → %PROGRAMFILES%);',
  '    ; 这里改为固定 D: 盘根目录下的语言化目录。赋值发生在 .onInit,',
  '    ; 因此安装向导"选择安装位置"页首次显示时展示的就是该路径。',
  '    ; $LANGUAGE 由 NSIS 在启动时按系统语言选中(languages = SimpChinese + English),',
  '    ; 实测中文系统为 2052(SimpChinese)。2052 → D:\\智汇AI,其余 → D:\\IHUI AI。',
  '    ; 不用 kernel32::GetUserDefaultUILanguage(需 System 插件,存在静默失败风险)。',
  '    ${If} $LANGUAGE == 2052',
  '      StrCpy $INSTDIR "D:\\智汇AI"',
  '    ${Else}',
  '      StrCpy $INSTDIR "D:\\IHUI AI"',
  '    ${EndIf}',
  '',
  '    Call RestorePreviousInstallLocation',
  '    ; ==== IHUI 定制结束 ====',
].join('\n');

// ---- P1:欢迎页 → IHUI 自定义品牌页 ----
const P1_UPSTREAM = [
  '; 1. Welcome Page',
  '!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive',
  '!insertmacro MUI_PAGE_WELCOME',
].join('\n');
const P1_IHUI = [
  '; 1. Welcome Page(IHUI 自定义品牌页,见 windows/ihui-ui.nsi;passive/静默在页内 Abort 跳过)',
  'Page custom IHUIWelcomePage IHUIWelcomeLeave',
].join('\n');

// ---- P2:目录页 → IHUI 自定义品牌页 ----
const P2_UPSTREAM = [
  '; 5. Choose install directory page',
  '!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive',
  '!insertmacro MUI_PAGE_DIRECTORY',
].join('\n');
const P2_IHUI = [
  '; 5. Choose install directory page(IHUI 自定义品牌页,见 windows/ihui-ui.nsi)',
  'Page custom IHUIDirPage IHUIDirLeave',
].join('\n');

// ---- P3:安装页 SHOW/LEAVE 回调(深色化 + 进度条重着色) ----
const P3_UPSTREAM = [
  '; 7. Installation page',
  '!insertmacro MUI_PAGE_INSTFILES',
].join('\n');
const P3_IHUI = [
  '; 7. Installation page(IHUI 深色化:SHOW/LEAVE 回调见 windows/ihui-ui.nsi)',
  '!define MUI_PAGE_CUSTOMFUNCTION_SHOW IHUIInstShow',
  '!define MUI_PAGE_CUSTOMFUNCTION_LEAVE IHUIInstLeave',
  '!insertmacro MUI_PAGE_INSTFILES',
].join('\n');

// ---- P4:完成页 → IHUI 自定义品牌页 ----
const P4_UPSTREAM = [
  '; 8. Finish page',
  ';',
  "; Don't auto jump to finish page after installation page,",
  '; because the installation page has useful info that can be used debug any issues with the installer.',
  '!define MUI_FINISHPAGE_NOAUTOCLOSE',
  '; Use show readme button in the finish page as a button create a desktop shortcut',
  '!define MUI_FINISHPAGE_SHOWREADME',
  '!define MUI_FINISHPAGE_SHOWREADME_TEXT "$(createDesktop)"',
  '!define MUI_FINISHPAGE_SHOWREADME_FUNCTION CreateOrUpdateDesktopShortcut',
  '; Show run app after installation.',
  '!define MUI_FINISHPAGE_RUN',
  '!define MUI_FINISHPAGE_RUN_FUNCTION RunMainBinary',
  '!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive',
  '!insertmacro MUI_PAGE_FINISH',
].join('\n');
const P4_IHUI = [
  '; 8. Finish page(IHUI 自定义品牌页,见 windows/ihui-ui.nsi)',
  '; 上游 MUI_FINISHPAGE_* 已移除:instfiles 完成后自动进入品牌完成页;',
  '; 快捷方式创建/启动应用逻辑移入 IHUIOnFinish/IHUIOnLaunch(Call 模板函数,语义不变)。',
  'Page custom IHUIFinishPage IHUIFinishLeave',
].join('\n');

// ---- P5:重装/升级确认页深色主题 ----
const P5_UPSTREAM = [
  '    ${NSD_SetFocus} $R2',
  '    nsDialogs::Show',
  '  ${EndIf}',
].join('\n');
const P5_IHUI = [
  '    ${NSD_SetFocus} $R2',
  '    ; IHUI:重装/升级确认页深色主题(只读 $R1/$R2/$R3/$R4,见 windows/ihui-ui.nsi)',
  '    !insertmacro IHUI_REINSTALLTHEME',
  '    nsDialogs::Show',
  '  ${EndIf}',
].join('\n');

// ---- P6:.onInit 尾部开屏动画(衔接 P0 补丁产物) ----
const P6_UPSTREAM = [
  '    ; ==== IHUI 定制结束 ====',
  '  ${EndIf}',
  '',
  '',
  '  !if "${INSTALLMODE}" == "both"',
].join('\n');
const P6_IHUI = [
  '    ; ==== IHUI 定制结束 ====',
  '  ${EndIf}',
  '',
  '  ; IHUI:多帧品牌开屏动画 + 页面资产预解压(passive/静默/升级模式跳过,见 windows/ihui-ui.nsi)',
  '  !insertmacro IHUI_INITSPLASH',
  '',
  '  !if "${INSTALLMODE}" == "both"',
].join('\n');

// 补丁集:name 用于诊断输出;apply 时严格断言锚点存在。
const PATCHES = [
  { name: 'P0 默认安装目录', upstream: P0_UPSTREAM, ihui: P0_IHUI },
  { name: 'P1 欢迎页', upstream: P1_UPSTREAM, ihui: P1_IHUI },
  { name: 'P2 目录页', upstream: P2_UPSTREAM, ihui: P2_IHUI },
  { name: 'P3 安装页回调', upstream: P3_UPSTREAM, ihui: P3_IHUI },
  { name: 'P4 完成页', upstream: P4_UPSTREAM, ihui: P4_IHUI },
  { name: 'P5 重装页主题', upstream: P5_UPSTREAM, ihui: P5_IHUI },
  { name: 'P6 开屏动画', upstream: P6_UPSTREAM, ihui: P6_IHUI },
];

// 定位 Tauri CLI 本地平台原生模块(模板以 include_str! 明文嵌入其中)
function findCliBinary() {
  const bases = new Set([join(ROOT, 'node_modules/@tauri-apps'), join(ROOT, 'apps/desktop/node_modules/@tauri-apps')]);
  // pnpm 把平台原生包放在 @tauri-apps/cli 真实路径的同级;用 require.resolve 取真实位置
  try {
    const require = createRequire(join(ROOT, 'apps/desktop/package.json'));
    bases.add(dirname(dirname(require.resolve('@tauri-apps/cli/package.json'))));
  } catch {
    /* 忽略:下面按目录扫描兜底 */
  }
  for (const base of bases) {
    if (!existsSync(base)) continue;
    let entries;
    try {
      entries = readdirSync(base);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.startsWith('cli-')) continue;
      const dir = join(base, entry);
      let names;
      try {
        names = readdirSync(dir);
      } catch {
        continue;
      }
      for (const name of names) {
        if (/^cli\..*\.node$/.test(name)) return join(dir, name);
      }
    }
  }
  return null;
}

// 从二进制中抽取模板:锚点 + 连续可打印字符区(include_str! 明文,未被压缩)
function extractTemplate(binPath) {
  const text = readFileSync(binPath).toString('latin1');
  const anchor = text.indexOf('!insertmacro MULTIUSER_INIT');
  if (anchor < 0) throw new Error('未在 Tauri CLI 二进制中定位到 NSIS 模板锚点');
  const printable = (c) => {
    const n = c.charCodeAt(0);
    return n === 9 || n === 10 || n === 13 || (n >= 32 && n <= 126);
  };
  let l = anchor;
  let r = anchor;
  while (l > 0 && printable(text[l - 1])) l--;
  while (r < text.length - 1 && printable(text[r + 1])) r++;
  const body = text.slice(l, r + 1).replaceAll('\r\n', '\n');
  if (!body.includes('Section Uninstall') || !body.includes('{{#each languages}}')) {
    throw new Error('抽取到的片段不像完整 installer.nsi 模板,请检查 Tauri CLI 版本');
  }
  return body;
}

const mode = process.argv.includes('--write') ? 'write' : 'check';

const bin = findCliBinary();
if (!bin) {
  if (mode === 'write') {
    console.error('[desktop-nsis-template] 未找到 @tauri-apps/cli 原生模块,无法生成模板(请在已安装依赖的工作区执行)');
    process.exit(1);
  }
  console.error('[desktop-nsis-template] 未找到 @tauri-apps/cli 原生模块,跳过校验(模板无法离线比对)');
  process.exit(0);
}

let upstream;
try {
  upstream = extractTemplate(bin);
} catch (error) {
  console.error(`[desktop-nsis-template] 抽取模板失败:${error.message}`);
  process.exit(1);
}

// 依序应用补丁;任一锚点失配立即报错(IHUI 补丁需人工复核后同步)。
let expected = upstream;
for (const patch of PATCHES) {
  if (!expected.includes(patch.upstream)) {
    console.error(`[desktop-nsis-template] 上游模板已变化:${patch.name} 的锚点片段失配,IHUI 补丁需人工复核后同步。`);
    console.error(`  上游模板:${bin}`);
    process.exit(1);
  }
  expected = expected.replace(patch.upstream, patch.ihui);
}
expected = HEADER + expected;

if (mode === 'write') {
  writeFileSync(TARGET, expected, 'utf8');
  console.log(`[desktop-nsis-template] 已写入 ${TARGET}(${expected.length} 字节,应用 ${PATCHES.length} 处 IHUI 补丁)`);
  process.exit(0);
}

if (!existsSync(TARGET)) {
  console.error(`[desktop-nsis-template] 缺少 ${TARGET},请执行 --write 生成`);
  process.exit(1);
}

const current = readFileSync(TARGET, 'utf8').replaceAll('\r\n', '\n');
if (current === expected) {
  console.log(`[desktop-nsis-template] OK:仓库模板 == 当前 Tauri CLI 内置模板 + ${PATCHES.length} 处 IHUI 补丁`);
  process.exit(0);
}

console.error('[desktop-nsis-template] DRIFT:仓库模板与当前 Tauri CLI 内置模板不一致,请 diff 后执行 --write');
console.error(`  仓库:${TARGET}`);
console.error(`  上游:${bin}`);
process.exit(1);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
