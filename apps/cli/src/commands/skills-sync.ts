/**
 * Skills 双向同步命令 — CLI ↔ Web 后端 skills 表同步。
 *
 * 灵感来源:git push/pull/sync 的语义模型 + contentHash 快速跳过 + tombstone 软删除。
 * 简化策略(做减法):
 *   - 复用 @ihui/api-client 的 fetchApi(已封装 baseURL/token/重试)
 *   - 基于 SHA-256 contentHash 快速跳过未变更 skill
 *   - tombstone 机制:本地删文件 → sync 远端软删除;Web 删除 → pull 删本地文件
 *   - upsert 复活:若远端已软删除但本地重新推送了不同内容,自动清空 deletedAt
 *
 * 三个子命令:
 *   ihui skills sync   — 双向同步(推送本地 + 拉取远端 + tombstone 处理)
 *   ihui skills push   — 单向推送本地 → 远端(不处理 tombstone)
 *   ihui skills pull   — 单向拉取远端 → 本地(处理 tombstone,删本地文件)
 *
 * 同步前必须配置:
 *   - 后端 API 地址:--api-url 或 IHUI_API_URL 或 ~/.ihui/settings.json apiUrl
 *   - 鉴权 token:--api-key 或 IHUI_API_KEY 或 ~/.ihui/settings.json apiKey
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { fetchApi } from '@ihui/api-client';
import { loadSkills } from '../skills/index.js';

/** 远端 skill 数据结构(对应后端 /api/skills/pull 响应项) */
interface RemoteSkill {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  content?: string | null;
  contentHash?: string | null;
  isPublished?: boolean;
  syncSource?: string;
  updatedAt: string;
  lastSyncedAt?: string | null;
  /** 软删除时间戳,不为空表示已删除(tombstone),CLI 据此删本地文件 */
  deletedAt?: string | null;
}

/** 推送到远端的 skill 项 */
interface PushSkillItem {
  slug: string;
  name: string;
  description?: string | null;
  content?: string | null;
  contentHash?: string | null;
  isPublished?: boolean;
}

/** 本地 skill 目录(优先级从高到低,只写第一个可写目录) */
const SYNC_TARGET_DIRS = [
  '.ihui/skills',
  '.agents/skills',
  '.claude/skills',
  '.cursor/skills',
];

/** 计算 content 的 SHA-256 */
function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/** 将文件名 stem 转为 slug(小写+非字母数字转 -) */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 找到第一个可写的 skill 目录(优先 .ihui/skills) */
function findWritableSkillDir(cwd: string): string {
  for (const dir of SYNC_TARGET_DIRS) {
    const fullDir = path.join(cwd, dir);
    try {
      if (!fs.existsSync(fullDir)) {
        fs.mkdirSync(fullDir, { recursive: true });
      }
      // 测试可写
      fs.accessSync(fullDir, fs.constants.W_OK);
      return fullDir;
    } catch {
      continue;
    }
  }
  // 兜底:.ihui/skills
  const fallback = path.join(cwd, '.ihui/skills');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

/** 把本地加载的 skills 转为推送格式 */
function buildPushItems(cwd: string): PushSkillItem[] {
  const skills = loadSkills({ cwd });
  return skills.map((s) => {
    const slug = slugify(s.name);
    const content = s.body;
    return {
      slug,
      name: s.name,
      description: s.description || null,
      content,
      contentHash: computeContentHash(content),
      isPublished: false, // CLI 推送默认不发布,需在 Web 端手动发布
    };
  });
}

/** 把远端 skill 写入本地文件 */
function writeRemoteSkillToLocal(remote: RemoteSkill, cwd: string): string {
  const skillDir = findWritableSkillDir(cwd);
  const fileName = `${remote.slug || slugify(remote.name)}.md`;
  const filePath = path.join(skillDir, fileName);

  // 远端 content 可能已含 frontmatter(若原始 push 来自 CLI),直接写入避免重复包装
  // 仅当 content 不以 --- 开头时,才补 frontmatter(来自 Web 端新建的 skill 无 frontmatter)
  const content = remote.content ?? '';
  const hasFrontmatter = content.trimStart().startsWith('---');
  let fileContent: string
  if (hasFrontmatter) {
    fileContent = `${content}\n`
  } else {
    const frontmatterLines: string[] = ['---', `name: ${remote.name}`]
    if (remote.description) {
      frontmatterLines.push(`description: ${remote.description}`)
    }
    frontmatterLines.push('---')
    fileContent = `${frontmatterLines.join('\n')}\n\n${content}\n`
  }

  fs.writeFileSync(filePath, fileContent, 'utf8')
  return filePath
}

/**
 * 删除本地 skill 文件(tombstone 处理:远端已软删除,本地也删)
 * 在所有候选 skill 目录中查找同名文件并删除
 */
function removeLocalSkillFile(remote: RemoteSkill, cwd: string): boolean {
  const fileName = `${remote.slug || slugify(remote.name)}.md`;
  let removed = false;
  for (const dir of SYNC_TARGET_DIRS) {
    const filePath = path.join(cwd, dir, fileName);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removed = true;
      }
    } catch {
      // 忽略删除失败(权限等问题)
    }
  }
  return removed;
}

