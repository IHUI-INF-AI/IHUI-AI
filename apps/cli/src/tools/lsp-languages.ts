/**
 * 多语言 LSP server 配置 + 自动检测(Wave 9,2026-07-22 立)
 *
 * 对标 OpenCode "开箱即用 LSP":不仅支持 typescript-language-server,
 * 还覆盖 Rust(rust-analyzer)/ Go(gopls)/ Python(pylsp)/ Java(jdtls)/
 * C/C++(clangd)/ C#(OmniSharp)共 7 种语言。
 *
 * 策略:
 *   - 内置 7 种语言 LSP server 配置(LSP_SERVERS)
 *   - isLspServerAvailable:用 where(Windows)/ which(POSIX) 检测二进制是否安装
 *   - findLspConfigForFile:按文件扩展名匹配对应 LSP server
 *   - listAvailableLspServers:列出系统已安装的 LSP server
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as os from 'node:os';

/** 单语言 LSP server 配置 */
export interface LspServerConfig {
  /** 语言标识:'typescript' | 'rust' | 'go' | 'python' | 'java' | 'c' | 'csharp' */
  language: string;
  /** 展示名:'TypeScript' | 'Rust' | 'Go' | 'Python' | 'Java' | 'C/C++' | 'C#' */
  displayName: string;
  /** 启动命令,如 ['typescript-language-server', '--stdio'] */
  command: string[];
  /** 用于 which/where 检测的二进制名,如 'typescript-language-server' */
  spawnCommand: string;
  /** 支持的文件扩展名(小写,含点),如 ['.ts', '.tsx'] */
  fileExtensions: string[];
  /** LSP initialize 的 initializationOptions */
  initializationOptions?: Record<string, unknown>;
  /** 是否需要 workspace root(如 rust-analyzer / gopls / jdtls) */
  requiresWorkspace?: boolean;
}

/**
 * 内置 7 种语言 LSP server 配置。
 *
 * 扩展指南:新增语言时在此数组追加一项即可,无需改动其他文件。
 */
export const LSP_SERVERS: LspServerConfig[] = [
  {
    language: 'typescript',
    displayName: 'TypeScript',
    command: ['typescript-language-server', '--stdio'],
    spawnCommand: 'typescript-language-server',
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  },
  {
    language: 'rust',
    displayName: 'Rust',
    command: ['rust-analyzer'],
    spawnCommand: 'rust-analyzer',
    fileExtensions: ['.rs'],
    requiresWorkspace: true,
  },
  {
    language: 'go',
    displayName: 'Go',
    command: ['gopls', 'serve'],
    spawnCommand: 'gopls',
    fileExtensions: ['.go'],
    requiresWorkspace: true,
  },
  {
    language: 'python',
    displayName: 'Python',
    command: ['pylsp'],
    spawnCommand: 'pylsp',
    fileExtensions: ['.py', '.pyi'],
  },
  {
    language: 'java',
    displayName: 'Java',
    command: ['jdtls'],
    spawnCommand: 'jdtls',
    fileExtensions: ['.java'],
    requiresWorkspace: true,
  },
  {
    language: 'c',
    displayName: 'C/C++',
    command: ['clangd'],
    spawnCommand: 'clangd',
    fileExtensions: ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hh', '.hxx'],
  },
  {
    language: 'csharp',
    displayName: 'C#',
    command: ['OmniSharp', '-lsp'],
    spawnCommand: 'OmniSharp',
    fileExtensions: ['.cs'],
  },
];

/**
 * 检测系统是否安装了某 LSP server。
 *
 * Windows 用 `where <command>`,POSIX 用 `which <command>`。
 * 检测失败返回 false,不 throw。
 */
export async function isLspServerAvailable(config: LspServerConfig): Promise<boolean> {
  const cmd = os.platform() === 'win32' ? 'where' : 'which';
  try {
    const result = spawnSync(cmd, [config.spawnCommand], {
      windowsHide: true,
      shell: true,
      timeout: 5_000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * 根据文件扩展名查找对应 LSP server 配置。
 *
 * 匹配用 toLowerCase(),不区分大小写。
 * 未匹配返回 null。
 */
export function findLspConfigForFile(filePath: string): LspServerConfig | null {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return null;
  for (const config of LSP_SERVERS) {
    if (config.fileExtensions.includes(ext)) return config;
  }
  return null;
}

/**
 * 列出所有可用 LSP server(异步检测系统安装情况)。
 *
 * 遍历 LSP_SERVERS,用 isLspServerAvailable 逐个检测,返回已安装的列表。
 */
export async function listAvailableLspServers(): Promise<LspServerConfig[]> {
  const available: LspServerConfig[] = [];
  for (const config of LSP_SERVERS) {
    if (await isLspServerAvailable(config)) {
      available.push(config);
    }
  }
  return available;
}

/**
 * 按语言标识查找 LSP server 配置。
 *
 * 用于 workspace/symbol 等不依赖文件扩展名的场景。
 */
export function findLspConfigByLanguage(language: string): LspServerConfig | null {
  for (const config of LSP_SERVERS) {
    if (config.language === language) return config;
  }
  return null;
}
