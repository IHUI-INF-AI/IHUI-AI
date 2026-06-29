package com.ai.manager.app.controller;

import com.ai.manager.app.server.AuthorizationManagementServlet;
import com.ai.manager.core.config.ResponseResultInfo;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/auth_management")
@Tag(name = "授权管理)")
public class AuthorizationManagementController {

    @Autowired
    private AuthorizationManagementServlet servlet;

    //获取授权用户
    @GetMapping("/get/{uuid}")
    public ResponseResultInfo getList(@PathVariable("uuid") String uuid){
        // 获取所有平台第三方注册信息
        return servlet.getList(uuid);
    }
    // 解绑小程序
    @PostMapping("/remove")
    public ResponseResultInfo delAuth(@RequestBody Map<String, Object> param){
        String uuid, platform;
        if(!param.containsKey("uuid") ||  Objects.isNull(uuid = param.get("uuid").toString())){
            return ResponseResultInfo.error(null, "不存在的授权！");
        }
        if(!param.containsKey("platform") ||  Objects.isNull(platform = param.get("platform").toString())){
            return ResponseResultInfo.error(null, "未知的授权平台!");
        }

        return servlet.delAuth(uuid, platform);
    }


}
