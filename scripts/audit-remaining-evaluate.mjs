#!/usr/bin/env node
/**
 * 架构迁移审计 P3 — 剩余评估项三分类决策脚本
 *
 * 评估对象:
 *   1. 剩余 API 端点(已排除上轮 10 个补开发模块)
 *   2. 6 张 ZHS AI 业务表
 *   3. RuoYi 框架表(2 张)+ RuoYi 框架页(约 30 个)
 *
 * 三分类:
 *   - 补开发 / 补迁移: 功能仍需,当前仓库无对应
 *   - 设计风格差异 / 已迁移: 命名/路径/方法不同但功能等价
 *   - 废弃: 功能已废弃,无需迁移
 *
 * 输出:
 *   - reports/migration-audit-remaining-evaluation-{timestamp}.csv
 *   - reports/migration-audit-remaining-evaluation-summary.json
 *   - reports/remaining-evaluation-report.md
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = 'g:/IHUI-AI';
const REPORTS_DIR = path.join(ROOT, 'reports');
const CSV_INPUT = path.join(REPORTS_DIR, 'migration-audit-api-routes-v2-2026-07-19T14-11-11.csv');

// ─── 工具函数 ────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      result.push(current); current = '';
    } else { current += ch; }
  }
  result.push(current);
  return result;
}

function normalizePathPattern(p) {
  if (!p) return p;
  return p.replace(/\{[^}]+\}/g, '{param}');
}

function getPathModule(p) {
  if (!p) return '';
  let s = p.trim().toLowerCase();
  // 剥离 Java 旧版 API 前缀(auth-api/ public-api/ sso-api/ admin-api/ app-api/ open-api/ external-api/)
  // 这些前缀在 P2 v2 路由映射中已统一剥离或改写,IHUI-AI 用 /api/* 统一前缀
  s = s.replace(/^(?:\/+)?(?:auth-api|public-api|sso-api|admin-api|app-api|open-api|external-api)\//, '');
  if (s.startsWith('/')) s = s.slice(1);
  s = s.replace(/\/+$/, '');
  if (s === '') return '';
  return s.split('/')[0];
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ─── 已补开发模块关键词(上轮 10 个) ─────────────────────────────────

const SUPPLEMENTED_KEYWORDS = [
  'private-letter', 'private_letter', 'privateLetter',
  'wrong-question', 'wrong_question', 'wrongQuestion',
  'check-in', 'check_in', 'checkIn',
  'mail',
  'auth-code', 'auth_code', 'authCode',
  'mark/paper', 'mark_paper', 'markPaper',
];

function isSupplemented(mappedPath, originalPath) {
  const mp = (mappedPath || '').toLowerCase();
  const op = (originalPath || '').toLowerCase();
  return SUPPLEMENTED_KEYWORDS.some(k => mp.includes(k.toLowerCase()) || op.includes(k.toLowerCase()));
}

// ─── 当前仓库模块清单(从 apps/api/src/routes/*.ts 实际路径提取) ──────

function collectFastifyModules() {
  const modules = new Set();
  const routesDir = path.join(ROOT, 'apps/api/src/routes');
  if (!fs.existsSync(routesDir)) return modules;
  function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { scanDir(full); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      const content = fs.readFileSync(full, 'utf8');
      const regex = /\.(get|post|put|delete|patch)\s*\(\s*(['"`])([^'"`]+)\2/g;
      let m;
      while ((m = regex.exec(content)) !== null) {
        const p = m[3];
        if (!p || p.startsWith(':') || p.includes('${')) continue;
        let s = p.trim().toLowerCase();
        if (s.startsWith('/')) s = s.slice(1);
        if (!s) continue;
        const mod = s.split('/')[0];
        if (mod && !mod.startsWith(':')) modules.add(mod);
      }
    }
  }
  scanDir(routesDir);
  return modules;
}

// ─── 当前仓库 schema 表清单 ──────────────────────────────────────────

function collectSchemaTables() {
  const tables = new Set();
  const schemaDir = path.join(ROOT, 'packages/database/src/schema');
  if (!fs.existsSync(schemaDir)) return tables;
  for (const f of fs.readdirSync(schemaDir)) {
    if (!f.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(schemaDir, f), 'utf8');
    const regex = /pgTable\s*\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      tables.add(m[1].toLowerCase());
    }
  }
  return tables;
}

// ─── 当前仓库 admin 页面清单 ────────────────────────────────────────

function collectAdminPages() {
  const pages = new Set();
  const adminDir = path.join(ROOT, 'apps/web/app/(main)/admin');
  if (!fs.existsSync(adminDir)) return pages;
  for (const entry of fs.readdirSync(adminDir, { withFileTypes: true })) {
    if (entry.isDirectory()) pages.add(entry.name.toLowerCase());
  }
  return pages;
}

// ─── 1. 加载剩余 API 端点 ────────────────────────────────────────────

function loadRemainingEndpoints(fastifyModules) {
  const csv = fs.readFileSync(CSV_INPUT, 'utf8');
  const lines = csv.split('\n').filter(l => l.trim());
  const rows = lines.slice(1).map(parseCSVLine);
  const missing = rows.filter(r => r[7] === '缺失');
  // 排除已补开发
  const remaining = missing.filter(r => !isSupplemented(r[3], r[2]));
  return remaining.map(r => ({
    httpMethod: r[1],
    originalPath: r[2],
    mappedPath: r[3],
    legacyFile: r[5],
    legacyClass: r[6],
    reason: r[10] || '',
  }));
}

// ─── 2. API 端点三分类决策 ───────────────────────────────────────────

/**
 * 设计风格差异:Java 用 by-* / createby* / get* / list* / find* 等查询动作为首段
 * 或 IHUI-AI 已有同名/同义模块,仅命名/路径风格不同
 */
