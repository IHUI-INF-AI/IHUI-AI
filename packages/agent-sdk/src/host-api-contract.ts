// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 宿主 API 契约(W4-07)—— 服务方法、生命周期事件、payload 类型三者同源。
 *
 * 本轮只收口 `session / turn / tool / prompt` 四个高频面;不承诺 21 个服务一次到位。
 * 两条硬规矩:
 *   1. 每个事件必须指向一个已声明的 payload 类型 —— 没有类型的“裸事件”一律拒;
 *   2. 方法/事件的请求与响应类型也必须是已声明类型 —— 悬空引用不靠调用方猜。
 */

export * from './host-api-contract-types.js';

import { HostApiContractError } from './host-api-contract-types.js';
import type {
  HostApiContract,
  HostApiIssue,
  HostApiValidateResult,
} from './host-api-contract-types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function namePattern(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9._/-]*$/.test(name);
}

function checkContract(input: unknown): HostApiIssue[] {
  if (!isRecord(input)) return [{ path: '$', code: 'invalid-contract', message: '契约必须是对象' }];
  const issues: HostApiIssue[] = [];
  if (!Number.isInteger(input.version) || (input.version as number) <= 0) {
    issues.push({ path: 'version', code: 'invalid-version', message: 'version 必须是正整数' });
  }
  if (!Array.isArray(input.services) || !Array.isArray(input.types)) {
    return [{ path: '$', code: 'invalid-contract', message: 'services/types 必须是数组' }];
  }

  const typeNames = new Set<string>();
  const voidTypes = new Set<string>();
  for (const [i, rawType] of input.types.entries()) {
    if (!isRecord(rawType) || !nonEmptyString(rawType.name)) {
      issues.push({ path: `types[${i}]`, code: 'invalid-name', message: '类型必须有非空 name' });
      continue;
    }
    if (typeNames.has(rawType.name)) {
      issues.push({ path: `types[${i}]`, code: 'duplicate-type', message: `类型 ${rawType.name} 重复` });
    }
    typeNames.add(rawType.name);
    if (rawType.shape === 'void') voidTypes.add(rawType.name);
    if (typeof rawType.shape !== 'string') {
      issues.push({ path: `types[${i}].shape`, code: 'invalid-contract', message: 'shape 必须是字符串' });
    }
  }

  const serviceNames = new Set<string>();
  const methodNames = new Set<string>();
  const eventNames = new Set<string>();
  for (const [si, rawService] of input.services.entries()) {
    if (!isRecord(rawService) || !nonEmptyString(rawService.name)) {
      issues.push({ path: `services[${si}]`, code: 'invalid-name', message: '服务必须有非空 name' });
      continue;
    }
    if (serviceNames.has(rawService.name)) {
      issues.push({ path: `services[${si}]`, code: 'duplicate-service', message: `服务 ${rawService.name} 重复` });
    }
    serviceNames.add(rawService.name);
    if (!Array.isArray(rawService.methods) || !Array.isArray(rawService.events)) {
      issues.push({ path: `services[${si}]`, code: 'invalid-contract', message: 'methods/events 必须是数组' });
      continue;
    }
    if (rawService.methods.length === 0) {
      issues.push({ path: `services[${si}]`, code: 'empty-service', message: '服务至少要有一个方法' });
    }
    for (const [mi, rawMethod] of rawService.methods.entries()) {
      const path = `services[${si}].methods[${mi}]`;
      if (!isRecord(rawMethod) || !nonEmptyString(rawMethod.name)) {
        issues.push({ path, code: 'invalid-name', message: '方法必须有非空 name' });
        continue;
      }
      if (!namePattern(rawMethod.name)) {
        issues.push({ path: `${path}.name`, code: 'invalid-name', message: `方法名不合法: ${rawMethod.name}` });
      }
      if (methodNames.has(rawMethod.name)) {
        issues.push({ path, code: 'duplicate-method', message: `方法 ${rawMethod.name} 重复` });
      }
      methodNames.add(rawMethod.name);
      for (const field of ['requestType', 'responseType'] as const) {
        if (!nonEmptyString(rawMethod[field]) || !typeNames.has(rawMethod[field])) {
          issues.push({
            path: `${path}.${field}`,
            code: 'missing-type',
            message: `方法 ${rawMethod.name} 的 ${field} 未声明类型`,
          });
        }
      }
    }
    for (const [ei, rawEvent] of rawService.events.entries()) {
      const path = `services[${si}].events[${ei}]`;
      if (!isRecord(rawEvent) || !nonEmptyString(rawEvent.name)) {
        issues.push({ path, code: 'invalid-name', message: '事件必须有非空 name' });
        continue;
      }
      if (eventNames.has(rawEvent.name)) {
        issues.push({ path, code: 'duplicate-event', message: `事件 ${rawEvent.name} 重复` });
      }
      eventNames.add(rawEvent.name);
      if (
        !nonEmptyString(rawEvent.payloadType) ||
        !typeNames.has(rawEvent.payloadType) ||
        voidTypes.has(rawEvent.payloadType)
      ) {
        issues.push({
          path: `${path}.payloadType`,
          code: 'missing-event-payload',
          message: `事件 ${rawEvent.name} 的 payload 类型必须是已声明的非 void 类型`,
        });
      }
    }
  }
  return issues;
}

/** 全量校验;失败返回逐条 issue,不抛错。 */
export function validateHostApiContract(input: unknown): HostApiValidateResult {
  const issues = checkContract(input);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, contract: input as HostApiContract };
}

/** 校验失败即抛;成功返回原契约。 */
export function assertHostApiContract(input: unknown): HostApiContract {
  const result = validateHostApiContract(input);
  if (!result.ok) throw new HostApiContractError(result.issues);
  return result.contract;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