/** 同步结果统计 */
interface SyncStats {
  pushed: number;
  pulled: number;
  tombstoned: number;
  skipped: number;
  errors: string[];
}

/** 执行推送:本地 skills → 远端(不处理 tombstone) */
async function doPush(cwd: string): Promise<{ pushed: number; errors: string[] }> {
  const items = buildPushItems(cwd);
  if (items.length === 0) {
    console.info(chalk.dim('本地无 skills 可推送'));
    return { pushed: 0, errors: [] };
  }

  const spinner = ora(`推送 ${items.length} 个 skills 到远端...`).start();
  const result = await fetchApi<{ results: Array<{ slug: string; status: string; message?: string }> }>(
    '/skills/push',
    {
      method: 'POST',
      body: JSON.stringify({ skills: items }),
    },
  );

  if (!result.success) {
    spinner.fail(chalk.red(`推送失败: ${result.error}`));
    return { pushed: 0, errors: [result.error ?? '推送失败'] };
  }

  const stats = { pushed: 0, errors: [] as string[] };
  for (const r of result.data.results) {
    if (r.status === 'created' || r.status === 'updated') {
      stats.pushed += 1;
    } else if (r.status === 'error') {
      stats.errors.push(`${r.slug}: ${r.message ?? '未知错误'}`);
    }
  }
  spinner.succeed(
    chalk.green(`推送完成: ${stats.pushed} 个更新, ${items.length - stats.pushed - stats.errors.length} 个无变化`),
  );
  return stats;
}

/**
 * 执行拉取:远端 skills → 本地(含 tombstone 处理)
 * - 远端 deletedAt 不为空 → 删除本地文件(tombstone)
 * - 远端 deletedAt 为空且 contentHash 不同 → 写入本地文件
 */
async function doPull(cwd: string): Promise<{ pulled: number; tombstoned: number; errors: string[] }> {
  const spinner = ora('从远端拉取 skills...').start();
  const result = await fetchApi<{ skills: RemoteSkill[] }>(
    '/skills/pull',
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );

  if (!result.success) {
    spinner.fail(chalk.red(`拉取失败: ${result.error}`));
    return { pulled: 0, tombstoned: 0, errors: [result.error ?? '拉取失败'] };
  }

  const skills = result.data.skills;
  if (skills.length === 0) {
    spinner.info(chalk.dim('远端无 skills 可拉取'));
    return { pulled: 0, tombstoned: 0, errors: [] };
  }

  // 本地已加载的 skills slug → contentHash 映射,用于跳过未变更
  const localItems = buildPushItems(cwd);
  const localHashMap = new Map(localItems.map((i) => [i.slug, i.contentHash]));

  let pulled = 0;
  let tombstoned = 0;
  const errors: string[] = [];
  for (const remote of skills) {
    // tombstone:远端已软删除,删除本地文件
    if (remote.deletedAt) {
      try {
        if (removeLocalSkillFile(remote, cwd)) {
          tombstoned += 1;
        }
      } catch (err) {
        errors.push(`${remote.slug}: ${err instanceof Error ? err.message : '删除本地文件失败'}`);
      }
      continue;
    }
    // contentHash 相同则跳过
    if (remote.contentHash && localHashMap.get(remote.slug) === remote.contentHash) {
      continue;
    }
    try {
      writeRemoteSkillToLocal(remote, cwd);
      pulled += 1;
    } catch (err) {
      errors.push(`${remote.slug}: ${err instanceof Error ? err.message : '写入失败'}`);
    }
  }
  spinner.succeed(
    chalk.green(`拉取完成: ${pulled} 个更新, ${tombstoned} 个本地删除, ${skills.length - pulled - tombstoned - errors.length} 个无变化`),
  );
  return { pulled, tombstoned, errors };
}

/**
 * 执行双向同步:调用 /skills/db-sync 一次完成 push + tombstone + pull
 * - 推送本地 skills(upsert,基于 contentHash 跳过未变更;contentHash 不同则复活已软删除的)
 * - tombstone:本地不存在的远端活跃 skill,远端软删除
 * - 拉取远端所有 skills(含已软删除的),CLI 据此删本地文件
 *
 * 注意:使用 /skills/db-sync(DB 版,tombstone + contentHash)而非 /skills/sync(Redis 版,action-based)。
 *       两者契约不同,/skills/sync 已在 routes/skills.ts 中注册实现 SkillSyncRequest/Response canonical 契约。
 */
