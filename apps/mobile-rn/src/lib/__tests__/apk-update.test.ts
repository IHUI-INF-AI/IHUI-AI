// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * APK 整包更新的判据取证(2026-11-04 立)。
 *
 * 钉六件事,每条都对应一个"看起来在跑、其实判反了"的高发点:
 *   ① 版本比较必须**读不懂就答 null**,不许把"看不懂"伪装成"一样新";
 *   ② 服务端 hasUpdate 有假阳性(当前版本未登记 ⇒ currentBuild 记 0 ⇒ 任何 latest 行都算新),
 *      客户端必须自己再比一次 —— 服务端说新、版本号却相等 ⇒ 不提示;
 *   ③ 非 Android 环境**不碰**服务端接口,直接 unsupported;
 *   ④ 没有任何原生模块时,点了更新要开浏览器,**且不许先在应用内白下 90MB**;
 *   ⑤ 有原生模块时才走"下载 → content:// → 系统安装器",且意图参数必须是 APK 的 mime type;
 *   ⑥ 用户关掉的一次性提示,在新一轮查到更新时必须复位。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  checkAppVersion: vi.fn(),
  createDownloadResumable: vi.fn(),
  getContentUriAsync: vi.fn(),
  startActivity: vi.fn(),
  startActivityAsync: vi.fn(),
  downloadAsync: vi.fn(),
}));

/** 分片腿接管点:null ⇒ 默认判"服务端不支持 Range",让用例落到单流降级腿。 */
const ranged = vi.hoisted(() => ({
  impl: null as
    | null
    | ((
        options: unknown,
      ) => Promise<{ uri: string; bytes: number; connections: number }>),
}));

/**
 * 选腿接管点:默认恒等(既有用例全部保持原 URL),个别用例改成返回国内腿,
 * 用来证明 applyApkUpdate 真的把选腿结果交给了下载器 —— 否则"选腿模块写了但没接上"
 * 这类同错(实现与夹具一起绿)测不出来。
 */
const legChoice = vi.hoisted(() => ({ url: null as string | null }));

vi.mock("@ihui/api-client", () => ({
  checkAppVersion: h.checkAppVersion,
}));

/**
 * expo-file-system 的真身 import expo-modules-core(原生模块),vitest 下解析失败会让
 * **整个测试文件加载不进来**(一条断言都没跑)。父路径在 vitest.config.ts 已有替身,
 * 但本模块用的是 `expo-file-system/legacy` 子路径 ⇒ 必须在这里局部替身。
 */
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  createDownloadResumable: h.createDownloadResumable,
  getContentUriAsync: h.getContentUriAsync,
}));

/** 选腿的 IO 面在 apk-download-legs.test.ts 单独钉;这里只接管出口,避免用例真发探针。 */
vi.mock("../apk-download-legs", () => ({
  resolveApkDownloadUrl: async (primary: string) => ({
    url: legChoice.url ?? primary,
    leg: legChoice.url ? "cn" : "site",
    reason: "测试夹具",
    probed: Boolean(legChoice.url),
  }),
}));

/**
 * 分片腿的调度细节在 `ranged-download.test.ts` 里单独钉。这一份只钉**选腿**:
 * 默认让分片腿回 RangeUnsupported ⇒ 落到单流,下面三个用例判的就是这条降级腿的老行为;
 * 需要验"分片腿成功"的用例用 `ranged.impl` 临时接管。
 * 用 importOriginal 保留真实的错误类:默认实现抛 `RangeUnsupportedError` 让普通用例
 * 落到单流腿;而选腿判据是「除取消外任何分片失败都降级」(2026-11-04 真机教训),
 * 所以下面另有 `it.each` 逐类证明普通 Error 也会退回单流,不再只认那一个类。
 */
vi.mock("../ranged-download", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ranged-download")>();
  return {
    ...actual,
    downloadRanged: (options: unknown) =>
      ranged.impl
        ? ranged.impl(options)
        : Promise.reject(
            new actual.RangeUnsupportedError("测试:分片腿默认关闭"),
          ),
  };
});

