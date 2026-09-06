package __PACKAGE__.carrier;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Collections;
import java.util.List;

/**
 * 闪验一键登录桥接包的注册入口。
 * 由 plugins/withCarrier.js 在 prebuild 时把本文件 + CarrierOneClickModule.java
 * 写入 android/app/src/main/java/<pkg>/carrier/ 并注册到 MainApplication。
 */
public class CarrierOneClickPackage implements ReactPackage {
  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }

  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    return Collections.singletonList(new CarrierOneClickModule(reactContext));
  }
}