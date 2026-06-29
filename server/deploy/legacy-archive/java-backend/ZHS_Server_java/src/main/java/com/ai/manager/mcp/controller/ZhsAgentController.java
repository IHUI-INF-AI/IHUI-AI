package com.ai.manager.mcp.controller;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.core.constants.WXConfig;
import com.ai.manager.core.utils.JWTUtils;
import com.ai.manager.mcp.service.AgentService;
import com.ai.manager.small.domain.AgentRule;
import com.ai.manager.small.domain.AiModelInfo;
import com.ai.manager.small.domain.ZhsUserAgentContext;
import com.ai.manager.small.domain.dto.PageBean;
import com.ai.manager.small.service.impl.ISysFileService;
import com.alibaba.fastjson.JSON;
import com.google.common.collect.Lists;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.SneakyThrows;
import org.apache.commons.lang3.StringUtils;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import javax.imageio.ImageIO;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.OutputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static com.ai.manager.core.utils.ChatImageDrawer2.drawChatImage;

/**
 * 本地智能体
 */
@RestController
@RequestMapping("/agent")
@Tag(name = "智能体列表")
public class ZhsAgentController {

    @Autowired
    private AgentService zhsAgentService;
    @Autowired
    private JWTUtils jwtUtils;


    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    // 生成视频
    @SkipLogin
    @SneakyThrows
    @GetMapping("/rule/search")
    @Operation(summary = "按规则查询")
    public ResponseResultInfo searchRule(AgentRule rule, HttpServletRequest request){
        String uuid = null;
        // 手动尝试解析认证信息
        String authorization = request.getHeader(BeanConfig.ZHS_AUTHORIZATION);
        if (StringUtils.isNotBlank(authorization) && authorization.startsWith("Bearer ")) {
            try {
                String bearer = authorization.replace("Bearer ", "");
                Map<String, Object> claims = jwtUtils.parseJwt(bearer, Map.class);

                // 验证token有效性
                if (claims.containsKey("uuid") && claims.containsKey("expiresAt")) {
                    long expiresAt = Long.parseLong(claims.get("expiresAt").toString());
                    if (expiresAt > Instant.now().getEpochSecond()) {
                        uuid = claims.get("uuid").toString();
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }


        System.out.println(JSONObject.valueToString(rule));
        rule.setCreator(uuid);
        if(Objects.nonNull(rule.getId())){
            // 查询单个规则
            AgentRule byId = zhsAgentService.getAgentRule(rule.getId());
            byId.setPageSize(rule.getPageSize());
            byId.setPageNum(rule.getPageNum());
            byId.setAgentCategory(rule.getAgentCategory());
            byId.setAgentMainCategory(rule.getAgentMainCategory());
            byId.setCreator(rule.getCreator());
            return ResponseResultInfo.success(zhsAgentService.searchRuleById(byId, null));
        }

        return ResponseResultInfo.success(zhsAgentService.searchRule(rule));
    }

    // 按规则查询（使用agent_rule_link表）
    @SkipLogin
    @SneakyThrows
    @GetMapping("/rule/search/bylink")
    @Operation(summary = "按规则查询(使用agent_rule_link表)")
    public ResponseResultInfo searchRuleByLink(AgentRule rule, HttpServletRequest request){
        String uuid = null;
        // 手动尝试解析认证信息
        String authorization = request.getHeader(BeanConfig.ZHS_AUTHORIZATION);
        if (StringUtils.isNotBlank(authorization) && authorization.startsWith("Bearer ")) {
            try {
                String bearer = authorization.replace("Bearer ", "");
                Map<String, Object> claims = jwtUtils.parseJwt(bearer, Map.class);
                // 验证token有效性
                if (claims.containsKey("uuid") && claims.containsKey("expiresAt")) {
                    long expiresAt = Long.parseLong(claims.get("expiresAt").toString());
                    if (expiresAt > Instant.now().getEpochSecond()) {
                        uuid = claims.get("uuid").toString();
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        System.out.println(JSONObject.valueToString(rule));
        rule.setCreator(uuid);
        if(Objects.nonNull(rule.getId())){
            // 查询单个规则
            AgentRule byId = zhsAgentService.getAgentRule(rule.getId());
            byId.setPageSize(rule.getPageSize());
            byId.setPageNum(rule.getPageNum());
            byId.setAgentCategory(rule.getAgentCategory());
            byId.setAgentMainCategory(rule.getAgentMainCategory());
            byId.setCreator(rule.getCreator());
            return ResponseResultInfo.success(zhsAgentService.searchRuleByIdByLink(byId, null));
        }
        return ResponseResultInfo.success(zhsAgentService.searchRuleByLink(rule));
    }

    // 按规则查询（使用agent_rule_link表）
    @SkipLogin
    @SneakyThrows
    @GetMapping("/rule/list")
    @Operation(summary = "按规则查询(使用agent_rule_link表)")
    public ResponseResultInfo searchRuleByLink(){
        return ResponseResultInfo.success(zhsAgentService.getRuleList());
    }


    // 性格测试
//    @SkipLogin
//    @SneakyThrows
    @PostMapping("/query/personality")
    @Operation(summary = "性格测试")
    public String queryPersonality(@RequestBody Map param){
        String s = queryPersonalityN8n(param, "http://47.94.40.108:5678/webhook/b0a3336f-ba7a-42b9-8dcb-6023b9c0dbfc");
//        String s1 = fileService.uploadMinio(s.getBytes(StandardCharsets.UTF_8), UUID.randomUUID().toString() + ".html");
        return s;
    }



    private String queryPersonalityN8n(Map param,String uri){
//        String jsonString = "{\"1.孩子目前就读的学校\":\"普通公办学校\",\"2.孩子班级整体水平大概是什么情况\":\"普通班\",\"3.孩子最近几次语文和英语考试的大概分数范围\":\"90\",\"4.在语文和英语学习上，您觉得孩子目前最大的困难是什么\":\"阅读速度\",\"5.关于理科方面，您是否观察到孩子在思考与解决问题的表现上有什么特点？\":\"666\",\"6.对于孩子在日常学习的过程中，您觉得最影响他学习的因素是什么？\":[\"孩子痴迷游戏\"],\"7.平时在没有学习任务的时候，孩子最喜欢做的事是什么？有没有长期坚持的兴趣或特长？\":\"666\",\"8.孩子在人际关系和性格方面大致是什么样的？遇到挫折时通常会怎么反应？\":[\"性格内向\",\"擅长解决问题\"],\"9.每周除了学校任务之外，您觉得孩子还能有多少余力来用于课外学习或培训班？\":\"孩子有充足的空余时间\",\"10.在安排学习和培训时，您觉得孩子对压力的承受度如何？\":\"适合有挑战性的训练\",\"11.如果用 1-5 分来打分，您对孩子未来三到五年在学习上的目标期待大概是几分？\":\"2\",\"【性格测试】您的孩子在学校或同龄人聚会中通常：\":\"倾向于和一两个熟悉的朋友一起，或更喜欢自己安静活动\",\"【性格测试】您的孩子在学习或思考时更常表现为：\":\"会提出超出课本的问题、跳跃联想、喜欢探索“概念”和可能性\",\"【性格测试】您的孩子遇到矛盾或选择时通常：\":\"更看重自己或别人的感受，容易因为情绪影响决定\",\"【性格测试】在学习安排或日常作息方面，孩子更像：\":\"常常挺随性，需要提醒才开始行动，对突发变化不太抗拒\",\"【性格测试】当孩子累了或压力大时，他/她更倾向于：\":\"找朋友聊天、出去活动、参与社交来放松\",\"submittedAt\":\"2025-11-26T22:52:26.594-05:00\",\"formMode\":\"test\"}";
        String jsonString = JSON.toJSONString(param);
//        String jsonString = param.toString();
        System.out.println("当前入参为：\n" + jsonString);
        System.out.println(Instant.now().toEpochMilli());
        HttpResponse postResponse = HttpRequest.post( uri)
                .header(BeanConfig.ZHS_CONTENT_TYPE, "application/json")
                .body(jsonString)
                .execute();
        String body = postResponse.body();
        System.out.println(Instant.now().toEpochMilli());
        System.out.println("POST 响应: \n" + body);
        return body;
    }

    @GetMapping("/use/history")
    @Operation(summary = "性格测试")
    public ResponseResultInfo useHistory(@RequestHeader(WXConfig.DEVICE_TYPE_HEAD) String platform,
                             @RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid){
//        param.put("userUuid", userUuid);
//        param.put("platform", platform);
        return ResponseResultInfo.success( zhsAgentService.useHistory(userUuid,platform));
    }

    /**
     * 我的创作
     * @param userUuid
     * @param type
     * @param bean
     * @return
     */
    @Operation(summary = "我的创作")
    @PostMapping("/creation/my/{type}")
    public ResponseResultInfo myCreation(@RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid, @PathVariable("type")Integer type, @RequestBody PageBean bean){
        return ResponseResultInfo.success( zhsAgentService.myCreation(userUuid, type, bean));
    }


    /**
     * 分享创作
     */
    @Operation(summary = "分享创作")
    @PostMapping("/creation/share")
    public ResponseResultInfo shareCreation(@RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid, @RequestBody()Map<String, Object> param ){
        String contextId = param.getOrDefault("contextId", "").toString();
        String title = param.getOrDefault("title", "").toString();
        String coverUrl = param.getOrDefault("coverUrl", "").toString();
        String subtitle = param.getOrDefault("subtitle", "").toString();
        String fileUrl = param.getOrDefault("fileUrl", "").toString();
        String problem = param.getOrDefault("problem", "").toString();
        String answer = param.getOrDefault("answer", "").toString();
        if(StringUtils.isBlank(contextId) && StringUtils.isBlank(fileUrl) && StringUtils.isBlank(answer)){
            return ResponseResultInfo.error(null, "当前分享内容不存在！");
        }
        if(StringUtils.isBlank(title)){
            return ResponseResultInfo.error(null, "请输入标题！");
        }
        if (StringUtils.isNotBlank(contextId))
            zhsAgentService.shareCreation(userUuid, contextId, title, coverUrl, subtitle);
        else
            zhsAgentService.shareCustomCreation(userUuid, title, coverUrl, subtitle, problem, answer, fileUrl);
        return ResponseResultInfo.success();
    }


    /**
     *
     * @param userUuid
     * @param gcId
     * @param type 1点赞 2收藏
     * @return
     */
    @Operation(summary = "点赞创作")
    @GetMapping("/creation/operate/{gcId}/{type}")
    public ResponseResultInfo operateCreation(@RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid, @PathVariable("gcId")String gcId, @PathVariable("type")String type){
        zhsAgentService.operateCreation(userUuid, gcId, type);
        return ResponseResultInfo.success();
    }

    @SkipLogin
    @SneakyThrows
    @Operation(summary = "分享转地址")
    @GetMapping(value = "/creation/share/third/{code}")
    public ResponseResultInfo creation2third(@PathVariable("code")String code){
        Object o = redisTemplate.opsForValue().get(code);
        if(Objects.isNull(o)){
            return ResponseResultInfo.error(null, "当前无分享内容！");
        }
        String context = o.toString();
        return ResponseResultInfo.success(JSON.parseObject(context, List.class));
    }
    @SneakyThrows
    @Operation(summary = "分享转CODE")
    @PostMapping(value = "/creation/share/code")
    public ResponseResultInfo creation2code(@RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid, @RequestBody Map<String, Object> param){
        String chatId = param.getOrDefault("chat_id", "").toString();
        String agentId = param.getOrDefault("agent_id", "").toString();
        Object idsObj = param.get("ids");
        System.out.println(JSON.toJSONString(param));
        if(StringUtils.isBlank(chatId)){
            return ResponseResultInfo.error(null, "会话不可为空！");
        }
        if(StringUtils.isBlank(agentId)){
            return ResponseResultInfo.error(null, "模型不可为空！");
        }

        if(Objects.isNull(idsObj) || !(idsObj instanceof List)){
            return ResponseResultInfo.error(null, "上下文不可为空！");
        }
        List<String> ids = Lists.newArrayList((List<String>)idsObj);

        List<ZhsUserAgentContext> contexts = zhsAgentService.creation2third(userUuid, chatId, agentId, ids);
        String code = UUID.randomUUID().toString().replaceAll("-", "");
        redisTemplate.opsForValue().set(code, JSON.toJSONString(contexts), 30, TimeUnit.DAYS);
        return ResponseResultInfo.success(code);
    }

    /**
     * 生成图片
     * {
     *     "user_uuid": "",
     *     "chat_id": "",
     *     "agent_id": "",
     *     "ids": [
     *         "problem_{id}",
     *         "answer_{id}"
     *     ]
     * }
     */
    @SneakyThrows
    @Operation(summary = "分享转图片")
    @PostMapping(value = "/creation/image", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseResultInfo creation2Image(@RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid, @RequestBody Map<String, Object> param, HttpServletResponse response){
        String chatId = param.getOrDefault("chat_id", "").toString();
        String agentId = param.getOrDefault("agent_id", "").toString();
        Object idsObj = param.get("ids");
        if(StringUtils.isBlank(chatId)){
            return ResponseResultInfo.error(null, "会话不可为空！");
        }
        if(StringUtils.isBlank(agentId)){
            return ResponseResultInfo.error(null, "模型不可为空！");
        }
        if(Objects.isNull(idsObj) || !(idsObj instanceof List)){
            return ResponseResultInfo.error(null, "上下文不可为空！");
        }
        List<String> ids = Lists.newArrayList((List<String>)idsObj);

        List<ZhsUserAgentContext> contexts = zhsAgentService.creation2third(userUuid, chatId, agentId, ids);
        if(contexts.isEmpty()){
            return ResponseResultInfo.error(null, "当前没有内容！");
        }
        AiModelInfo modelName =  zhsAgentService.getModelName(agentId);

        BufferedImage image = drawChatImage(contexts, modelName.getImg(), modelName.getSource(), "E:\\job\\test\\a.png");
        if(Objects.nonNull(image)){
            // 2. 设置响应头（关键：指定图片类型、禁用缓存、设置内容类型）
            response.setContentType("image/png"); // 根据实际图片格式调整（jpg/png/gif）
            response.setHeader("Cache-Control", "no-cache"); // 禁用缓存，避免客户端缓存旧图片
            response.setHeader("Pragma", "no-cache");
            response.setDateHeader("Expires", 0);

            // 3. 获取输出流，将BufferedImage写入流
            try (OutputStream outputStream = response.getOutputStream()) {
                // ImageIO.write(图片对象, 图片格式, 输出流)
                boolean writeSuccess = ImageIO.write(image, "png", outputStream);
                if (!writeSuccess) {
                    throw new IOException("无法写入图片流，不支持的图片格式：png");
                }
                outputStream.flush(); // 强制刷新，确保图片完整输出
            }
        }

        return ResponseResultInfo.success();
    }
}