type ExpoGlobalShape = { expo?: { modules?: Record<string, unknown> } };

/** 装/拆原生意图模块的假注册表(探测读的就是 globalThis.expo.modules,见 apk-update 头注)。 */
function setNativeLauncher(present: boolean): void {
  const g = globalThis as unknown as ExpoGlobalShape;
  if (!present) {
    delete g.expo;
    return;
  }
  g.expo = {
    modules: { ExpoIntentLauncher: { startActivity: h.startActivity } },
  };
}

async function setPlatform(os: "android" | "ios" | "web"): Promise<void> {
  const rn = (await import("react-native")) as unknown as {
    Platform: { OS: string };
  };
  Object.defineProperty(rn.Platform, "OS", { value: os, configurable: true });
}

/**
 * 每个用例拿一份全新模块(store 是模块级单例,不重置会串味)。
 * 与 ota-update.test.ts 同一条陷阱:resetModules 之后要**先重新 import react-native 再改 OS**,
 * 否则拿到旧实例,所有用例静默落到 wrong 分支。
 */
async function freshModule(os: "android" | "ios" | "web" = "android") {
  vi.resetModules();
  // 刻意**不** stub __DEV__:src/lib/config.ts 在 !IS_DEV_BUILD 且 API 基址是本机回环时
  // 直接抛错拒绝启动(测试环境 env 钉的就是 localhost:8802)。本模块也不按 dev/release 分叉
  // (整包更新在 dev 里同样要能查到),所以这里保持 vitest 默认(非 production ⇒ 视为开发档)。
  await setPlatform(os);
  return await import("../apk-update");
}

/** 服务端"有更新"的标准响应;各用例只改必要的字段。 */
function updateResponse(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      hasUpdate: true,
      latestVersion: "0.0.9",
      downloadUrl: "https://example.test/ihui-ai-latest.apk",
      releaseNotes: null,
      forceUpdate: false,
      ...overrides,
    },
  };
}

beforeEach(() => {
  h.checkAppVersion.mockReset();
  h.createDownloadResumable.mockReset();
  h.getContentUriAsync.mockReset();
  h.startActivity.mockReset();
  h.startActivityAsync.mockReset();
  h.downloadAsync.mockReset();
  ranged.impl = null;
  legChoice.url = null;
  setNativeLauncher(false);
});

describe("版本比较:读不懂必须答 null", () => {
  it("按段比大小,段数不同按 0 补?不 —— 缺段视为 0", async () => {
    const { compareVersions } = await freshModule();
    expect(compareVersions("0.0.9", "0.0.5")).toBe(1);
    expect(compareVersions("0.0.5", "0.0.9")).toBe(-1);
    expect(compareVersions("0.0.5", "0.0.5.0")).toBe(0);
    // CI 派生的 `<base>.<UTC YYYYMMDD>` 与三段版号混比:0.0.5.20261104 仍低于 0.0.9
    expect(compareVersions("0.0.5.20261104", "0.0.9")).toBe(-1);
  });

  it('非 X.Y[.Z[.W]] 形态 ⇒ null(不冒充"一样新")', async () => {
    const { compareVersions } = await freshModule();
    expect(compareVersions("latest", "0.0.5")).toBeNull();
    expect(compareVersions("0.0.5", "")).toBeNull();
    expect(compareVersions("0.0.5-beta", "0.0.5")).toBeNull();
  });
});

