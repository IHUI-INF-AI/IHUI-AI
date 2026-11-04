// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * APK 下载腿选择(2026-11-04 立)。
 *
 * 现场(手机 2411DRN47C,干净网络,无代理):
 *   `www.aizhs.top/remote-images/download/ihui-ai-latest.apk` 的 302 落到带版本号副本,
 *   响应头 `Server: cloudflare` / `CF-RAY: …-LAX` / `cf-cache-status: EXPIRED` —— 国内腿
 *   在 DNS/CDN 上没生效,唯一活着的入口是 Cloudflare 洛杉矶。跟随 302 取 512KB,25s 只
 *   收到 262144B(≈10KB/s),手机侧 30s 直接 0 字节超时。同一台手机打 Gitee API 是
 *   `200 / ttfb 0.32s / 180.76.199.13`。
 *
 * 仓库里「国内走国内网络」的设定本来就有:`apps/web/src/lib/desktop-download-leg.ts`
 * 按访客地域分腿(CN → Gitee),`desktop-feed-live.ts` 用 Content-Length 做 Gitee 字节对账。
 * **缺的只是应用内 APK 更新没接这条腿** —— 它只拿服务端下发的单条 `downloadUrl`。
 *
 * 这里不复刻「按 IP 猜地域」:RN 客户端没有 `cf-ipcountry`,猜错会把国内用户静默推去
 * 更慢的腿(与桌面端那句「没信号 ⇒ 保持现状」同源纪律)。改为**实测竞速**:
 *   1. 对服务端主腿与 Gitee 国内腿并发发一条 256KB 的 `Range` 探针,**真把字节读回来**;
 *      HEAD 不够 —— 主腿的 HEAD 可以 1.5s 就回,真正的病是大文件吞吐,不是 TTFB。
 *   2. 8s 内没读回来 ⇒ 该腿淘汰(现网主腿正是这一型);
 *   3. 两条都量到 `Content-Range` 总长时**必须相等**才允许选国内腿 —— 桌面端
 *      「同名附件冒名旧包 ⇒ 下载成功但验签必失败」的教训,不能在这里重演;
 *   4. 只有国内腿可用 ⇒ 如实记「单边降级」,不静默、也不假装对过账;
 *   5. 全灭 / 任何异常 ⇒ **保持服务端主腿**。失败方向恒为「不多要权限、不猜」。
 *
 * 为什么探针用 XHR 而不是 fetch:RN 的 XHR + `responseType='arraybuffer'` 在本仓
 * `ranged-download.ts` 已真机验过能稳定拿到 `Content-Range`;而服务端若不认 Range
 * 退回 200 全文,XHR 的 timeout 会直接把这条腿淘汰,不会把 85MB 拉进 JS 堆。
 */

export type ApkLegId = "site" | "cn";

export interface ApkLeg {
  id: ApkLegId;
  url: string;
}

/** 国内腿固定 tag:发布脚本每次替换同名附件,URL 恒定(与站点腿 latest 指针同形)。 */
export const APK_CN_LEG_TAG = "mobile-apk-latest";
export const APK_CN_LEG_ASSET = "ihui-ai-latest.apk";
export const APK_CN_LEG_URL = `https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/${APK_CN_LEG_TAG}/${APK_CN_LEG_ASSET}`;

/** 字面量白名单,与 desktop-download-leg.ts 的 RELEASE_TARGET_ALLOWED_ORIGINS 同源纪律。 */
export const APK_LEG_ALLOWED_ORIGINS: readonly string[] = [
  "https://www.aizhs.top",
  "https://gitee.com",
  "https://github.com",
  "https://objects.githubusercontent.com",
];

/** 官网签名 APK 的体积下限,与 scripts/data/mobile-download-leg.json 的 minApkBytes 同源。 */
export const APK_MIN_BYTES = 50 * 1024 * 1024;
/** 探针片:256KB 足够让慢腿暴露吞吐,又不会把首片拖成几分钟。 */
export const APK_PROBE_BYTES = 256 * 1024;
/** 单腿探针上限:现网跨境主腿 8s 内拿不回 256KB,正好被淘汰。 */
export const DEFAULT_LEG_PROBE_TIMEOUT_MS = 8000;

export function isAllowedLegUrl(raw: string): boolean {
  try {
    const u = new URL(String(raw ?? ""));
    return (
      u.protocol === "https:" && APK_LEG_ALLOWED_ORIGINS.includes(u.origin)
    );
  } catch {
    return false;
  }
}

/** 候选腿:服务端主腿恒在第一位(失败方向),国内腿只在主腿合法且不是它自己时追加。 */
export function buildLegCandidates(primaryUrl: string): ApkLeg[] {
  if (!isAllowedLegUrl(primaryUrl)) return [];
  if (String(primaryUrl) === APK_CN_LEG_URL)
    return [{ id: "cn", url: APK_CN_LEG_URL }];
  const legs: ApkLeg[] = [{ id: "site", url: primaryUrl }];
  if (isAllowedLegUrl(APK_CN_LEG_URL)) {
    legs.push({ id: "cn", url: APK_CN_LEG_URL });
  }
  return legs;
}

