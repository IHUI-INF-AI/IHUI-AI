#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 模板生成/校验脚本为 CLI 工具,需 console 输出诊断信息 */
// 桌面端 NSIS 安装器模板:生成 / 漂移校验。
//
// 背景:Tauri v2 的 nsis.installerHooks 只暴露 PREINSTALL/POSTINSTALL/PREUNINSTALL/POSTUNINSTALL
// 四个宏,全部在 Section 内执行 —— 改不了安装向导"选择安装位置"页的**默认目录**。
// 该默认值由内置模板 installer.nsi 的 .onInit 决定,唯一官方接管方式是 bundle.windows.nsis.template
// 整体替换模板。因此本仓库维护一份"上游模板 + 一处 IHUI 定制"的副本,并由本脚本保证两者不漂移。
//
// 用法:
//   node scripts/desktop-nsis-template.mjs --check   # 校验仓库模板 == 上游模板 + IHUI 补丁(不一致 exit 1)
//   node scripts/desktop-nsis-template.mjs --write   # 从当前 Tauri CLI 重新生成仓库模板
//   node scripts/desktop-nsis-template.mjs --check --require-cli
//                                                    # 「定位不到 Tauri CLI」由"跳过"改为**硬失败**。
//                                                    # CI / 发版 workflow 用这个:漂移校验绝不允许被静默跳过。
//
// 触发时机:升级 Tauri CLI 后必须跑一次 --check;不一致则看 diff 决定是否 --write。
// 自动触发点(2026-09-18 起,防止"零调用方 = 漂移永久静默"):
//   · pre-commit  scripts/guardian-runner.mjs 第 51 项(经 check-desktop-install-dir.mjs --template)
//   · CI          .github/workflows/ci.yml
//   · 发版        .github/workflows/release-desktop.yml / desktop-build.yml(构建前 + 构建后)
//
// CLI 定位:除仓库 node_modules 外,也会探测**全局**安装(@tauri-apps/cli)。发版 workflow 是
// 纯 Rust 构建(无 node_modules),只用 `npm i -g @tauri-apps/cli` —— 没有这个探测,发版侧的
// 漂移校验会"找不到 CLI → 打印跳过 → exit 0",等于没有守门。

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  '; IHUI 定制范围(仅一处逻辑改动,其余与上游逐字节一致):',
  ';   模板 .onInit 的"默认安装目录"分支被替换为 —— 安装语言为简体中文($LANGUAGE = 2052)→ D:\\智汇AI,',
  ';   其余语言 → D:\\IHUI AI。上游紧跟其后的 Call RestorePreviousInstallLocation 原样保留,',
  ';   因此"已装过则沿用既有安装位置"(重装不产生第二份安装、/UPDATE 静默升级回原位置)的语义不变。',
  ';   目的是让安装向导"选择安装位置"页的**首屏默认值**即为该路径。',
  ';   (旧实现用 NSIS_HOOK_PREINSTALL 改 $INSTDIR,时机过晚:只影响落盘,不影响向导显示。)',
  ';',
  '; ⚠️ 升级 Tauri CLI 后必须执行:node scripts/desktop-nsis-template.mjs --check',
  ';   禁止手工编辑本文件的非定制段落;要改定制逻辑请改本脚本内的常量后重新 --write。',
  '',
  '',
].join('\n');

