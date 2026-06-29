package com.ai.manager.mcp.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.mcp.service.Gemini3ProPreviewService;
import com.ai.manager.mcp.service.SunoService;
import com.alibaba.druid.support.json.JSONUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.SneakyThrows;
import org.apache.commons.io.IOUtils;
import org.apache.logging.log4j.util.Base64Util;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.Base64Utils;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileWriter;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/gemini")
@Tag(name = "suno音乐制作")
public class Gemini3ProPreviewController {

    @Autowired
    private Gemini3ProPreviewService sunoService;

    /**
     *
     * @param param
     * @param uuid
     * @return
     */
//    @SkipLogin
    @PostMapping("/3/generate")
    @Operation(summary = "对话")
    public ResponseResultInfo generateTimbre(@RequestBody Map<String, Object> param, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid){
        String problem = JSONUtils.toJSONString(param);

        param.put("creator", uuid);
        // auditPath copyWriting
        if (!param.containsKey("prompt") || Objects.isNull(param.get("prompt").toString())) {
            return ResponseResultInfo.error(null,"提示词不能为空!");
        }

        return sunoService.generate(param, problem);
    }

}
