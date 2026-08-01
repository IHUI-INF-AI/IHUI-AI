(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["chunks/[root-of-the-server]__0a058809._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/packages/shared/src/utils/jwt-utils.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "base64UrlDecode",
    ()=>base64UrlDecode,
    "readExp",
    ()=>readExp
]);
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/**
 * 原生 atob 引用(模块加载时一次性捕获)。
 * web 端存在原生 atob;mobile-rn Hermes / 旧版环境无。
 */ const nativeAtob = typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function' ? globalThis.atob : undefined;
/**
 * 原生 TextDecoder 构造器引用。
 * web 端 / RN 0.71+ 存在;旧版 Hermes 无。
 */ const NativeTextDecoder = typeof globalThis !== 'undefined' && 'TextDecoder' in globalThis ? globalThis.TextDecoder : undefined;
/** 纯 JS atob polyfill(对称反向解码,兼容 Hermes 等无 atob 环境)。 */ function atobPolyfill(input) {
    const cleanInput = input.replace(/=+$/, '');
    let result = '';
    let i = 0;
    while(i < cleanInput.length){
        const a = BASE64_CHARS.indexOf(cleanInput[i++] || '');
        const b = BASE64_CHARS.indexOf(cleanInput[i++] || '');
        const c = BASE64_CHARS.indexOf(cleanInput[i++] || '');
        const d = BASE64_CHARS.indexOf(cleanInput[i++] || '');
        if (a < 0 || b < 0) break;
        result += String.fromCharCode(a << 2 | b >> 4);
        if (c >= 0) result += String.fromCharCode((b & 15) << 4 | c >> 2);
        if (d >= 0) result += String.fromCharCode((c & 3) << 6 | d);
    }
    return result;
}
/** UTF-8 解码:优先用原生 TextDecoder,缺失时回退到纯 JS polyfill。 */ function utf8Decode(bytes) {
    if (NativeTextDecoder) return new NativeTextDecoder().decode(bytes);
    let result = '';
    let i = 0;
    while(i < bytes.length){
        const b = bytes[i++] || 0;
        if (b < 0x80) {
            result += String.fromCharCode(b);
        } else if (b < 0xe0) {
            const b2 = bytes[i++] || 0;
            result += String.fromCharCode((b & 0x1f) << 6 | b2 & 0x3f);
        } else if (b < 0xf0) {
            const b2 = bytes[i++] || 0;
            const b3 = bytes[i++] || 0;
            result += String.fromCharCode((b & 0x0f) << 12 | (b2 & 0x3f) << 6 | b3 & 0x3f);
        } else {
            const b2 = bytes[i++] || 0;
            const b3 = bytes[i++] || 0;
            const b4 = bytes[i++] || 0;
            const codepoint = (b & 0x07) << 18 | (b2 & 0x3f) << 12 | (b3 & 0x3f) << 6 | b4 & 0x3f;
            const adjusted = codepoint - 0x10000;
            result += String.fromCharCode(0xd800 | adjusted >> 10, 0xdc00 | adjusted & 0x3ff);
        }
    }
    return result;
}
function base64UrlDecode(input) {
    const s = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = s + '='.repeat((4 - s.length % 4) % 4);
    const binary = nativeAtob ? nativeAtob(padded) : atobPolyfill(padded);
    const bytes = Uint8Array.from(binary, (c)=>c.charCodeAt(0));
    return utf8Decode(bytes);
}
function readExp(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadPart = parts[1];
    if (!payloadPart) return null;
    try {
        const decoded = JSON.parse(base64UrlDecode(payloadPart));
        return typeof decoded.exp === 'number' ? decoded.exp : null;
    } catch  {
        return null;
    }
}
}),
"[project]/apps/web/src/lib/auth-utils.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "decodeUserFromToken",
    ()=>decodeUserFromToken,
    "getRedirectPath",
    ()=>getRedirectPath,
    "isAdmin",
    ()=>isAdmin,
    "isAuthenticated",
    ()=>isAuthenticated,
    "verifyAccessTokenEdge",
    ()=>verifyAccessTokenEdge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$jwt$2d$utils$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/jwt-utils.ts [middleware-edge] (ecmascript)");
