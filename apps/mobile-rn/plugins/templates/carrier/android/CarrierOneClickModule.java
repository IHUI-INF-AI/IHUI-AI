package __PACKAGE__.carrier;

import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

/**
 * 闪验(FlashVerify/创蓝闪验)一键登录原生桥接模板(mobile-rn)。
 *
 * 【设计】用反射加载闪验 SDK,做到"可插拔、非阻断":
 *   - 未打 aar(未集成 SDK)时,编译/运行均不崩溃,initialize/oneClickLogin 直接失败,
 *     JS 侧 src/lib/carrier-one-click.ts 据错误码把 UI 降级到短信验证码 + 免费自动回填。
 *   - 将闪验 Android SDK 的 aar 放入 android/app/libs/ 并确认 build.gradle 的
 *     `implementation fileTree(include: ['*.aar'], dir: 'libs')` 后,App 即具备一键登录能力,无需改 JS。
 *   - SDK 类:com.chuanglan.shanyan_sdk.OneKeyLoginManager;监听器在 com.chuanglan.shanyan_sdk.listener。
 *
 * 供 JS 调用(NativeModules.CarrierOneClickTurboModule):
 *   initialize(appId): Promise<boolean>   —— code 1022 成功
 *   oneClickLogin(): Promise<{ accessToken?, code?, operator }> —— code 1000 成功,result 为 {"token":"..."}
 *   finishAuthActivity(): void
 *
 * 回调开锁线程:两方法均在 UI 线程回调(授权页是 Activity,须主线程操作)。
 */
public class CarrierOneClickModule extends ReactContextBaseJavaModule {

  private static final String SDK_CLS = "com.chuanglan.shanyan_sdk.OneKeyLoginManager";
  private static final String LISTENER_PKG = "com.chuanglan.shanyan_sdk.listener";

  private final ReactApplicationContext reactContext;
  private final Handler main = new Handler(Looper.getMainLooper());

  // 反射缓存(仅当 aar 存在时非空)
  private Object manager;              // OneKeyLoginManager 实例
  private Method mInit;                // init(Context, String, InitListener)
  private Method mOpenLogin;           // openLoginAuth(boolean, OpenLoginAuthListener, OneKeyLoginListener)
  private Method mFinishAuth;          // finishAuthActivity()
  private Class<?> clsInit;            // InitListener
  private Class<?> clsOpenAuth;        // OpenLoginAuthListener
  private Class<?> clsOneKey;          // OneKeyLoginListener

