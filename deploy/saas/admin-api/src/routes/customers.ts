/**
 * 客户管理路由
 * 端点:
 *   GET    /admin/api/customers
 *   GET    /admin/api/customers/:slug
 *   POST   /admin/api/customers
 *   GET    /admin/api/customers/:slug/backups
 *   DELETE /admin/api/customers/:slug/backups/:timestamp   (P1-2.2b 新增)
 *   POST   /admin/api/customers/:slug/pause
 *   POST   /admin/api/customers/:slug/resume
 *   POST   /admin/api/customers/:slug/backup
 *   POST   /admin/api/customers/:slug/restore
 *   DELETE /admin/api/customers/:slug
 *
 * 实现方式:调用 deploy/saas/scripts/*.sh(避免业务逻辑重复)
 */

import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve as pathResolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { requireAdminAuth } from './auth.js';
import { config } from '../config.js';

const SlugSchema = z.string().regex(/^[a-z0-9-]{3,20}$/, 'Invalid slug');

const CUSTOMERS_DIR = pathResolve(config.SAAS_ROOT, 'customers');
const BACKUPS_DIR = pathResolve(config.SAAS_ROOT, 'backups');
const SCRIPTS_DIR = pathResolve(config.SAAS_ROOT, 'scripts');

/**
 * 执行脚本并返回结果
 */
async function runScript(
  scriptName: string,
  args: string[],
  log: FastifyBaseLogger,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((res, rej) => {
    const script = pathResolve(SCRIPTS_DIR, scriptName);
    if (!existsSync(script)) {
      return rej(new Error(`Script not found: ${script}`));
    }

    const proc = spawn('bash', [script, ...args], {
      env: { ...process.env, FORCE_DESTROY: '1' },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      log.info(s.trim());
    });
    proc.stderr?.on('data', (d: Buffer) => {
      const s = d.toString();
      stderr += s;
      log.error(s.trim());
    });

    proc.on('close', (code) => res({ code: code ?? 0, stdout, stderr }));
    proc.on('error', rej);
  });
}

/**
 * 读取客户状态
 */
function getCustomerState(slug: string): {
  state: string;
  stateChangedAt: string | null;
  exists: boolean;
  containersRunning: number;
  containersTotal: number;
  memory: string;
  cpu: string;
  domain: string;
} {
  const dir = join(CUSTOMERS_DIR, slug);
  if (!existsSync(dir)) {
    return {
      state: 'not-found',
      stateChangedAt: null,
      exists: false,
      containersRunning: 0,
      containersTotal: 0,
      memory: '-',
      cpu: '-',
      domain: '-',
    };
  }

  const stateFile = join(dir, '.state');
  const stateChangedFile = join(dir, '.state_changed_at');
  const envFile = join(dir, '.env');
  const composeFile = join(dir, 'docker-compose.yml');

  // 读 .env 拿 domain
  let domain = '-';
  if (existsSync(envFile)) {
    const envContent = readFileSync(envFile, 'utf8');
    const match = envContent.match(/^CUSTOMER_DOMAIN=(.+)$/m);
    if (match) domain = match[1].trim();
  }

  // 读 compose 拿资源限制
  let memory = '-';
  let cpu = '-';
  if (existsSync(composeFile)) {
    const composeContent = readFileSync(composeFile, 'utf8');
    const memMatch = composeContent.match(/memory:\s*(\S+)/);
    const cpuMatch = composeContent.match(/cpus:\s*'([^']+)'/);
    if (memMatch) memory = memMatch[1];
    if (cpuMatch) cpu = cpuMatch[1];
  }

  return {
    state: existsSync(stateFile) ? readFileSync(stateFile, 'utf8').trim() : 'active',
    stateChangedAt: existsSync(stateChangedFile)
      ? readFileSync(stateChangedFile, 'utf8').trim()
      : null,
    exists: true,
    containersRunning: 0, // 实时查询见 listCustomers
    containersTotal: 0,
    memory,
    cpu,
    domain,
  };
}