;
function decodeUserFromToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadPart = parts[1];
    if (!payloadPart) return null;
    try {
        return JSON.parse((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$jwt$2d$utils$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["base64UrlDecode"])(payloadPart));
    } catch  {
        return null;
    }
}
function isAdmin(user) {
    if (!user) return false;
    if (typeof user.roleId === 'number' && user.roleId >= 1) return true;
    if (typeof user.role === 'string') {
        const r = user.role.toLowerCase();
        return r === 'admin' || r === 'administrator';
    }
    return false;
}
function isAuthenticated(token) {
    if (!token) return false;
    const user = decodeUserFromToken(token);
    if (!user) return false;
    if (typeof user.exp === 'number') {
        const now = Math.floor(Date.now() / 1000);
        if (now >= user.exp) return false;
    }
    return true;
}
function getRedirectPath(request) {
    const redirect = request.nextUrl.searchParams.get('redirect');
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
        return redirect;
    }
    return '/';
}
// ---------------------------------------------------------------------------
// Edge Runtime 兼容的轻量级 JWT 验签(Web Crypto API)
// ---------------------------------------------------------------------------
const EDGE_ISSUER = 'ihui-ai';
const EDGE_AUDIENCE = 'ihui-ai-users';
/** 恒定时间字符串比较(防 timing attack) */ function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for(let i = 0; i < a.length; i++){
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
function getJwtSecretBytes() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT_SECRET 未设置或强度不足(>=32 字符)');
    }
    return new TextEncoder().encode(secret);
}
/** ArrayBuffer → base64url string(无 padding),用于 HMAC 签名编码 */ function arrayBufferToBase64Url(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for(let i = 0; i < bytes.length; i++){
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function verifyAccessTokenEdge(token) {
    if (!token) return null;
    const parts = token.split('.');
    const [headerB64, payloadB64, signatureB64] = parts;
    if (!headerB64 || !payloadB64 || !signatureB64) return null;
    // 1. 解析 header,校验 alg
    let header;
    try {
        header = JSON.parse((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$jwt$2d$utils$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["base64UrlDecode"])(headerB64));
    } catch  {
        return null;
    }
    if (header.alg !== 'HS256') return null;
    // 2. HMAC-SHA256 计算期望签名,恒定时间比较
    let expectedSig;
    try {
        const key = await crypto.subtle.importKey('raw', getJwtSecretBytes(), {
            name: 'HMAC',
            hash: 'SHA-256'
        }, false, [
            'sign'
        ]);
        const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
        const sigBuf = await crypto.subtle.sign('HMAC', key, data);
        expectedSig = arrayBufferToBase64Url(sigBuf);
    } catch  {
        return null;
    }
    if (!timingSafeEqual(expectedSig, signatureB64)) return null;
    // 3. 解析 payload,校验 exp / iss / aud / type / sub
    let payload;
    try {
        payload = JSON.parse((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$jwt$2d$utils$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["base64UrlDecode"])(payloadB64));
    } catch  {
        return null;
    }
    const exp = payload.exp;
    if (typeof exp !== 'number' || exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.iss !== EDGE_ISSUER) return null;
    if (payload.aud !== EDGE_AUDIENCE) return null;
    if (payload.type === 'refresh') return null;
    const sub = payload.sub;
    if (typeof sub !== 'string' || !sub) return null;
    return {
        userId: sub,
        phone: String(payload.phone ?? ''),
        familyId: String(payload.familyId ?? ''),
        roleId: Number(payload.roleId ?? 0)
    };
}
}),
"[project]/apps/web/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * IHUI-AI Web 顶层 Middleware(P0-1 + P3-4)。
 *
 * ============================================================================
 * P3-4:SSO 路径变更文档化(D 盘历史项目 → G 盘 IHUI-AI)
 * ============================================================================
 * D 盘历史项目(3 套独立登录入口,已废弃):
 *   - D1 admin(sso):/sso/login           (Vue Router 守卫跳转)
 *   - D2 web:        /login               (Vue Router beforeEach 守卫)
 *   - D4 mobile:     /auth/login          (uni-app)
 *
 * G 盘 IHUI-AI(统一入口):
 *   - PC 主入口:    /sso/login            (SaaS 风格独立页 + 扫码登录)
 *   - 弹窗入口:     (auth)/login dialog   (openLoginDialogOnce,懒触发,见 src/lib/login-dialog-trigger.ts)
 *   - 移动端:       (auth)/callback/*     (OAuth callback 路由组)
 *
 * 兼容性:若需保留 D 盘旧路径,可在此处添加 redirect 规则,例如:
 *   if (pathname === '/auth/login') {
 *     return NextResponse.redirect(new URL('/sso/login', request.url))
 *   }
 * 当前未启用(项目已统一切换到 /sso/login,旧路径无外部引用)。
 *
 * ============================================================================
 * P0-1:未登录访问 /admin/* 时 307 重定向到 SSO 登录页
 * ============================================================================
 * - token 校验:src/lib/auth-utils.ts 的 verifyAccessTokenEdge(Web Crypto API,Edge 兼容)
 * - cookie 读取:auth_token(与 src/lib/cookie-utils.ts 一致),只验签不查库
 * - 重定向目标:/sso/login?redirect=<encoded-original-url>(307 保留 method)
 * - 不阻塞:/admin/unauthorized(让用户看到无权限页)
 *
 * ============================================================================
 * D2 web guard 公开页白名单(迁移自 D:\历史项目存档\code\edu\client\web\web\src\router\guard.js L10-31)
 * ============================================================================
 * 当前 matcher 只匹配 /admin/*,以下白名单仅作文档化(后续扩展 matcher 时复用):
 *   /, /login, /register, /forget-password, /forgot-password, /reset-password,
 *   /agreement, /about, /help, /feedback, /contact, /pricing, /docs,
 *   /sso/*, /share/*, /api/*, /_next/*, /favicon.ico, /admin/unauthorized
 * G 盘扩展(与 src/lib/login-dialog-trigger.ts PUBLIC_PATHS 对齐):
 *   /sso/register, /sso/auth, /sso/redirect, /api/health
 *
 * ============================================================================
 * ⚠️ 关键限制:output:'export' 模式下 middleware 生产环境不生效
 * ============================================================================
 * next.config.ts L5 配置 output:'export'(静态导出供 Tauri WebView 加载),
 * Next.js 官方文档明确 middleware 在该模式下不工作(只在 `next dev` 模式生效):
 *   https://nextjs.org/docs/app/api-reference/file-conventions/middleware
 *
 * 生产部署等价方案(由 nginx/CDN 层实现):
 *   location /admin/ {
 *     if ($cookie_auth_token = "") { return 307 /sso/login?redirect=$request_uri; }
 *     # token 验签由后端 /api/auth/verify 完成(可选;性能敏感时可只判 cookie 存在性)
 *   }
 *   location = /admin/unauthorized { try_files $uri /index.html; }
 *
 * 当前 middleware 在 dev 模式(pnpm dev)生效,提供开发期 FOUC 防护 + JS bundle 信息泄露防护;
 * 生产环境需配合上述 nginx 配置(由部署侧负责)。
 * ============================================================================
 */ __turbopack_context__.s([
    "config",
    ()=>config,
    "middleware",
    ()=>middleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/esm/server/web/exports/index.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$auth$2d$utils$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/auth-utils.ts [middleware-edge] (ecmascript)");
;
;
const AUTH_COOKIE = 'auth_token';
const LOGIN_PATH = '/sso/login';
const UNAUTHORIZED_PATH = '/admin/unauthorized';
async function middleware(request) {
    const { pathname, search } = request.nextUrl;
    // 不阻塞 /admin/unauthorized(让用户看到无权限页)
    if (pathname === UNAUTHORIZED_PATH) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    const token = request.cookies.get(AUTH_COOKIE)?.value;
    if (token && await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$auth$2d$utils$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["verifyAccessTokenEdge"])(token)) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    // 无 token 或验签失败 → 307 重定向到 SSO 登录页
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(loginUrl, 307);
}
const config = {
    // 仅匹配 /admin/*,避免匹配静态资源 / api / _next(由 Next.js 自动跳过)
    matcher: [
        '/admin/:path*'
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__0a058809._.js.map