// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 语言服务器配置表 — 全 CLI 唯一的「语言 → 服务器」真相源(V3 #83)。
 *
 * 立票理由(现读实测,不是假想):
 *   1. 改前 `apps/cli/src/tools/lsp.ts` 里另有一张 `detectLanguageId()` 的 `switch (ext)`,
 *      把「扩展名 → LSP languageId」又写了一遍 —— 表里 `fileExtensions` 说 `.mjs` 属 typescript,
 *      switch 里再决定它报 `javascript`,两处各自演进即"表说一套、发出去另一套"。现由本表的
 *      `languageIds` 一次性承载,switch 已删除(判据:`scripts/check-lsp-language-table.mjs` T4)。
 *   2. 改前 `getLspClientForFile()` 对**未登记扩展名静默回退 TypeScript server**
 *      (源码注释自述"向后兼容"),症状是"问了个 .vue 文件,拿到 typescript-language-server
 *      的一堆空结果",而调用方只看得到"没找到定义"。现回退分支取消,改为显式
 *      `unsupported-extension` 诊断(可诊断性由 `probe.ts` 的结果并集承担)。
 *   3. 表里每个字段都必须被读走:一个没人消费的字段本身就是本票要检测的"规格 ↔ 代码落差",
 *      所以新增字段前请先问"哪一行代码读它"。
 *
 * 判据口径:本表的**全部字面量**都是静态可读的(数组 + 对象字面量,无运行时拼装),
 * 因此 `scripts/check-lsp-language-table.mjs` 能在提交链上审到每一项 ——
 * 不允许出现"只有跑起来才知道表长什么样"的形态。
 */

/** 一次 LSP 请求的种类。能力预检与表内 `capabilities` 共用这一维,不得在别处再写一套名字。 */
export const LSP_REQUEST_KINDS = [
  'definition',
  'references',
  'hover',
  'diagnostics',
  'workspaceSymbol',
  'rename',
  'codeAction',
] as const;

export type LspRequestKind = (typeof LSP_REQUEST_KINDS)[number];

/** 单个可执行候选:一个语言可以有多个候选(如 Python 先 pyright 再 pylsp),按数组顺序探测。 */
export interface LspBinaryCandidate {
  /** 可执行名 —— 同时用于 `where`/`which` 在位探测与 spawn,不得写绝对路径 */
  binary: string;
  /** 启动参数(stdio 模式);TS 服务器需 `--stdio`,gopls 需 `serve`,故逐候选声明 */
  args: string[];
  /**
   * 取版本号的参数。空数组 = 该服务器不提供稳定的版本输出 ⇒ 跳过版本判据,
   * **但仍然如实报"版本未知"**(不得把"没判"写成"判过了")。
   */
  versionArgs: string[];
  /**
   * 最低可接受版本(点分数)。缺省 = 无可信依据,不做版本下限判据。
   * 只在能给出**出处**时填写(见各候选注释),不得凭感觉设档。
   */
  minVersion?: string;
  /** 未安装时的安装出路。必填:诊断文本里没有出路 = 让下一个人心算 */
  installHint: string;
  /**
   * 该候选**实际实现**的请求集。逐候选而不是逐语言,因为同一语言的不同服务器能力不等:
   * pyright 只做类型检查(无 rename / workspaceSymbol / codeAction),而 pylsp(Jedi)有。
   * 客户端在发请求前按此预检,不再让不支持的请求跑到 10s 超时。
   */
  capabilities: LspRequestKind[];
}

/** 一种语言的服务器配置。 */
export interface LspServerConfig {
  /** 语言标识(小写),用于 `--language` 之类的显式选择 */
  language: string;
  /** 展示名 */
  displayName: string;
  /** 支持的文件扩展名(小写、含点)。跨语言不得重复 —— 由门 T2 判红 */
  fileExtensions: string[];
  /**
   * 扩展名 → LSP `textDocument/didOpen` 的 languageId。**每个** `fileExtensions` 里的扩展名
   * 都要在这里有对应键(门 T3 判红),否则就是"表说支持、握手时报 unknown"。
   */
  languageIds: Record<string, string>;
  /** 按顺序探测的候选。至少一项(门 T1),首项即默认档 */
  candidates: LspBinaryCandidate[];
  /**
   * 该语言的工程根标记文件(如 Cargo.toml / go.mod)。**只用于诊断**:探测就绪时若工作区
   * 没有任一标记,状态行会喊"符号索引大概率为空",但**不拦任何请求** —— 拦下去就是一台
   * 与用户工作区结构有关的恒红门,而这条信息本身才是用户要的。
   */
  workspaceMarkers?: string[];
  /** LSP `initialize.initializationOptions` */
  initializationOptions?: Record<string, unknown>;
}

