package com.ai.manager.mcp.controller;

import com.ai.manager.core.annotation.CourseHeaderCheck;
import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.mcp.service.KlingAIService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.SneakyThrows;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/kling")
@Tag(name = "可灵AI接口")
public class KlingAIController {

    @Autowired
    private KlingAIService klingAIService;

    // 生成视频
    @SneakyThrows
    @PostMapping("/generate/video")
    @Operation(summary = "生成数字人")
    public ResponseResultInfo generateVideo(@RequestBody Map<String, Object> param, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid){
        param.put("creator", uuid);
        // 判断是否存在视频
        // image， soundFile，prompt, mode
        return klingAIService.generateVideo(param);
    }

    // 查询进度
    @SneakyThrows
    @GetMapping("/video/info/{id}")
    @Operation(summary = "列表")
    public ResponseResultInfo videoInfo(@PathVariable String id, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid){
//        String uuid = null;
        return klingAIService.videoInfo(id, uuid);
    }


}