// 上游需要被替换的片段(默认安装目录分支,逐字节匹配)
const UPSTREAM_BLOCK = [
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

// IHUI 定制后的片段
// 设计原则:只替换「默认目录的推导方式」,其余与上游逐字一致 —— 尤其是末尾那句
// 无条件的 Call RestorePreviousInstallLocation 必须原样保留,它承担两个职责:
//   ① 已安装过 → 沿用既有安装位置(重装不产生第二份安装);
//   ② /UPDATE 静默升级 → 回到原位置。
// 注册表无记录时该函数不改动 $INSTDIR(ReadRegStr 得空串则跳过),故全新机器上仍是 D: 盘默认目录。
const IHUI_BLOCK = [
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

// 全局 npm 根目录(发版 workflow 用 `npm i -g @tauri-apps/cli@^2`,仓库内无 node_modules)。
// 同时兜底 Windows 默认全局前缀 %APPDATA%/npm/node_modules。
// 注意:这是**惰性兜底** —— 只有仓库内各 node_modules 都找不到时才调用,避免每次 pre-commit
// 都去 spawn 一次 npm(Windows 上 npm 是 .cmd,须按 npm.cmd 调用)。
function globalCliBases() {
  const bases = [];
  for (const bin of process.platform === 'win32' ? ['npm.cmd', 'npm'] : ['npm']) {
    try {
      const out = execFileSync(bin, ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const root = out.trim();
      if (!root) continue;
      bases.push(join(root, '@tauri-apps'));
      break;
    } catch {
      /* 该 npm 变体不可用,试下一个 */
    }
  }
  const appData = process.env.APPDATA;
  if (appData) bases.push(join(appData, 'npm/node_modules/@tauri-apps'));
  return bases;
}

// 在某个 @tauri-apps 目录下扫描平台原生模块(模板以 include_str! 明文嵌入其中,文件名 cli.<platform>.node)
function scanCliBase(base) {
  if (!existsSync(base)) return null;
  let entries;
  try {
    entries = readdirSync(base);
  } catch {
    return null;
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
  return null;
}

// 「@tauri-apps 目录」的两种真实布局(2026-09-18 实测,只处理同级那种会漏掉全局安装):
//   ① 平台原生包与 cli 包**同级** —— pnpm 虚拟仓 / 部分 npm 布局
//      <base>/cli-win32-x64-msvc/cli.win32-x64-msvc.node
//   ② 平台原生包**嵌在 cli 包内部** —— `npm i -g @tauri-apps/cli` 的布局
//      <base>/cli/node_modules/@tauri-apps/cli-win32-x64-msvc/cli.win32-x64-msvc.node
// 发版 workflow 走的正是 ②(纯 Rust 构建 + 全局 CLI),漏掉它 → 漂移校验"找不到 CLI → 跳过 → exit 0"。
function scanForCliBinary(base) {
  for (const candidate of [base, join(base, 'cli', 'node_modules', '@tauri-apps')]) {
    const hit = scanCliBase(candidate);
    if (hit) return hit;
  }
  return null;
}

// 定位 Tauri CLI 平台原生模块:先仓库内(快,零副作用),再全局(发版 workflow 场景)
function findCliBinary() {
  const local = new Set([join(ROOT, 'node_modules/@tauri-apps'), join(ROOT, 'apps/desktop/node_modules/@tauri-apps')]);
  // pnpm 把平台原生包放在 @tauri-apps/cli 真实路径的同级;用 require.resolve 取真实位置
  try {
    const require = createRequire(join(ROOT, 'apps/desktop/package.json'));
    local.add(dirname(dirname(require.resolve('@tauri-apps/cli/package.json'))));
  } catch {
    /* 忽略:下面按目录扫描兜底 */
  }
  for (const base of local) {
    const hit = scanForCliBinary(base);
    if (hit) return hit;
  }
  for (const base of globalCliBases()) {
    const hit = scanForCliBinary(base);
    if (hit) return hit;
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
// --require-cli:定位不到 CLI 视为失败。CI / 发版扣这个开关,确保漂移校验不被静默跳过。
const requireCli = process.argv.includes('--require-cli');

// === 平台适用性门(2026-09-18 立,CI 实测教训)===
// NSIS 模板是 Tauri **Windows** bundler 的资产,只内嵌在 Windows 版
// `cli.win32-x64-msvc.node` 里。非 Windows 平台上**没有对照物**,而且抽取是"按可打印字符
// 切片"的启发式 —— 在另一个平台的二进制里即使**找到锚点**,"成功"抽出来的也可能是**截断片段**,
// 于是被误判成"上游模板漂移"。CI 实测:ubuntu 上这一步因此恒红,而同一份代码在 Windows 上全绿。
//
// 所以判据是**平台**,不是"抽取是否抛异常":
//   · win32  :语义不变 —— 定位不到 CLI(且带 --require-cli)= 失败;抽取失败 / 漂移 = 失败。
//   · 非 win32:`--check` **一律**显式打印跳过原因后 exit 0(不进入抽取与比对);
//              `--write` 仍需真模板,故照常走下面的流程并在失败时 exit 1。
// 漂移校验真正的强制点:① 本机 pre-commit(guardian-runner id 51,Windows);
//   ② release-desktop.yml / desktop-build.yml 的 **Windows** leg(构建前,带 --require-cli)。
const isWindows = process.platform === 'win32'
const SKIP_LINUX =
  '平台不适用:NSIS 模板只内嵌在 Windows 版 Tauri CLI 二进制里,本平台无可比对象 —— ' +
  '此处**不是**漂移。漂移校验由 Windows 侧强制(pre-commit id 51 / 发版与桌面构建的 Windows leg)。'

if (mode === 'check' && !isWindows) {
  console.error(`[desktop-nsis-template] 跳过漂移校验 —— ${SKIP_LINUX}`)
  process.exit(0)
}

const bin = findCliBinary();
if (!bin) {
  if (mode === 'write') {
    console.error('[desktop-nsis-template] 未找到 @tauri-apps/cli 原生模块,无法生成模板(请在已安装依赖的工作区执行)');
    process.exit(1);
  }
  const hint =
    '已探测: 仓库 node_modules / pnpm 虚拟仓 / 全局 npm root -g / %APPDATA%/npm/node_modules。' +
    'CI 与发版 workflow 请确保已安装 @tauri-apps/cli(ci.yml 走 pnpm install,release-desktop.yml 走 npm i -g)。';
  if (requireCli) {
    console.error('[desktop-nsis-template] 未找到 @tauri-apps/cli 原生模块,且已指定 --require-cli → 判定失败');
    console.error(`  ${hint}`);
    process.exit(1);
  }
  console.error('[desktop-nsis-template] 未找到 @tauri-apps/cli 原生模块,跳过校验(模板无法离线比对)');
  console.error(`  ${hint}`);
  process.exit(0);
}

let upstream;
try {
  upstream = extractTemplate(bin);
} catch (error) {
  console.error(`[desktop-nsis-template] 抽取模板失败:${error.message}`);
  process.exit(1);
}

if (!upstream.includes(UPSTREAM_BLOCK)) {
  console.error('[desktop-nsis-template] 上游模板的"默认安装目录"片段已变化,IHUI 补丁需人工复核后同步。');
  console.error(`  上游模板:${bin}`);
  process.exit(1);
}

const expected = HEADER + upstream.replace(UPSTREAM_BLOCK, IHUI_BLOCK);

if (mode === 'write') {
  writeFileSync(TARGET, expected, 'utf8');
  console.log(`[desktop-nsis-template] 已写入 ${TARGET}(${expected.length} 字节)`);
  process.exit(0);
}

if (!existsSync(TARGET)) {
  console.error(`[desktop-nsis-template] 缺少 ${TARGET},请执行 --write 生成`);
  process.exit(1);
}

const current = readFileSync(TARGET, 'utf8').replaceAll('\r\n', '\n');
if (current === expected) {
  console.log('[desktop-nsis-template] OK:仓库模板 == 当前 Tauri CLI 内置模板 + IHUI 补丁');
  process.exit(0);
}

console.error('[desktop-nsis-template] DRIFT:仓库模板与当前 Tauri CLI 内置模板不一致,请 diff 后执行 --write');
console.error(`  仓库:${TARGET}`);
console.error(`  上游:${bin}`);
process.exit(1);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