const TS_CAPABILITIES: readonly LspRequestKind[] = [
  'definition',
  'references',
  'hover',
  'diagnostics',
  'workspaceSymbol',
  'rename',
  'codeAction',
] as const;

/**
 * 内置语言服务器表。
 *
 * 扩展指南:新增一门语言 = 在此数组追加一项,**不需要**改任何其他文件
 * (`lsp.ts` 只消费本表;新门的 T1–T5 会当场问出缺哪个字段)。
 */
export const LSP_SERVERS: LspServerConfig[] = [
  {
    language: 'typescript',
    displayName: 'TypeScript',
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    languageIds: {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
    },
    candidates: [
      {
        binary: 'typescript-language-server',
        args: ['--stdio'],
        versionArgs: ['--version'],
        installHint: 'pnpm add -g typescript-language-server typescript',
        capabilities: [...TS_CAPABILITIES],
      },
    ],
  },
  {
    language: 'rust',
    displayName: 'Rust',
    fileExtensions: ['.rs'],
    languageIds: { '.rs': 'rust' },
    workspaceMarkers: ['Cargo.toml'],
    candidates: [
      {
        binary: 'rust-analyzer',
        args: [],
        versionArgs: ['--version'],
        installHint: 'rustup component add rust-analyzer(或 winget install RustAnalyzer.RustAnalyzer)',
        capabilities: [...TS_CAPABILITIES],
      },
    ],
  },
  {
    language: 'go',
    displayName: 'Go',
    fileExtensions: ['.go'],
    languageIds: { '.go': 'go' },
    workspaceMarkers: ['go.mod'],
    candidates: [
      {
        binary: 'gopls',
        args: ['serve'],
        versionArgs: ['version'],
        installHint: 'go install golang.org/x/tools/gopls@latest',
        capabilities: [...TS_CAPABILITIES],
      },
    ],
  },
  {
    language: 'python',
    displayName: 'Python',
    fileExtensions: ['.py', '.pyi'],
    languageIds: { '.py': 'python', '.pyi': 'python' },
    workspaceMarkers: ['pyproject.toml', 'setup.py', 'requirements.txt'],
    candidates: [
      {
        // 首选 pyright:微软维护、类型推断接近 mypy --strict,且本仓 ai-service 用 pyproject 类型标注。
        // 版本下限刻意留空 —— 没有可给出的出处,凭感觉设档会把用户挡在门外而不说明为什么。
        binary: 'pyright',
        args: ['--stdio'],
        versionArgs: ['--version'],
        installHint: 'pnpm add -g pyright(或 pip install pyright)',
        // pyright 是纯类型检查器:不实现 rename / codeAction / workspaceSymbol。
        // 这里少写一项,客户端就在发请求前直接给出"该服务器不做这件事"的诊断,
        // 而不是等 10s 超时后回一句"LSP 不可用"。
        capabilities: ['definition', 'references', 'hover', 'diagnostics'],
      },
      {
        // 兜底 pylsp(Jedi):能力更全(含 rename / codeAction),类型精度低于 pyright。
        binary: 'pylsp',
        args: [],
        versionArgs: ['--version'],
        installHint: 'pip install "python-lsp-server[all]"',
        capabilities: [...TS_CAPABILITIES],
      },
    ],
  },
  {
    language: 'java',
    displayName: 'Java',
    fileExtensions: ['.java'],
    languageIds: { '.java': 'java' },
    workspaceMarkers: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'],
    candidates: [
      {
        binary: 'jdtls',
        args: [],
        versionArgs: [],
        installHint: '安装 Eclipse JDT LS 并把 `jdtls` 放进 PATH(brew install jdtls 或 SDKMAN)',
        capabilities: [...TS_CAPABILITIES],
      },
    ],
  },
  {
    language: 'c',
    displayName: 'C/C++',
    fileExtensions: ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hh', '.hxx'],
    languageIds: {
      '.c': 'c',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.h': 'cpp',
      '.hpp': 'cpp',
      '.hh': 'cpp',
      '.hxx': 'cpp',
    },
    workspaceMarkers: ['compile_commands.json', 'CMakeLists.txt'],
    candidates: [
      {
        binary: 'clangd',
        args: [],
        versionArgs: ['--version'],
        installHint: 'winget install LLVM.LLVM(或 brew install clangd)',
        capabilities: [...TS_CAPABILITIES],
      },
    ],
  },
  {
    language: 'csharp',
    displayName: 'C#',
    fileExtensions: ['.cs'],
    languageIds: { '.cs': 'csharp' },
    workspaceMarkers: ['*.csproj', '*.sln'],
    candidates: [
      {
        binary: 'OmniSharp',
        args: ['-lsp'],
        versionArgs: ['--version'],
        installHint: 'dotnet tool install -g OmniSharp.Roslyn.Cli.Services',
        capabilities: [...TS_CAPABILITIES],
      },
    ],
  },
  // —— 以下两门是 V3 #83 新增:本仓有 3,000+ 个 .json(i18n 语言包 / 各端 package.json)
  //    与一批 .yaml/.yml(CI 工作流、config/architecture-policy.yaml),此前整面没有 LSP 覆盖。
  {
    language: 'json',
    displayName: 'JSON',
    fileExtensions: ['.json', '.jsonc', '.json5'],
    languageIds: { '.json': 'json', '.jsonc': 'jsonc', '.json5': 'json5' },
    candidates: [
      {
        binary: 'vscode-json-language-server',
        args: ['--stdio'],
        versionArgs: ['--version'],
        installHint: 'pnpm add -g vscode-langservers-extracted',
        // 提取版 JSON 语言服务器没有 rename / codeAction(它做校验、补全、格式化)。
        capabilities: ['definition', 'references', 'hover', 'diagnostics', 'workspaceSymbol'],
      },
    ],
  },
  {
    language: 'yaml',
    displayName: 'YAML',
    fileExtensions: ['.yaml', '.yml'],
    languageIds: { '.yaml': 'yaml', '.yml': 'yaml' },
    candidates: [
      {
        binary: 'yaml-language-server',
        args: ['--stdio'],
        versionArgs: ['--version'],
        installHint: 'pnpm add -g yaml-language-server',
        // 无 workspace/symbol(YAML 没有符号表概念),声明了就是给客户端发一条必空请求。
        capabilities: ['definition', 'references', 'hover', 'diagnostics', 'rename', 'codeAction'],
      },
    ],
  },
];