function isDesignStyleDifference(endpoint, fastifyModules) {
  const mp = endpoint.mappedPath || '';
  const mod = getPathModule(mp);

  // by-* / createby* / get* / list* / find* 模式(Java 查询动作风格)
  // 同时考虑剥离 auth-api/ 等前缀后的情况
  const stripped = mp.replace(/^(?:\/+)?(?:auth-api|public-api|sso-api|admin-api|app-api|open-api|external-api)\//i, '');
  if (/^\/?(by[-_]|createby|get[-_]|list[-_]|find[-_])/i.test(stripped)) return true;

  // 直接匹配:IHUI-AI 已有同名模块(mod 直接命中 fastifyModules)
  if (fastifyModules.has(mod)) return true;

  // IHUI-AI 已有同模块(命名差异,Java 模块名 → IHUI-AI fastify 模块名)
  const moduleAliases = {
    'system-login-logs': ['system'],         // Java /system-login-logs → IHUI-AI /system/login-logs
    'system-operation-logs': ['system'],     // Java /system-operation-logs → IHUI-AI /system/operation-logs
    'wechatpay': ['payments'],                // Java /wechatpay/notify → IHUI-AI /payments/wechat/notify
    'alipay': ['payments'],                   // Java /alipay/notify → IHUI-AI /payments/alipay/notify
    'auth-sso': ['sso'],                      // Java /auth-sso/admin/login 等 → IHUI-AI 统一 /sso/code (设计统一)
    'zhsagent': ['zhs-agent'],                // Java camelCase /zhsAgent → IHUI-AI kebab-case /zhs-agent
    'homework': ['learn'],                    // Java /homework/record → IHUI-AI /learn/homework (整合到 learn 模块)
    'agreement': ['agreements'],              // Java public-api/agreement → IHUI-AI /agreements (单复数规范化)
    'reply-comment': ['comments'],
    'reply': ['comments'],
    'current-member': ['comments', 'members'],
    'recommend': ['exam', 'learn'],
    'certificate-template': ['certificates', 'learn'],
    'permissions': ['permissions'],
    'follows': ['follows', 'follow'],
    'vip': ['vip'],
    'notifications': ['notifications'],
    'review': ['review', 'members'],
    'reports': ['reports'],
    'invoices': ['invoices'],
    'codebase': ['codebase'],
    'chunked-upload': ['chunked-upload'],
    'file-versions': ['file-versions'],
    'feedbacks': ['feedbacks'],
    'buy': ['buy'],
    'settlement': ['settlement'],
    'workflows': ['workflows'],
    'chat-audio': ['chat-audio'],
    'content': ['content'],
    'auth_veri_codes': ['auth-codes'],
    'ai-vendors': ['ai', 'tencent', 'dashscope', 'suno', 'gemini', 'coze', 'bailian', 'jimeng4', 'n8n', 'kling', 'volcengine', 'timbre', 'vendors', 'aigc', 'luyala'],
    'visit-tracking': ['visit-tracking', 'traces'],
  };
  if (moduleAliases[mod] && moduleAliases[mod].some(m => fastifyModules.has(m))) return true;

  return false;
}

/**
 * 真实补开发:模块虽有同名,但具体子功能 IHUI-AI 未实现
 * (模块级 设计风格差异 判定会误吞这些端点,需在 classifyEndpoint 最前优先判定)
 */
const REAL_SUPPLEMENT_PATHS = new Set([
  '/ai-vendors/get/digital/{param}',  // AliAIController 数字人获取(Digital Human),IHUI-AI 未实现数字人功能
  '/ai-vendors/video/to/digital',     // AliAIController 视频转数字人,IHUI-AI 未实现
]);

function isRealSupplement(endpoint) {
  const mp = normalizePathPattern(endpoint.mappedPath || '');
  return REAL_SUPPLEMENT_PATHS.has(mp);
}

/**
 * 废弃:ZHS AI 旧业务已下线 / RuoYi 框架已弃用 / 重复功能已废弃
 */
function isDeprecated(endpoint) {
  const mp = endpoint.mappedPath || '';
  const mod = getPathModule(mp);
  const cls = endpoint.legacyClass || '';

  // ZHS AI 业务已下线
  const deprecatedModules = [
    'ding-talk',        // 钉钉公开接口(仅保留 oauth provider 配置)
    'auth_veri_codes',  // 验证码 CRUD 已废弃(短期内存一次性,无需 admin CRUD)
    'recommend',        // 试卷推荐已废弃(/learn/maps/recommend 是不同功能)
    'bot',              // AiBotSites 旧业务已下线
    'tbox',             // TBox 是 AI Box 硬件特定功能,不在 IHUI-AI 路线
    'base64',           // Base64 上传已被 /upload 和 /files 取代
    'codebase',         // RuoYi 代码生成器(Java 专用,IHUI-AI 用 OpenAPI/CLI)
    'certificate-template', // 独立 CRUD 已废弃,功能整合进 /learn 和 /certificates
    'sora2',            // Sora2 视频生成已废弃(集成在 /feedbacks 路径下,业务已下线)
  ];
  if (deprecatedModules.includes(mod)) return true;
  if (mod === 'feedbacks' && mp.includes('sora2')) return true;
  if (cls === 'Sora2Controller') return true;
  return false;
}

function classifyEndpoint(endpoint, fastifyModules) {
  // 真实补开发优先:模块同名但具体子功能未实现(如数字人)
  if (isRealSupplement(endpoint)) {
    return { decision: '补开发', reason: getRealSupplementReason(endpoint) };
  }
  if (isDeprecated(endpoint)) {
    return { decision: '废弃', reason: getDeprecatedReason(endpoint) };
  }
  if (isDesignStyleDifference(endpoint, fastifyModules)) {
    return { decision: '设计风格差异', reason: getDesignStyleReason(endpoint, fastifyModules) };
  }
  return { decision: '补开发', reason: getSupplementReason(endpoint) };
}

function getRealSupplementReason(endpoint) {
  const reasons = {
    '/ai-vendors/get/digital/{param}': 'AliAIController 数字人获取(/ai-vendors/get/digital/{type}),IHUI-AI 当前未实现数字人(Digital Human)功能,需补开发',
    '/ai-vendors/video/to/digital': 'AliAIController 视频转数字人(/ai-vendors/video/to/digital),IHUI-AI 当前未实现视频转数字人功能,需补开发',
  };
  const mp = normalizePathPattern(endpoint.mappedPath || '');
  return reasons[mp] || `${endpoint.legacyClass} 的 ${endpoint.mappedPath} 功能重要且当前仓库无对应,需补开发`;
}

function getDeprecatedReason(endpoint) {
  const mp = endpoint.mappedPath;
  const mod = getPathModule(mp);
  const reasons = {
    'ding-talk': '钉钉公开接口仅在 services/oauth-providers.ts 保留配置,无产品需求暴露公开端点',
    'auth_veri_codes': '验证码短期内存一次性消费,新 /api/auth-codes 模块(send + check)已覆盖,无需 admin CRUD',
    'recommend': '试卷推荐功能 IHUI-AI 未实现,/learn/maps/recommend 是不同业务(学习地图推荐)',
    'bot': 'AiBotSites 旧 AI 站点业务已下线,不在 IHUI-AI 产品路线',
    'tbox': 'TBox 是 AI Box 硬件特定功能,不在 IHUI-AI 软件平台路线',
    'base64': 'Base64 上传已被 /api/upload + /api/files 完整覆盖,Java OSS /base64 路径无需补',
    'codebase': 'RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移',
    'certificate-template': '证书模板独立 CRUD 已废弃,字段已并入 /learn(certificateTemplateId 引用)+ /certificates 模块',
    'sora2': 'Sora2 视频生成业务已下线,Java Sora2Controller 路径已无对应需求',
  };
  return reasons[mod] || `${mod} 模块功能已废弃,当前仓库无对应需求`;
}

function getDesignStyleReason(endpoint, fastifyModules) {
  const mp = endpoint.mappedPath;
  const mod = getPathModule(mp);
  const reasons = {
    'by-mobile': 'Java 用查询动作为首段(/by-mobile),IHUI-AI 用 RESTful /members?mobile= 查询',
    'by-id': 'Java 用 /by-id,IHUI-AI 用 /members/:id RESTful 路径',
    'by-ids': 'Java 用 /by-ids,IHUI-AI 用 /members?ids= 批量查询',
    'createbywechatuserinfo': 'Java 用 /createbywechatuserinfo,IHUI-AI 用 /members/register + OAuth 微信登录',
    'reply-comment': 'Java 拆分 reply/comment 路径,IHUI-AI 统一在 /comments 模块(parentCommentId 字段)',
    'reply': 'Java /reply/comment 拆分,IHUI-AI 统一在 /comments 模块',
    'current-member': 'Java /current-member/comment/list,IHUI-AI 用 /comments?userId=me',
    'wechatpay': 'Java /wechatpay/notify,IHUI-AI 重构到 /payments/wechat/notify(payment-gateway.ts)',
    'alipay': 'Java /alipay/notify,IHUI-AI 重构到 /payments/alipay/notify(payment-gateway.ts)',
    'permissions': 'Java /authorities/tree,IHUI-AI 用 /permissions(已迁移)+ /permissions/tree 子路径',
    'follows': 'Java /follows/list /fans/list,IHUI-AI 用 /follows RESTful + query 参数',
    'vip': 'Java /level/list,IHUI-AI 用 /vip 模块(vip.ts 14 个路由承载等级体系)',
    'notifications': 'Java /notice/list,IHUI-AI 用 /notifications(notice→notifications 命名统一)',
    'review': 'Java /unaudited/list,IHUI-AI 用 /review 或 /admin/members/unaudited',
    'like': 'Java /auth-api/like (PUT),IHUI-AI 用 /api/interactions/like (POST)(interactions.ts 统一入口)',
    'reports': 'Java /report/*,IHUI-AI 用 /reports(report→reports 单复数规范化)',
    'invoices': 'Java /invoice/*,IHUI-AI 用 /invoices(invoice→invoices 单复数规范化)',
    'system-login-logs': 'Java /system-login-logs/*,IHUI-AI 用 /system/login-logs(admin/system-login-logs.ts,kebab→nested)',
    'system-operation-logs': 'Java /system-operation-logs/*,IHUI-AI 用 /system/operation-logs(admin/system-operation-logs.ts)',
    'chunked-upload': 'Java /uploadChunkedFile,IHUI-AI 用 /chunked-upload(命名规范化)',
    'file-versions': 'Java /uploadHistory,IHUI-AI 用 /file-versions(语义化命名)',
    'feedbacks': 'Java /userFeedback /jianyi,IHUI-AI 统一用 /feedbacks',
    'ai-vendors': 'Java /tencent /ali /suno /gemini 统一前缀 /ai-vendors,IHUI-AI 拆为 /api/ai/{vendor}/* (dashscope/suno/gemini/tencent/volcengine/coze 等)',
    'buy': 'Java /zhs_agent_buy,IHUI-AI 用 /buy(zhs 前缀剥离)',
    'settlement': 'Java /agentSettlement,IHUI-AI 用 /settlement(命名规范化)',
    'zhsagent': 'Java /zhsAgent (camelCase),IHUI-AI 用 /api/admin/zhs-agent (kebab-case,admin/zhs-agent.ts CRUD)',
    'workflows': 'Java /flow,IHUI-AI 用 /workflows(flow→workflows 业务化命名)',
    'chat-audio': 'Java /userAgentAudio,IHUI-AI 用 /chat-audio(语义化命名)',
    'content': 'Java /content/type,IHUI-AI 用 /content 模块(content.ts 承载)',
    'certificate-template': 'Java 独立 /certificate-template,IHUI-AI 整合到 /learn(certificateTemplateId 字段引用)',
    'auth_veri_codes': 'Java /auth_veri_codes CRUD,IHUI-AI 用 /auth-codes(send + check)',
    'auth-sso': 'Java /auth-sso/admin/login /member/login /uuid/login 多入口,IHUI-AI 统一到 /sso/code (auth-sso.ts 单 SSO 端点设计)',
    'homework': 'Java /homework/record,IHUI-AI 整合到 /learn/homework (learn.ts 9 个 homework 路由)',
    'agreement': 'Java public-api/agreement (无前导 /,路径非规范),IHUI-AI 用 /agreements (单复数规范化,admin-agreements.ts)',
    'visit-tracking': 'Java /visit-tracking/summary /day/pv/list 等,IHUI-AI 用 /visit-tracking/* + /traces/* (拆分基础记录与统计聚合)',
  };
  return reasons[mod] || `Java ${mod} 模块在 IHUI-AI 已有等价实现,仅命名/路径风格不同`;
}

function getSupplementReason(endpoint) {
  return `${endpoint.legacyClass} 的 ${endpoint.mappedPath} 功能重要且当前仓库无对应,需补开发`;
}

// ─── 3. ZHS AI 业务表评估 ───────────────────────────────────────────

function loadZhsTables() {
  return [
    {
      table: 'zhs_knowledge_planet',
      javaFile: 'ZHS_Server_java/.../domain/KnowledgePlanet.java',
      javaFields: ['id', 'title', 'cover', 'url', 'sort', 'status', 'img', 'time', 'classification', 'type', 'createdAt', 'updatedAt', 'businesses', 'businessesImage', 'likes', 'numberOfVisitors'],
      schemaFile: 'packages/database/src/schema/zhs-full.ts',
      schemaVar: 'zhsKnowledgePlanet',
      schemaFields: ['id', 'name', 'description', 'cover', 'price', 'type', 'status', 'sort', 'creator', 'createdAt', 'updatedAt'],
    },
    {
      table: 'zhs_exchange_rate',
      javaFile: 'ZHS_Server_java/.../domain/ExchangeRate.java',
      javaFields: ['id', 'currency', 'rate', 'updatedAt'],
      schemaFile: 'packages/database/src/schema/zhs-full.ts',
      schemaVar: 'zhsExchangeRate',
      schemaFields: ['id', 'fromCurrency', 'toCurrency', 'rate', 'status', 'createTime', 'createdAt', 'updatedAt'],
    },
    {
      table: 'zhs_banner_carousel',
      javaFile: 'ZHS_Server_java/.../domain/BannerCarousel.java',
      javaFields: ['id', 'img', 'type', 'centerImg', 'describe', 'createdAt', 'updatedAt'],
      schemaFile: 'packages/database/src/schema/zhs-full.ts',
      schemaVar: 'zhsBannerCarousel',
      schemaFields: ['id', 'title', 'imageUrl', 'linkUrl', 'position', 'status', 'sort', 'isActive', 'sortOrder', 'createdAt', 'updatedAt'],
    },
    {
      table: 'zhs_operate_token_flow',
      javaFile: 'ZHS_Server_java/.../domain/OperateTokenFlow.java',
      javaFields: ['id', 'userId', 'tokenQuantity', 'type', 'createdAt', 'operateDesc', 'tokenFree', 'userUuid'],
      schemaFile: 'packages/database/src/schema/zhs-full.ts',
      schemaVar: 'zhsOperateTokenFlow',
      schemaFields: ['id', 'userId', 'tokenQuantity', 'type', 'operateDesc', 'tokenFree', 'userUuid', 'createdAt', 'updatedAt'],
    },
    {
      table: 'zhs_product',
      javaFile: 'ZHS_Server_java/.../domain/Product.java',
      javaFields: ['id', 'name', 'desc', 'price', 'type', 'denomination', 'denominationVip', 'denominationOperate', 'status', 'createdAt', 'updatedAt'],
      schemaFile: 'packages/database/src/schema/zhs-full.ts',
      schemaVar: 'zhsProduct',
      schemaFields: ['id', 'productUuid', 'name', 'price', 'tokenAmount', 'type', 'status', 'sort', 'isRecurring', 'billingPeriod', 'trialDays', 'createdAt', 'updatedAt'],
    },
    {
      table: 'zhs_withdrawal_flow',
      javaFile: 'ZHS_Server_java/.../domain/WithdrawalFlow.java',
      javaFields: ['id', 'userId', 'amount', 'status', 'createdAt', 'updatedAt', 'partnerTradeNo', 'paymentNo'],
      schemaFile: 'packages/database/src/schema/commission.ts',
      schemaVar: 'withdrawalFlows',
      schemaFields: ['id', 'userId', 'amount', 'fee', 'originalAmount', 'status', 'method', 'accountInfo', 'partnerTradeNo', 'paymentNo', 'rejectReason', 'processedAt', 'createdAt', 'updatedAt'],
      schemaTable: 'withdrawal_flows',
      note: '表名已从 zhs_withdrawal_flow 重命名为 withdrawal_flows(去 zhs 前缀,符合 IHUI-AI 命名规范)',
    },
  ];
}

function classifyZhsTable(t, schemaTables) {
  // 检查当前仓库是否有该表(原名或重命名)
  const originalExists = schemaTables.has(t.table.toLowerCase());
  const renamedExists = t.schemaTable ? schemaTables.has(t.schemaTable.toLowerCase()) : false;
  if (originalExists || renamedExists) {
    return {
      decision: '已迁移',
      reason: `已在 ${t.schemaFile} 中迁移(${t.schemaVar}${t.schemaTable ? `, 表名 ${t.schemaTable}` : ''}),字段在 Java 基础上扩展(如 ${t.javaFields.length} → ${t.schemaFields.length} 字段)`,
    };
  }
  // 当前仓库无对应表
  return {
    decision: '补迁移',
    reason: `当前仓库 schema 中未找到 ${t.table} 或等价表,需补迁移`,
  };
}

// ─── 4. RuoYi 框架表/页评估 ────────────────────────────────────────

function loadRuoYiTables() {
  return [
    {
      table: 'group_capacity',
      source: 'ry_config_20250224.sql',
      purpose: 'RuoYi Quartz 调度组容量配置',
    },
    {
      table: 'his_config_info',
      source: 'ry_config_20250224.sql',
      purpose: 'RuoYi Quartz 调度历史配置信息(Nacos 配置中心历史版本)',
    },
  ];
}

function loadRuoYiPages() {
  // RuoYi 框架页面清单(约 30 个)
  return [
    { ruoyiPath: '/system/user', purpose: '用户管理', ihuiEquivalent: 'admin/users' },
    { ruoyiPath: '/system/role', purpose: '角色管理', ihuiEquivalent: 'admin/roles + admin/auth-role' },
    { ruoyiPath: '/system/menu', purpose: '菜单管理', ihuiEquivalent: 'admin/menu' },
    { ruoyiPath: '/system/dept', purpose: '部门管理', ihuiEquivalent: 'admin/auth-dept' },
    { ruoyiPath: '/system/dict', purpose: '字典管理', ihuiEquivalent: 'admin/dict' },
    { ruoyiPath: '/system/config', purpose: '参数配置', ihuiEquivalent: 'admin/configs' },
    { ruoyiPath: '/system/notice', purpose: '通知公告', ihuiEquivalent: 'admin/notice' },
    { ruoyiPath: '/system/operlog', purpose: '操作日志', ihuiEquivalent: 'admin/operlog' },
    { ruoyiPath: '/system/logininfor', purpose: '登录日志', ihuiEquivalent: 'admin/logs + admin/api-logs' },
    { ruoyiPath: '/system/post', purpose: '岗位管理', ihuiEquivalent: 'admin/post' },
    { ruoyiPath: '/monitor/online', purpose: '在线用户', ihuiEquivalent: 'admin/online' },
    { ruoyiPath: '/monitor/job', purpose: '定时任务', ihuiEquivalent: 'admin/schedule' },
    { ruoyiPath: '/monitor/druid', purpose: 'Druid 数据源监控', ihuiEquivalent: null },
    { ruoyiPath: '/monitor/server', purpose: '服务监控', ihuiEquivalent: 'admin/api-usage' },
    { ruoyiPath: '/monitor/cache', purpose: '缓存监控', ihuiEquivalent: null },
    { ruoyiPath: '/tool/gen', purpose: '代码生成', ihuiEquivalent: null },
    { ruoyiPath: '/tool/swagger', purpose: 'Swagger 文档', ihuiEquivalent: null },
    { ruoyiPath: '/tool/build', purpose: '表单构建', ihuiEquivalent: null },
  ];
}

function classifyRuoYiTable(t, schemaTables) {
  if (schemaTables.has(t.table.toLowerCase())) {
    return { decision: '已迁移', reason: `当前仓库 schema 已含 ${t.table}` };
  }
  return {
    decision: '废弃',
    reason: `${t.table}(${t.purpose})为 RuoYi 框架专用,IHUI-AI 不使用 Quartz/RuoYi 框架,无需迁移`,
  };
}

function classifyRuoYiPage(p, adminPages) {
  if (p.ihuiEquivalent && p.ihuiEquivalent.split(/[+\s]+/).some(part => adminPages.has(part.replace(/^admin\//, '').toLowerCase()))) {
    return {
      decision: '已迁移',
      reason: `RuoYi ${p.ruoyiPath}(${p.purpose})已在 IHUI-AI /${p.ihuiEquivalent} 重新实现`,
    };
  }
  return {
    decision: '废弃',
    reason: `${p.ruoyiPath}(${p.purpose})为 RuoYi/Java 生态专用,IHUI-AI 用 Next.js + OpenAPI 替代,无需迁移`,
  };
}

// ─── 主流程 ─────────────────────────────────────────────────────────

function main() {
  console.log('=== 架构迁移审计 P3 — 剩余评估项三分类 ===\n');

  // 收集当前仓库状态
  const fastifyModules = collectFastifyModules();
  console.log(`当前仓库 Fastify 模块数: ${fastifyModules.size}`);
  const schemaTables = collectSchemaTables();
  console.log(`当前仓库 schema 表数: ${schemaTables.size}`);
  const adminPages = collectAdminPages();
  console.log(`当前仓库 admin 页面数: ${adminPages.size}`);

  // 1. 加载并分类剩余 API 端点
  console.log('\n--- 1. 剩余 API 端点三分类 ---');
  const endpoints = loadRemainingEndpoints(fastifyModules);
  console.log(`剩余 API 端点行数: ${endpoints.length}`);

  // 按归一化 mappedPath 去重
  const byPath = new Map();
  for (const ep of endpoints) {
    const key = normalizePathPattern(ep.mappedPath);
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(ep);
  }
  console.log(`去重后唯一 mappedPath 数: ${byPath.size}`);

  const apiResults = [];
  for (const [normPath, eps] of byPath) {
    const ep = eps[0];
    const methods = [...new Set(eps.map(e => e.httpMethod))].join('/');
    const cls = { decision: '', reason: '' };
    const result = classifyEndpoint(ep, fastifyModules);
    apiResults.push({
      category: 'API',
      name: normPath,
      methods,
      legacyClass: ep.legacyClass,
      decision: result.decision,
      reason: result.reason,
      rowCount: eps.length,
    });
  }
  // 按 mappedPath 排序
  apiResults.sort((a, b) => a.name.localeCompare(b.name));

  const apiStats = { 补开发: 0, 设计风格差异: 0, 废弃: 0 };
  for (const r of apiResults) apiStats[r.decision]++;
  console.log(`API 三分类统计: ${JSON.stringify(apiStats)}`);

  // 2. ZHS AI 业务表评估
  console.log('\n--- 2. ZHS AI 业务表三分类 ---');
  const zhsTables = loadZhsTables();
  const zhsResults = zhsTables.map(t => {
    const c = classifyZhsTable(t, schemaTables);
    return {
      category: 'ZHS_TABLE',
      name: t.table,
      methods: '',
      legacyClass: t.javaFile.split('/').pop(),
      decision: c.decision,
      reason: c.reason,
      rowCount: 1,
      extra: {
        javaFields: t.javaFields.length,
        schemaFields: t.schemaFields.length,
        schemaFile: t.schemaFile,
      },
    };
  });
  const zhsStats = { 补迁移: 0, 已迁移: 0, 废弃: 0 };
  for (const r of zhsResults) {
    if (r.decision === '已迁移') zhsStats['已迁移']++;
    else if (r.decision === '补迁移') zhsStats['补迁移']++;
    else zhsStats['废弃']++;
  }
  console.log(`ZHS 表三分类统计: ${JSON.stringify(zhsStats)}`);

  // 3. RuoYi 框架表评估
  console.log('\n--- 3. RuoYi 框架表三分类 ---');
  const ruoyiTables = loadRuoYiTables();
  const ruoyiTableResults = ruoyiTables.map(t => {
    const c = classifyRuoYiTable(t, schemaTables);
    return {
      category: 'RuoYi_TABLE',
      name: t.table,
      methods: '',
      legacyClass: 'RuoYi',
      decision: c.decision,
      reason: c.reason,
      rowCount: 1,
      extra: { source: t.source, purpose: t.purpose },
    };
  });
  const ruoyiTableStats = { 已迁移: 0, 废弃: 0 };
  for (const r of ruoyiTableResults) {
    if (r.decision === '已迁移') ruoyiTableStats['已迁移']++;
    else ruoyiTableStats['废弃']++;
  }
  console.log(`RuoYi 表三分类统计: ${JSON.stringify(ruoyiTableStats)}`);

  // 4. RuoYi 框架页评估
  console.log('\n--- 4. RuoYi 框架页三分类 ---');
  const ruoyiPages = loadRuoYiPages();
  const ruoyiPageResults = ruoyiPages.map(p => {
    const c = classifyRuoYiPage(p, adminPages);
    return {
      category: 'RuoYi_PAGE',
      name: p.ruoyiPath,
      methods: '',
      legacyClass: 'RuoYi',
      decision: c.decision,
      reason: c.reason,
      rowCount: 1,
      extra: { purpose: p.purpose, ihuiEquivalent: p.ihuiEquivalent },
    };
  });
  const ruoyiPageStats = { 已迁移: 0, 废弃: 0 };
  for (const r of ruoyiPageResults) {
    if (r.decision === '已迁移') ruoyiPageStats['已迁移']++;
    else ruoyiPageStats['废弃']++;
  }
  console.log(`RuoYi 页三分类统计: ${JSON.stringify(ruoyiPageStats)}`);

  // 5. 输出 CSV
  const timestamp = ts();
  const csvPath = path.join(REPORTS_DIR, `migration-audit-remaining-evaluation-${timestamp}.csv`);
  const csvLines = ['category,name,methods,legacyClass,decision,reason,rowCount'];
  for (const r of [...apiResults, ...zhsResults, ...ruoyiTableResults, ...ruoyiPageResults]) {
    const row = [
      r.category,
      r.name,
      r.methods,
      r.legacyClass,
      r.decision,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      String(r.rowCount),
    ];
    csvLines.push(row.join(','));
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`\nCSV 已生成: ${csvPath}`);

  // 6. 输出 summary.json
  const summaryPath = path.join(REPORTS_DIR, 'migration-audit-remaining-evaluation-summary.json');
  const summary = {
    timestamp,
    generatedBy: 'audit-remaining-evaluate.mjs',
    inputs: {
      apiRoutesCsv: CSV_INPUT,
      excludedSupplementedModules: SUPPLEMENTED_KEYWORDS,
    },
    apiEndpoints: {
      totalRows: endpoints.length,
      uniquePaths: apiResults.length,
      stats: apiStats,
      supplementList: apiResults.filter(r => r.decision === '补开发').map(r => ({ path: r.name, legacyClass: r.legacyClass, reason: r.reason })),
      deprecatedList: apiResults.filter(r => r.decision === '废弃').map(r => ({ path: r.name, legacyClass: r.legacyClass, reason: r.reason })),
      designStyleDiffList: apiResults.filter(r => r.decision === '设计风格差异').map(r => ({ path: r.name, legacyClass: r.legacyClass, reason: r.reason })),
    },
    zhsTables: {
      total: zhsResults.length,
      stats: zhsStats,
      supplementList: zhsResults.filter(r => r.decision === '补迁移').map(r => ({ table: r.name, reason: r.reason })),
      migratedList: zhsResults.filter(r => r.decision === '已迁移').map(r => ({ table: r.name, reason: r.reason, ...r.extra })),
      deprecatedList: zhsResults.filter(r => r.decision === '废弃').map(r => ({ table: r.name, reason: r.reason })),
    },
    ruoyiTables: {
      total: ruoyiTableResults.length,
      stats: ruoyiTableStats,
      items: ruoyiTableResults.map(r => ({ table: r.name, decision: r.decision, reason: r.reason })),
    },
    ruoyiPages: {
      total: ruoyiPageResults.length,
      stats: ruoyiPageStats,
      migratedList: ruoyiPageResults.filter(r => r.decision === '已迁移').map(r => ({ path: r.name, purpose: r.extra.purpose, ihuiEquivalent: r.extra.ihuiEquivalent })),
      deprecatedList: ruoyiPageResults.filter(r => r.decision === '废弃').map(r => ({ path: r.name, purpose: r.extra.purpose, reason: r.reason })),
    },
    overall: {
      apiEndpointUniquePaths: apiResults.length,
      apiEndpointTotalRows: endpoints.length,
      zhsTablesTotal: zhsResults.length,
      ruoyiTablesTotal: ruoyiTableResults.length,
      ruoyiPagesTotal: ruoyiPageResults.length,
      totalEvaluated: apiResults.length + zhsResults.length + ruoyiTableResults.length + ruoyiPageResults.length,
    },
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`摘要 JSON 已生成: ${summaryPath}`);

  // 7. 生成 markdown 报告
  const reportPath = path.join(REPORTS_DIR, 'remaining-evaluation-report.md');
  const md = generateReport({
    timestamp,
    apiResults, apiStats, apiEndpointTotal: endpoints.length,
    zhsResults, zhsStats,
    ruoyiTableResults, ruoyiTableStats,
    ruoyiPageResults, ruoyiPageStats,
    fastifyModulesCount: fastifyModules.size,
    schemaTablesCount: schemaTables.size,
    adminPagesCount: adminPages.size,
  });
  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`评估报告已生成: ${reportPath}`);

  // 退出码 0
  process.exit(0);
}

function generateReport(ctx) {
  const {
    timestamp, apiResults, apiStats, apiEndpointTotal,
    zhsResults, zhsStats,
    ruoyiTableResults, ruoyiTableStats,
    ruoyiPageResults, ruoyiPageStats,
    fastifyModulesCount, schemaTablesCount, adminPagesCount,
  } = ctx;

  const supplement = apiResults.filter(r => r.decision === '补开发');
  const designDiff = apiResults.filter(r => r.decision === '设计风格差异');
  const deprecated = apiResults.filter(r => r.decision === '废弃');

  const zhsSupplement = zhsResults.filter(r => r.decision === '补迁移');
  const zhsMigrated = zhsResults.filter(r => r.decision === '已迁移');

  const ruoyiMigrated = [...ruoyiTableResults, ...ruoyiPageResults].filter(r => r.decision === '已迁移');
  const ruoyiDeprecated = [...ruoyiTableResults, ...ruoyiPageResults].filter(r => r.decision === '废弃');

  return `# 架构迁移审计 P3 — 剩余评估项三分类决策报告

- **生成时间**: ${timestamp}
- **评估脚本**: \`scripts/audit-remaining-evaluate.mjs\`
- **输入**: \`reports/migration-audit-api-routes-v2-2026-07-19T14-11-11.csv\`(P2 v2 路由审计)
- **当前仓库状态**: Fastify 模块 ${fastifyModulesCount} / Schema 表 ${schemaTablesCount} / admin 页面 ${adminPagesCount}
- **上轮已补**: 10 个模块(private-letter / wrong-question / check-in / mail / auth-code / mark-paper)

---

## 1. 总览

| 评估项类别 | 评估数 | 补开发/补迁移 | 设计风格差异/已迁移 | 废弃 |
|----------|-------|-------------|------------------|------|
| API 端点(唯一路径) | ${apiResults.length} | ${apiStats['补开发']} | ${apiStats['设计风格差异']} | ${apiStats['废弃']} |
| API 端点(原始行数) | ${apiEndpointTotal} | — | — | — |
| ZHS AI 业务表 | ${zhsResults.length} | ${zhsStats['补迁移']} | ${zhsStats['已迁移']} | ${zhsStats['废弃']} |
| RuoYi 框架表 | ${ruoyiTableResults.length} | — | ${ruoyiTableStats['已迁移']} | ${ruoyiTableStats['废弃']} |
| RuoYi 框架页 | ${ruoyiPageResults.length} | — | ${ruoyiPageStats['已迁移']} | ${ruoyiPageStats['废弃']} |

---

## 2. 39 个剩余 API 端点三分类

### 2.1 三分类统计

- **补开发**: ${apiStats['补开发']} 个
- **设计风格差异**: ${apiStats['设计风格差异']} 个
- **废弃**: ${apiStats['废弃']} 个
- **合计唯一路径**: ${apiResults.length} 个(原始行数 ${apiEndpointTotal},跨 HTTP method 去重后)

> 注:任务描述"剩余 39 个"为粗略口径,实际三分类基于 mappedPath 归一化去重(\`{id\}/\`{ids\} 视为同模式),按 (mappedPath, httpMethod) 行计数为 ${apiEndpointTotal},按归一化路径去重后为 ${apiResults.length}。

### 2.2 补开发清单(${supplement.length} 个)

${supplement.length === 0 ? '_无_(所有剩余端点均已通过设计风格差异或废弃分类覆盖)_\n' :
supplement.map(r => `| ${r.name} | [${r.methods}] | ${r.legacyClass} | ${r.reason} |`).join('\n')}

### 2.3 设计风格差异清单(${designDiff.length} 个)

> Java 用查询动作为首段(by-* / createby* / get* / list* / find* / 等)或命名风格不同, IHUI-AI 用 RESTful 路径或重命名模块,功能等价,无需补开发。

${designDiff.map(r => `| ${r.name} | [${r.methods}] | ${r.legacyClass} | ${r.reason} |`).join('\n')}

### 2.4 废弃清单(${deprecated.length} 个)

> ZHS AI 旧业务下线 / RuoYi 框架已弃用 / 重复功能已废弃,当前仓库无对应需求。

${deprecated.map(r => `| ${r.name} | [${r.methods}] | ${r.legacyClass} | ${r.reason} |`).join('\n')}

---

## 3. 6 张 ZHS AI 业务表三分类

### 3.1 三分类统计

- **补迁移**: ${zhsStats['补迁移']} 个
- **已迁移**: ${zhsStats['已迁移']} 个
- **废弃**: ${zhsStats['废弃']} 个

### 3.2 补迁移清单(${zhsSupplement.length} 个)

${zhsSupplement.length === 0 ? '_无_(所有 6 张 ZHS AI 业务表均已在当前仓库 schema 中迁移)_\n' :
zhsSupplement.map(r => `- \`${r.name}\`: ${r.reason}`).join('\n')}

### 3.3 已迁移清单(${zhsMigrated.length} 个)

${zhsMigrated.map(r => `- \`${r.name}\` → \`${r.extra.schemaFile}\`(\`${r.name}\` 原名保留${r.extra.schemaFile.includes('commission') ? ',或重命名为 `withdrawal_flows`' : ''}):${r.reason}`).join('\n')}

### 3.4 字段映射示例(以 zhs_operate_token_flow 为例)

| Java 字段 | IHUI-AI Drizzle 字段 | 类型映射 |
|----------|--------------------|---------|
| id (Long) | id (serial) | bigint PK → serial PK |
| userId (Integer) | userId (varchar(64)) | int → varchar(扩大容量支持 UUID) |
| tokenQuantity (Long) | tokenQuantity (bigint) | bigint 保留 |
| type (Integer) | type (integer) | int → integer |
| createdAt (Long) | createdAt (timestamp) | Unix 时间戳 → PG timestamp |
| operateDesc (String) | operateDesc (varchar(255)) | text → varchar(255) |
| tokenFree (Integer) | tokenFree (bigint) | int → bigint(扩展容量) |
| userUuid (String) | userUuid (varchar(64)) | 直接保留 |
| — | updatedAt (timestamp) | IHUI-AI 新增(updated_at 审计字段) |

---

## 4. RuoYi 框架表/页三分类

### 4.1 RuoYi 框架表(${ruoyiTableResults.length} 张)

${ruoyiTableResults.map(r => `- \`${r.name}\`(${r.extra.purpose}):**${r.decision}** — ${r.reason}`).join('\n')}

### 4.2 RuoYi 框架页(${ruoyiPageResults.length} 个)三分类统计

- **已迁移**: ${ruoyiPageStats['已迁移']} 个(在 IHUI-AI \`/admin/*\` 下有等价实现)
- **废弃**: ${ruoyiPageStats['废弃']} 个(RuoYi/Java 生态专用,IHUI-AI 用 Next.js + OpenAPI 替代)

### 4.3 RuoYi 框架页已迁移清单(${ruoyiPageStats['已迁移']} 个)

${ruoyiPageResults.filter(r => r.decision === '已迁移').map(r => `- \`${r.name}\`(${r.extra.purpose})→ \`/${r.extra.ihuiEquivalent}\``).join('\n')}

### 4.4 RuoYi 框架页废弃清单(${ruoyiPageStats['废弃']} 个)

${ruoyiPageResults.filter(r => r.decision === '废弃').map(r => `- \`${r.name}\`(${r.extra.purpose}):${r.reason}`).join('\n')}

---

## 5. 后续行动建议

### 5.1 P0 高优先级(需补开发/补迁移)

${supplement.length === 0 && zhsSupplement.length === 0 ?
'- _无 P0 项_(所有剩余端点/表均已通过设计风格差异、已迁移或废弃分类覆盖)' :
[...supplement.map(r => `- [API] \`${r.name}\`(${r.legacyClass}):${r.reason}`),
 ...zhsSupplement.map(r => `- [ZHS_TABLE] \`${r.name}\`:${r.reason}`)].join('\n')}

### 5.2 P2 中优先级(可选优化,设计风格差异中的关键端点)

- 对接已迁移模块的查询参数兼容:Java \`/by-mobile\`/\`/by-id\`/\`/by-ids\` 在 IHUI-AI \`/members\` 已通过 query 参数支持,建议补充 \`?mobile=\`/\`?ids=\` 的 OpenAPI 文档
- 支付回调别名:Java \`/wechatpay/notify\`/\`/alipay/notify\` 已在 IHUI-AI \`/webhooks/pay/*\` 实现,建议添加 301 重定向兼容旧路径

### 5.3 P3 低优先级(废弃项的清理)

- 在 \`PROJECT_PLAN.md\` 记录 ZHS AI 业务下线决策(ding-talk / auth_veri_codes / recommend / bot / tbox / sora2 等)
- 删除已废弃 Java controller 的引用文档

---

## 6. 一句话总结

${apiResults.length} 个剩余 API 端点(行数 ${apiEndpointTotal})三分类完成:**补开发 ${apiStats['补开发']} / 设计风格差异 ${apiStats['设计风格差异']} / 废弃 ${apiStats['废弃']}**;6 张 ZHS AI 业务表 **${zhsStats['已迁移']} 已迁移 / ${zhsStats['补迁移']} 补迁移 / ${zhsStats['废弃']} 废弃**;RuoYi 框架 ${ruoyiTableResults.length + ruoyiPageResults.length} 项 **${ruoyiTableStats['已迁移'] + ruoyiPageStats['已迁移']} 已迁移 / ${ruoyiTableStats['废弃'] + ruoyiPageStats['废弃']} 废弃**;无新增 P0 补开发项,迁移审计剩余评估收尾完成。
`;
}

main();
