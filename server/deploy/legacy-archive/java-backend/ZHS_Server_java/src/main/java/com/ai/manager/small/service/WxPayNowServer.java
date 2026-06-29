package com.ai.manager.small.service;

import com.ai.manager.core.config.ResponseResultInfo;
import com.wechat.pay.java.service.payments.model.Transaction;
import com.wechat.pay.java.service.refund.model.Refund;

import java.util.Map;

public interface WxPayNowServer {
//    /**
//     * 调起支付下单
//     * @param param
//     * @return
//     */
//    Map pay(Map<String, Object> param);

    /***
     * 微信支付订单号查询订单
     * @param param
     * @return
     */
    Transaction queryOrderById(Map<String, Object> param);

    /**
     * 商户订单号查询订单
     * @param param
     * @return
     */
    Transaction queryOrderByOutTradeNo(Map<String, Object> param);

    /**
     * 关闭订单
     * @param param
     * @return
     */
    Transaction closeOrder(Map<String, Object> param);

    /**
     * 退款申请
     * @param param
     * @return
     */
    Refund refunds(Map<String, Object> param);

    /**
     * 支付回调
     * @param param
     * @param serial
     * @param signature
     * @param timestamp
     * @param nonce
     * @return
     */
    Map<String,Object> handleNotify(String param, String serial, String signature, String timestamp, String nonce);

    /**
     * 提现回调
     * @param res
     * @param serial
     * @param signature
     * @param timestamp
     * @param nonce
     * @return
     */
    Map<String, Object> transferAccountsNotify(String res, String serial, String signature, String timestamp, String nonce);

    Map pay(Map<String, Object> param);

    Map<String, Object> courseNotify(String param, String serial, String signature, String timestamp, String nonce);

    /**
     * 获取连续包月会员商品
     * @return
     */
    ResponseResultInfo getConsecutivelyProduct();

    com.wechat.pay.java.service.payments.app.model.PrepayWithRequestPaymentResponse appPay(Map<String, Object> param);
}
