package com.ai.manager.small.controller;

import java.util.List;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.small.domain.ZhsProductIdentity;
import com.ai.manager.small.service.IZhsProductIdentityService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * 开通身份订单Controller
 * 
 * @author Raindrop_L
 * @date 2025-06-07
 */
@RestController
@RequestMapping("/product_identity")
@Tag(name = "开通身份订单")
public class ZhsProductIdentityController
{
    @Autowired
    private IZhsProductIdentityService zhsProductIdentityService;

    /**
     * 查询开通身份订单列表
     */
    @GetMapping("/list")
    public ResponseResultInfo list(ZhsProductIdentity zhsProductIdentity)
    {
        List<ZhsProductIdentity> list = zhsProductIdentityService.selectZhsProductIdentityList(zhsProductIdentity);
        return ResponseResultInfo.builder().data(list).code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).build();
    }


    /**
     * 获取开通身份订单详细信息
     */
    @GetMapping(value = "/getInfo")
    public ResponseResultInfo getInfo(@RequestParam("token") String token)
    {
        return zhsProductIdentityService.getByOpenId(token);
    }
}
