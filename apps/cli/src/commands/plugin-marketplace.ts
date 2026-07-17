/**
 * Plugin Marketplace slash 命令:/plugin install|uninstall|list|marketplace。
 *
 * 灵感来源:cli cli-pager/plugin_cmd。
 * 集成策略:feature flag 控制,默认关闭(settings.pluginMarketplace.enabled)。
 *   - flag 关闭时:所有子命令返回"未启用"提示,不执行实际安装/卸载
 *   - flag 开启时:委托 plugins/installer.ts 执行实际操作
 *
 * 用法:
 *   /plugin install <source>      安装插件(source 可为本地路径或 Git URL)
 *   /plugin uninstall <name>      卸载插件
 *   /plugin list                  列出已安装插件
 *   /plugin marketplace <path>    扫描 marketplace 索引
 */
import { loadSettings } from './settings.js';
import {
  installPlugin,
  uninstallPlugin,
  loadInstallRegistry,
  scanMarketplace,
} from '../plugins/index.js';

export interface PluginMarketplaceResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

/** 检查 feature flag 是否启用(settings.pluginMarketplace.enabled === true) */
function isMarketplaceEnabled(): boolean {
  const settings = loadSettings();
  return settings.pluginMarketplace?.enabled === true;
}

/**
 * 处理 /plugin 子命令。
 *
 * @param args 子命令及参数,如 ['install', './foo'] / ['uninstall', 'foo'] / ['list'] / ['marketplace', '/path']
 */
export async function handlePluginMarketplaceCommand(
  args: string[],
): Promise<PluginMarketplaceResult> {
  if (!isMarketplaceEnabled()) {
    return {
      ok: false,
      message: 'Plugin marketplace 未启用。请在 settings.json 中设置 pluginMarketplace.enabled = true',
    };
  }

  const [subcommandRaw, ...rest] = args;
  const subcommand = subcommandRaw ?? '';

  switch (subcommand) {
    case 'install': {
      const source = rest[0];
      if (!source) {
        return { ok: false, message: '用法:/plugin install <source>' };
      }
      try {
        const outcome = await installPlugin(source);
        return {
          ok: true,
          message: `插件 ${outcome.name} 安装成功(路径:${outcome.installedPath})`,
          data: outcome,
        };
      } catch (err) {
        return {
          ok: false,
          message: `安装失败:${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    case 'uninstall': {
      const name = rest[0];
      if (!name) {
        return { ok: false, message: '用法:/plugin uninstall <name>' };
      }
      try {
        const outcome = await uninstallPlugin(name);
        return {
          ok: true,
          message: `插件 ${name} 卸载成功`,
          data: outcome,
        };
      } catch (err) {
        return {
          ok: false,
          message: `卸载失败:${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    case 'list': {
      try {
        const registry = loadInstallRegistry();
        if (registry.records.length === 0) {
          return { ok: true, message: '暂无已安装插件' };
        }
        const list = registry.records
          .map((r) => `- ${r.name} (${r.version ?? 'unknown'}) - ${r.sourceType}${r.sourceUrl ? ` from ${r.sourceUrl}` : ''}`)
          .join('\n');
        return {
          ok: true,
          message: `已安装插件(${registry.records.length} 个):\n${list}`,
          data: registry.records,
        };
      } catch (err) {
        return {
          ok: false,
          message: `加载失败:${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    case 'marketplace': {
      const marketplacePath = rest[0];
      if (!marketplacePath) {
        return { ok: false, message: '用法:/plugin marketplace <path>' };
      }
      try {
        const scan = scanMarketplace(marketplacePath);
        if (!scan.found || !scan.index) {
          return {
            ok: false,
            message: `未找到 marketplace.json,扫描路径:${scan.indexPath}`,
          };
        }
        const plugins = scan.index.plugins
          .map((p) => `- ${p.name} (${p.version ?? 'latest'}) - ${p.description ?? ''}`)
          .join('\n');
        return {
          ok: true,
          message: `Marketplace "${scan.index.name}" 包含 ${scan.index.plugins.length} 个插件:\n${plugins}`,
          data: scan.index,
        };
      } catch (err) {
        return {
          ok: false,
          message: `扫描失败:${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    default:
      return {
        ok: false,
        message: '未知子命令。用法:/plugin install|uninstall|list|marketplace',
      };
  }
}
