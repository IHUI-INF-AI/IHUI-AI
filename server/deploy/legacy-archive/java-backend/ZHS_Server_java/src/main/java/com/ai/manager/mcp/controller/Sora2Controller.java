package com.ai.manager.mcp.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.mcp.service.JianYiAIService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.SneakyThrows;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/jianyi")
@Tag(name = "简易AI")
public class Sora2Controller {


    @Autowired
    private JianYiAIService sora2Service;

    // 生成视频
    @SneakyThrows
    @PostMapping("/sora2/generate/video")
    @Operation(summary = "创建视频任务")
    public ResponseResultInfo generateVideoBySora2(@RequestBody Map<String, Object> param, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid){
        param.put("uuid", uuid);
        // 判断是否存在视频
        // image， soundFile，prompt, mode
        return sora2Service.generateVideoBySora2(param);
    }

    // 查询进度
    @SneakyThrows
//    @GetMapping("/sora2/video/info/{id}")
    @PostMapping("/sora2/video/info")
    @Operation(summary = "查询任务")
    public ResponseResultInfo videoInfoBySora2(@RequestBody Map<String, String> param, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid){
//        String uuid = null;
        return sora2Service.videoInfoBySora2(param.get("id"), uuid);
    }

}
