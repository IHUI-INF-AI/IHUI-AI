// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * profiles —— 「客户端登录态一键切换」的**内置目标注册表**。
 *
 * 与 core.js 的关系:core 是引擎(不认识任何具体客户端),本文件是**数据**
 * —— 内置目标集(路径/形态/命中口径/一致性规则)全部登记在此,一处改、全面生效。
 *
 * 一手取证(2026-10-27 本机实测,非抄文档):
 *  - trae / trae-solo / qoder:沿用 relay-ide-switch.ts 原实现,路径与行为**逐字一致**
 *    (既有测试零改动通过的前提);
 *  - minimax-code:~/.minimax/auth/prod/cn/mcode-public/{auth.json,auth-state.json},
 *    明文 JSON;两份文件各带 generation,必须一致才允许切换(不一致 ⇒ 半切换态);
 *  - zcode:~/.zcode/v2/credentials.json,凭据是 Chromium DPAPI+AES-GCM 信封;
 *    os_crypt key 旁证文件(Local State)**不在** credentials.json 同目录
 *    ⇒ 双基址:files 全部在 ~/.zcode/v2/,key 文件走 auxFiles(绝对/相对基址均可),
 *    只用于解密探测,**不参与替换**;
 *  - codearts-agent:登录态在 VS Code SecretStorage(sqlite),本轮**只读探测**,
 *    明确标注未实现(supported:false)—— 宁可不支持也不冒充;
 *  - qianfan:AppData/Roaming/qianfan-desktop-app/{auth.json,.cookie-key};
 *  - codex / opencode:CLI 类纯配置文件,随时可切(requiresStoppedApp:false)。
 *
 * 红线:内置目标一律**存在性探测**,未安装即 installed:false(list 如实显示"未检测到"),
 * 不报错、不阻断其他目标;路径与指纹只登记事实,不登记任何凭据值。
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

import { firstExistingPath, type SwitchTarget } from './core.js'
// 本模块的公开面含 SwitchTarget(admin 路由与测试都从这里取),而它住在 core.js ——
// 只 import 不 re-export 会让下游报 TS2459「declares locally but is not exported」。
export type { SwitchTarget } from './core.js'

/** 兼容门面(relay-ide-switch.ts)沿用的三个历史 id */
export const LEGACY_IDE_IDS = ['trae', 'trae-solo', 'qoder'] as const

export type LegacyIdeId = (typeof LEGACY_IDE_IDS)[number]

/**
 * 内置目标全集(home 可注入 ⇒ 测试与实机同一条路径生成器)。
 * 顺序即 list/CLI 的展示顺序:历史三平台在前,其余按形态追加。
 *
 * appDataRoaming 可注入 ⇒ 测试可完全绕开真实 AppData;不注入时的探测口径与
 * relay-ide-switch.ts 原实现**逐字一致**(先环境变量 APPDATA,再 <home>/AppData/Roaming)。
 */