/** `bytes 0-262143/84915649` → 84915649;读不懂返回 null,绝不用 Content-Length 猜。 */
export function parseProbeTotal(contentRange: string | null): number | null {
  const m = /\/\s*(\d+)\s*$/.exec(String(contentRange ?? ""));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface LegProbe {
  id: ApkLegId;
  url: string;
  status: number;
  /** 包的总字节数(来自 Content-Range 的 /total,不是这一片的长度) */
  totalBytes: number | null;
  /** 探针真读回来的字节数;0 表示没到货 */
  receivedBytes: number;
  elapsedMs: number;
  error: string | null;
}

export interface LegChoice {
  url: string;
  leg: ApkLegId;
  reason: string;
  /** 是否真的跑过探针;主腿不合法 / 只有一条腿时为 false */
  probed: boolean;
}

/**
 * 纯判据:选腿。任何"量不到"都不折算成绿。
 * 体积对账只在两条腿都量到时做;主腿量不到而国内腿可用时,允许单边降级但如实记原因。
 */
export function pickLeg(probes: LegProbe[], primaryUrl: string): LegChoice {
  const usable = (probes || []).filter(
    (p) =>
      (p.status === 200 || p.status === 206) &&
      p.receivedBytes > 0 &&
      p.totalBytes !== null &&
      p.totalBytes >= APK_MIN_BYTES &&
      !p.error,
  );
  if (usable.length === 0) {
    return {
      url: primaryUrl,
      leg: "site",
      reason: "所有腿探针都不可用(超时/非 200-206/体积量不到)⇒ 保持服务端主腿",
      probed: true,
    };
  }

  const site = usable.find((p) => p.id === "site") ?? null;
  const cn = usable.find((p) => p.id === "cn") ?? null;
  let eligible = usable;
  let note = "";
  if (site && cn) {
    if (site.totalBytes !== cn.totalBytes) {
      // 冒名旧包防线:两条腿不是同一枚包 ⇒ 国内腿再快也不许用。
      eligible = [site];
      note = ` · 体积对账 different(${site.totalBytes}/${cn.totalBytes}) ⇒ 只用权威腿`;
    } else {
      note = ` · 体积对账 same(${site.totalBytes})`;
    }
  } else if (cn && !site) {
    note = " · 主腿量不到 ⇒ 单边降级到国内腿(如实记录,不假装对过账)";
  }

  const fastest = eligible.reduce((a, b) =>
    b.elapsedMs < a.elapsedMs ? b : a,
  );
  return {
    url: fastest.url,
    leg: fastest.id,
    reason: `${fastest.id} 探针 ${fastest.elapsedMs}ms 最快${note}`,
    probed: true,
  };
}

export type LegProbeTransport = (
  leg: ApkLeg,
  timeoutMs: number,
) => Promise<Omit<LegProbe, "id" | "url">>;

/** 默认探针:RN XHR + arraybuffer,真读 256KB,超时由 XHR 自己撤单。 */
export const xhrLegProbe: LegProbeTransport = (leg, timeoutMs) =>
  new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    const finish = (out: Omit<LegProbe, "id" | "url">) => {
      if (settled) return;
      settled = true;
      resolve({ ...out, elapsedMs: Math.max(0, Date.now() - started) });
    };
    let xhr: XMLHttpRequest;
    try {
      xhr = new XMLHttpRequest();
    } catch (e) {
      finish({
        status: 0,
        totalBytes: null,
        receivedBytes: 0,
        elapsedMs: 0,
        error: String(e),
      });
      return;
    }
    xhr.responseType = "arraybuffer";
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      const body = xhr.response;
      const received = body instanceof ArrayBuffer ? body.byteLength : 0;
      finish({
        status: xhr.status,
        totalBytes: parseProbeTotal(xhr.getResponseHeader("Content-Range")),
        receivedBytes: received,
        elapsedMs: 0,
        error: null,
      });
    };
    xhr.onerror = () =>
      finish({
        status: 0,
        totalBytes: null,
        receivedBytes: 0,
        elapsedMs: 0,
        error: "XHR onerror",
      });
    xhr.ontimeout = () =>
      finish({
        status: 0,
        totalBytes: null,
        receivedBytes: 0,
        elapsedMs: 0,
        error: `探针 ${timeoutMs}ms 超时`,
      });
    try {
      xhr.open("GET", leg.url, true);
      xhr.setRequestHeader("Range", `bytes=0-${APK_PROBE_BYTES - 1}`);
      xhr.send();
    } catch (e) {
      finish({
        status: 0,
        totalBytes: null,
        receivedBytes: 0,
        elapsedMs: 0,
        error: String(e),
      });
    }
  });

export interface ResolveLegOptions {
  timeoutMs?: number;
  /** 测试注入点;生产省略走 xhrLegProbe */
  transport?: LegProbeTransport;
}

/**
 * 选腿入口。**永不抛**:探测层任何异常都吞掉并回退服务端主腿,
 * 让"选腿"这件事没有能力把更新入口弄坏。
 */
export async function resolveApkDownloadUrl(
  primaryUrl: string,
  opts: ResolveLegOptions = {},
): Promise<LegChoice> {
  const legs = buildLegCandidates(primaryUrl);
  const fallback: LegChoice = {
    url: primaryUrl,
    leg: legs[0]?.id ?? "site",
    reason: "主腿不在允许域 / 只有一条腿 ⇒ 不探测,保持服务端主腿",
    probed: false,
  };
  if (legs.length < 2) return fallback;
  const timeoutMs = Math.max(
    1000,
    opts.timeoutMs ?? DEFAULT_LEG_PROBE_TIMEOUT_MS,
  );
  const transport = opts.transport ?? xhrLegProbe;
  try {
    const results = await Promise.all(
      legs.map(async (leg) => {
        try {
          const out = await transport(leg, timeoutMs);
          return { id: leg.id, url: leg.url, ...out };
        } catch (e) {
          return {
            id: leg.id,
            url: leg.url,
            status: 0,
            totalBytes: null,
            receivedBytes: 0,
            elapsedMs: timeoutMs,
            error: e instanceof Error ? e.message : String(e),
          } satisfies LegProbe;
        }
      }),
    );
    return pickLeg(results, primaryUrl);
  } catch {
    return fallback;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
