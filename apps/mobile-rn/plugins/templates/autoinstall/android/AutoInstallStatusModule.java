// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

package __PACKAGE__.autoinstall;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityManager;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.util.List;

/**
 * 「IHUI 自动安装」无障碍服务的真实读数(由 plugins/withAutoInstaller.cjs 在 prebuild 期生成)。
 *
 * 为什么非要有它(2026-11-23 真机定位):
 *   RN 自带的 AccessibilityInfo.isAccessibilityServiceEnabled() 返回的是
 *   AccessibilityManager.isEnabled —— 那表示"设备上**任意**无障碍服务开着"(TalkBack 也算),
 *   用它判本服务会把"没开"读成"开了"。唯一可靠判据是 getEnabledAccessibilityServiceList
 *   里恰好有本包本类的服务在列。
 *
 * 为什么一起回读安装来源:Android 13+ 对"非商店来源"安装的包给无障碍服务加了
 *   「受限制的设置」锁 —— 开关灰显且点不动(实测副标题 Controlled by Restricted Setting)。
 *   判据是包的安装来源(PackageManager.getInstallSourceInfo),所以一并给出,
 *   让 JS 侧能引导「先到应用信息页解除受限、再回来开启」,而不是让用户对着灰开关反复点。
 *
 * 返回(JS 侧 src/lib/auto-install.ts 的 getAutoInstallStatus 消费):
 *   { package, sdkInt, enabled, installer, restrictedRisk }
 *   installer 读不到时为 null(侧载/无来源);restrictedRisk 仅 Android 13+ 才可能为 true。
 */
public class AutoInstallStatusModule extends ReactContextBaseJavaModule {
  private static final String MODULE_NAME = "AutoInstallStatus";
  /** 必须与本插件生成的 AccessibilityService 类全名一致;名字漂了会永远读成未启用。 */
  private static final String SERVICE_CLASS = "__PACKAGE__.A11yAutoInstallService";

  /** Play 商店安装：不受 Android 13 受限设置约束。 */
  private static final String PLAY_STORE = "com.android.vending";

  /** 与服务端 A11yAutoInstallService 的 companion 常量逐字一致(名字漂了会永远读成未开启)。 */
  private static final String A11Y_PREFS = "ihui_a11y";
  private static final String A11Y_KEY_CONNECTED = "connected";
  private static final String A11Y_KEY_TS = "connectedAt";
  /** 服务自报的有效期:服务每 5s 刷一次心跳时间戳,这里只认 4 倍窗口内的(防进程被静默杀死留下的陈旧 true)。 */
  private static final long A11Y_SELF_REPORT_TTL_MS = 20L * 1000;

  private final ReactApplicationContext reactContext;

