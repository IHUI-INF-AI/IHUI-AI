package com.ai.manager.mcp.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.mcp.service.SunoService;
import com.alibaba.druid.support.json.JSONUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.SneakyThrows;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/suno")
@Tag(name = "suno音乐制作")
public class SunoController {

    @Autowired
    private SunoService sunoService;

    /**
     * 生成歌曲
     * @param param
     *          prompt: 提示词(歌词 \n分割)
     *          kind: type=0:0纯音乐 1音词同步 type=3:0不内嵌 1内嵌
     *          type: 0灵感模式，1自定义模式，2二次创作，3续写模式，4拼接歌曲
     *          clipId: 歌曲id
     *          continueAt: 歌曲秒值
     *          tags: 歌曲标签
     *          negativeTags: 需要排除的歌曲标签
     *          tags: 歌曲标签
     *          chatId: 唯一标识
     * @param uuid
     * @return
     */
    @PostMapping("/generate/music")
    @Operation(summary = "生成歌曲")
    public ResponseResultInfo generateTimbre(@RequestBody Map<String, Object> param, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid){
        String problem = JSONUtils.toJSONString(param);

        param.put("creator", uuid);
        // auditPath copyWriting
        if (!param.containsKey("prompt") || Objects.isNull(param.get("prompt").toString())) {
            return ResponseResultInfo.error(null,"提示词不能为空!");
        }
        // 判断用法 0灵感模式，1自定义模式，2二次创作，3续写模式，4拼接歌曲
        Integer type = Integer.valueOf(param.getOrDefault("type", 0).toString());
        param.put("type", type);
        if (Objects.nonNull(param.get("kind")) && Integer.parseInt(param.get("kind").toString()) == 1){
            param.put("make_instrumental", true);
        } else {
            param.put("make_instrumental", false);
        }
        if(type == 1 && Objects.isNull(param.get("tags")) && Objects.isNull(param.get("title"))){
            // 自定义模式需要穿标签
            return ResponseResultInfo.error("自定义模式需要设置标题与标签！");
        }
        if(type == 2 && Objects.isNull(param.get("clipId")) && Objects.isNull(param.get("continueAt")) && Objects.isNull(param.get("tags")) && Objects.isNull(param.get("negativeTags"))){
            // 2二次创作需要对上次的结果进行操作
            return ResponseResultInfo.error("缺少字段！");
        }
        if(type == 3 && Objects.isNull(param.get("clipId")) && Objects.isNull(param.get("continueAt")) && Objects.isNull(param.get("tags"))){
            // 3续写模式
            return ResponseResultInfo.error("缺少字段！");
        }
        if(type == 4 && Objects.isNull(param.get("clipId"))){
            // 4拼接歌曲
            return ResponseResultInfo.error("缺少字段！");
        }

        //判断是否存在音色文件
        return sunoService.generateMusic(param, problem);
    }

}