async function doSync(cwd: string): Promise<SyncStats> {
  const stats: SyncStats = { pushed: 0, pulled: 0, tombstoned: 0, skipped: 0, errors: [] };

  const localItems = buildPushItems(cwd);
  const spinner = ora(`同步 ${localItems.length} 个本地 skills 与远端...`).start();

  const result = await fetchApi<{
    pushed: string[];
    pulled: RemoteSkill[];
    tombstoned: string[];
    tombstonedCount: number;
  }>('/skills/db-sync', {
    method: 'POST',
    body: JSON.stringify({ localSkills: localItems }),
  });

  if (!result.success) {
    spinner.fail(chalk.red(`同步失败: ${result.error}`));
    stats.errors.push(result.error ?? '同步失败');
    return stats;
  }

  stats.pushed = result.data.pushed.length;
  stats.tombstoned = result.data.tombstonedCount;

  // 处理远端返回的 skills:deletedAt 不为空则删本地,否则按 contentHash 跳过或写入
  const localHashMap = new Map(localItems.map((i) => [i.slug, i.contentHash]));
  for (const remote of result.data.pulled) {
    if (remote.deletedAt) {
      try {
        if (removeLocalSkillFile(remote, cwd)) {
          stats.tombstoned += 1;
        }
      } catch (err) {
        stats.errors.push(`${remote.slug}: ${err instanceof Error ? err.message : '删除本地文件失败'}`);
      }
      continue;
    }
    if (remote.contentHash && localHashMap.get(remote.slug) === remote.contentHash) {
      stats.skipped += 1;
      continue;
    }
    try {
      writeRemoteSkillToLocal(remote, cwd);
      stats.pulled += 1;
    } catch (err) {
      stats.errors.push(`${remote.slug}: ${err instanceof Error ? err.message : '写入失败'}`);
    }
  }

  // 注意:服务端 tombstonedCount 是远端被软删除的数量(本地不存在的),
  // 上面的 removeLocalSkillFile 处理的是远端已软删除、本地也删除的数量(可能为 0,因为本地本来就没有)
  // 所以 stats.tombstoned 最终值是"远端软删除数 + 本地删除数",这里只保留远端软删除数更清晰
  stats.tombstoned = result.data.tombstonedCount;

  spinner.succeed(
    chalk.green(`同步完成: 推送 ${stats.pushed} 个, 拉取 ${stats.pulled} 个, 远端软删除 ${stats.tombstoned} 个, 无变化 ${stats.skipped} 个`),
  );
  return stats;
}

/** 注册 skills sync/push/pull 子命令 */
export function registerSkillsSyncCommand(program: Command): void {
  const skillsCmd = program.commands.find((c) => c.name() === 'skills');
  if (!skillsCmd) {
    console.warn(chalk.yellow('未找到 skills 命令,跳过 sync 子命令注册'));
    return;
  }

  skillsCmd
    .command('sync')
    .description('双向同步本地 skills 与 Web 后端(推送本地 + 拉取远端 + tombstone 软删除)')
    .option('--cwd <path>', '工作区路径', process.cwd())
    .action(async (options: { cwd: string }) => {
      const cwd = path.resolve(options.cwd);
      console.info(chalk.cyan(`\n开始双向同步(工作区: ${cwd})...`));
      const stats = await doSync(cwd);
      console.info('');
      console.info(chalk.cyan('同步结果:'));
      console.info(`  推送: ${chalk.green(`${stats.pushed} 个`)}`);
      console.info(`  拉取: ${chalk.green(`${stats.pulled} 个`)}`);
      console.info(`  软删除: ${chalk.yellow(`${stats.tombstoned} 个`)}`);
      console.info(`  无变化: ${chalk.dim(`${stats.skipped} 个`)}`);
      if (stats.errors.length > 0) {
        console.info(`  ${chalk.red(`错误: ${stats.errors.length} 个`)}`);
        for (const e of stats.errors) {
          console.info(chalk.dim(`    - ${e}`));
        }
      }
      console.info('');
    });

  skillsCmd
    .command('push')
    .description('推送本地 skills 到 Web 后端(upsert,基于 contentHash 跳过未变更,不处理 tombstone)')
    .option('--cwd <path>', '工作区路径', process.cwd())
    .action(async (options: { cwd: string }) => {
      const cwd = path.resolve(options.cwd);
      console.info(chalk.cyan(`\n推送本地 skills 到远端(工作区: ${cwd})...`));
      const result = await doPush(cwd);
      if (result.errors.length > 0) {
        console.info(chalk.red(`\n错误(${result.errors.length}个):`));
        for (const e of result.errors) {
          console.info(chalk.dim(`  - ${e}`));
        }
      }
      console.info('');
    });

  skillsCmd
    .command('pull')
    .description('从 Web 后端拉取 skills 到本地(覆盖同名文件,远端已删除则删本地)')
    .option('--cwd <path>', '工作区路径', process.cwd())
    .action(async (options: { cwd: string }) => {
      const cwd = path.resolve(options.cwd);
      console.info(chalk.cyan(`\n从远端拉取 skills 到本地(工作区: ${cwd})...`));
      const result = await doPull(cwd);
      console.info('');
      console.info(chalk.cyan('拉取结果:'));
      console.info(`  更新: ${chalk.green(`${result.pulled} 个`)}`);
      console.info(`  本地删除: ${chalk.yellow(`${result.tombstoned} 个`)}`);
      if (result.errors.length > 0) {
        console.info(`  ${chalk.red(`错误: ${result.errors.length} 个`)}`);
        for (const e of result.errors) {
          console.info(chalk.dim(`    - ${e}`));
        }
      }
      console.info('');
    });
}

export default registerSkillsSyncCommand;
