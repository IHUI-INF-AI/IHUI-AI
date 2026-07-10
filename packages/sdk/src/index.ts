/**
 * IHUI AI TypeScript SDK
 * 自动生成 — 请勿手动编辑 (由 scripts/generate-sdk.ts 生成)
 *
 * 用法:
 *   import { createClient } from '@ihui/sdk';
 *   const client = createClient({ baseUrl: 'http://localhost:8000', apiKey: '...' });
 *   const { data } = await client.getUsers();
 */

export interface SdkConfig {
  baseUrl: string;
  apiKey?: string;
  tenantId?: string;
  fetch?: typeof fetch;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export class SdkError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SdkError';
  }
}

/** 基础客户端：封装 fetch, 注入 auth/tenant header, 统一错误处理。 */
export class BaseClient {
  private baseUrl: string;
  private apiKey?: string;
  private tenantId?: string;
  private fetchFn: typeof fetch;

  constructor(config: SdkConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.tenantId = config.tenantId;
    this.fetchFn = config.fetch ?? globalThis.fetch;
  }

  protected async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    if (this.tenantId) headers['x-tenant-id'] = this.tenantId;

    const resp = await this.fetchFn(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await resp.json()) as ApiResponse<T>;
    if (!resp.ok || json.code !== 0) {
      throw new SdkError(resp.status, json.message || `HTTP ${resp.status}`);
    }
    return json.data;
  }

  protected get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  protected post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  protected patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  protected put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  protected delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

// =============================================================================
// API 客户端 — 按路由模块组织
// =============================================================================

export class AuthApi extends BaseClient {
  login(body: { username: string; password: string }) {
    return this.post('/api/auth/login', body);
  }
  register(body: { username: string; password: string; email?: string }) {
    return this.post('/api/auth/register', body);
  }
  getProfile() {
    return this.get('/api/users/me');
  }
}

export class TenantApi extends BaseClient {
  listTenants() {
    return this.get('/api/tenants');
  }
  createTenant(body: { name: string; slug: string; description?: string; plan?: string }) {
    return this.post('/api/tenants', body);
  }
  getTenant(id: string) {
    return this.get(`/api/tenants/${id}`);
  }
  updateTenant(id: string, body: Record<string, unknown>) {
    return this.patch(`/api/tenants/${id}`, body);
  }
  deleteTenant(id: string) {
    return this.delete(`/api/tenants/${id}`);
  }
  listMembers(tenantId: string) {
    return this.get(`/api/tenants/${tenantId}/members`);
  }
  addMember(tenantId: string, body: { userId: string; role?: string }) {
    return this.post(`/api/tenants/${tenantId}/members`, body);
  }
  removeMember(tenantId: string, userId: string) {
    return this.delete(`/api/tenants/${tenantId}/members/${userId}`);
  }
  getQuota(tenantId: string) {
    return this.get(`/api/tenants/${tenantId}/quota`);
  }
  updateQuota(tenantId: string, body: Record<string, unknown>) {
    return this.patch(`/api/tenants/${tenantId}/quota`, body);
  }
}

export class AiCostApi extends BaseClient {
  getDashboard(params?: { startDate?: string; endDate?: string; tenantId?: string }) {
    return this.get('/api/admin/ai/cost/dashboard', params);
  }
  getRecords(params?: { limit?: string; offset?: string; userId?: string; model?: string }) {
    return this.get('/api/admin/ai/cost/records', params);
  }
  getBudgets() {
    return this.get('/api/admin/ai/cost/budgets');
  }
  setBudget(body: { scope: string; scopeKey: string; model?: string; dailyTokenLimit?: number; monthlyTokenLimit?: number }) {
    return this.post('/api/admin/ai/cost/budgets', body);
  }
}

export class TeamApi extends BaseClient {
  listTeams() {
    return this.get('/api/teams');
  }
  createTeam(body: { name: string; slug: string; description?: string }) {
    return this.post('/api/teams', body);
  }
  getTeam(id: string) {
    return this.get(`/api/teams/${id}`);
  }
  updateTeam(id: string, body: Record<string, unknown>) {
    return this.patch(`/api/teams/${id}`, body);
  }
  deleteTeam(id: string) {
    return this.delete(`/api/teams/${id}`);
  }
}

export class FileApi extends BaseClient {
  uploadFile(file: Blob, metadata?: Record<string, string>) {
    return this.post('/api/files/upload', { file, ...metadata });
  }
  listFiles(params?: { page?: string; pageSize?: string }) {
    return this.get('/api/files', params);
  }
  deleteFile(id: string) {
    return this.delete(`/api/files/${id}`);
  }
}

export class HealthApi extends BaseClient {
  health() {
    return this.get('/api/health');
  }
}

// =============================================================================
// 顶层客户端工厂
// =============================================================================

export interface IhuiClient {
  auth: AuthApi;
  tenants: TenantApi;
  aiCost: AiCostApi;
  teams: TeamApi;
  files: FileApi;
  health: HealthApi;
}

export function createClient(config: SdkConfig): IhuiClient {
  return {
    auth: new AuthApi(config),
    tenants: new TenantApi(config),
    aiCost: new AiCostApi(config),
    teams: new TeamApi(config),
    files: new FileApi(config),
    health: new HealthApi(config),
  };
}

export default createClient;
