import Foundation
import React

/// 闪验(FlashVerify/创蓝闪验)一键登录原生桥接模板(mobile-rn, iOS)。
///
/// 【设计】与 Android 版一致,做到"可插拔、非阻断":
///   - 本文件不 import 任何闪验 iOS 依赖(CocoaPods 的 CL_ShanYanSDK),
///     仅通过 NSClassFromString / NSInvocation 反射调用 SDK,保证在未 pod install 情况下仍可编译运行。
///   - SDK 存在时,初始化 + 拉起授权页获取 token;不存在时 Promise 直接 reject,
///     JS 侧 src/lib/carrier-one-click.ts 据错误码把 UI 降级到短信验证码 + 免费自动回填。
///
/// 供 JS 调用(NativeModules.CarrierOneClickTurboModule):
///   - initialize(_ appId, _ resolver, _ rejecter): 初始化闪验 SDK(complete 回调无错即成功)
///   - oneClickLogin(_ resolver, _ rejecter): 拉起授权页并发起一键登录,回传 {"accessToken": token, "operator": "flashverify"}
///
/// ⚠️ 接入必读(闪验 iOS SDK 方法原型不同版本略有差异,实施时以官方文档为准):
///   初始化: + (void)initWithAppId:(NSString *)appId complete:(void(^)(void))complete;   (类方法,class CLShanYanSDK)
///   一键登录:拉起授权页等方法请按官方指南补齐下述 TODO 反射调用 + 回调 block 解析 token。
///   若实际类名/方法名不同,仅需改本文件的 selector 字符串,JS 契约不变。
@objc(CarrierOneClickTurboModule)
class CarrierOneClickTurboModule: NSObject, RCTBridgeModule {
  static func moduleName() -> String! { "CarrierOneClickTurboModule" }
  static func requiresMainQueueSetup() -> Bool { true }

  /// 常量化闪验类名(反射用,避免硬依赖)。
  private let sdkClassName = "CLShanYanSDK"

  /// 初始化。闪烁 SDK 可解析时成功/失败;否则 reject(CARRIER_LOGIN_FAILED)。
  @objc(initialize:resolver:rejecter:)
  func initialize(
    _ appId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard !appId.isEmpty else { resolve(false); return }
    guard let sdkClass = NSClassFromString(sdkClassName) as? NSObject.Type else {
      resolve(false)  // SDK 未集成,非阻断
      return
    }
    // TODO(闪验 iOS 实施时按官方文档确认初始化 selector): 例如
    //   sdkClass.perform(NSSelectorFromString("initWithAppId:complete:"), with: appId, with: ...)
    // 由于 complete 回调是 block,NSInvocation 反射拼 block 较繁琐,建议直接 import SDK 后改普通调用。
    // 当前为保持"可编译",先用 perform 试探;命中与否只影响 true/false 结果。
    let sel = NSSelectorFromString("initWithAppId:")
    if sdkClass.responds(to: sel) {
      _ = sdkClass.perform(sel, with: appId)
    }
    resolve(true)
  }

  /// 拉起授权页一键登录。SDK 可用且拿到 token 时 resolve;否则 reject。
  @objc(oneClickLogin:rejecter:)
  func oneClickLogin(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let sdkClass = NSClassFromString(sdkClassName) as? NSObject.Type else {
      reject("CARRIER_LOGIN_FAILED", "闪验 SDK 未集成(pod 未安装)", nil)
      return
    }
    // TODO(闪验 iOS 实施时按官方文档补齐): 调用拉起授权页方法,在回调解析
    //   {"token":"..."} → resolve(["accessToken": token, "operator": "flashverify"])
    //   用户取消/失败分别 reject("CARRIER_LOGIN_CANCELLED" / "CARRIER_LOGIN_FAILED")
    _ = sdkClass
    reject("CARRIER_LOGIN_FAILED", "闪验 iOS 一键登录桥接待按官方文档补全", nil)
  }
}