  public AutoInstallStatusModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return MODULE_NAME;
  }

  @ReactMethod
  public void getStatus(final Promise promise) {
    try {
      String pkg = reactContext.getPackageName();
      WritableMap map = Arguments.createMap();
      map.putString("package", pkg);
      map.putInt("sdkInt", Build.VERSION.SDK_INT);
      // 判据双保险(2026-11-23 实测定性):
      //   · settings 读法:Settings.Secure 的「总开关 + 本组件在列」——用户看到的设置页就是它;
      //   · AMS 读法:AccessibilityManager 里本服务是否在已启用列表(冷启动首帧可能未同步)。
      // 两者任一为真即判「已开启」——任一都能被系统侧独立证实,不因单条的时序问题把"开了"读成"没开"。
      boolean globalOn = readAccessibilityGlobalOn();
      String servicesRaw = readEnabledServicesRaw();
      boolean inSettings = containsMineInFlatList(servicesRaw, pkg);
      boolean bound = isServiceBound(pkg);
      boolean selfReported = isSelfReportedConnected();
      map.putBoolean("enabled", selfReported || (globalOn && inSettings) || bound);
      // 诊断字段:四条判据各自的原始读数(JS 侧只作日志/排障,不参与 UI 决策)。
      map.putBoolean("bound", bound);
      map.putBoolean("selfReported", selfReported);
      map.putBoolean("globalOn", globalOn);
      map.putString("servicesRaw", servicesRaw == null ? "" : servicesRaw);

      String installer = readInstaller(pkg);
      if (installer == null) {
        map.putNull("installer");
      } else {
        map.putString("installer", installer);
      }
      map.putBoolean("restrictedRisk", isRestrictedRisk(installer, pkg));
      promise.resolve(map);
    } catch (Throwable t) {
      promise.reject("AUTO_INSTALL_STATUS_FAILED", t.getMessage(), t);
    }
  }

  /**
   * Settings.Secure 的总开关(用户须知的那一屏里"无障碍"是否开着)。
   * 读不到(某些 ROM 对普通 App 屏蔽读)时按 false 处理 —— 由 AMS 判据兜底。
   */
  private boolean readAccessibilityGlobalOn() {
    try {
      return Settings.Secure.getInt(
              reactContext.getContentResolver(), Settings.Secure.ACCESSIBILITY_ENABLED, 0)
          == 1;
    } catch (Throwable t) {
      return false;
    }
  }

  /** Settings.Secure 里「已启用服务」的原始串(冒号分隔),供跨判据诊断。 */
  private String readEnabledServicesRaw() {
    try {
      return Settings.Secure.getString(
          reactContext.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
    } catch (Throwable t) {
      return null;
    }
  }

  /**
   * 服务自己上报的「我连着」(A11yAutoInstallService 在 onServiceConnected/onUnbind 写本包私有 prefs)。
   *
   * 为什么必须有这一条(2026-11-23 实机定性):
   *   · Settings.Secure 的 enabled_accessibility_services / accessibility_enabled 在普通 App 进程里
   *     读到的是空串与 0(shell 读到的是真有值)—— 系统按调用者身份屏蔽了这两项;
   *   · AccessibilityManager.getEnabledAccessibilityServiceList 冷启动首帧同样读空。
   * 三条系统读法全不可信时,「服务真的绑上了」只有服务自己知道;它写的 prefs 本包可读且不受限。
   * 额外加 20s 时效(服务每 5s 刷心跳):服务被系统静默杀死/被禁用而没走 onUnbind 时,陈旧 true 不会被采信。
   */
  private boolean isSelfReportedConnected() {
    try {
      SharedPreferences sp =
          reactContext.getSharedPreferences(A11Y_PREFS, Context.MODE_PRIVATE);
      if (!sp.getBoolean(A11Y_KEY_CONNECTED, false)) return false;
      long at = sp.getLong(A11Y_KEY_TS, 0L);
      return at > 0 && System.currentTimeMillis() - at <= A11Y_SELF_REPORT_TTL_MS;
    } catch (Throwable t) {
      return false;
    }
  }

  /** 原始扁平串里是否有本包本类(形如 `pkg/pkg.Class` 或 `pkg/.Class`)。 */
  private boolean containsMineInFlatList(String flat, String pkg) {
    if (flat == null || flat.isEmpty()) return false;
    try {
      TextUtils.SimpleStringSplitter splitter = new TextUtils.SimpleStringSplitter(':');
      splitter.setString(flat);
      while (splitter.hasNext()) {
        ComponentName cn = ComponentName.unflattenFromString(splitter.next());
        if (cn == null) continue;
        if (pkg.equals(cn.getPackageName()) && SERVICE_CLASS.equals(cn.getClassName())) {
          return true;
        }
      }
    } catch (Throwable t) {
      return false;
    }
    return false;
  }

  /** 本服务是否被系统实际绑定(用户在设置里开启且服务正在跑)。 */
  private boolean isServiceBound(String pkg) {
    AccessibilityManager am =
        (AccessibilityManager) reactContext.getSystemService(Context.ACCESSIBILITY_SERVICE);
    if (am == null) return false;
    List<AccessibilityServiceInfo> services =
        am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
    if (services == null) return false;
    for (AccessibilityServiceInfo info : services) {
      if (info == null || info.getResolveInfo() == null) continue;
      ServiceInfo si = info.getResolveInfo().serviceInfo;
      if (si == null || si.packageName == null || si.name == null) continue;
      if (!pkg.equals(si.packageName)) continue;
      // serviceInfo.name 在不同 ROM 上可能是 ".A11yAutoInstallService" 或全名,统一归一后比对
      String full = si.name.startsWith(".") ? si.packageName + si.name : si.name;
      if (SERVICE_CLASS.equals(full)) return true;
    }
    return false;
  }

  /** 安装来源包名;无来源(adb/侧载)或读不到时返回 null。 */
  private String readInstaller(String pkg) {
    try {
      PackageManager pm = reactContext.getPackageManager();
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        InstallSourceInfo info = pm.getInstallSourceInfo(pkg);
        return info == null ? null : info.getInstallingPackageName();
      }
      return pm.getInstallerPackageName(pkg);
    } catch (Throwable t) {
      return null;
    }
  }

  /**
   * 是否存在「受限制的设置」风险。
   *   · Android 12 及以下没有这项机制 ⇒ 恒 false;
   *   · 无来源(adb/侧载)/ Play / 自定义分发自身 ⇒ false(实测 adb 覆盖安装后开关立刻为 On);
   *   · 其他来源(系统安装器/文件管理器/浏览器点 APK)⇒ true,这类包在 13+ 会被锁。
   * 宁可多给一次"先解除受限"的引导,也不让用户对着灰开关点不动。
   */
  private boolean isRestrictedRisk(String installer, String pkg) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return false;
    if (installer == null || installer.isEmpty()) return false;
    if (PLAY_STORE.equals(installer)) return false;
    if (pkg.equals(installer)) return false;
    return true;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
