/**
 * 客户管理路由
 * 端点:
 *   GET    /admin/api/customers
 *   GET    /admin/api/customers/:slug
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
import { requireApiKey } from './auth.js';
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

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  // 所有路由需要鉴权
  app.addHook('preHandler', requireApiKey);

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
}
