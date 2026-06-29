package com.ai.manager.mcp.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.config.SpringContextUtil;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.core.utils.JWTUtils;
import com.ai.manager.mcp.service.AliAIService;
import com.alibaba.fastjson.JSON;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.SneakyThrows;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.lang.reflect.Type;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/ali")
@Tag(name = "阿里云百炼")
public class AliAIController {

    @Autowired
    private AliAIService aiService;

    @Autowired
    private JWTUtils jwtUtils;

    // 创建音色
    @SneakyThrows
    @PostMapping("/generate/timbre")
    @Operation(summary = "生成音色")
    public ResponseResultInfo generateTimbre(@RequestBody Map<String, Object> param, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid){
        param.put("creator", uuid);
        // auditPath copyWriting
        if (!param.containsKey("copyWriting") || Objects.isNull(param.get("copyWriting").toString())) {
            return ResponseResultInfo.error(null,"文案不能为空!");
        }

        System.out.println(JSON.toJSONString(param));

        //判断是否存在音色文件
        return aiService.generateTimbre(param);
    }

    @SkipLogin
    @GetMapping("/audio/sys")
    @Operation(summary = "获取系统音色")
    public ResponseResultInfo getAudioSys(){
        //判断是否存在音色文件
        return aiService.getAudioSys();
    }


    /**
     *
     * @param videoUrl
     * @param type 进展 0提交音频 | 1提交图像 | 2提交视频 | 3提交全部 | 4图片地址
     * @param imageName
     * @param request
     * @return
     */
//    @SkipLogin
    @PostMapping("/video/to/digital")
    @Operation(summary = "视频形象保存，视频拆分音频文件与图像数字形象")
    public ResponseResultInfo videoToDigital(@RequestBody Map<String, Object> param/*,@RequestParam("videoUrl")String videoUrl,@RequestParam( name = "type")Integer type,@RequestParam( name = "imageName")String imageName*/, HttpServletRequest request, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String userUuid){
//        String userUuid = null;
//        // 手动尝试解析认证信息
//        String authorization = request.getHeader(BeanConfig.ZHS_AUTHORIZATION);
//        if (StringUtils.isNotBlank(authorization) && authorization.startsWith("Bearer ")) {
//            try {
//                String bearer = authorization.replace("Bearer ", "");
//                JWTUtils jwtUtils = SpringContextUtil.getBean(JWTUtils.class);
//                Map<String, Object> claims = jwtUtils.parseJwt(bearer, Map.class);
//
//                // 验证token有效性
//                if (claims.containsKey("uuid") && claims.containsKey("expiresAt")) {
//                    long expiresAt = Long.parseLong(claims.get("expiresAt").toString());
//                    if (expiresAt > Instant.now().getEpochSecond()) {
//                        userUuid = claims.get("uuid").toString();
//                    }
//                }
//            } catch (Exception e) {
//                // 认证解析失败，userUuid保持为null
//                e.printStackTrace();
////                logger.warn("Token解析失败: {}", e.getMessage());
//            }
//        }

        //判断是否存在音色文件

        String videoUrl, imageName;
        Integer type;
        if (!param.containsKey("videoUrl") || StringUtils.isBlank(videoUrl = param.get("videoUrl").toString())) {
            return ResponseResultInfo.error(null,"视频不能为空!");
        }
        if (!param.containsKey("imageName") || StringUtils.isBlank(imageName = param.get("imageName").toString())) {
            return ResponseResultInfo.error(null,"形象名称不能为空!");
        }
        if (!param.containsKey("type") || Objects.isNull(param.get("type"))) {
            return ResponseResultInfo.error(null,"形象类型不能为空!");
        }
        type = Integer.valueOf(param.get("type").toString());


        return aiService.videoToDigital(videoUrl, userUuid, type, imageName);
    }

    // 获取我的定制形象
    @GetMapping("/get/digital/{type}")
    @Operation(summary = "获取我的定制形象")
    public ResponseResultInfo getDigital(@PathVariable(name = "type")Integer type ,@RequestHeader(CourseConfig.PLATFORM_USER_ID)String userUuid){
        return aiService.getDigital(userUuid,type);
    }

}