describe("是否有更新:服务端结论 + 客户端复核", () => {
  it("服务端说新、但版本号相等 ⇒ 不提示(当前版本未登记造成的假阳性)", async () => {
    const { decideHasUpdate } = await freshModule();
    expect(
      decideHasUpdate({
        serverHasUpdate: true,
        latestVersion: "0.0.5",
        currentVersion: "0.0.5",
      }),
    ).toBe(false);
  });

  it("服务端说新、版本号也确实更新 ⇒ 提示", async () => {
    const { decideHasUpdate } = await freshModule();
    expect(
      decideHasUpdate({
        serverHasUpdate: true,
        latestVersion: "0.0.9",
        currentVersion: "0.0.5",
      }),
    ).toBe(true);
  });

  it("服务端说没有 ⇒ 不提示(哪怕版本号看起来更新)", async () => {
    const { decideHasUpdate } = await freshModule();
    expect(
      decideHasUpdate({
        serverHasUpdate: false,
        latestVersion: "9.9.9",
        currentVersion: "0.0.5",
      }),
    ).toBe(false);
  });

  it('版本号读不懂 ⇒ 退回信任服务端,但不因"读不懂"自行判成有更新', async () => {
    const { decideHasUpdate } = await freshModule();
    expect(
      decideHasUpdate({
        serverHasUpdate: true,
        latestVersion: "vNext",
        currentVersion: "0.0.5",
      }),
    ).toBe(true);
    expect(
      decideHasUpdate({
        serverHasUpdate: false,
        latestVersion: "vNext",
        currentVersion: "0.0.5",
      }),
    ).toBe(false);
    expect(
      decideHasUpdate({
        serverHasUpdate: true,
        latestVersion: null,
        currentVersion: "0.0.5",
      }),
    ).toBe(false);
  });
});

describe("检查:环境判定与状态落库", () => {
  it("web ⇒ unsupported,且不打服务端接口", async () => {
    const mod = await freshModule("web");
    await expect(mod.checkApkUpdate()).resolves.toBe("unsupported");
    expect(h.checkAppVersion).not.toHaveBeenCalled();
  });

  it("服务端说没有更新 ⇒ up-to-date", async () => {
    h.checkAppVersion.mockResolvedValue(
      updateResponse({ hasUpdate: false, latestVersion: "0.0.5" }),
    );
    const mod = await freshModule();
    await expect(mod.checkApkUpdate()).resolves.toBe("up-to-date");
    expect(h.checkAppVersion).toHaveBeenCalledTimes(1);
    expect(mod.apkSnapshot().latestVersion).toBe("0.0.5");
    expect(mod.apkSnapshot().downloadUrl).toBeNull();
  });

  it("查到真更新 ⇒ available,并把下载地址与说明落库", async () => {
    h.checkAppVersion.mockResolvedValue(
      updateResponse({ releaseNotes: "修复若干问题" }),
    );
    const mod = await freshModule();
    await expect(mod.checkApkUpdate()).resolves.toBe("available");
    const snap = mod.apkSnapshot();
    expect(snap.latestVersion).toBe("0.0.9");
    expect(snap.downloadUrl).toBe("https://example.test/ihui-ai-latest.apk");
    expect(snap.releaseNotes).toBe("修复若干问题");
    expect(snap.dismissed).toBe(false);
    // 绝不静默下载:检查阶段一次下载都不许发起
    expect(h.createDownloadResumable).not.toHaveBeenCalled();
  });

  it("服务端报错 ⇒ error,不抛异常", async () => {
    h.checkAppVersion.mockRejectedValue(new Error("boom"));
    const mod = await freshModule();
    await expect(mod.checkApkUpdate()).resolves.toBe("error");
    expect(mod.apkSnapshot().lastError).toBe("boom");
  });

  it("关掉的一次性提示,在新一轮查到更新时复位", async () => {
    h.checkAppVersion.mockResolvedValue(updateResponse());
    const mod = await freshModule();
    await mod.checkApkUpdate();
    mod.dismissApkPrompt();
    expect(mod.apkSnapshot().dismissed).toBe(true);
    await mod.checkApkUpdate();
    expect(mod.apkSnapshot().dismissed).toBe(false);
  });
});

describe("安装能力探测", () => {
  it("没有原生意图模块 ⇒ canInstallInApp 为 false", async () => {
    const mod = await freshModule();
    expect(mod.canInstallInApp()).toBe(false);
  });

  it("注册表里有 ExpoIntentLauncher.startActivity ⇒ 可应用内直装", async () => {
    setNativeLauncher(true);
    const mod = await freshModule();
    expect(mod.canInstallInApp()).toBe(true);
  });

  it("非 Android 即便有模块也不走 APK 通道", async () => {
    setNativeLauncher(true);
    const mod = await freshModule("ios");
    expect(mod.canInstallInApp()).toBe(false);
  });
});