/**
 * 不依赖文件名的请求(workspace/symbol 这类)缺省用哪门语言。
 *
 * 它是**表的一部分**而不是散落在调用点的字符串:改前 `lsp.ts` 里有两处硬写
 * `'typescript'`(未登记扩展名的回退 + language 形参缺省值),两处各写各的,
 * 于是"缺省语言"这件事没有单一出处可对账。
 */
export const DEFAULT_LSP_LANGUAGE = 'typescript';

/** 按语言标识取配置;未登记返回 null(调用方必须把它变成诊断,不得静默挑一个)。 */
export function findLspConfigByLanguage(language: string): LspServerConfig | null {
  for (const config of LSP_SERVERS) {
    if (config.language === language) return config;
  }
  return null;
}

/** 按文件扩展名取配置;未登记返回 null。 */
export function findLspConfigForFile(filePath: string): LspServerConfig | null {
  const ext = extensionOf(filePath);
  if (!ext) return null;
  for (const config of LSP_SERVERS) {
    if (config.fileExtensions.includes(ext)) return config;
  }
  return null;
}

/** 小写扩展名(含点);无扩展名返回空串。 */
export function extensionOf(filePath: string): string {
  const base = filePath.slice(filePath.lastIndexOf('/') + 1).slice(filePath.lastIndexOf('\\') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot).toLowerCase();
}

/**
 * 扩展名 → LSP languageId。**取代**改前 `lsp.ts` 里的 `detectLanguageId()` switch。
 * 未登记的扩展名返回 null ⇒ 调用方必须显式报"这门语言没有服务器配置",
 * 不得回落到某门语言的服务器(那正是改后的静默失真)。
 */
export function languageIdForFile(config: LspServerConfig, filePath: string): string | null {
  const ext = extensionOf(filePath);
  if (!ext) return null;
  return config.languageIds[ext] ?? null;
}

/** 本表登记过的全部扩展名(诊断输出与门的对照输入都用它,不得各处再拼一份)。 */
export function allRegisteredExtensions(): string[] {
  const set = new Set<string>();
  for (const config of LSP_SERVERS) for (const ext of config.fileExtensions) set.add(ext);
  return [...set].sort();
}