/**
 * 同步查询容器状态
 */
async function getContainerStatus(slug: string): Promise<{ running: number; total: number }> {
  const { exec } = await import('node:child_process');
  return new Promise((resolve) => {
    exec(
      `docker ps --filter "name=customer-${slug}-" --format "{{.Names}}" | wc -l; docker ps -a --filter "name=customer-${slug}-" --format "{{.Names}}" | wc -l`,
      (err, stdout) => {
        if (err) return resolve({ running: 0, total: 0 });
        const [running, total] = stdout.trim().split('\n').map((s) => parseInt(s, 10) || 0);
        resolve({ running, total });
      },
    );
  });
}

/**
 * 递归计算目录大小(KB),限制深度避免深层目录过慢
 */
function dirSizeKb(dir: string, maxDepth: number, currentDepth = 0): number {
  if (currentDepth > maxDepth) return 0;
  let total = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          total += dirSizeKb(full, maxDepth, currentDepth + 1);
        } else if (entry.isFile()) {
          total += Math.ceil(statSync(full).size / 1024);
        }
      } catch {
        // 跳过无权限或已删除的文件
      }
    }
  } catch {
    // 目录不可读
  }
  return total;
}

/**
 * 格式化大小为人类可读字符串
 */
function formatSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  // 所有路由需要双重鉴权(X-Admin-API-Key + X-Admin-User)
  app.addHook('preHandler', requireAdminAuth);

  // ==================== 创建(P1-2.2 新增)====================
  const CreateCustomerSchema = z.object({
    slug: SlugSchema,
    memory: z.string().default('2G'),
    cpu: z.string().default('1.0'),
    plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  });

  app.post('/admin/api/customers', async (request, reply) => {
    const parse = CreateCustomerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'InvalidBody', message: parse.error.message });
    }
    const { slug, memory, cpu } = parse.data;

    if (existsSync(join(CUSTOMERS_DIR, slug))) {
      return reply.status(409).send({
        error: 'AlreadyExists',
        message: `Customer '${slug}' already exists`,
      });
    }

    const result = await runScript('create-customer.sh', [slug, memory, cpu], request.log);
    if (result.code !== 0) {
      return reply.status(500).send({
        error: 'CreateFailed',
        message: 'Create script failed',
        stderr: result.stderr,
        stdout: result.stdout,
      });
    }
    return { status: 'created', slug, memory, cpu, plan: parse.data.plan, output: result.stdout };
  });

  // ==================== 备份列表(P1-2.2)====================
  app.get<{ Params: { slug: string } }>(
    '/admin/api/customers/:slug/backups',
    async (request, reply) => {
      const parse = SlugSchema.safeParse(request.params.slug);
      if (!parse.success) {
        return reply.status(400).send({ error: 'InvalidSlug', message: parse.error.message });
      }
      const slug = parse.data;
      const backupsDir = join(BACKUPS_DIR, slug);

      if (!existsSync(backupsDir)) {
        return { backups: [] };
      }

      const now = Date.now();
      const backups = readdirSync(backupsDir)
        .filter((name) => {
          // 跳过 latest 软链接和隐藏文件
          if (name === 'latest' || name.startsWith('.')) return false;
          const full = join(backupsDir, name);
          return statSync(full).isDirectory();
        })
        .map((timestamp) => {
          const full = join(backupsDir, timestamp);
          const st = statSync(full);
          // 递归统计目录大小(KB),限制深度避免太慢
          const totalSize = dirSizeKb(full, 3);
          const fileCount = readdirSync(full).length;
          const ageMs = now - st.mtimeMs;
          const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
          const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
          const age =
            ageDays > 0
              ? `${ageDays} 天前`
              : ageHours > 0
                ? `${ageHours} 小时前`
                : '刚刚';
          return {
            timestamp,
            mtime: st.mtime.toISOString(),
            size: formatSize(totalSize),
            sizeKb: totalSize,
            age,
            fileCount,
          };
        })
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

      return { backups };
    },
  );

  // ==================== 删除备份(P1-2.2b 新增)====================
  app.delete<{ Params: { slug: string; timestamp: string } }>(
    '/admin/api/customers/:slug/backups/:timestamp',
    async (request, reply) => {
      const slugParse = SlugSchema.safeParse(request.params.slug);
      if (!slugParse.success) {
        return reply.status(400).send({ error: 'InvalidSlug', message: slugParse.error.message });
      }
      // 严格校验 timestamp 格式(YYYYMMDD_HHMMSS),防止路径穿越
      const tsParse = z
        .string()
        .regex(/^[0-9]{8}_[0-9]{6}$/, 'Invalid timestamp format (expected YYYYMMDD_HHMMSS)')
        .safeParse(request.params.timestamp);
      if (!tsParse.success) {
        return reply
          .status(400)
          .send({ error: 'InvalidTimestamp', message: tsParse.error.message });
      }
      const slug = slugParse.data;
      const timestamp = tsParse.data;

      const backupDir = join(BACKUPS_DIR, slug, timestamp);
      if (!existsSync(backupDir)) {
        return reply.status(404).send({
          error: 'BackupNotFound',
          message: `Backup '${timestamp}' not found for customer '${slug}'`,
        });
      }

      // 调用删除脚本(FORCE_DELETE=1 跳过交互式确认,API 端默认视为已确认)
      const result = await runScript(
        'delete-backup.sh',
        [slug, timestamp],
        request.log,
      );
      if (result.code !== 0) {
        return reply.status(500).send({
          error: 'DeleteBackupFailed',
          message: 'Delete backup script failed',
          stderr: result.stderr,
        });
      }
      return { status: 'deleted', slug, timestamp, output: result.stdout };
    },
  );

  // ==================== 列表 ====================
  app.get('/admin/api/customers', async () => {
    if (!existsSync(CUSTOMERS_DIR)) {
      return { customers: [] };
    }

    const slugs = readdirSync(CUSTOMERS_DIR).filter((name) => {
      const full = join(CUSTOMERS_DIR, name);
      return statSync(full).isDirectory();
    });

    const customers = await Promise.all(
      slugs.map(async (slug) => {
        const state = getCustomerState(slug);
        const containers = await getContainerStatus(slug);
        return {
          slug,
          ...state,
          containersRunning: containers.running,
          containersTotal: containers.total,
        };
      }),
    );

    return { customers };
  });

  // ==================== 详情 ====================
  app.get<{ Params: { slug: string } }>('/admin/api/customers/:slug', async (request, reply) => {
    const parse = SlugSchema.safeParse(request.params.slug);
    if (!parse.success) {
      return reply.status(400).send({ error: 'InvalidSlug', message: parse.error.message });
    }

    const slug = parse.data;
    const state = getCustomerState(slug);
    if (!state.exists) {
      return reply.status(404).send({ error: 'NotFound', message: `Customer '${slug}' not found` });
    }

    const containers = await getContainerStatus(slug);
    return {
      slug,
      ...state,
      containersRunning: containers.running,
      containersTotal: containers.total,
    };
  });

  // ==================== 暂停 ====================
  app.post<{ Params: { slug: string } }>('/admin/api/customers/:slug/pause', async (request, reply) => {
    const parse = SlugSchema.safeParse(request.params.slug);
    if (!parse.success) {
      return reply.status(400).send({ error: 'InvalidSlug', message: parse.error.message });
    }

    const result = await runScript('pause-customer.sh', [parse.data], request.log);
    if (result.code !== 0) {
      return reply.status(500).send({
        error: 'PauseFailed',
        message: 'Pause script failed',
        stderr: result.stderr,
      });
    }
    return { status: 'paused', slug: parse.data };
  });

  // ==================== 恢复 ====================
  app.post<{ Params: { slug: string } }>('/admin/api/customers/:slug/resume', async (request, reply) => {
    const parse = SlugSchema.safeParse(request.params.slug);
    if (!parse.success) {
      return reply.status(400).send({ error: 'InvalidSlug', message: parse.error.message });
    }

    const result = await runScript('resume-customer.sh', [parse.data], request.log);
    if (result.code !== 0) {
      return reply.status(500).send({
        error: 'ResumeFailed',
        message: 'Resume script failed',
        stderr: result.stderr,
      });
    }
    return { status: 'active', slug: parse.data };
  });

  // ==================== 备份 ====================
  app.post<{ Params: { slug: string } }>('/admin/api/customers/:slug/backup', async (request, reply) => {
    const parse = SlugSchema.safeParse(request.params.slug);
    if (!parse.success) {
      return reply.status(400).send({ error: 'InvalidSlug', message: parse.error.message });
    }

    const result = await runScript('backup-customer.sh', [parse.data], request.log);
    if (result.code !== 0) {
      return reply.status(500).send({
        error: 'BackupFailed',
        message: 'Backup script failed',
        stderr: result.stderr,
      });
    }
    return { status: 'backup-created', slug: parse.data, output: result.stdout };
  });

  // ==================== 恢复(从备份)====================
  app.post<{
    Params: { slug: string };
    Body: { timestamp?: string };
  }>('/admin/api/customers/:slug/restore', async (request, reply) => {
    const parse = SlugSchema.safeParse(request.params.slug);
    if (!parse.success) {
      return reply.status(400).send({ error: 'InvalidSlug', message: parse.error.message });
    }

    const BodySchema = z.object({ timestamp: z.string().optional() });
    const bodyParse = BodySchema.safeParse(request.body ?? {});
    if (!bodyParse.success) {
      return reply.status(400).send({ error: 'InvalidBody', message: bodyParse.error.message });
    }

    const args = [parse.data];
    if (bodyParse.data.timestamp) {
      args.push(bodyParse.data.timestamp);
    }

    // restore 脚本会要求 'yes' 确认,自动跳过(API 调用已视为确认)
    const result = await runScript('restore-customer.sh', args, request.log);
    if (result.code !== 0) {
      return reply.status(500).send({
        error: 'RestoreFailed',
        message: 'Restore script failed',
        stderr: result.stderr,
      });
    }
    return { status: 'restored', slug: parse.data, output: result.stdout };
  });

  // ==================== 销毁 ====================
  app.delete<{ Params: { slug: string } }>('/admin/api/customers/:slug', async (request, reply) => {
    const parse = SlugSchema.safeParse(request.params.slug);
    if (!parse.success) {
      return reply.status(400).send({ error: 'InvalidSlug', message: parse.error.message });
    }

    const result = await runScript('destroy-customer.sh', [parse.data], request.log);
    if (result.code !== 0) {
      return reply.status(500).send({
        error: 'DestroyFailed',
        message: 'Destroy script failed',
        stderr: result.stderr,
      });
    }
    return { status: 'destroyed', slug: parse.data };
  });

  // ==================== 配额占位 (P1-2.2c) ====================
  // 等待 P1-2.3 Prometheus 接入,当前返回硬编码占位数据
  // 端点契约已稳定,接入 Prometheus 时只改此处 + 移除 placeholder 字段即可
  app.get<{ Params: { slug: string } }>(
    '/admin/api/customers/:slug/quota',
    async (request, reply) => {
      const parse = SlugSchema.safeParse(request.params.slug);
      if (!parse.success) {
        return reply.status(400).send({ error: 'InvalidSlug', message: parse.error.message });
      }

      const slug = parse.data;
      const state = getCustomerState(slug);
      if (!state.exists) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `Customer '${slug}' not found`,
        });
      }

      return {
        slug,
        apiCalls: {
          used: 0,
          limit: null,
          window: 'all',
          resetAt: null,
        },
        storage: {
          usedBytes: 0,
          limitBytes: null,
        },
        aiTokens: {
          used: 0,
          limit: null,
          window: 'all',
          resetAt: null,
        },
        placeholder: true,
        expectedFrom: 'P1-2.3 (Prometheus + Grafana)',
        generatedAt: new Date().toISOString(),
      };
    },
  );
}
