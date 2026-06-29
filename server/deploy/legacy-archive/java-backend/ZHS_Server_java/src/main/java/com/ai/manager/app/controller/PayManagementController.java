package com.ai.manager.app.controller;

import com.ai.manager.app.server.PayAndroidService;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.ResultConfig;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/app/pay")
@Tag(name = "支付管理)")
public class PayManagementController {
    @Autowired
    private PayAndroidService androidService;

    @PostMapping("/wx/android")
    public ResponseResultInfo wxPay(@RequestBody Map<String, Object> param, @RequestHeader(BeanConfig.ZHS_AUTHORIZATION)String authorization){
        if(!param.containsKey("uuid")){
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
                .data(androidService.pay(param, authorization))
                .build();
    }
}
