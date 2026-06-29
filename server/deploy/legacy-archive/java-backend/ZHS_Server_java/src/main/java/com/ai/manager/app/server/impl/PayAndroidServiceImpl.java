package com.ai.manager.app.server.impl;

import com.ai.manager.app.server.PayAndroidService;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.WXConfig;
import com.ai.manager.core.utils.JsonUtils;
import com.ai.manager.core.utils.NonceRandomUtils;
import com.ai.manager.core.utils.SSLClient;
import com.ai.manager.small.domain.Order;
import com.ai.manager.small.domain.Product;
import com.ai.manager.small.mapper.OrderMapper;
import com.ai.manager.small.mapper.ProductMapper;
import com.google.common.collect.Maps;
import com.wechat.pay.java.core.RSAPublicKeyConfig;
import com.wechat.pay.java.core.notification.NotificationParser;
import com.wechat.pay.java.service.payments.app.AppServiceExtension;
import com.wechat.pay.java.service.payments.app.model.Amount;
import com.wechat.pay.java.service.payments.app.model.PrepayRequest;
import com.wechat.pay.java.service.payments.app.model.PrepayWithRequestPaymentResponse;
import com.wechat.pay.java.service.refund.RefundService;
import lombok.SneakyThrows;
import org.apache.commons.beanutils.BeanUtils;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@Service
public class PayAndroidServiceImpl implements PayAndroidService {
    private static final Logger log = LoggerFactory.getLogger(PayAndroidServiceImpl.class);
    // 获取appid
    @Value("${app.apply.id}")
    private String APP_ID;

    @Value("${wx.secret}")
    private String secret;
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
    @Value("${wx.app.notify}")
    private String notifyUrl;


    @Value("${ai.default.product.url}")
    private String productUrl;

    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private ProductMapper productMapper;


    private RSAPublicKeyConfig payConfig;
    private AppServiceExtension appService;
    private RefundService refundService;
    private NotificationParser notificationParser;

    @PostConstruct
    private void initService(){
        getPayConfig();
        getAppService();
//        getRefundService();
//        getNotificationParser();
    }

    private void getAppService() {
        if(Objects.isNull(this.appService)){
            // 构建service
            this.appService = new AppServiceExtension.Builder().config(getPayConfig()).build();
        }
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


    @SneakyThrows
//    @DS("slave")
    @Override
    public Map pay(Map<String, Object> param, String authorization) {
        // 时间戳
        long payTime = Instant.now().getEpochSecond();
        // 订单号
        String outTradeNo = "WX" + NonceRandomUtils.getRandomString(8).toLowerCase() + payTime;
        JSONObject request = new JSONObject(param);
        String uuid = request.getString("uuid");
        String desc = request.getString("desc");
        int productType = request.getInt("productType");

        //保存订单
        Order order = new Order();
        String activityId = null;
        Long productId = null;
        String productIdentityId = null;

        Integer num;
        JSONObject porduct = null;
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
        }
        if(productType == 1){
            // 调用中心库拿到活动与身份订单信息
            log.info("优惠活动商品");
            activityId = request.get("id").toString();
            // 获取金额
//            ZhsActivity activity = activityService.selectZhsActivityById(activityId);
            JSONObject activity = porduct.getJSONObject("activity");

            num = request.getInt("amount") * activity.getInt("multiple") * 100;
            order.setOrderType(3);
        } else if (productType == 2) {
            log.info("开通身份");
            productIdentityId = request.get("id").toString();
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
            }
            order.setOrderType(4);
        } else {
            log.info("普通商品");
            productId = request.getLong("id");
            // 获取金额
            Product product = productMapper.selectById(productId);
            num = product.getPrice();

            order.setOrderType(productId == 1 ? 1 : 2);
        }

        // 调用微信支付
        PrepayWithRequestPaymentResponse response = wxPay( desc, outTradeNo, num);

        // 创建本地订单
//        User byOpenId = userService.getByOpenId(openId);
        order.setOutTradeNo(outTradeNo);
//        order.setOpenId(openId);
        order.setOpenId(uuid);
        order.setAmount(num);
//        order.setUserId(byOpenId.getId());
        order.setStatus(0);
        order.setCreatedAt(Long.valueOf(response.getTimestamp()));
        order.setProductId(productId);
        order.setActivityId(activityId);
        order.setProductIdentityId(productIdentityId);
        order.setPlatformType("android");
        order.setPayType(WXConfig.DEVICE_CODE);
        orderMapper.insertOrder(order);

        // 拼装返回数据
//        Map<String, Object> result = Maps.newHashMap();
//        result.put("appId",  APP_ID);
//        result.put("partnerId",shopsId);
//        result.put("prepayId",response.getSigntyype());
//        result.put("packageValue",response.getNonceStr());
//        result.put("nonceStr", response.getPaySign());
//        result.put("timeStamp",outTradeNo);
//        result.put("sign",outTradeNo);

        return BeanUtils.describe(response);
    }

    /**
     * 调用支付
     *
     * @param desc
     * @param outTradeNo
     * @param num
     * @return
     */
    private PrepayWithRequestPaymentResponse wxPay( String desc, String outTradeNo, Integer num){
        Amount amount = new Amount();
        // TODO 放到线上需要吧这段内容修改成使用num，否则支付的金额永远是一份钱
//        amount.setTotal(num);
        amount.setTotal(1);

        // 构建Request
        PrepayRequest prepayRequest = new PrepayRequest();
        // 公众号ID（小程序id）
        prepayRequest.setAppid(APP_ID);
        // 直连商户号
        prepayRequest.setMchid(shopsId);
        // 商品描述
//        prepayRequest.setDescription(desc);
        prepayRequest.setDescription("购买");
        // 商户订单号 说明：商户订单号
        prepayRequest.setOutTradeNo(outTradeNo);
        // 通知地址 说明：有效性：1. HTTPS；2. 不允许携带查询串
        prepayRequest.setNotifyUrl(notifyUrl);
        // 金额
        prepayRequest.setAmount(amount);

        // 调用下单方法，得到应答
        return appService.prepayWithRequestPayment(prepayRequest);
//        return null;
    }
}
