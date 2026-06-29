package com.ai.manager.small.service.impl;

import cn.hutool.core.bean.BeanUtil;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.core.constants.WXConfig;
import com.ai.manager.core.utils.JsonUtils;
import com.ai.manager.course.domain.ZhsCoursePayLog;
import com.ai.manager.course.service.IZhsCoursePayLogService;
import com.ai.manager.small.domain.*;
import com.ai.manager.small.mapper.OrderMapper;
import com.ai.manager.small.mapper.ProductMapper;
import com.ai.manager.small.mapper.ZhsAgentBuyMapper;
import com.ai.manager.small.mapper.ZhsProductIdentityMapper;
import com.ai.manager.small.service.*;
import com.google.common.collect.Maps;
import com.wechat.pay.java.core.RSAPublicKeyConfig;
import com.wechat.pay.java.core.notification.NotificationParser;
import com.wechat.pay.java.core.notification.RequestParam;
import com.wechat.pay.java.service.payments.app.AppServiceExtension;
import com.wechat.pay.java.service.payments.jsapi.JsapiServiceExtension;
import com.wechat.pay.java.service.payments.jsapi.model.*;
import com.wechat.pay.java.service.payments.model.Transaction;
import com.wechat.pay.java.service.refund.RefundService;
import com.wechat.pay.java.service.refund.model.AmountReq;
import com.wechat.pay.java.service.refund.model.CreateRequest;
import com.wechat.pay.java.service.refund.model.Refund;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.math.NumberUtils;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class WXPayNowServiceImpl implements WxPayNowServer {

    private static final Logger log = LoggerFactory.getLogger(WXPayNowServiceImpl.class);


    @Value("${wx.appid}")
    private String appId;
    @Value("${wx.secret}")
    private String secret;
    @Value("${wx.app.appid}")
    private String app_appId;
    @Value("${wx.app.secret}")
    private String app_secret;
    @Value("${wx.shops.id}")
    private String shopsId;
    @Value("${wx.shops.v3Key}")
    private String v3Key;
    @Value("${wx.shops.cert.apiclient.path}")
    private String certApiClientPath;
    @Value("${wx.shops.cert.num}")
    private String certNum;
    @Value("${wx.shops.cert.public.path}")
    private String certPublicPath;
    @Value("${wx.shops.public.num}")
    private String certPublicNum;
    @Value("${wx.jsapi.notify}")
    private String notifyUrl;
    @Value("${wx.jsapi.notify2}")
    private String notifyUrl2;

    @Value("${ai.default.product.url}")
    private String productUrl;

    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private ProductMapper productMapper;
    @Autowired
    private ZhsProductIdentityMapper productIdentityMapper;

    @Autowired
    private IZhsUserService zhsUserService;

    @Autowired
    private IZhsActivityService activityService;
    @Autowired
    private IZhsCommissionFlowService commissionFlowService;
    @Autowired
    private ZhsAgentBuyMapper zhsAgentBuyMapper;
    @Autowired
    private IZhsCoursePayLogService payLogService;

    private RSAPublicKeyConfig payConfig;
    private JsapiServiceExtension jsapiService;
    private AppServiceExtension appService;
    private RefundService refundService;
    private NotificationParser notificationParser;
    @PostConstruct
    private void initService(){
        getPayConfig();
        getJsapiService();
        getRefundService();
        getNotificationParser();
        getAppService();
    }
    private RSAPublicKeyConfig getPayConfig(){
        if(Objects.isNull(this.payConfig)){
//            payConfig = new RSAAutoCertificateConfig.Builder()
            payConfig = new RSAPublicKeyConfig.Builder()
                    // 商户号
                    .merchantId(shopsId)
                    // 商户API私钥路径
                    .privateKeyFromPath(certApiClientPath)
                    // 公钥路径
                    .publicKeyFromPath(certPublicPath)
                    // 公钥ID
                    .publicKeyId(certPublicNum)
                    // 商户证书序列号
                    .merchantSerialNumber(certNum)
                    // 商户APIV3密钥
                    .apiV3Key(v3Key)
                    .build();
        }
        return this.payConfig;
    }
    private void getJsapiService(){
        if(Objects.isNull(this.jsapiService)){
            // 构建service
            this.jsapiService = new JsapiServiceExtension.Builder().config(getPayConfig()).build();
        }
    }
    private void getAppService(){
        if(Objects.isNull(this.appService)){
            // 构建service
            this.appService = new AppServiceExtension.Builder().config(getPayConfig()).build();
        }
    }
    private void getRefundService(){
        if(Objects.isNull(this.refundService)){
            // 构建service
            this.refundService = new RefundService.Builder().config(getPayConfig()).build();
        }
    }
    private void getNotificationParser() {
        if(Objects.isNull(this.notificationParser)){
            // 构建service
            this.notificationParser = new NotificationParser(getPayConfig());
        }
    }


    private String getSign(String data){

        // 加载私钥
        String privateKeyPEM = null;
        try {
            privateKeyPEM = new String(Files.readAllBytes(Paths.get(certApiClientPath)));
            privateKeyPEM = privateKeyPEM
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s", "");

            byte[] decodedKey = Base64.getDecoder().decode(privateKeyPEM);
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            PrivateKey privateKey = keyFactory.generatePrivate(new PKCS8EncodedKeySpec(decodedKey));

            byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8);

            // 创建签名对象
            Signature signature = Signature.getInstance("SHA256withRSA");
            signature.initSign(privateKey);
            signature.update(dataBytes);

            // 生成签名
            byte[] digitalSignature = signature.sign();

            // 将签名转换为 Base64 字符串
            String signatureBase64 = Base64.getEncoder().encodeToString(digitalSignature);
//            System.out.println("Signature (Base64): " + signatureBase64);
            return signatureBase64;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
    private String getSign(String appId, String time, String random, String param){
        String data = appId + "\n" + time + "\n" + random + "\n" + param + "\n";
        return getSign(data);
    }

    /**
     * 构建成功响应
     */
    private Map<String, Object> buildSuccessResponse(String message) {
        HashMap<String, Object> resultInfo = Maps.newHashMap();
        resultInfo.put("code", ResultConfig.SUCCESS);
        resultInfo.put("message", message);
        return resultInfo;
    }

    /**
     * 构建错误响应
     */
    private Map<String, Object> buildErrorResponse(String message) {
        HashMap<String, Object> resultInfo = Maps.newHashMap();
        resultInfo.put("code", ResultConfig.WX_ERROR_CODE);
        resultInfo.put("message", message);
        return resultInfo;
    }

    /**
     * 处理智能体购买订单
     */
    private Map<String, Object> handleAgentBuyOrder(String outTradeNo, Transaction transaction) {
        ZhsAgentBuy zhsAgentBuy = zhsAgentBuyMapper.selectByOrderNo(outTradeNo);
        if (Objects.isNull(zhsAgentBuy)) {
            log.warn("微信支付回调：智能体订单号 {} 不存在", outTradeNo);
            return buildErrorResponse("订单不存在");
        }

        if ("SUCCESS".equals(transaction.getTradeState().toString())) {
            zhsAgentBuy.setSettlement("1");
            zhsAgentBuyMapper.updateZhsAgentBuy(zhsAgentBuy);
            log.info("微信支付回调成功处理智能体订单：{}", outTradeNo);
            return buildSuccessResponse("成功");
        }

        return null; // 表示支付状态非成功，需要继续处理
    }

    /**
     * 处理普通订单
     */
    private Map<String, Object> handleNormalOrder(String outTradeNo, Transaction transaction) {
        Order order = orderMapper.selectByOutTradeNo(outTradeNo);
        if (Objects.isNull(order)) {
            log.warn("微信支付回调：普通订单号 {} 不存在", outTradeNo);
            return buildErrorResponse("订单不存在");
        }

        if (order.getStatus() == 0 && "SUCCESS".equals(transaction.getTradeState().toString())) {
            zhsUserService.userPayNotify(order);
            log.info("微信支付回调成功处理普通订单：{}", outTradeNo);
            return buildSuccessResponse("成功");
        }

        return null; // 表示支付状态非成功，需要继续处理
    }


    @Override
    public Map<String,Object> handleNotify(String requestBody, String wechatPaySerial, String wechatPaySignature, String wechatPayTimestamp, String wechatPayNonce) {
        try {
            // 确保 notificationParser 已初始化
            if (this.notificationParser == null) {
                log.error("NotificationParser 未初始化，无法处理回调。");
                return buildErrorResponse("验签内部错误");
            }

            // 构建请求参数并解析回调通知
            RequestParam requestParam = new RequestParam.Builder()
                    .serialNumber(wechatPaySerial)
                    .nonce(wechatPayNonce)
                    .signature(wechatPaySignature)
                    .timestamp(wechatPayTimestamp)
                    .body(requestBody)
                    .build();

            Transaction transaction = notificationParser.parse(requestParam, Transaction.class);
            String outTradeNo = transaction.getOutTradeNo();
            log.info("微信支付回调验签成功，商户订单号: {}", outTradeNo);

            // 根据订单号前缀判断订单类型并处理
            Map<String, Object> result = outTradeNo.startsWith("WXAT")
                    ? handleAgentBuyOrder(outTradeNo, transaction)
                    : handleNormalOrder(outTradeNo, transaction);

            // 如果处理成功，直接返回结果
            if (result != null) {
                return result;
            }

            // 支付状态非成功的情况
            log.warn("微信支付回调：订单号 {} 支付状态非成功: {}", outTradeNo, transaction.getTradeState());
            return buildSuccessResponse("订单状态非成功，已记录");

        } catch (Exception e) {
            log.error("微信支付回调处理失败：{}", e.getMessage(), e);
            return buildErrorResponse("处理失败");
        }
    }
//
//    @Deprecated
//    public Map pay(Map<String, Object> param){
//        // 时间戳
//        long payTime = Instant.now().getEpochSecond();
//        // 订单号
//        String outTradeNo = "WX" + getRandomString(8) + payTime;
//        JSONObject request = new JSONObject(param);
//        String desc = request.getString("desc");
//        String openId = request.getString("openId");
//        int productType = request.getInt("productType");
//
//        //保存订单
//        Order order = new Order();
//        String activityId = null;
//        Long productId = null;
//        String productIdentityId = null;
//
//        Integer num;
//        if(productType == 1){
//            log.info("优惠活动商品");
//            activityId = request.get("id").toString();
//            // 获取金额
//            ZhsActivity activity = activityService.selectZhsActivityById(activityId);
//            num = request.getInt("amount") * activity.getMultiple();
//            order.setOrderType(3);
//        } else if (productType == 2) {
//            log.info("开通身份");
//            productIdentityId = request.get("id").toString();
//            ZhsProductIdentity productIdentity = productIdentityMapper.selectZhsProductIdentityById(productIdentityId);
//            // 判断时间是否在活动期限内
//            long time = new Date().getTime();
//            if(productIdentity.getStatus() == 1 && productIdentity.getBeginTime().getTime() <= time && productIdentity.getEndTime().getTime() >= time ){
//                num = productIdentity.getAmount();
//            } else {
//                num = productIdentity.getDefAmount();
//            }
//        } else {
//            log.info("普通商品");
//            productId = request.getLong("id");
//            // 获取金额
//            Product product = productMapper.selectById(productId);
//            num = product.getPrice();
//
//            order.setOrderType(productId == 1 ? 1 : 2);
//        }
//
//        // 调用微信支付
//        PrepayWithRequestPaymentResponse response = wxPay(openId, desc, outTradeNo, num);
//
//        // 创建本地订单
//        User byOpenId = userService.getByOpenId(openId);
//        order.setOutTradeNo(outTradeNo);
////        order.setOpenId(openId);
//        order.setOpenId(byOpenId.getToken());
//        order.setAmount(num);
//        order.setUserId(byOpenId.getId());
//        order.setStatus(0);
//        order.setCreatedAt(Long.valueOf(response.getTimeStamp()));
//        order.setProductId(productId);
//        order.setActivityId(activityId);
//        order.setProductIdentityId(productIdentityId);
//        orderMapper.insertOrder(order);
//
//        // 拼装返回数据
//        Map<String, Object> result = Maps.newHashMap();
//        result.put("package",  response.getPackageVal());
//        result.put("timeStamp",response.getTimeStamp());
//        result.put("signType",response.getSignType());
//        result.put("nonceStr",response.getNonceStr());
//        result.put("paySign", response.getPaySign());
//        result.put("outTradeNo",outTradeNo);
//
////        Map<String, Object> resultParam = Maps.newHashMap();
////        resultParam.put("code",200);
////        resultParam.put("msg","success");
////        resultParam.put("data",result);
//
////        return JSONUtils.toJSONString(resultParam);
//        return result;
//    }

    /**
     * 调用支付
     *
     * @param openId
     * @param desc
     * @param outTradeNo
     * @param num
     * @return
     */
    private PrepayWithRequestPaymentResponse wxPay(String openId, String desc, String outTradeNo, Integer num){
        Amount amount = new Amount();
        // TODO 放到线上需要吧这段内容修改成使用num，否则支付的金额永远是一份钱
        amount.setTotal(num);
//        amount.setTotal(1);
        // 用户id
        Payer payer = new Payer();
        payer.setOpenid(openId);

        // 构建Request
        PrepayRequest prepayRequest = new PrepayRequest();
        // 公众号ID（小程序id）
        prepayRequest.setAppid(appId);
        // 直连商户号
        prepayRequest.setMchid(shopsId);
        // 商品描述
        if(StringUtils.isEmpty(desc)){
            desc = "购买";
        }
        prepayRequest.setDescription(desc);
        // 商户订单号 说明：商户订单号
        prepayRequest.setOutTradeNo(outTradeNo);
        // 通知地址 说明：有效性：1. HTTPS；2. 不允许携带查询串
        if(outTradeNo.startsWith("WXAT")){
            //智能体回调地址
            prepayRequest.setNotifyUrl(notifyUrl2);
        } else if (outTradeNo.startsWith("COURSE")){
            //智能体回调地址
            prepayRequest.setNotifyUrl(notifyUrl2);

        } else {
            prepayRequest.setNotifyUrl(notifyUrl);
        }
        // 金额
        prepayRequest.setAmount(amount);

        prepayRequest.setPayer(payer);
        // 调用下单方法，得到应答
        return jsapiService.prepayWithRequestPayment(prepayRequest);
    }

    public Transaction queryOrderById(Map<String, Object> request){
//        initService();
        String transactionId = request.get("transactionId").toString();

        // 构建Request
        QueryOrderByIdRequest prepayRequest = new QueryOrderByIdRequest();
        // 直连商户号
        prepayRequest.setMchid(shopsId);
        prepayRequest.setTransactionId(transactionId);
        // 通知地址 说明：有效性：1. HTTPS；2. 不允许携带查询串
//        prepayRequest.setNotifyUrl("https://47.94.40.108.com/api/wechat/notify");
        // 调用下单方法，得到应答
        Transaction transaction = jsapiService.queryOrderById(prepayRequest);
        System.out.println(transaction);
        return transaction;
    }


    public static String getRandomString(int length){
        String str="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        Random random=new Random();
        StringBuffer sb=new StringBuffer();
        for(int i=0;i<length;i++){
            int number=random.nextInt(36);
            sb.append(str.charAt(number));
        }
        return sb.toString();
    }

    public Transaction queryOrderByOutTradeNo(Map<String, Object> param) {
//        initService();
        String outTradeNo = param.get("outTradeNo").toString();

        // 构建Request
        QueryOrderByOutTradeNoRequest prepayRequest = new QueryOrderByOutTradeNoRequest();
        // 直连商户号
        prepayRequest.setMchid(shopsId);
        prepayRequest.setOutTradeNo(outTradeNo);
        // 调用下单方法，得到应答
        return jsapiService.queryOrderByOutTradeNo(prepayRequest);
    }

    public Transaction closeOrder(Map<String, Object> param) {
//        initService();
        String outTradeNo = param.get("outTradeNo").toString();
        //修改支付状态
        Integer orderNUm = orderMapper.updateStatus(outTradeNo, 4);

        // 构建Request
        QueryOrderByOutTradeNoRequest prepayRequest = new QueryOrderByOutTradeNoRequest();
        // 直连商户号
        prepayRequest.setMchid(shopsId);
        prepayRequest.setOutTradeNo(outTradeNo);
        // 通知地址 说明：有效性：1. HTTPS；2. 不允许携带查询串
//        prepayRequest.setNotifyUrl("https://47.94.40.108.com/api/wechat/notify");
        // 调用下单方法，得到应答
        return jsapiService.queryOrderByOutTradeNo(prepayRequest);
    }

    public Refund refunds(Map<String, Object> param) {
//        initService();
        String openId = param.get("openId").toString();
        String transactionId = param.get("transactionId").toString();
        String outTradeNo = param.get("outTradeNo").toString();
        String outRefundNo = param.get("outRefundNo").toString();
        String reason = param.get("reason").toString();
//        String fundsAccount = param.get("fundsAccount").toString();
//        String goodsDetail = param.get("goodsDetail").toString();
        Float num = (Float)param.get("Amount") * 100;
        AmountReq amount = new AmountReq();
        amount.setTotal(NumberUtils.toLong(num.toString()));
        // 用户id
        Payer payer = new Payer();
        payer.setOpenid(openId);

        // 构建Request
        CreateRequest prepayRequest = new CreateRequest();
        // 订单号id
        prepayRequest.setTransactionId(transactionId);
        // 商户订单号 *transaction_id和out_trade_no必须二选一进行传参。
        prepayRequest.setOutTradeNo(outTradeNo);
        // 商户退款单号
        prepayRequest.setOutTradeNo(outRefundNo);
        // 退款原因
        prepayRequest.setReason(reason);
        // 退款资金来源
//        prepayRequest.setFundsAccount(fundsAccount);
        prepayRequest.setAmount(amount);
        // 退款商品
//        prepayRequest.setGoodsDetail(goodsDetail);
        // 通知地址 说明：有效性：1. HTTPS；2. 不允许携带查询串 *选填
        prepayRequest.setNotifyUrl(notifyUrl);
        // 调用下单方法，得到应答

        return refundService.create(prepayRequest);
    }

    /*public static void main(String[] args) throws Exception {
        // 加载私钥
        String privateKeyPEM = new String(Files.readAllBytes(Paths.get("D:/WXCertUtil/cert/1714645682_20250529_cert/test_key.pem")));
        privateKeyPEM = privateKeyPEM
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");

        byte[] decodedKey = Base64.getDecoder().decode(privateKeyPEM);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        PrivateKey privateKey = keyFactory.generatePrivate(new PKCS8EncodedKeySpec(decodedKey));

        // 要签名的数据
        String data = "wx2421b1c4370ec43b\n1554208460\n593BEC0C930BF1AFEB40B4A08C8FB242\nprepay_id=wx201410272009395522657a690389285100\n";
        byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8.name());

        // 创建签名对象
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initSign(privateKey);
        signature.update(dataBytes);

        // 生成签名
        byte[] digitalSignature = signature.sign();

        // 将签名转换为 Base64 字符串
        String signatureBase64 = Base64.getEncoder().encodeToString(digitalSignature);
        System.out.println("Signature (Base64): " + signatureBase64);
    }*/

    @Override
    public Map<String, Object> transferAccountsNotify(String res, String serial, String signature, String timestamp, String nonce) {
        HashMap<String, Object> resultInfo = Maps.newHashMap();
        try {
            // 预估错误信息
            resultInfo.put("code", ResultConfig.WX_ERROR_CODE);
            // 确保 notificationParser 已初始化
            if (this.notificationParser == null) {
                log.error("NotificationParser 未初始化，无法处理回调。");
                resultInfo.put("message", "验签内部错误");
                return resultInfo;
            }

            RequestParam requestParam = new RequestParam.Builder()
                    .serialNumber(serial)
                    .nonce(nonce)
                    .signature(signature)
                    .timestamp(timestamp)
                    .body(res)
                    .build();

            // 解析回调通知，SDK 会自动进行验签
            // Transaction.cla ss 需要替换为您期望解密出的具体通知类型，例如 com.wechat.pay.java.service.payments.model.Transaction
            TransferInfo transaction = notificationParser.parse(requestParam, TransferInfo.class);
            log.info( "\n" + JsonUtils.toJson(transaction) + "\n");
            String transferBillNo = transaction.getTransferBillNo();
            commissionFlowService.editTransferAccountsNotify(transferBillNo);

            /*// 验签成功，处理业务逻辑
            String outTradeNo = transaction.getOutTradeNo();
            log.info("微信支付回调验签成功，商户订单号: {}", outTradeNo);

            // 根据商户订单号查询订单
            Order order = orderMapper.selectByOutTradeNo(outTradeNo);
            if (Objects.isNull(order)) {
                log.warn("微信支付回调：订单号 {} 不存在", outTradeNo);
                resultInfo.put("message", "订单不存在");
                return resultInfo;
            }*/

            /*if (order.getStatus() == 0 && "SUCCESS".equals(transaction.getTradeState().toString())) { // 状态为0表示待支付

//                commissionFlowService.transferAccountsNotify();

                log.info("微信支付回调成功处理订单：{}", outTradeNo);
                resultInfo.put("code", ResultConfig.SUCCESS);
                resultInfo.put("message", "成功");
                return resultInfo;
            }
            log.warn("微信支付回调：订单号 {} 支付状态非成功: {}", outTradeNo, transaction.getTradeState());
            // 关闭订单
            */

            resultInfo.put("code", ResultConfig.SUCCESS);
            resultInfo.put("message", "订单状态非成功，已记录");
            return resultInfo;
        } catch (Exception e) {
            log.error("微信支付回调处理失败：{}", e.getMessage(), e);
            resultInfo.put("message", "处理失败");
            return resultInfo;
        }
    }

    @Override
    public Map pay(Map<String, Object> param) {
        // 时间戳
        long payTime = Instant.now().getEpochSecond();
        // 订单号
        String outTradeNo = "WX" + getRandomString(8) + payTime;
        JSONObject request = new JSONObject(param);
        String uuid = request.getString("uuid");
        String desc = request.getString("desc");
        String openId = request.getString("openId");
        int productType = request.getInt("productType");
        Object productId = request.get("id");
        Integer amount = null;
        if(productType == 1)
            amount = request.getInt("amount");

        switch (productType){
            case 4: {
                //购买智能体 使用智能体订单编号
                log.info("智能体购买");
                // 获取金额
                ZhsAgentBuy product = zhsAgentBuyMapper.selectZhsAgentBuyById(productId.toString());
                amount = product.getRealPrice();
                outTradeNo = product.getOrderNo();
            }
            break;
            case 6:
            case 7: {
                log.info("购买课程相关");
                outTradeNo = "COURSE" + getRandomString(8) + payTime;
                //保存订单
                ZhsCoursePayLog order = saveCourseOrderInfo(productType, productId.toString(), amount, uuid, outTradeNo);
                // 判断商品与订单规则，那实际存库金额（分为单位）
                amount = order.getAmount();
            }
            break;
            default: {
                //保存订单
                Order order = saveOrderInfo(productType, productId, amount, uuid, outTradeNo);
                // 判断商品与订单规则，那实际存库金额（分为单位）
                amount = order.getAmount();
                break;
            }
        }
        // 调用微信支付
        PrepayWithRequestPaymentResponse response = wxPay(openId, desc, outTradeNo, amount);
//        wxContract(op)

        // 拼装返回数据
        Map<String, Object> result = Maps.newHashMap();
        result.put("package",  response.getPackageVal());
        result.put("timeStamp",response.getTimeStamp());
        result.put("signType",response.getSignType());
        result.put("nonceStr",response.getNonceStr());
        result.put("paySign", response.getPaySign());
        result.put("outTradeNo",outTradeNo);

        return result;
    }

    @Override
    public Map<String, Object> courseNotify(String param, String serial, String signature, String timestamp, String nonce) {
        HashMap<String, Object> resultInfo = Maps.newHashMap();

        try {
            // 预估错误信息
            resultInfo.put("code", ResultConfig.WX_ERROR_CODE);

            // 确保 notificationParser 已初始化
            if (this.notificationParser == null) {
                log.error("NotificationParser 未初始化，无法处理回调。");
                resultInfo.put("message", "验签内部错误");
                return resultInfo;
            }

            RequestParam requestParam = new RequestParam.Builder()
                    .serialNumber(serial)
                    .nonce(nonce)
                    .signature(signature)
                    .timestamp(timestamp)
                    .body(param)
                    .build();

            // 解析回调通知，SDK 会自动进行验签
            com.wechat.pay.java.service.partnerpayments.nativepay.model.Transaction transaction = notificationParser.parse(requestParam, com.wechat.pay.java.service.partnerpayments.nativepay.model.Transaction.class);

            // 验签成功，处理业务逻辑
            String outTradeNo = transaction.getOutTradeNo();
            log.info("微信支付回调验签成功，商户订单号: {}", outTradeNo);

            // 根据商户订单号查询订单
            ZhsCoursePayLog order =  payLogService.getByOutBillNo(outTradeNo);
            if (Objects.isNull(order)) {
                log.warn("微信支付回调：订单号 {} 不存在", outTradeNo);
                resultInfo.put("message", "订单不存在");
                return resultInfo;
            }

            if (order.getStatus() == 0 && "SUCCESS".equals(transaction.getTradeState().toString())) { // 状态为0表示待支付
//            if (true) { // 状态为0表示待支付
                // 更新订单状态为已支付/已完成

                coursePayNotify(order);
//                zhsUserService.userPayNotifyByCenter(order);

                log.info("微信支付回调成功处理订单：{}", outTradeNo);
                resultInfo.put("code", ResultConfig.SUCCESS);
                resultInfo.put("message", "成功");
                return resultInfo;
            }
            log.warn("微信支付回调：订单号 {} 支付状态非成功: {}", outTradeNo, transaction.getTradeState());
            // 关闭订单

            resultInfo.put("code", ResultConfig.SUCCESS);
            resultInfo.put("message", "订单状态非成功，已记录");
            return resultInfo;
        } catch (Exception e) {
            log.error("微信支付回调处理失败：{}", e.getMessage(), e);
            resultInfo.put("message", "处理失败");
            return resultInfo;

        }
    }

    @Override
    public ResponseResultInfo getConsecutivelyProduct() {
        List<ZhsProductIdentity> productIdentities = productIdentityMapper.getConsecutivelyProduct();
        Map<Integer, List<ZhsProductIdentity>> collect = productIdentities.stream().collect(Collectors.groupingBy(ZhsProductIdentity::getType));
        return ResponseResultInfo.success(collect);
    }

    @Override
    public com.wechat.pay.java.service.payments.app.model.PrepayWithRequestPaymentResponse appPay(Map<String, Object> param) {
        // 时间戳
        long payTime = Instant.now().getEpochSecond();
        // 订单号
        String outTradeNo = "WX" + getRandomString(8) + payTime;
        JSONObject request = new JSONObject(param);
        String uuid = request.getString("uuid");
        String desc = request.getString("desc");
        int productType = request.getInt("productType");
        Object productId = request.get("id");
        Integer amount = null;
        if(productType == 1)
            amount = request.getInt("amount");

        switch (productType){
            case 4: {
                //购买智能体 使用智能体订单编号
                log.info("智能体购买");
                // 获取金额
                ZhsAgentBuy product = zhsAgentBuyMapper.selectZhsAgentBuyById(productId.toString());
                amount = product.getRealPrice();
                outTradeNo = product.getOrderNo();
            }
            break;
            case 6:
            case 7: {
                log.info("购买课程相关");
                outTradeNo = "COURSE" + getRandomString(8) + payTime;
                //保存订单
                ZhsCoursePayLog order = saveCourseOrderInfo(productType, productId.toString(), amount, uuid, outTradeNo);
                // 判断商品与订单规则，那实际存库金额（分为单位）
                amount = order.getAmount();
            }
            break;
            default: {
                //保存订单
                Order order = saveOrderInfo(productType, productId, amount, uuid, outTradeNo);
                // 判断商品与订单规则，那实际存库金额（分为单位）
                amount = order.getAmount();
                break;
            }
        }
        // 调用微信支付
        com.wechat.pay.java.service.payments.app.model.PrepayWithRequestPaymentResponse response = wxAppPay(desc, outTradeNo, amount);
        Map<String, Object> result = Maps.newHashMap();
        BeanUtil.copyProperties(response, result);
        result.put("outTradeNo", outTradeNo);

        return response;
//        wxContract(op)

//        // 拼装返回数据
//        Map<String, Object> result = Maps.newHashMap();
//        result.put("package",  response.getPackageVal());
//        result.put("timeStamp",response.getTimeStamp());
//        result.put("signType",response.getSignType());
//        result.put("nonceStr",response.getNonceStr());
//        result.put("paySign", response.getPaySign());
//        result.put("outTradeNo",outTradeNo);
//
//        return result;
    }

    private com.wechat.pay.java.service.payments.app.model.PrepayWithRequestPaymentResponse  wxAppPay(String desc, String outTradeNo, Integer num) {
        com.wechat.pay.java.service.payments.app.model.Amount amount = new com.wechat.pay.java.service.payments.app.model.Amount ();
        // TODO 放到线上需要吧这段内容修改成使用num，否则支付的金额永远是一份钱
//        amount.setTotal(num);
        amount.setTotal(1);

        // 构建Request
        com.wechat.pay.java.service.payments.app.model.PrepayRequest prepayRequest = new com.wechat.pay.java.service.payments.app.model.PrepayRequest();
        // 公众号ID（小程序id）
        prepayRequest.setAppid(app_appId);
        // 直连商户号
        prepayRequest.setMchid(shopsId);
        // 商品描述
        if(StringUtils.isEmpty(desc)){
            desc = "购买";
        }
        prepayRequest.setDescription(desc);
        // 商户订单号 说明：商户订单号
        prepayRequest.setOutTradeNo(outTradeNo);
        // 通知地址 说明：有效性：1. HTTPS；2. 不允许携带查询串
        if(outTradeNo.startsWith("WXAT")){
            //智能体回调地址
            prepayRequest.setNotifyUrl(notifyUrl2);
        } else if (outTradeNo.startsWith("COURSE")){
            //智能体回调地址
            prepayRequest.setNotifyUrl(notifyUrl2);

        } else {
            prepayRequest.setNotifyUrl(notifyUrl);
        }
        // 金额
        prepayRequest.setAmount(amount);

        // 调用下单方法，得到应答
        return appService.prepayWithRequestPayment(prepayRequest);
    }

    private void coursePayNotify(ZhsCoursePayLog order) {
        order.setStatus(1);
        // 修改支付状态
        payLogService.edit(order);
    }


    /**
     *
     * @param productType 商品类型
     * @param id 订单id
     * @param amount 订单金额（只有商品类型为1活动的时候才需要手动填写金额）
     * @param uuid 创建订单人
     * @param outTradeNo 订单编号（本地订单与微信订单通用）
     * @return
     */
    private Order saveOrderInfo(Integer productType, Object id, Integer amount, String uuid, String outTradeNo){
        Order order = new Order();
        Integer num;
        String activityId = null;
        Long productId = null;
        String productIdentityId = null;
        /*JSONObject porduct = null;
        if(productType == 1 || productType == 2) {
            try {
                HashMap<Object, Object> head = Maps.newHashMap();
                head.put(BeanConfig.ZHS_AUTHORIZATION, authorization);
                head.put(WXConfig.DEVICE_TYPE_HEAD, WXConfig.DEVICE_CODE);
                String s1 = new SSLClient().doGet(productUrl, "", head);
                Map map = JsonUtils.fromJson(s1, Map.class);
                porduct = (JSONObject)map.get("data");
            } catch (Exception e) {
                throw new RuntimeException(e);
            }

        }*/
        if(productType == 1){
            log.info("优惠活动商品");
            activityId = id.toString();
            // 获取金额
            ZhsActivity activity = activityService.selectZhsActivityById(activityId);
            num = amount * activity.getMultiple() * 100;
            // 调用中心库拿到活动与身份订单信息
//            JSONObject activity = porduct.getJSONObject("activity");
//            num = request.getInt("amount") * activity.getInt("multiple") * 100;
            order.setOrderType(3);
        } else if (productType == 2 || productType == 3) {
            log.info("开通身份");
            productIdentityId = id.toString();
            /*
            // 调用中心库拉取身份订单
            JSONArray jsonArray = porduct.getJSONArray("productIdentities");
            JSONObject productIdentity = null;
            for (Object object :
                    jsonArray) {
                JSONObject obj = object instanceof JSONObject? (JSONObject) object : null;
                String id = obj.getString("id");
                if(id.equals(productIdentityId)){
                    productIdentity = obj;
                    break;
                }
            }

            // 判断时间是否在活动期限内
            long time = new Date().getTime();
            if(productIdentity.getInt("status") == 1 && ((Date)productIdentity.get("beginTime")).getTime() <= time && ((Date)productIdentity.get("endTime")).getTime() >= time ){
                num = productIdentity.getInt("amount");
            } else {
                num = productIdentity.getInt("defAmount");
            }*/
            ZhsProductIdentity productIdentity = productIdentityMapper.selectZhsProductIdentityById(productIdentityId);
            // 判断时间是否在活动期限内
            long time = new Date().getTime();
            if(productIdentity.getStatus() == 1 && Objects.isNull(productIdentity.getBeginTime()) && Objects.isNull(productIdentity.getEndTime())){
                // 没设置时间且状态为1启用
                num = productIdentity.getAmount();
            }else if(productIdentity.getStatus() == 1 && productIdentity.getBeginTime().getTime() <= time && productIdentity.getEndTime().getTime() >= time ){
                num = productIdentity.getAmount();
            } else {
                num = productIdentity.getDefAmount();
            }
            if(productType == 3)
                order.setOrderType(5); // 开发者
            else
                order.setOrderType(4); // vip，操盘手
        } else{
            log.info("普通商品");
            productId = Long.parseLong(id.toString());
            // 获取金额
            Product product = productMapper.selectById(productId);
            num = product.getPrice();

            order.setOrderType(productId == 1 ? 1 : 2);
        }

        order.setProductId(productId);
        order.setActivityId(activityId);
        order.setProductIdentityId(productIdentityId);

        order.setAmount(num);

        // 创建本地订单
        order.setOutTradeNo(outTradeNo);
        order.setOpenId(uuid);
        order.setStatus(0);
        order.setCreatedAt(Instant.now().getEpochSecond());
        order.setPlatformType(WXConfig.DEVICE_CODE);
        System.out.println("保存订单："  + JsonUtils.toJson(order));
        orderMapper.insertOrder(order);
        return order;
    }


    /**
     * 创建课程订单
     * @param productType
     * @param productId
     * @param amount
     * @param uuid
     * @param outTradeNo
     * @return
     */
    private ZhsCoursePayLog saveCourseOrderInfo(int productType, String productId, Integer amount, String uuid, String outTradeNo) {

        ZhsCoursePayLog payLog = new ZhsCoursePayLog();

        // 获取金额
        Integer num = payLogService.getProduct(productType, productId);

        if(productType == 6){
            payLog.setType(0);
            payLog.setCourseId(productId);

        }
        if(productType == 7){
            payLog.setType(1);
            payLog.setVideoId(productId);

        }

        payLog.setAmount(num);
        payLog.setOutBillOn(outTradeNo);
        payLog.setUserUuid(uuid);
//        payLog.setStatus(0);
        payLog.setCreatedAt(Date.from(Instant.now()));

        // 创建本地订单
        payLogService.add(payLog);
        return payLog;
    }




    public static void main(String[] args) {
        for (int i = 0; i < 10; i++) {
            System.out.println(UUID.randomUUID());
        }
    }

}