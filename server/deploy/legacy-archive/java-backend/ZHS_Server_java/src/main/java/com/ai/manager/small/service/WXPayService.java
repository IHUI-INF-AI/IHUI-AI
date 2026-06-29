//package com.ai.manager.small.service;
//
//import com.ai.manager.core.config.ResponseResultInfo;
//import com.ai.manager.core.constants.ResultConfig;
//import com.ai.manager.small.domain.*;
//import com.ai.manager.small.mapper.*;
//import com.alibaba.druid.support.json.JSONUtils;
//import com.google.common.collect.Maps;
//import com.wechat.pay.java.core.Config;
//import com.wechat.pay.java.core.RSAAutoCertificateConfig;
//import com.wechat.pay.java.core.notification.NotificationParser;
//import com.wechat.pay.java.service.payments.jsapi.JsapiServiceExtension;
//import com.wechat.pay.java.service.payments.jsapi.model.*;
//import com.wechat.pay.java.service.payments.model.Transaction;
//import com.wechat.pay.java.service.refund.RefundService;
//import com.wechat.pay.java.service.refund.model.AmountReq;
//import com.wechat.pay.java.service.refund.model.CreateRequest;
//import com.wechat.pay.java.service.refund.model.Refund;
//import org.apache.commons.lang3.StringUtils;
//import org.apache.commons.lang3.math.NumberUtils;
//import org.slf4j.Logger;
//import org.slf4j.LoggerFactory;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.beans.factory.annotation.Value;
//import org.springframework.stereotype.Service;
//import org.springframework.transaction.annotation.Transactional;
//
//import java.nio.charset.StandardCharsets;
//import java.nio.file.Files;
//import java.nio.file.Paths;
//import java.security.KeyFactory;
//import java.security.PrivateKey;
//import java.security.Signature;
//import java.security.spec.PKCS8EncodedKeySpec;
//import java.util.*;
//import java.util.concurrent.TimeUnit;
//
//@Service
//public class WXPayService {
//
//    private static final Logger log = LoggerFactory.getLogger(WXPayService.class);
//
//    @Autowired
//    private OrderMapper orderMapper;
//
//    @Autowired
//    private ProductMapper productMapper;
//    @Autowired
//    private ZhsActivityMapper activityMapper;
//
//    @Autowired
//    private UserMapper userMapper;
//
//    @Autowired
//    private UserService userService;
//
//    @Autowired
//    private OperateTokenFlowMapper operateTokenFlowMapper;
//
//    @Autowired
//    private WithdrawalFlowMapper withdrawalFlowMapper;
//
//    @Value("${wx.appid}")
//    private String appId;
//    @Value("${wx.secret}")
//    private String secret;
//    @Value("${wx.shops.id}")
//    private String shopsId;
//    @Value("${wx.shops.v3Key}")
//    private String v3Key;
//    @Value("${wx.shops.cert.apiclient.path}")
//    private String certApiClientPath;
//    @Value("${wx.shops.cert.public.path}")
//    private String certPublicPath;
//    @Value("${wx.shops.cert.num}")
//    private String certNum;
//    @Value("${wx.jsapi.notify}")
//    private String notifyUrl;
//
//    private Config payConfig;
//    private JsapiServiceExtension jsapiService;
//    private RefundService refundService;
//    private NotificationParser notificationParser;
//
//    private void initService(){
//        getJsapiService();
//        getRefundService();
//    }
//
//    /**
//     * 小程序发起微信支付订单
//     * 对应 PHP 的 miniappOrder 方法
//     *
//     * @param openId    微信用户OpenID
//     * @param productId 商品ID
//     * @param orderType
//     * @return 微信支付所需的预支付信息 (ResponseResultInfo)
//     */
//    @Transactional
//    public ResponseResultInfo createMiniAppOrder(String openId, Long productId, String orderType) {
//        // 参数校验
//        if (StringUtils.isEmpty(openId) || productId == null || StringUtils.isEmpty(orderType)) {
//            return ResponseResultInfo.builder()
//                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
//                    .msg("缺少必要的参数")
//                    .build();
//        }
//
//        // 查询商品和用户信息
//        Product product = productMapper.selectById(productId);
//        if (product == null) {
//            return ResponseResultInfo.builder()
//                    .code("404")
//                    .msg("商品不存在")
//                    .build();
//        }
//
//        User user = userMapper.selectByOpenId(openId);
//        if (user == null) {
//            return ResponseResultInfo.builder()
//                    .code("404")
//                    .msg("用户不存在")
//                    .build();
//        }
//        int price = product.getPrice().intValue();
//        String description = product.getDesc();
//        if(orderType=="1"){
//
//        }
//
//        // 构造订单信息
//        String outTradeNo = "WX" + System.currentTimeMillis() + (new Random().nextInt(9000) + 1000); // 生成商户订单号
//        Integer totalFee = product.getPrice(); // 微信单位为分，BigDecimal 可以处理精度
//        String body = product.getDesc() != null ? product.getDesc() : "商品支付";
//
//        // 写入订单数据到数据库
//        Order order = new Order();
//        order.setUserId(user.getId());
//        order.setOutTradeNo(outTradeNo);
//        order.setOpenId(openId);
//        order.setAmount(totalFee);
//        order.setStatus(0); // 待支付
//        order.setPaymentStatus(0); // 待支付
//        Long currentTime = TimeUnit.MILLISECONDS.toSeconds(System.currentTimeMillis());
//        order.setCreatedAt(currentTime);
//        order.setPaidAt(0l);
//        order.setProductId(productId);
//        order.setOrderType(product.getType()); // 从商品类型获取订单类型
//
//
//        try {
//            // TODO: 调用微信支付统一下单 API
//            // 这部分需要使用 Java 微信支付 SDK 或手动构建请求
//            // 示例 (使用模拟数据，实际需要调用微信 API)
//            Map<String, String> wxOrderParams = new HashMap<>();
//            wxOrderParams.put("appid", "your_miniapp_appid"); // TODO: 替换为你的小程序 AppID
//            wxOrderParams.put("mch_id", "your_mch_id"); // TODO: 替换为你的商户号
//            wxOrderParams.put("nonce_str", "random_string"); // TODO: 生成随机字符串
//            wxOrderParams.put("body", body);
//            wxOrderParams.put("out_trade_no", outTradeNo);
//            wxOrderParams.put("total_fee", totalFee.toString()); // 金额转换为整数，单位分
//            wxOrderParams.put("spbill_create_ip", "client_ip"); // TODO: 获取用户IP
//            wxOrderParams.put("notify_url", notifyUrl); // 使用配置中的通知URL
//            wxOrderParams.put("trade_type", "JSAPI"); // 小程序支付使用 JSAPI
//            wxOrderParams.put("openid", openId);
//
//            // TODO: 调用微信支付 SDK 或发送 HTTP 请求到微信统一下单接口
//            // 示例 (使用模拟数据):
//            Map<String, String> prePayResult = new HashMap<>();
//            prePayResult.put("prepay_id", "mock_prepay_id"); // 实际应从微信支付接口返回获取
//
//            if (prePayResult == null || !prePayResult.containsKey("prepay_id")) {
//                // 统一下单失败
//                 log.error("微信下单失败：未获取到 prepay_id");
//                 return ResponseResultInfo.builder()
//                         .code("500")
//                         .msg("微信下单失败，请稍后再试")
//                         .data(prePayResult)
//                         .build();
//            }
//
//            // TODO: 根据统一下单结果构建小程序支付参数并签名
//            // 示例 (使用模拟数据):
//            int timestamp = (int) TimeUnit.MILLISECONDS.toSeconds(System.currentTimeMillis());
//            Map<String, Object> miniAppPayParams = new HashMap<>();
//            miniAppPayParams.put("appId", appId); // 使用配置中的 AppID
//            miniAppPayParams.put("timeStamp", String.valueOf(timestamp));
//            miniAppPayParams.put("nonceStr", UUID.randomUUID().toString().replace("-", "")); // 生成随机字符串
//            miniAppPayParams.put("package", "prepay_id=" + prePayResult.get("prepay_id"));
//            miniAppPayParams.put("signType", "RSA"); // 根据微信支付 SDK 使用的签名方式确定
//            // TODO: 生成 paySign，需要使用商户私钥签名
//            // miniAppPayParams.put("paySign", "mock_pay_sign"); // 实际需要根据参数和私钥生成签名
//
//            // TODO: 实际签名逻辑
//            // String paySign = generateSign(appId, String.valueOf(timestamp), (String) miniAppPayParams.get("nonceStr"), (String) miniAppPayParams.get("package"));
//            // miniAppPayParams.put("paySign", paySign);
//
//
//            orderMapper.insertOrder(order);
//
//            return ResponseResultInfo.builder()
//                    .code(ResultConfig.SUCCESS_CODE.toString())
//                    .msg("创建订单成功")
//                    .data(miniAppPayParams)
//                    .build();
//
//        } catch (Exception e) {
//            log.error("微信下单失败：{}", e.getMessage(), e);
//            // TODO: 可以回滚订单创建
//            // throw new RuntimeException("微信下单失败", e); // 或者返回错误信息
//             return ResponseResultInfo.builder()
//                     .code("500")
//                     .msg("微信下单失败，请稍后再试")
//                     .data(e.getMessage())
//                     .build();
//        }
//    }
//
//    /**
//     * 微信支付回调处理
//     * 对应 PHP 的 notify 方法
//     *
//     * @param notifyData 微信支付回调的 XML 或 JSON 数据
//     * @return 返回给微信支付的响应 (XML)
//     */
//    @Transactional
//    public String handleNotify(String notifyData) {
//        try {
//            // TODO: 解析微信支付回调数据 (XML 或 JSON)，验证签名
//            // 使用微信支付 SDK 或手动解析和验证
//            // 示例 (使用模拟数据，实际需要解析 notifyData):
//            Map<String, String> data = new HashMap<>();
//            // data.put("return_code", "SUCCESS");
//            // data.put("result_code", "SUCCESS");
//            // data.put("out_trade_no", "the_order_out_trade_no"); // 从回调数据中获取
//
//            // 模拟验证成功并提取商户订单号
//            boolean verifySuccess = true; // TODO: 实际验证签名
//            String outTradeNo = "mock_out_trade_no"; // TODO: 从解析的数据中获取 out_trade_no
//
//            if (!verifySuccess) {
//                log.warn("微信支付回调签名验证失败");
//                return "<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名失败]]></return_msg></xml>";
//            }
//
//            // 根据商户订单号查询订单
//            Order orderToUpdate = orderMapper.selectByOutTradeNo(outTradeNo);
//            if (orderToUpdate == null) {
//                log.warn("微信支付回调：订单号 {} 不存在", outTradeNo);
//                return "<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[订单不存在]]></return_msg></xml>";
//            }
//
//            // 检查订单状态，防止重复处理
//            if (orderToUpdate.getStatus() == 0) { // 状态为0表示待支付
//                // 更新订单状态为已支付/已完成
//                orderToUpdate.setStatus(1); // 已支付
//                orderToUpdate.setPaymentStatus(1); // 已支付
//                Long currentTime = TimeUnit.MILLISECONDS.toSeconds(System.currentTimeMillis());
//                orderToUpdate.setPaidAt(currentTime);
//                orderMapper.updateOrder(orderToUpdate);
//
//                // 根据订单类型处理不同的业务逻辑
//                User user = userMapper.selectById(orderToUpdate.getUserId());
//                Product product = productMapper.selectById(orderToUpdate.getProductId());
//
//                if (user != null && product != null) {
//                    if (orderToUpdate.getOrderType() != null) {
//                        if (orderToUpdate.getOrderType() == 1) { // 会员购买
//                            // 更新用户会员状态
//                            user.setIsVIP(1);
//                            // PHP 代码中会员购买也增加了 Token，这里遵循原逻辑
//                            if (product.getDenomination() != null) {
//                                user.setTokenQuantity((user.getTokenQuantity() != null ? user.getTokenQuantity() : 0) + product.getDenomination());
//                            }
//                            userMapper.updateUser(user);
//
//                            log.info("订单 {} 支付成功，用户 {} 购买会员并增加 Token", outTradeNo, user.getId());
//
//                        } else if (orderToUpdate.getOrderType() == 2) { // Token 购买
//                            Long tokenQuantityToAdd = 0l;
//                            // 根据用户是否为VIP，增加不同数量的Token
//                            if (user.getIsVIP() != null && user.getIsVIP() == 1) {
//                                 if (product.getDenominationVip() != null) {
//                                    tokenQuantityToAdd = product.getDenominationVip();
//                                }
//                            } else {
//                                if (product.getDenomination() != null) {
//                                    tokenQuantityToAdd = product.getDenomination();
//                                }
//                            }
//
//                            if (tokenQuantityToAdd > 0) {
//                                 user.setTokenQuantity((user.getTokenQuantity() != null ? user.getTokenQuantity() : 0) + tokenQuantityToAdd);
//                                 userMapper.updateUser(user);
//
//                                // 记录 operate_token_flow 流水 (调用通用方法)
//                                userService.updateUserTokenAndLogFlow(user.getId(), tokenQuantityToAdd, 1, "购买Token，订单号: " + outTradeNo); // type 1 表示购买
//
//                                log.info("订单 {} 支付成功，用户 {} 购买 Token，增加 {} 个", outTradeNo, user.getId(), tokenQuantityToAdd);
//
//                            }
//
//                            // PHP 中 Token 购买直接设置订单状态为 3 (已完成)，这里保持一致
//                            orderToUpdate.setStatus(3);
//                            orderMapper.updateOrder(orderToUpdate);
//
//                        }
//                        // TODO: 其他订单类型的处理
//                    }
//                }
//
//                // TODO: 执行支付成功后的其他业务逻辑，例如：
//                // - 计算分销佣金并写入 commission_flow 表 (如果订单类型不是 Token 购买)
//                // - 更新用户总收益 (zhs_user 表)
//                // 这些逻辑需要根据您的具体业务需求实现
//                // 例如：
//                // if (order.getOrderType() != 2) { // Token 购买不参与分佣
//                //    distributionService.processCommission(order); // 假设 DistributionService 有处理佣金的方法
//                // }
//
//                log.info("微信支付回调成功处理订单：{}", outTradeNo);
//                // 返回成功给微信支付
//                return "<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>";
//            } else {
//                log.warn("微信支付回调：订单号 {} 已处理，当前状态 {}", outTradeNo, orderToUpdate.getStatus());
//                // 订单已处理，直接返回成功
//                return "<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>";
//            }
//
//        } catch (Exception e) {
//            log.error("微信支付回调处理失败：{}", e.getMessage(), e);
//            // 处理异常，返回失败给微信支付
//            return "<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[处理失败]]></return_msg></xml>";
//        }
//    }
//
//    // TODO: 如果 WXPayCOP.php 中的逻辑类似且与此相关，需要整合或创建 WXPayCOPService
//    // 可以先读取 WXPayCOP.php 的内容以进行判断
//
//    // Added withdrawal related methods based on WXSDKPay.php
//
//    /**
//     * 用户提现
//     * 对应 PHP 的 withdraw 方法
//     * @param userId 用户ID
//     * @param amount 提现金额
//     * @return 提现结果
//     */
//    @Transactional
//    public ResponseResultInfo withdraw(Integer userId, Long amount) {
//        // 参数校验
//        if (userId == null || amount == null || amount.compareTo(0L) <= 0) {
//            return ResponseResultInfo.builder()
//                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
//                    .msg("缺少必要的参数或提现金额无效")
//                    .build();
//        }
//
//        User user = userMapper.selectById(userId);
//        if (user == null) {
//            return ResponseResultInfo.builder()
//                    .code("404")
//                    .msg("用户不存在")
//                    .build();
//        }
//
//        // 检查用户余额是否充足
//        if (user.getBalance() == null || user.getBalance().compareTo(amount) < 0) {
//            return ResponseResultInfo.builder()
//                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
//                    .msg("余额不足")
//                    .build();
//        }
//
//        // TODO: 调用微信支付企业付款到零钱 API
//        // 这部分需要使用微信支付企业付款到零钱 SDK 或手动构建请求
//        // 示例 (模拟成功):
//        boolean transferSuccess = true; // TODO: 实际调用微信支付企业付款 API 并判断结果
//        String paymentNo = null; // TODO: 从微信支付返回结果中获取付款单号
//        //提现
//
//
//        if (transferSuccess) {
//            // 更新用户余额
//            user.setBalance(user.getBalance() + amount);
//            userMapper.updateUser(user);
//
//            // 记录提现流水
//            WithdrawalFlow withdrawalFlow = new WithdrawalFlow();
//            withdrawalFlow.setUserId(userId);
//            withdrawalFlow.setAmount(amount);
//            withdrawalFlow.setStatus(1); // 成功
//            withdrawalFlow.setPaymentNo(paymentNo); // 记录微信支付付款单号
//            withdrawalFlow.setCreatedAt((int) (System.currentTimeMillis() / 1000L));
//            withdrawalFlowMapper.insertWithdrawalFlow(withdrawalFlow);
//
//            return ResponseResultInfo.builder()
//                    .code(ResultConfig.SUCCESS_CODE.toString())
//                    .msg("提现成功")
//                    .data(withdrawalFlow) // 可以返回流水信息
//                    .build();
//        } else {
//            // 提现失败
//            // TODO: 记录提现失败流水
//             WithdrawalFlow withdrawalFlow = new WithdrawalFlow();
//             withdrawalFlow.setUserId(userId);
//             withdrawalFlow.setAmount(amount);
//             withdrawalFlow.setStatus(2); // 失败
//             withdrawalFlow.setCreatedAt((int) (System.currentTimeMillis() / 1000L));
//             // 可以记录微信支付返回的错误信息
//             // withdrawalFlow.setRemark("微信支付企业付款失败: " + errorMsg);
//             withdrawalFlowMapper.insertWithdrawalFlow(withdrawalFlow);
//
//            return ResponseResultInfo.builder()
//                    .code("500")
//                    .msg("提现失败，请稍后再试")
//                    // TODO: 可以将微信支付返回的详细错误信息放入 data 中
//                    .build();
//        }
//    }
//
//    /**
//     * 微信提现回调处理 (如果微信支持提现回调)
//     * TODO: 确认微信企业付款是否有回调，以及如何处理
//     *
//     * @param notifyData 微信支付回调的 XML 或 JSON 数据
//     * @return 返回给微信支付的响应 (XML)
//     */
//    @Transactional
//    public String handleWithdrawNotify(String notifyData) {
//        try {
//            // TODO: 解析微信支付回调数据 (XML 或 JSON)，验证签名
//            // 使用微信支付 SDK 或手动解析和验证
//            // 示例 (使用模拟数据，实际需要解析 notifyData):
//            Map<String, String> data = new HashMap<>();
//            // data.put("return_code", "SUCCESS");
//            // data.put("result_code", "SUCCESS");
//            // data.put("partner_trade_no", "the_withdrawal_partner_trade_no"); // 从回调数据中获取
//
//            // 模拟验证成功并提取商户订单号
//            boolean verifySuccess = true; // TODO: 实际验证签名
//            String partnerTradeNo = "mock_partner_trade_no"; // TODO: 从解析的数据中获取 partner_trade_no
//            String paymentNo = "mock_payment_no"; // TODO: 从解析的数据中获取 payment_no
//            String resultCode = "SUCCESS"; // TODO: 从解析的数据中获取 result_code
//
//            if (!verifySuccess) {
//                log.warn("微信提现回调签名验证失败");
//                return "<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名失败]]></return_msg></xml>";
//            }
//
//            // 根据商户订单号查询提现流水
//            WithdrawalFlow withdrawalFlow = withdrawalFlowMapper.selectByPartnerTradeNo(partnerTradeNo);
//            if (withdrawalFlow == null) {
//                log.warn("未找到对应的提现流水记录: {}", partnerTradeNo);
//                return "<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[提现流水不存在]]></return_msg></xml>";
//            }
//
//            // 检查状态，避免重复处理
//            if (withdrawalFlow.getStatus() != 0) { // 如果不是处理中状态
//                log.warn("提现流水 {} 状态 {} 已处理，不再重复处理", partnerTradeNo, withdrawalFlow.getStatus());
//                return "<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>"; // 告诉微信已成功处理
//            }
//
//            // 更新提现流水状态
//            int newStatus = 2; // 默认失败
//            if ("SUCCESS".equals(resultCode)) {
//                newStatus = 1; // 成功
//            }
//
//            withdrawalFlow.setStatus(newStatus);
//            withdrawalFlow.setPaymentNo(paymentNo);
//            withdrawalFlow.setUpdatedAt((int) TimeUnit.MILLISECONDS.toSeconds(System.currentTimeMillis()));
//            withdrawalFlowMapper.updateWithdrawalFlow(withdrawalFlow);
//
//            if (newStatus == 1) {
//                // 提现成功后，更新用户余额 (如果是在这里扣除余额)
//                // TODO: 确认是在提现申请时扣除还是回调成功时扣除
//                User user = userMapper.selectById(withdrawalFlow.getUserId());
//                if (user != null) {
//                    // user.setBalance(user.getBalance().subtract(withdrawalFlow.getAmount())); // 如果在这里扣除
//                    // userMapper.updateUser(user);
//                }
//            }
//
//            // 返回成功响应给微信
//            return "<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>";
//
//        } catch (Exception e) {
//            log.error("处理微信提现回调异常：{}", e.getMessage(), e);
//            return "<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[处理失败]]></return_msg></xml>";
//        }
//    }
//
//    private Config getPayConfig(){
//        if(Objects.isNull(this.payConfig)){
//            payConfig = new RSAAutoCertificateConfig.Builder()
//                    // 商户号
//                    .merchantId(shopsId)
//                    // 商户API私钥路径
//                    .privateKeyFromPath(certApiClientPath)
//                    // 商户证书序列号
//                    .merchantSerialNumber(certNum)
//                    // 商户APIV3密钥
//                    .apiV3Key(v3Key)
//                    .build();
//        }
//        return this.payConfig;
//    }
//
//    private JsapiServiceExtension getJsapiService(){
//        if(Objects.isNull(this.jsapiService)){
//            // 构建service
//            this.jsapiService = new JsapiServiceExtension.Builder().config(getPayConfig()).build();
//        }
//        return this.jsapiService;
//    }
//    private RefundService getRefundService(){
//        if(Objects.isNull(this.refundService)){
//            // 构建service
//            this.refundService = new RefundService.Builder().config(getPayConfig()).build();
//        }
//        return this.refundService;
//    }
//    private NotificationParser getNotificationParser() {
//        if(Objects.isNull(this.notificationParser)){
//
//            // 构建service
////            this.notificationParser = new NotificationParser(getPayConfig())
//        }
//        return this.notificationParser;
//    }
//
//
//
//    public String pay(Map<String, Object> param){
//        // 时间戳
//        Long payTime = new Date().getTime();
//        // 订单号
//        String outTradeNo = "WX" + getRandomString(8) + payTime;
//        initService();
//
//        String desc;
//        if(Objects.isNull(param.get("desc"))){
//            desc = "";
//        } else {
//            desc = param.get("desc").toString();
//        }
//        String openId = param.get("openId").toString();
//        Object productType = param.get("productType");
//
//        //保存订单
//        Order order = new Order();
//        String activityId = null;
//        Long productId = null;
//
//        Integer num;
//        if(Objects.nonNull(productType) && productType.equals(1) ){
//            activityId = param.get("id").toString();
//            // 获取金额
//            ZhsActivity activity = activityMapper.selectZhsActivityById(activityId);
//            num = Integer.parseInt(param.get("amount").toString()) * 100 * activity.getMultiple();
//            order.setOrderType(3);
//        } else {
//            productId = Long.valueOf(param.get("id").toString());
//            // 获取金额
//            Product product = productMapper.selectById(productId);
//            num = product.getPrice() * 100;
//            if(productId.equals(1)){
//                order.setOrderType(1);
//            } else {
//                order.setOrderType(2);
//            }
//        }
//        Amount amount = new Amount();
////        amount.setTotal(num);
//        amount.setTotal(1);
//        // 用户id
//        Payer payer = new Payer();
//        payer.setOpenid(openId);
//
//        // 构建Request
//        PrepayRequest prepayRequest = new PrepayRequest();
//        // 公众号ID（小程序id）
//        prepayRequest.setAppid(appId);
//        // 直连商户号
//        prepayRequest.setMchid(shopsId);
//        // 商品描述
//        prepayRequest.setDescription("测试");
//        // 商户订单号 说明：商户订单号
//        prepayRequest.setOutTradeNo(outTradeNo);
//        // 通知地址 说明：有效性：1. HTTPS；2. 不允许携带查询串
//        prepayRequest.setNotifyUrl(notifyUrl);
//        // 金额
//        prepayRequest.setAmount(amount);
//
//        prepayRequest.setPayer(payer);
//        // 调用下单方法，得到应答
//        PrepayWithRequestPaymentResponse response = jsapiService.prepayWithRequestPayment(prepayRequest);
//
//        User byOpenId = userService.getByOpenId(openId);
//
//        order.setOutTradeNo(outTradeNo);
//        order.setOpenId(openId);
//        order.setAmount(amount.getTotal());
//        order.setUserId(byOpenId.getId());
//        order.setStatus(0);
//        order.setCreatedAt(payTime / 1000);
//        order.setProductId(productId);
//        order.setActivityId(activityId);
//        orderMapper.insertOrder(order);
//
//        // 拼装返回数据
//        Map<String, Object> result = Maps.newHashMap();
//        result.put("package",  response.getPackageVal());
//        result.put("timeStamp",payTime.toString());
//        result.put("signType:",response.getSignType());
////        String randomString = getRandomString(32);
//        result.put("nonceStr",response.getNonceStr());
////        String sign = getSign(appId, payTime.toString(), randomString, response.getPackageVal());
//        result.put("paySign", response.getPaySign());
//        result.put("outTradeNo",outTradeNo);
//
//        Map<String, Object> resultParam = Maps.newHashMap();
//        resultParam.put("code",200);
//        resultParam.put("msg","success");
//        resultParam.put("data",result);
//
//        return JSONUtils.toJSONString(resultParam);
//    }
//    public Transaction queryOrderById(Map<String, Object> request){
//        initService();
//        String transactionId = request.get("transactionId").toString();
//
//        // 构建Request
//        QueryOrderByIdRequest prepayRequest = new QueryOrderByIdRequest();
//        // 直连商户号
//        prepayRequest.setMchid(shopsId);
//        prepayRequest.setTransactionId(transactionId);
//        // 通知地址 说明：有效性：1. HTTPS；2. 不允许携带查询串
////        prepayRequest.setNotifyUrl("https://47.94.40.108.com/api/wechat/notify");
//        // 调用下单方法，得到应答
//        Transaction transaction = jsapiService.queryOrderById(prepayRequest);
//        System.out.println(transaction);
//        return transaction;
//    }
//
//
//    public static String getRandomString(int length){
//        String str="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
//        Random random=new Random();
//        StringBuffer sb=new StringBuffer();
//        for(int i=0;i<length;i++){
//            int number=random.nextInt(36);
//            sb.append(str.charAt(number));
//        }
//        return sb.toString();
//    }
//
//    public Transaction queryOrderByOutTradeNo(Map<String, Object> param) {
//        initService();
//        String outTradeNo = param.get("outTradeNo").toString();
//
//        // 构建Request
//        QueryOrderByOutTradeNoRequest prepayRequest = new QueryOrderByOutTradeNoRequest();
//        // 直连商户号
//        prepayRequest.setMchid(shopsId);
//        prepayRequest.setOutTradeNo(outTradeNo);
//        // 调用下单方法，得到应答
//        return jsapiService.queryOrderByOutTradeNo(prepayRequest);
//    }
//
//    public Transaction closeOrder(Map<String, Object> param) {
//        initService();
//        String outTradeNo = param.get("outTradeNo").toString();
//        //修改支付状态
//        Integer orderNUm = orderMapper.updateStatus(outTradeNo, 4);
//
//        // 构建Request
//        QueryOrderByOutTradeNoRequest prepayRequest = new QueryOrderByOutTradeNoRequest();
//        // 直连商户号
//        prepayRequest.setMchid(shopsId);
//        prepayRequest.setOutTradeNo(outTradeNo);
//        // 通知地址 说明：有效性：1. HTTPS；2. 不允许携带查询串
////        prepayRequest.setNotifyUrl("https://47.94.40.108.com/api/wechat/notify");
//        // 调用下单方法，得到应答
//        return jsapiService.queryOrderByOutTradeNo(prepayRequest);
//    }
//
//    public Refund refunds(Map<String, Object> param) {
//        initService();
//        String openId = param.get("openId").toString();
//        String transactionId = param.get("transactionId").toString();
//        String outTradeNo = param.get("outTradeNo").toString();
//        String outRefundNo = param.get("outRefundNo").toString();
//        String reason = param.get("reason").toString();
////        String fundsAccount = param.get("fundsAccount").toString();
////        String goodsDetail = param.get("goodsDetail").toString();
//        Float num = (Float)param.get("Amount") * 100;
//        AmountReq amount = new AmountReq();
//        amount.setTotal(NumberUtils.toLong(num.toString()));
//        // 用户id
//        Payer payer = new Payer();
//        payer.setOpenid(openId);
//
//        // 构建Request
//        CreateRequest prepayRequest = new CreateRequest();
//        // 订单号id
//        prepayRequest.setTransactionId(transactionId);
//        // 商户订单号 *transaction_id和out_trade_no必须二选一进行传参。
//        prepayRequest.setOutTradeNo(outTradeNo);
//        // 商户退款单号
//        prepayRequest.setOutTradeNo(outRefundNo);
//        // 退款原因
//        prepayRequest.setReason(reason);
//        // 退款资金来源
////        prepayRequest.setFundsAccount(fundsAccount);
//        prepayRequest.setAmount(amount);
//        // 退款商品
////        prepayRequest.setGoodsDetail(goodsDetail);
//        // 通知地址 说明：有效性：1. HTTPS；2. 不允许携带查询串 *选填
//        prepayRequest.setNotifyUrl(notifyUrl);
//        // 调用下单方法，得到应答
//
//        return refundService.create(prepayRequest);
//    }
//
////    public static void main(String[] args) throws Exception {
////        // 加载私钥
////        String privateKeyPEM = new String(Files.readAllBytes(Paths.get("D:/WXCertUtil/cert/1714645682_20250529_cert/test_key.pem")));
////        privateKeyPEM = privateKeyPEM
////                .replace("-----BEGIN PRIVATE KEY-----", "")
////                .replace("-----END PRIVATE KEY-----", "")
////                .replaceAll("\\s", "");
////
////        byte[] decodedKey = Base64.getDecoder().decode(privateKeyPEM);
////        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
////        PrivateKey privateKey = keyFactory.generatePrivate(new PKCS8EncodedKeySpec(decodedKey));
////
////        // 要签名的数据
////        String data = "wx2421b1c4370ec43b\n1554208460\n593BEC0C930BF1AFEB40B4A08C8FB242\nprepay_id=wx201410272009395522657a690389285100\n";
////        byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8.name());
////
////        // 创建签名对象
////        Signature signature = Signature.getInstance("SHA256withRSA");
////        signature.initSign(privateKey);
////        signature.update(dataBytes);
////
////        // 生成签名
////        byte[] digitalSignature = signature.sign();
////
////        // 将签名转换为 Base64 字符串
////        String signatureBase64 = Base64.getEncoder().encodeToString(digitalSignature);
////        System.out.println("Signature (Base64): " + signatureBase64);
////    }
//    public String getSign(String data){
//
//        // 加载私钥
//        String privateKeyPEM = null;
//        try {
//            privateKeyPEM = new String(Files.readAllBytes(Paths.get(certApiClientPath)));
//            privateKeyPEM = privateKeyPEM
//                    .replace("-----BEGIN PRIVATE KEY-----", "")
//                    .replace("-----END PRIVATE KEY-----", "")
//                    .replaceAll("\\s", "");
//
//            byte[] decodedKey = Base64.getDecoder().decode(privateKeyPEM);
//            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
//            PrivateKey privateKey = keyFactory.generatePrivate(new PKCS8EncodedKeySpec(decodedKey));
//
//            byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8);
//
//            // 创建签名对象
//            Signature signature = Signature.getInstance("SHA256withRSA");
//            signature.initSign(privateKey);
//            signature.update(dataBytes);
//
//            // 生成签名
//            byte[] digitalSignature = signature.sign();
//
//            // 将签名转换为 Base64 字符串
//            String signatureBase64 = Base64.getEncoder().encodeToString(digitalSignature);
////            System.out.println("Signature (Base64): " + signatureBase64);
//            return signatureBase64;
//        } catch (Exception e) {
//            throw new RuntimeException(e);
//        }
//    }
//    private String getSign(String appId, String time, String radom, String param){
//        String data = appId + "\n" + time + "\n" + radom + "\n" + param + "\n";
//        return getSign(data);
//    }
//
//
//    public boolean verifySign(String data, String sign) {
//        return false;
//    }
//
//
//    private void setActivityToken(User user, String activityId, Integer amount) {
//        ZhsActivity zhsActivity = activityMapper.selectZhsActivityById(activityId);
//        Long tokenQuantity = (amount/100) * zhsActivity.getComputing();
//        user.setTokenQuantity(tokenQuantity);
//    }
//
//    private void setProductToken(User user, Long productId){
//
//        Product product = productMapper.selectById(productId);
//        if(product.getId() == 1){
//            user.setIsVIP(1);
//        }
//        // 修改次数
//        User byOpenId = userService.getByOpenId(user.getOpenId());
//        Integer isVIP = byOpenId.getIsVIP();
//        Integer identityType = byOpenId.getIdentityTypy();
//
//        if(identityType == 1){
//            user.setTokenQuantity(Long.valueOf(product.getDenominationOperate()));
//        } else if(isVIP == 1){
//            user.setTokenQuantity(Long.valueOf(product.getDenominationVip()));
//        }else {
//            user.setTokenQuantity(Long.valueOf(product.getDenomination()));
//        }
//    }
//
//}