export function resolveTargets(home = homedir(), appDataRoaming?: string): SwitchTarget[] {
  const appDataRoot =
    appDataRoaming ??
    firstExistingPath([process.env['APPDATA'] ?? '', join(home, 'AppData', 'Roaming')])
  const homeAppDataRoaming = join(home, 'AppData', 'Roaming')
  // 历史三平台的快照根:与 relay-ide-switch.ts 原实现逐字一致(既有快照不搬家)
  const legacySnapBase = join(home, '.wb-switch', 'backups', 'ide')
  // 新目标统一快照根
  const snapBase = join(home, '.wb-switch', 'backups', 'switch')

  return [
    {
      id: 'trae',
      label: 'Trae CN',
      kind: 'ide',
      baseDirCandidates: [
        join(appDataRoot, 'Trae CN', 'User', 'globalStorage'),
        join(homeAppDataRoaming, 'Trae CN', 'User', 'globalStorage'),
      ],
      files: ['storage.json'],
      snapRoot: join(legacySnapBase, 'trae'),
      loginHints: ['iCubeAuthInfo://icube.cloudide', 'iCubeAuthInfo://usertag'],
      hintMode: 'content-scan',
      requiresStoppedApp: true,
      notes: ['VSCode fork;登录态在 globalStorage/storage.json 的 iCubeAuthInfo://* 键'],
    },
    {
      id: 'trae-solo',
      label: 'TRAE SOLO CN',
      kind: 'ide',
      baseDirCandidates: [
        join(appDataRoot, 'TRAE SOLO CN', 'User', 'globalStorage'),
        join(homeAppDataRoaming, 'TRAE SOLO CN', 'User', 'globalStorage'),
      ],
      files: ['storage.json'],
      snapRoot: join(legacySnapBase, 'trae-solo'),
      loginHints: ['iCubeAuthInfo://icube.cloudide', 'iCubeAuthInfo://usertag'],
      hintMode: 'content-scan',
      requiresStoppedApp: true,
      notes: ['VSCode fork;与 Trae CN 同形态,独立目录'],
    },
    {
      id: 'qoder',
      label: 'Qoder CN',
      kind: 'ide',
      baseDirCandidates: [appDataRoot, homeAppDataRoaming].map((root) =>
        join(root, 'com.qodercn.app.stable'),
      ),
      files: [
        'auth.v1.dat',
        'auth.machine-id',
        join('.auth', 'machine_id'),
        'auth-profile-overlays.v1.dat',
      ],
      snapRoot: join(legacySnapBase, 'qoder'),
      loginHints: ['auth.v1.dat'],
      hintMode: 'file-count',
      requiresStoppedApp: true,
      notes: ['认证四件套文件集;目录内 .credential-transaction 空标记 ⇒ 官方按事务性写入设计'],
    },
    {
      id: 'minimax-code',
      label: 'MiniMax Code',
      kind: 'desktop',
      baseDirCandidates: [join(home, '.minimax', 'auth', 'prod', 'cn', 'mcode-public')],
      files: ['auth.json', 'auth-state.json'],
      snapRoot: join(snapBase, 'minimax-code'),
      loginHints: ['accessToken', 'refreshToken'],
      hintMode: 'content-scan',
      requiresStoppedApp: true,
      coherence: {
        files: ['auth.json', 'auth-state.json'],
        field: 'generation',
        label: 'generation',
      },
      notes: [
        'Electron,明文 JSON 登录态',
        'auth.json 与 auth-state.json 的 generation 必须一致才允许切换(不一致 ⇒ 计划阶段拒绝)',
      ],
    },
    {
      id: 'zcode',
      label: '智谱 ZCode',
      kind: 'desktop',
      baseDirCandidates: [join(home, '.zcode', 'v2')],
      files: ['credentials.json'],
      snapRoot: join(snapBase, 'zcode'),
      loginHints: ['enc:v1:'],
      hintMode: 'content-scan',
      requiresStoppedApp: true,
      // os_crypt key 旁证文件:本机实测在 AppData/Roaming/ZCode/session/Local State,
      // 与 credentials.json 不同目录 ⇒ 走 auxFiles(绝对路径原样用),只探测不替换
      auxFiles: [
        join(appDataRoot, 'ZCode', 'session', 'Local State'),
        join(homeAppDataRoaming, 'ZCode', 'session', 'Local State'),
        'Local State',
      ],
      notes: [
        'Electron,凭据是 Chromium DPAPI+AES-GCM 信封',
        'os_crypt key(Local State)与 credentials.json 不同目录 ⇒ 双基址;key 文件仅探测,不参与替换',
      ],
    },
    {
      id: 'codearts-agent',
      label: '华为 CodeArts Agent',
      kind: 'desktop',
      baseDirCandidates: [
        join(appDataRoot, 'codearts-agent', 'User', 'globalStorage'),
        join(homeAppDataRoaming, 'codearts-agent', 'User', 'globalStorage'),
      ],
      files: ['state.vscdb'],
      snapRoot: join(snapBase, 'codearts-agent'),
      loginHints: ['state.vscdb'],
      hintMode: 'file-count',
      requiresStoppedApp: true,
      supported: false,
      unsupportedReason: 'sqlite SecretStorage 提取器未实现,仅探测',
      notes: ['VS Code fork;登录态在 state.vscdb 的 secret://huaweicloud.authentication 项'],
    },
    {
      id: 'qianfan',
      label: '千帆桌面端',
      kind: 'desktop',
      baseDirCandidates: [
        join(appDataRoot, 'qianfan-desktop-app'),
        join(homeAppDataRoaming, 'qianfan-desktop-app'),
      ],
      files: ['auth.json', '.cookie-key'],
      snapRoot: join(snapBase, 'qianfan'),
      loginHints: ['accountProfiles', 'activeProfileId'],
      hintMode: 'content-scan',
      requiresStoppedApp: true,
      notes: ['Electron;多账号档案 + cookie 密钥成对,缺一即不完整'],
    },
    {
      id: 'codex',
      label: 'Codex CLI',
      kind: 'cli',
      baseDirCandidates: [join(home, '.codex')],
      files: ['config.toml'],
      snapRoot: join(snapBase, 'codex'),
      loginHints: ['experimental_bearer_token', 'model_provider'],
      hintMode: 'content-scan',
      requiresStoppedApp: false,
      notes: ['本机当前为自配 provider 配置,非平台 OAuth 登录态'],
    },
    {
      id: 'opencode',
      label: 'OpenCode CLI',
      kind: 'cli',
      baseDirCandidates: [join(home, '.local', 'share', 'opencode')],
      files: ['auth.json'],
      snapRoot: join(snapBase, 'opencode'),
      loginHints: ['opencode'],
      hintMode: 'content-scan',
      requiresStoppedApp: false,
      notes: ['纯配置文件,随时可切'],
    },
  ]
}

/** 内置目标 id 集合(外部 profile 与之冲突时不覆盖内置) */
export function builtinTargetIds(home = homedir()): string[] {
  return resolveTargets(home).map((t) => t.id)
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
