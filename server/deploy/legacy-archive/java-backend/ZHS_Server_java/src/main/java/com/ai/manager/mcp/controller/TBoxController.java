package com.ai.manager.mcp.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.utils.JWTUtils;
import com.ai.manager.mcp.domain.TBoxBean;
import com.ai.manager.small.service.IZhsAgentExamineService;
import com.alibaba.fastjson.JSON;
import com.google.common.collect.Maps;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.SneakyThrows;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/tbox")
@Tag(name = "腾讯百宝箱")
public class TBoxController {

    @Autowired
    private IZhsAgentExamineService service;

    @Autowired
    private JWTUtils jwtUtils;

    // 创建音色
    @SkipLogin
    @SneakyThrows
    @PostMapping("/agent/channel/deploy")
    @Operation(summary = "智能体发布")
    public Map<String, Object> generateTimbre(@RequestBody TBoxBean param){
        System.out.println(JSON.toJSONString(param));

        Map<String, Object> result = Maps.newHashMap();
        result.put("success",true);

        if(param.getEvent_type().equals("platform.agent_unpublish")){
            System.out.println("下架");
            service.delistTBox(param.getEvent_content());
        } else if(param.getEvent_type().equals("platform.agent_publish")){
            System.out.println("上架");
            service.addTBox(param.getEvent_content());
        } else {
            result.put("success",false);
            result.put("message","未知的方法类型");
        }

        HashMap<String, Object> objectObjectHashMap = Maps.newHashMap();
        objectObjectHashMap.put("audit_status",1); // 1: 审核中 2: 审核通过  3: 审核不通过
        result.put("data", objectObjectHashMap);
        return result;
    }

}