describe("下载 + 安装", () => {
  it("无原生模块 ⇒ 开浏览器,且**不下载**(不白下 90MB)", async () => {
    h.checkAppVersion.mockResolvedValue(updateResponse());
    const mod = await freshModule();
    // 顺序有讲究:必须**在 freshModule 之后**再取 react-native —— freshModule 内部
    // vi.resetModules() 会重建替身实例,先取再改等于改在旧对象上,断言永远是 0 次调用。
    const rn = (await import("react-native")) as unknown as {
      Linking: { openURL: (url: string) => Promise<void> };
    };
    const openURL = vi.fn(async () => undefined);
    rn.Linking.openURL = openURL;
    await mod.checkApkUpdate();
    await expect(mod.applyApkUpdate()).resolves.toBe("installing");
    expect(openURL).toHaveBeenCalledWith(
      "https://example.test/ihui-ai-latest.apk",
    );
    expect(h.createDownloadResumable).not.toHaveBeenCalled();
    expect(mod.apkSnapshot().installMode).toBe("browser");
  });

  it("有原生模块 ⇒ 下载到缓存 → content:// → 系统安装器(APK mime)", async () => {
    h.checkAppVersion.mockResolvedValue(updateResponse());
    h.downloadAsync.mockResolvedValue({
      uri: "file:///cache/ihui-ai-0.0.9.apk",
    });
    h.createDownloadResumable.mockReturnValue({
      downloadAsync: h.downloadAsync,
    });
    h.getContentUriAsync.mockResolvedValue(
      "content://zh.ai.sq.FileSystemFileProvider/apk",
    );
    h.startActivity.mockResolvedValue(undefined);
    setNativeLauncher(true);

    const mod = await freshModule();
    await mod.checkApkUpdate();
    await expect(mod.applyApkUpdate()).resolves.toBe("installing");

    // 下载参数:目标文件名带版本号(重试可复用、升级不会拿旧包)
    expect(h.createDownloadResumable).toHaveBeenCalledTimes(1);
    expect(h.createDownloadResumable).toHaveBeenCalledWith(
      "https://example.test/ihui-ai-latest.apk",
      "file:///cache/ihui-ai-0.0.9.apk",
      expect.anything(),
      expect.any(Function),
    );
    expect(h.getContentUriAsync).toHaveBeenCalledWith(
      "file:///cache/ihui-ai-0.0.9.apk",
    );
    expect(h.startActivity).toHaveBeenCalledWith("android.intent.action.VIEW", {
      data: "content://zh.ai.sq.FileSystemFileProvider/apk",
      flags: 1,
      type: "application/vnd.android.package-archive",
    });
    expect(mod.apkSnapshot().installMode).toBe("in-app");
    expect(mod.apkSnapshot().progress).toBe(100);
  });

  it("分片腿可用 ⇒ 走分片,不回到单流", async () => {
    h.checkAppVersion.mockResolvedValue(updateResponse());
    h.getContentUriAsync.mockResolvedValue(
      "content://zh.ai.sq.FileSystemFileProvider/apk",
    );
    h.startActivity.mockResolvedValue(undefined);
    ranged.impl = async () => ({
      uri: "file:///cache/ihui-ai-0.0.9.apk",
      bytes: 84915649,
      connections: 4,
    });
    setNativeLauncher(true);

    const mod = await freshModule();
    await mod.checkApkUpdate();
    await expect(mod.applyApkUpdate()).resolves.toBe("installing");

    expect(h.createDownloadResumable).not.toHaveBeenCalled();
    expect(h.getContentUriAsync).toHaveBeenCalledWith(
      "file:///cache/ihui-ai-0.0.9.apk",
    );
    expect(h.startActivity).toHaveBeenCalledWith("android.intent.action.VIEW", {
      data: "content://zh.ai.sq.FileSystemFileProvider/apk",
      flags: 1,
      type: "application/vnd.android.package-archive",
    });
    expect(mod.apkSnapshot().installMode).toBe("in-app");
    expect(mod.apkSnapshot().progress).toBe(100);
  });

  it.each([
    ["首片停滞", "分片腿 45s 内 0 字节到货"],
    ["普通网络错误", "网络错误"],
    ["落盘不完整", "下载不完整:期望 84915649 字节"],
  ])(
    "分片腿 %s ⇒ 立刻退回原生单流,绝不把 0%% 伪装成下载中",
    async (_label, message) => {
      h.checkAppVersion.mockResolvedValue(updateResponse());
      h.downloadAsync.mockResolvedValue({
        uri: "file:///cache/ihui-ai-0.0.9.apk",
      });
      h.createDownloadResumable.mockReturnValue({
        downloadAsync: h.downloadAsync,
      });
      h.getContentUriAsync.mockResolvedValue(
        "content://zh.ai.sq.FileSystemFileProvider/apk",
      );
      h.startActivity.mockResolvedValue(undefined);
      ranged.impl = async () => {
        throw new Error(message);
      };
      setNativeLauncher(true);

      const mod = await freshModule();
      await mod.checkApkUpdate();
      await expect(mod.applyApkUpdate()).resolves.toBe("installing");

      expect(h.createDownloadResumable).toHaveBeenCalledTimes(1);
      expect(h.getContentUriAsync).toHaveBeenCalledWith(
        "file:///cache/ihui-ai-0.0.9.apk",
      );
      expect(mod.apkSnapshot().installMode).toBe("in-app");
    },
  );

  describe("下载腿接线:选腿结果必须真的流到下载器", () => {
    const CN =
      "https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/mobile-apk-latest/ihui-ai-latest.apk";

    async function arrange() {
      h.checkAppVersion.mockResolvedValue(updateResponse());
      h.downloadAsync.mockResolvedValue({
        uri: "file:///cache/ihui-ai-0.0.9.apk",
      });
      h.createDownloadResumable.mockReturnValue({
        downloadAsync: h.downloadAsync,
      });
      h.getContentUriAsync.mockResolvedValue(
        "content://zh.ai.sq.FileSystemFileProvider/apk",
      );
      h.startActivity.mockResolvedValue(undefined);
      setNativeLauncher(true);
      const mod = await freshModule();
      await mod.checkApkUpdate();
      return mod;
    }

    it("选腿返回国内腿 ⇒ 下载器收到的就是国内腿 URL,store 记 cn", async () => {
      legChoice.url = CN;
      const mod = await arrange();
      await expect(mod.applyApkUpdate()).resolves.toBe("installing");
      expect(h.createDownloadResumable).toHaveBeenCalledWith(
        CN,
        "file:///cache/ihui-ai-0.0.9.apk",
        expect.anything(),
        expect.any(Function),
      );
      expect(mod.apkSnapshot().downloadLeg).toBe("cn");
    });

    it("反向:选腿没换 URL ⇒ 仍是主腿,store 记 site", async () => {
      legChoice.url = null;
      const mod = await arrange();
      await expect(mod.applyApkUpdate()).resolves.toBe("installing");
      expect(h.createDownloadResumable).toHaveBeenCalledWith(
        "https://example.test/ihui-ai-latest.apk",
        "file:///cache/ihui-ai-0.0.9.apk",
        expect.anything(),
        expect.any(Function),
      );
      expect(mod.apkSnapshot().downloadLeg).toBe("site");
    });
  });

  it("服务端没给下载地址时点了也不炸,落 error", async () => {
    h.checkAppVersion.mockResolvedValue(updateResponse({ downloadUrl: null }));
    const mod = await freshModule();
    await mod.checkApkUpdate();
    await expect(mod.applyApkUpdate()).resolves.toBe("error");
    expect(mod.apkSnapshot().lastError).toBe("服务端没有下发安装包地址");
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
