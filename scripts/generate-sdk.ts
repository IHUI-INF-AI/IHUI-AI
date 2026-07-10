/**
 * OpenAPI SDK 自动生成脚本
 *
 * 从 Fastify 路由定义提取 OpenAPI spec (@fastify/swagger), 生成 TypeScript 客户端 SDK。
 *
 * 用法: npx tsx scripts/generate-sdk.ts
 *
 * 流程:
 *   1. 构建 Fastify 实例 (不监听端口)
 *   2. 获取 server.swagger() 返回的 OpenAPI JSON
 *   3. 解析 paths, 为每个 operation 生成客户端方法
 *   4. 写入 packages/sdk/src/generated.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'packages', 'sdk', 'src', 'generated.ts');

// OpenAPI 3.x 类型 (仅取所需字段)
interface OpenApiSpec {
  paths: Record<string, Record<string, OpenApiOperation>>;
}
interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  tags?: string[];
  parameters?: Array<{ name: string; in: string }>;
  requestBody?: { content: Record<string, { schema?: { $ref?: string } }> };
  responses?: Record<string, unknown>;
}
interface OpenApiDoc {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
}

/** 将路径参数 /api/users/{id} 转为模板字符串 /api/users/${id} */
function pathToTemplate(path: string): string {
  return path.replace(/\{([^}]+)\}/g, (_, param) => `\${${param}}`);
}

/** 从 operationId 或 path+method 生成方法名 */
function toMethodName(op: OpenApiOperation, path: string, method: string): string {
  if (op.operationId) return op.operationId.replace(/[-.]/g, '_');
  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? 'root';
  return `${method}_${last}`.replace(/[-{}]/g, '_');
}

/** 从 tag 生成 API 类名 */
function toClassName(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_](.)/g, (_, c) => c.toUpperCase()) + 'Api';
}

/** 提取路径参数列表 */
function extractPathParams(path: string): string[] {
  const matches = path.matchAll(/\{([^}]+)\}/g);
  return Array.from(matches).map((m) => m[1]!);
}

/** 生成单个客户端方法代码 */
function generateMethod(
  method: string,
  path: string,
  op: OpenApiOperation,
): string {
  const name = toMethodName(op, path, method);
  const templatePath = pathToTemplate(path);
  const pathParams = extractPathParams(path);
  const hasBody = method === 'post' || method === 'put' || method === 'patch';
  const hasQuery = op.parameters?.some((p) => p.in === 'query') ?? false;

  const paramList: string[] = [];
  for (const p of pathParams) {
    paramList.push(`${p}: string`);
  }
  if (hasBody) paramList.push(`body?: unknown`);
  if (hasQuery) paramList.push(`params?: Record<string, string>`);

  const args = paramList.length > 0 ? `(${paramList.join(', ')})` : `()`;

  let call: string;
  const httpMethod = method === 'delete' ? 'delete' : method;
  if (hasBody && hasQuery) {
    call = `this.${httpMethod}(\`${templatePath}\`, body, params)`;
  } else if (hasBody) {
    call = `this.${httpMethod}(\`${templatePath}\`, body)`;
  } else if (hasQuery) {
    call = `this.${httpMethod}(\`${templatePath}\`, params)`;
  } else {
    call = `this.${httpMethod}(\`${templatePath}\`)`;
  }

  const summary = op.summary ? `  /** ${op.summary} */\n` : '';
  return `${summary}  ${name}${args} {\n    return ${call};\n  }`;
}

/** 主生成函数: 从 OpenAPI spec 生成 TypeScript 客户端代码 */
export function generateSdkCode(spec: OpenApiDoc): string {
  const byTag = new Map<string, Array<{ method: string; path: string; op: OpenApiOperation }>>();

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const tag = op.tags?.[0] ?? 'default';
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push({ method, path, op });
    }
  }

  const classes: string[] = [];
  for (const [tag, operations] of byTag) {
    const className = toClassName(tag);
    const methods = operations
      .map((o) => generateMethod(o.method, o.path, o.op))
      .join('\n\n');
    classes.push(`export class ${className} extends BaseClient {\n${methods}\n}`);
  }

  const tagNames = Array.from(byTag.keys()).map(toClassName);
  const factoryProps = tagNames
    .map((cn) => {
      const prop = cn.charAt(0).toLowerCase() + cn.slice(1, -3);
      return `  ${prop}: new ${cn}(config)`;
    })
    .join(',\n');

  return `/**
 * IHUI AI TypeScript SDK — 自动生成
 * 生成时间: ${new Date().toISOString()}
 * 请勿手动编辑, 由 scripts/generate-sdk.ts 生成
 */

import { BaseClient, type SdkConfig } from './index.js';

${classes.join('\n\n')}

export interface GeneratedClient {
${tagNames.map((cn) => `  ${cn.charAt(0).toLowerCase() + cn.slice(1, -3)}: ${cn};`).join('\n')}
}

export function createGeneratedClient(config: SdkConfig): GeneratedClient {
  return {
${factoryProps}
  };
}
`;
}

async function main(): Promise<void> {
  // 动态导入 buildServer (避免在纯脚本环境加载失败)
  let openapiSpec: OpenApiDoc;
  try {
    const { buildServer } = await import('../apps/api/src/server.js');
    const server = await buildServer();
    openapiSpec = server.swagger() as OpenApiDoc;
    await server.close();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[generate-sdk] 无法构建服务器, 使用占位 spec: ${msg}`);
    openapiSpec = {
      openapi: '3.0.0',
      info: { title: 'IHUI AI API', version: '1.0.0' },
      paths: {},
    };
  }

  const code = generateSdkCode(openapiSpec);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, code, 'utf-8');
  console.log(`✅ SDK 已生成: ${OUTPUT_PATH}`);
}

// 仅在直接执行时运行 main (非 import)
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error('SDK 生成失败:', err);
    process.exit(1);
  });
}
