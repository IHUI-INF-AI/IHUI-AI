package com.ai.manager.mcp.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.mcp.service.McpResourceService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/mcp/resource")
@Tag(name = "可灵AI接口")
public class McpResourceController {

    @Autowired
    private McpResourceService resourceService;

    @SkipLogin
    @GetMapping("/video/to/audio")
    public ResponseResultInfo<String> VideoToAudio(@RequestParam("url")String videoUrl){
        return ResponseResultInfo.success(resourceService.videoToAudio(videoUrl));
    }
}
