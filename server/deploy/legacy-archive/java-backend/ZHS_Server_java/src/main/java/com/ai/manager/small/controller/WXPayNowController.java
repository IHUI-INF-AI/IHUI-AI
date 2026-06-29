package com.ai.manager.small.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.core.constants.WXConfig;
import com.ai.manager.small.domain.PaymentCallback;
import com.ai.manager.small.service.WxPayNowServer;
import com.alibaba.druid.support.json.JSONUtils;
import com.alibaba.fastjson.JSON;
import com.wechat.pay.java.service.payments.model.Transaction;
import com.wechat.pay.java.service.refund.model.Refund;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.commons.beanutils.BeanUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.lang.reflect.InvocationTargetException;
import java.util.Map;

@RestController
@RequestMapping("/pay") // 保持与 PHP 原有路径一致
@Tag(name = "支付方面（新版本java项目）")
public class WXPayNowController {

    private static final Logger log = LoggerFactory.getLogger(WXPayNowController.class);

    @Autowired
    private WxPayNowServer wxPayService;
//    @Autowired
//    private UserService userService;

    /**
     * JSAPI/小程序下单
     * uuid 用户唯一标识
     * openid 小程序唯一标识
     * desc 商品名称
     * id 商品id
     * productType订单类型： 0token(商品) 1活动 2开通身份 5购买开发者身份 4购买智能体 6购买课程 7购买课程附件
     *
     * @param param
     * @return
     */
    @PostMapping("/initiatePay")
    public ResponseResultInfo initiatePay(@RequestBody Map<String, Object> param, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid) {
        param.put("uuid", uuid);
        if(!param.containsKey("openId")){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("当前用户不存在").build();
        }
        if(!param.containsKey("desc")){
            param.put("desc","充值");
        }
        if(!param.containsKey("id")){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("购买物品不存在").build();
        }
        if(!param.containsKey("productType")){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("当前购买类型不存在").build();
        } else if (Integer.parseInt(param.get("productType").toString()) == 1 && !param.containsKey("amount")) {
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("购买力不足").build();
        }

        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(wxPayService.pay(param))
                .build();
    }
    @PostMapping("/app/initiatePay")
    public ResponseResultInfo appInitiatePay(@RequestBody Map<String, Object> param, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid) {
        System.out.println(JSON.toJSONString(param));
        param.put("uuid", uuid);
        if(!param.containsKey("openId")){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("当前用户不存在").build();
        }
        if(!param.containsKey("desc")){
            param.put("desc","充值");
        }
        if(!param.containsKey("id")){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("购买物品不存在").build();
        }
        if(!param.containsKey("productType")){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("当前购买类型不存在").build();
        } else if (Integer.parseInt(param.get("productType").toString()) == 1 && !param.containsKey("amount")) {
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("购买力不足").build();
        }

        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(wxPayService.appPay(param))
                .build();
    }
//    // 增加token
//    @PostMapping("/updateStatus")
//    public ResponseResultInfo updateStatus(@RequestBody User user){
//        return ResponseResultInfo.builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).data(userService.getByOpenId(user.getOpenId())).build();
//    }

    /**
     * 小程序拉起支付
     * @param param
     * @return
     */

    /**
     * 微信支付订单号查询订单
     * @param param
     * @return
     */
    @PostMapping("/queryOrderById")
    public Transaction queryOrderById(@RequestBody Map<String, Object> param) {
        return wxPayService.queryOrderById(param);
    }

    /**
     * 智能体支付回调，其他支付没用到
     * @param request
     * @return
     */
    @PostMapping("/notify")
    public Map<String,Object> notify(@RequestBody String res, HttpServletRequest request){
        try {
            String serial = request.getHeader(WXConfig.SERIAL);
            String signature = request.getHeader(WXConfig.SIGNATURE);
            String timestamp = request.getHeader(WXConfig.TIMESTAMP);
            String nonce = request.getHeader(WXConfig.NONCE);
            log.info("接收到微信支付回调: \nbody={}, \nserial={}, \nsignature={}, \ntimestamp={}, \nnonce={}\n\n",
                    res, serial, signature, timestamp, nonce);
            return wxPayService.handleNotify(res,serial, signature, timestamp, nonce);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
//        return "<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>";
    }

    /**
     * 商户订单号查询订单
     * @param param
     * @return
     */
    @PostMapping("/queryOrderByOutTradeNo")
    public Transaction queryOrderByOutTradeNo(@RequestBody Map<String, Object> param) {
        return wxPayService.queryOrderByOutTradeNo(param);
    }


    /**
     * 关闭订单
     * @param param
     * @return
     */
    @PostMapping("/closeOrder")
    public Transaction closeOrder(@RequestBody Map<String, Object> param) {
        System.out.println(JSON.toJSONString(param));
        return wxPayService.closeOrder(param);
    }

    /**
     * 支付成功回调通知
     * @param param
     * @return
     */

    /**
     * 退款申请
     * @param param
     * @return
     */
    @PostMapping("/refunds")
    public Refund refunds(@RequestBody Map<String, Object> param) {
        // RefundService
        return wxPayService.refunds(param);
    }


    /**
     * 提现回调
     * @param request
     * @return
     */
    @PostMapping("/transferNotify")
    public Map<String,Object> transferAccountsNotify(@RequestBody String res, HttpServletRequest request){
        try {
            String serial = request.getHeader(WXConfig.SERIAL);
            String signature = request.getHeader(WXConfig.SIGNATURE);
            String timestamp = request.getHeader(WXConfig.TIMESTAMP);
            String nonce = request.getHeader(WXConfig.NONCE);
            log.info("接收到微信支付回调: \nbody={}, \nserial={}, \nsignature={}, \ntimestamp={}, \nnonce={}\n\n",
                    res, serial, signature, timestamp, nonce);
            return wxPayService.transferAccountsNotify(res,serial, signature, timestamp, nonce);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }


    /**
     * 购买课程支付回调
     * @param res
     * @param request
     * @return
     */
    @PostMapping("/course/notify")
    public Map<String,Object> courseNotify(@RequestBody String res, HttpServletRequest request){
        try {
            String serial = request.getHeader(WXConfig.SERIAL);
            String signature = request.getHeader(WXConfig.SIGNATURE);
            String timestamp = request.getHeader(WXConfig.TIMESTAMP);
            String nonce = request.getHeader(WXConfig.NONCE);
            log.info("接收到微信支付回调: \nbody={}, \nserial={}, \nsignature={}, \ntimestamp={}, \nnonce={}\n\n",
                    res, serial, signature, timestamp, nonce);
            return wxPayService.courseNotify(res,serial, signature, timestamp, nonce);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * 查询连续包月
     * @return
     */
    @GetMapping("/consecutively/product")
    public ResponseResultInfo getConsecutivelyProduct(){
        return wxPayService.getConsecutivelyProduct();
    }



    public static void main(String[] args) throws InvocationTargetException, IllegalAccessException, NoSuchMethodException {
        PaymentCallback build = PaymentCallback.builder()
                .id("id")
//                .resource("id")
                .summary("summary")
                .createTime("createTime")
                .eventType("")
                .build();
        System.out.println(JSONUtils.toJSONString(BeanUtils.describe(build)));
    }
}