  public CarrierOneClickModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    loadSdkReflectively();
  }

  @Override
  public String getName() {
    return "CarrierOneClickTurboModule";
  }

  private void loadSdkReflectively() {
    try {
      Class<?> sdk = Class.forName(SDK_CLS);
      Method getInstance = sdk.getMethod("getInstance");
      manager = getInstance.invoke(null);
      mInit = sdk.getMethod(
          "init",
          android.content.Context.class,
          String.class,
          Class.forName(LISTENER_PKG + ".InitListener"));
      mOpenLogin = sdk.getMethod(
          "openLoginAuth",
          boolean.class,
          Class.forName(LISTENER_PKG + ".OpenLoginAuthListener"),
          Class.forName(LISTENER_PKG + ".OneKeyLoginListener"));
      try {
        mFinishAuth = sdk.getMethod("finishAuthActivity");
      } catch (NoSuchMethodException ignored) {
        // 旧版本可能无该方法
      }
      clsInit = Class.forName(LISTENER_PKG + ".InitListener");
      clsOpenAuth = Class.forName(LISTENER_PKG + ".OpenLoginAuthListener");
      clsOneKey = Class.forName(LISTENER_PKG + ".OneKeyLoginListener");
    } catch (Throwable t) {
      // 未打 aar:清空缓存,后续调用直接失败(非阻断)
      manager = null;
      mInit = null;
      mOpenLogin = null;
      mFinishAuth = null;
      clsInit = null;
      clsOpenAuth = null;
      clsOneKey = null;
    }
  }

  private boolean sdkLoaded() {
    return manager != null && mInit != null && mOpenLogin != null;
  }

  /** 初始化闪验 SDK(须在 UI 线程)。code 1022 成功;其余失败。 */
  @ReactMethod
  public void initialize(final String appId, final Promise promise) {
    main.post(new Runnable() {
      @Override
      public void run() {
        if (!sdkLoaded() || clsInit == null || appId == null) {
          promise.resolve(false);
          return;
        }
        try {
          Object listener = Proxy.newProxyInstance(
              getClass().getClassLoader(),
              new Class[]{clsInit},
              new InvocationHandler() {
                @Override
                public Object invoke(Object proxy, Method method, Object[] args) {
                  // 回调 getInitStatus(int code, String result)
                  if (args != null && args.length >= 1 && args[0] instanceof Integer) {
                    int code = (Integer) args[0];
                    promise.resolve(code == 1022);
                  }
                  return null;
                }
              });
          mInit.invoke(manager, reactContext.getApplicationContext(), appId, listener);
        } catch (Throwable t) {
          promise.resolve(false);
        }
      }
    });
  }

  /**
   * 拉起授权页并发起一键登录(须在 UI 线程)。
   * code 1000 成功,result 为 {"token":"..."};code 1011 为用户点击返回/取消。
   */
  @ReactMethod
  public void oneClickLogin(final Promise promise) {
    main.post(new Runnable() {
      @Override
      public void run() {
        if (!sdkLoaded() || clsOpenAuth == null || clsOneKey == null) {
          promise.reject("CARRIER_LOGIN_FAILED", "闪验 SDK 未安装(aar 未打入)");
          return;
        }
        try {
          Object openListener = Proxy.newProxyInstance(
              getClass().getClassLoader(),
              new Class[]{clsOpenAuth},
              new InvocationHandler() {
                @Override
                public Object invoke(Object proxy, Method method, Object[] args) {
                  // 回调 getOpenLoginAuthStatus(int code, String result)
                  if (args != null && args.length >= 1 && args[0] instanceof Integer) {
                    int code = (Integer) args[0];
                    if (code != 1000) {
                      promise.reject("CARRIER_LOGIN_FAILED", "授权页拉起失败 code=" + code);
                    }
                  }
                  return null;
                }
              });
          Object oneKeyListener = Proxy.newProxyInstance(
              getClass().getClassLoader(),
              new Class[]{clsOneKey},
              new InvocationHandler() {
                @Override
                public Object invoke(Object proxy, Method method, Object[] args) {
                  // 回调 getOneKeyLoginStatus(int code, String result)
                  if (args != null && args.length >= 1 && args[0] instanceof Integer) {
                    int code = (Integer) args[0];
                    Object resultObj = args.length >= 2 ? args[1] : null;
                    String result = resultObj != null ? String.valueOf(resultObj) : "";
                    if (code == 1000) {
                      promise.resolve(buildResult(result));
                    } else if (code == 1011) {
                      promise.reject("CARRIER_LOGIN_CANCELLED", "用户取消一键登录");
                    } else {
                      promise.reject("CARRIER_LOGIN_FAILED", "一键登录失败 code=" + code);
                    }
                  }
                  return null;
                }
              });
          mOpenLogin.invoke(manager, false, openListener, oneKeyListener);
        } catch (Throwable t) {
          promise.reject("CARRIER_LOGIN_FAILED", "调用闪验 SDK 失败: " + t.getMessage());
        }
      }
    });
  }

  /** 手动销毁授权页。 */
  @ReactMethod
  public void finishAuthActivity() {
    main.post(new Runnable() {
      @Override
      public void run() {
        try {
          if (mFinishAuth != null && manager != null) {
            mFinishAuth.invoke(manager);
          }
        } catch (Throwable ignored) {
          // 忽略
        }
      }
    });
  }

  /** 从 {"token":"..."} 提取 token,组装为 JS 返回对象。 */
  private WritableMap buildResult(String result) {
    WritableMap map = Arguments.createMap();
    String token = extractToken(result);
    if (token != null) {
      map.putString("accessToken", token);
    } else if (result != null) {
      map.putString("code", result);
    }
    map.putString("operator", "flashverify");
    return map;
  }

  private static String extractToken(String result) {
    if (result == null) {
      return null;
    }
    try {
      int i = result.indexOf("\"token\"");
      if (i < 0) {
        return null;
      }
      int colon = result.indexOf(':', i);
      int s = result.indexOf('"', colon + 1) + 1;
      int e = result.indexOf('"', s);
      if (s > 0 && e > s) {
        return result.substring(s, e);
      }
    } catch (Throwable ignored) {
      // 忽略
    }
    return null;
  }
}