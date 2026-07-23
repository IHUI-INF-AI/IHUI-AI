/**
 * Registry API client — 对接 api /api/registry/*,拉取/同步/安装/升级 MCP/Skill/Plugin 资源。
 *
 * 设计参考 skills/sync.ts 的 SkillSyncClient:
 *   - 网络失败/非 2xx/解析错全部降级(返回 null),不抛错,不影响主流程
 *   - 15s 超时
 *   - Bearer token 鉴权(可选)
 *
 * 同时维护本地安装清单 ~/.ihui/registry-installs.json(供 upgrade 子命令对比版本,
 * 实现"订阅自动 pull 升级":本地版本落后于 registry 最新版本时自动调用 install 拉取)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type {
  RegistryItemListResponse,
  RegistryItemListQuery,
  RegistrySyncResponse,
  RegistrySourceType,
  RegistryUpstreamSource,
  InstallRegistryItemResponse,
  UpgradeAllResponse,
} from '@ihui/types';

const FETCH_TIMEOUT_MS = 15_000;

/**
 * RegistryClient — 对接 api /api/registry/*。
 * 网络失败降级返回 null,与 SkillSyncClient 一致(不抛错)。
 *
 * 用法:
 *   const client = new RegistryClient('http://localhost:8000', 'bearer-token');
 *   const list = await client.list({ sort: 'hot' });
 *   const sync = await client.sync('mcp', 'github', true);
 */
export class RegistryClient {
  constructor(private apiUrl: string, private token?: string) {}

  /** 拉取资源列表(GET /api/registry/items) */
  async list(query: RegistryItemListQuery): Promise<RegistryItemListResponse | null> {
    try {
      const qs = new URLSearchParams();
      if (query.sourceType) qs.set('sourceType', query.sourceType);
      if (query.source) qs.set('source', query.source);
      if (query.sort) qs.set('sort', query.sort);
      if (query.q) qs.set('q', query.q);
      if (query.category) qs.set('category', query.category);
      if (query.page !== undefined) qs.set('page', String(query.page));
      if (query.pageSize !== undefined) qs.set('pageSize', String(query.pageSize));
      const res = await fetch(`${this.apiUrl}/api/registry/items?${qs.toString()}`, {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: RegistryItemListResponse };
      return json.data ?? null;
    } catch {
      return null;
    }
  }

  /** 触发同步(POST /api/registry/sync,管理员) */
  async sync(
    sourceType?: RegistrySourceType,
    source?: RegistryUpstreamSource,
    force?: boolean,
  ): Promise<RegistrySyncResponse | null> {
    try {
      const body: Record<string, unknown> = {};
      if (sourceType) body.sourceType = sourceType;
      if (source) body.source = source;
      if (force) body.force = true;
      const res = await fetch(`${this.apiUrl}/api/registry/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: RegistrySyncResponse };
      return json.data ?? null;
    } catch {
      return null;
    }
  }

  /** 安装(POST /api/registry/install,写 user_preferences group='registry_installs') */
  async install(
    sourceType: RegistrySourceType,
    sourceId: string,
    version?: string,
  ): Promise<InstallRegistryItemResponse | null> {
    try {
      const body: Record<string, unknown> = { sourceType, sourceId };
      if (version) body.version = version;
      const res = await fetch(`${this.apiUrl}/api/registry/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: InstallRegistryItemResponse };
      return json.data ?? null;
    } catch {
      return null;
    }
  }

  /** 批量升级(POST /api/registry/upgrade-all,管理员,服务端对比 user_preferences vs registry_items) */
  async upgradeAll(sourceType?: RegistrySourceType): Promise<UpgradeAllResponse | null> {
    try {
      const body: Record<string, unknown> = {};
      if (sourceType) body.sourceType = sourceType;
      const res = await fetch(`${this.apiUrl}/api/registry/upgrade-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: UpgradeAllResponse };
      return json.data ?? null;
    } catch {
      return null;
    }
  }

  private authHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }
}

// ================== 本地安装清单(~/.ihui/registry-installs.json) ==================
// 供 upgrade 子命令实现"订阅自动 pull 升级":对比本地版本与 registry 最新版本,
// 落后则自动调用 install 拉取新版本。

const MANIFEST_PATH = path.join(os.homedir(), '.ihui', 'registry-installs.json');

/** 本地安装清单单条记录 */
export interface RegistryInstallRecord {
  sourceType: RegistrySourceType;
  sourceId: string;
  version: string;
  installedAt: string;
}

interface InstallsManifest {
  installs: RegistryInstallRecord[];
}

/** 本地安装清单路径 */
export function getInstallsManifestPath(): string {
  return MANIFEST_PATH;
}

/** 读取本地安装清单(缺失/损坏返回空数组) */
export function loadInstalls(): RegistryInstallRecord[] {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) return [];
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as InstallsManifest;
    return Array.isArray(parsed.installs) ? parsed.installs : [];
  } catch {
    return [];
  }
}

/** 写入本地安装清单(覆盖) */
function writeInstalls(installs: RegistryInstallRecord[]): void {
  try {
    const dir = path.dirname(MANIFEST_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ installs }, null, 2), 'utf-8');
  } catch {
    // 写入失败不影响主流程
  }
}

/**
 * 记录一次安装(upsert by sourceType + sourceId)。
 * 同 sourceType + sourceId 已存在则更新 version + installedAt,否则追加。
 */
export function recordInstall(record: RegistryInstallRecord): void {
  const installs = loadInstalls();
  const idx = installs.findIndex(
    (i) => i.sourceType === record.sourceType && i.sourceId === record.sourceId,
  );
  const now = new Date().toISOString();
  if (idx >= 0) {
    installs[idx] = { ...record, installedAt: now };
  } else {
    installs.push({ ...record, installedAt: record.installedAt || now });
  }
  writeInstalls(installs);
}

/** 移除一条安装记录(按 sourceType + sourceId),返回是否实际删除 */
export function removeInstall(sourceType: RegistrySourceType, sourceId: string): boolean {
  const installs = loadInstalls();
  const next = installs.filter(
    (i) => !(i.sourceType === sourceType && i.sourceId === sourceId),
  );
  if (next.length === installs.length) return false;
  writeInstalls(next);
  return true;
}
