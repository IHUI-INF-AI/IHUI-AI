// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/** 宿主 API 契约的稳定序列化与跨端签名比对(W4-07)。 */

import { assertHostApiContract } from './host-api-contract.js';
import type { HostApiContract, HostApiDrift } from './host-api-contract-types.js';

function sorted<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

/** 稳定序列化:服务/方法/事件/类型按名字排序,便于三端逐字节比对。 */
export function serializeHostApiContract(input: unknown): string {
  const contract = assertHostApiContract(input);
  return JSON.stringify(
    {
      version: contract.version,
      services: sorted(contract.services).map((service) => ({
        name: service.name,
        methods: sorted(service.methods),
        events: sorted(service.events),
      })),
      types: sorted(contract.types),
    },
    null,
    2,
  );
}

function collectMap<T extends { name: string }>(items: readonly T[], label: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.name)) throw new Error(`${label} 重名: ${item.name}`);
    map.set(item.name, item);
  }
  return map;
}

/** 对比两份契约;用于“构建时签名比对”,返回新增/删除/签名变化。 */
export function diffHostApiContracts(expected: HostApiContract, actual: HostApiContract): HostApiDrift[] {
  const a = assertHostApiContract(expected);
  const b = assertHostApiContract(actual);
  const drift: HostApiDrift[] = [];
  if (a.version !== b.version) {
    drift.push({ kind: 'version-changed', path: 'version', message: `${a.version} -> ${b.version}` });
  }

  const typeA = collectMap(a.types, '类型');
  const typeB = collectMap(b.types, '类型');
  for (const name of typeA.keys()) {
    if (!typeB.has(name)) drift.push({ kind: 'type-removed', path: `types.${name}`, message: `${name} 被删除` });
  }
  for (const name of typeB.keys()) {
    if (!typeA.has(name)) drift.push({ kind: 'type-added', path: `types.${name}`, message: `${name} 新增` });
  }

  const serviceA = collectMap(a.services, '服务');
  const serviceB = collectMap(b.services, '服务');
  for (const [name, left] of serviceA) {
    const right = serviceB.get(name);
    if (!right) {
      drift.push({ kind: 'service-removed', path: `services.${name}`, message: `${name} 被删除` });
      continue;
    }
    const methodA = collectMap(left.methods, '方法');
    const methodB = collectMap(right.methods, '方法');
    for (const [methodName, method] of methodA) {
      const next = methodB.get(methodName);
      if (!next) {
        drift.push({
          kind: 'method-removed',
          path: `services.${name}.methods.${methodName}`,
          message: `${methodName} 被删除`,
        });
      } else if (method.requestType !== next.requestType || method.responseType !== next.responseType) {
        drift.push({
          kind: 'method-signature-changed',
          path: `services.${name}.methods.${methodName}`,
          message: `${method.requestType}/${method.responseType} -> ${next.requestType}/${next.responseType}`,
        });
      }
    }
    for (const methodName of methodB.keys()) {
      if (!methodA.has(methodName)) {
        drift.push({
          kind: 'method-added',
          path: `services.${name}.methods.${methodName}`,
          message: `${methodName} 新增`,
        });
      }
    }

    const eventA = collectMap(left.events, '事件');
    const eventB = collectMap(right.events, '事件');
    for (const [eventName, event] of eventA) {
      const next = eventB.get(eventName);
      if (!next) {
        drift.push({
          kind: 'event-removed',
          path: `services.${name}.events.${eventName}`,
          message: `${eventName} 被删除`,
        });
      } else if (event.payloadType !== next.payloadType) {
        drift.push({
          kind: 'event-payload-changed',
          path: `services.${name}.events.${eventName}`,
          message: `${event.payloadType} -> ${next.payloadType}`,
        });
      }
    }
    for (const eventName of eventB.keys()) {
      if (!eventA.has(eventName)) {
        drift.push({
          kind: 'event-added',
          path: `services.${name}.events.${eventName}`,
          message: `${eventName} 新增`,
        });
      }
    }
  }
  for (const name of serviceB.keys()) {
    if (!serviceA.has(name)) drift.push({ kind: 'service-added', path: `services.${name}`, message: `${name} 新增` });
  }
  return drift;
}
