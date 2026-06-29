package com.ai.manager.small.controller;

import com.ai.manager.app.domain.users.UsersVO;
import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.config.SpringContextUtil;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.core.utils.ImageWatermarkUtil;
import com.ai.manager.core.utils.JWTUtils;
import com.ai.manager.core.utils.NetFileDownloadUtil;
import com.ai.manager.core.utils.VideoWatermarkUtil;
import com.ai.manager.small.domain.User;
import com.ai.manager.small.domain.ZhsAgent;
import com.ai.manager.small.domain.ZhsProductIdentity;
import com.ai.manager.small.domain.ZhsUserAgentContext;
import com.ai.manager.small.service.*;
import com.google.common.collect.Maps;
import com.google.common.net.HttpHeaders;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.SchemaProperties;
import io.swagger.v3.oas.annotations.media.SchemaProperty;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.net.URLEncoder;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/resource")
@Tag(name = "资源模块")
public class ResourceNowController {

    @Autowired
    private ResourceService resourceService;
    @Autowired
    private CozeService cozeService;
    @Autowired
    private IZhsUserAgentContextService contextService;

    @Autowired
    private LoginService loginService;

    @Value("${ai.agent.watermark}")
    private String WATER_MARK;


    /**
     * 处理用户Token扣减及流水
     * 根据输入的id和token值变化,整理剩余token值
     * @return
     */
    @Deprecated
    @PostMapping("/getTokenCount") // PHP 使用 POST
    public ResponseResultInfo getTokenCount(@RequestBody Map<String, Object> param, @RequestHeader(BeanConfig.ZHS_AUTHORIZATION)String authorization) {
        // 参数验证
//        @RequestBody Long userId, @RequestBody Integer quantity, @RequestBody String remarks
        JSONObject jsonObject = new JSONObject(param);

        if (jsonObject.isNull("token") || jsonObject.isNull("quantity")){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("字段缺失").build();
        }
        String userUUid = jsonObject.getString("token");
        Integer quantity = jsonObject.getInt("quantity");

        Object remarksObj = param.get("remarks");
        String remarks = null;
        if(Objects.nonNull(remarksObj)){
            remarks = remarksObj.toString();
        }
        if (quantity <= 0) {
            return ResponseResultInfo.<User>builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("扣除数量必须为正数")
                    .build();
        }
//        return resourceService.getTokenCount(userUUid, quantity, remarks);
        return resourceService.operateToken(userUUid, -quantity, authorization);
    }

    /**
     * 回退token
     * @param param
     * @return
     */
    @PostMapping("/getTokenReturn") // PHP 使用 POST
    public ResponseResultInfo<User> getTokenReturn(@RequestBody Map<String, Object> param, @RequestHeader(BeanConfig.ZHS_AUTHORIZATION)String authorization) {
        JSONObject jsonObject = new JSONObject(param);
        // 参数验证
        Long id = jsonObject.getLong("flowId");
        String contextId = jsonObject.getString("contextId");
        if (jsonObject.isNull("id") && jsonObject.isNull("contextId")) {
            return ResponseResultInfo.<User>builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("需退回智汇力找不到")
                    .build();
        }
        return resourceService.getTokenReturn(id, contextId, authorization);
    }

    /**
     * 获取cozetoken
     * @param openId
     * @param token
     * @return
     */
    @SkipLogin
    @Deprecated
    @GetMapping("/getAccessToken")
    public ResponseResultInfo<String> getCozeAccessToken(@RequestParam(name = "openId", required = false) String openId,@RequestParam("token") String token){
        String accessToken = cozeService.getAccessToken(token);
        return ResponseResultInfo.<String>builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(accessToken)
                .accessToken(accessToken)
                .build();
    }

    @Deprecated
    @GetMapping("/getAgentList")
    public ResponseResultInfo<List<ZhsAgent>> getAgentList(){
        List<ZhsAgent> agents = resourceService.getAgentList(null);
        return ResponseResultInfo.<List<ZhsAgent>>builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(agents)
                .build();
    }

    @Deprecated
    @GetMapping("/getAgent")
    public ResponseResultInfo<ZhsAgent> getAgent(@RequestParam("id")String id, @RequestParam("token")String userUuid, @RequestParam("problem")String problem, @RequestParam(name = "userUrl", required = false)String userUrl, @RequestHeader(BeanConfig.ZHS_AUTHORIZATION)String authorization){
        List<ZhsAgent> agents = resourceService.getAgentList(id);


        if(CollectionUtils.isEmpty(agents) || agents.size() != 1)
            return ResponseResultInfo.<ZhsAgent>builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("当前智能体名称错误!")
                    .build();
        ZhsAgent agent = agents.get(0);

        // 消耗智汇力
        Map map = Maps.newHashMap();
        map.put("remarks","调用智能体【" + agent.getName() + "】消耗：" + agent.getConsume() + "智汇力");
        map.put("quantity",agent.getConsume());
        map.put("token",userUuid);
        ResponseResultInfo tokenCount = getTokenCount(map, authorization);
//        ResponseResultInfo success = ResponseResultInfo.success();
//        success.setData(map.get("data"));
        if(tokenCount.getCode().equals(ResultConfig.ERROR_CODE.toString())){
            return tokenCount;
        }


        String uuid = UUID.randomUUID().toString();
        // 保存上下文
        ZhsUserAgentContext context = ZhsUserAgentContext.builder()
                .id(uuid)
                .agentId(id.toString())
                .userUuid(userUuid)
                .problem(problem)
                .userUrl(userUrl)
                .sendTime(Instant.now().getEpochSecond())
                .build();
        int i = contextService.insertZhsUserAgentContext(context);
        tokenCount.setUserContextId(uuid);

        tokenCount.setAccessToken(cozeService.getAccessToken(userUuid));
        return tokenCount;
    }

    @GetMapping("/getAgent2")
    public ResponseResultInfo<Map<String, String>> getAgent2(@RequestParam("id")String id,
                                                  @RequestParam("token")String userUuid,
                                                  @RequestParam("problem")String problem,
                                                  @RequestParam(name = "userUrl", required = false)String userUrl,
                                                  @RequestParam(name = "field1", required = false) String field1){

        String uuid = UUID.randomUUID().toString();
        if(StringUtils.isBlank(field1)){
            field1 = UUID.randomUUID().toString();
        }
        // 保存上下文
        ZhsUserAgentContext context = ZhsUserAgentContext.builder()
                .id(uuid)
                .agentId(id.toString())
                .userUuid(userUuid)
                .problem(problem)
                .userUrl(userUrl)
                .field1(field1)
                .sendTime(Instant.now().getEpochSecond())
                .build();
        int i = contextService.insertZhsUserAgentContext(context);
        Map<String, String> result = Maps.newHashMap();
        result.put("userContextId",uuid);
        result.put("field1",field1);

        return ResponseResultInfo.success(result);
    }

    @PostMapping("/saveUserContext")
    public ResponseResultInfo saveUserContext(
            @SchemaProperties({
                    @SchemaProperty(name = "id", schema = @Schema(name = "id", required = true)),
                    @SchemaProperty(name = "answer", schema = @Schema(name = "回答上下文", required = true)),
                    @SchemaProperty(name = "agentUrl", schema = @Schema(name = "回答文件路径")),
            })
            @RequestBody
            Map<String, Object> param
    ){
        JSONObject jsonObject = new JSONObject(param);
        if(jsonObject.isNull("id") || jsonObject.isNull("answer")){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("当前参数不全").build();
        }
        // 保存上下文
        ZhsUserAgentContext context = ZhsUserAgentContext.builder()
                .id(jsonObject.getString("id"))
                .answer(jsonObject.getString("answer"))
                .agentUrl(jsonObject.isNull("agentUrl")? null : jsonObject.getString("agentUrl"))
                .build();
        int i = contextService.updateZhsUserAgentContext(context);
        return ResponseResultInfo.success();
    }

    @GetMapping("/getUserContext")
    public ResponseResultInfo<List<ZhsUserAgentContext>> getUserAgentContext(@RequestParam("id")String id, @RequestParam("token")String userUuid, @RequestParam(value = "field1", required = false) String field1){
        ZhsUserAgentContext build = ZhsUserAgentContext.builder()
                .agentId(id)
                .userUuid(userUuid)
                .field1(field1)
                .build();
        List<ZhsUserAgentContext> zhsUserAgentContexts = contextService.selectZhsUserAgentContextList(build);
        return ResponseResultInfo.success(zhsUserAgentContexts);
    }
    @GetMapping("/getUserContext/field")
    public ResponseResultInfo<List<ZhsUserAgentContext>> getUserAgentContextByField(@RequestParam("id")String id, @RequestParam("token")String userUuid, @RequestParam(value = "field1", required = false) String field1){
        ZhsUserAgentContext build = ZhsUserAgentContext.builder()
                .agentId(id)
                .userUuid(userUuid)
                .field1(field1)
                .build();
        List<ZhsUserAgentContext> zhsUserAgentContexts = contextService.getUserAgentContextByField(build);
        return ResponseResultInfo.success(zhsUserAgentContexts);
    }
    @PostMapping("/remove/context/field")
    public ResponseResultInfo removeContextField(@RequestBody Map<String, String> param){
        String id, userUuid, field1;

        if(!param.containsKey("id") || Objects.isNull(id = param.get("id"))){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("参数异常！").build();
        }
        if(!param.containsKey("token") || Objects.isNull(userUuid = param.get("token"))){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("参数异常！").build();
        }
        if(!param.containsKey("field1") || Objects.isNull(field1 = param.get("field1"))){
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("参数异常！").build();
        }

        ZhsUserAgentContext build = ZhsUserAgentContext.builder()
                .agentId(id)
                .userUuid(userUuid)
                .field1(field1)
                .build();
        Integer a = contextService.removeContextField(build);
        return getUserAgentContextByField(id, userUuid,null);
    }

    @PostMapping("/fileUpload")
    public ResponseResultInfo<String> fileUpload(@RequestBody Map<String, Object> param){
        String file, fileName;
        if (!param.containsKey("file") || Objects.isNull(file = param.get("file").toString())) {
            return ResponseResultInfo.<String>builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("文件不存在").build();
        }
        if (!param.containsKey("fileName") || Objects.isNull(fileName = param.get("fileName").toString())) {
            return ResponseResultInfo.<String>builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("文件不存在").build();
        }
        ResponseResultInfo<String> stringResponseResultInfo = loginService.fileUpload(file, fileName);
        return stringResponseResultInfo;
    }

    // 获取开发者价格信息
    @GetMapping("/developer/price")
    public ResponseResultInfo<List<ZhsProductIdentity>> getDeveloperPrice(){
        return resourceService.getDeveloperPrice();
    }


    @SkipLogin
    @PostMapping("/fileUploadNetworkPath")
    public ResponseResultInfo<String> fileUploadNetworkPath(@RequestBody Map<String, Object> param){
        String filePath;
        if (!param.containsKey("filePath") || Objects.isNull(filePath = param.get("filePath").toString())) {
            return ResponseResultInfo.<String>builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("文件不存在").build();
        }
        ResponseResultInfo<String> stringResponseResultInfo = loginService.fileUploadNetworkPath(filePath);
        return stringResponseResultInfo;
    }

    /**
     * 首次分享赠送算力 18888
     */
    @GetMapping("/first/share")
    public ResponseResultInfo<String> firstShare(@RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid){
        return ResponseResultInfo.success(loginService.firstShare(uuid));
    }
//    public ResponseResultInfo<UsersVO> firstShare(@RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid){
//        return ResponseResultInfo.success(loginService.firstShare(uuid));
//    }
//    @SkipLogin
    @GetMapping("/first/share/show")
    public Boolean firstShareShow(/*@RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid, */HttpServletRequest request){
        String userUuid = null;
        // 手动尝试解析认证信息
        String authorization = request.getHeader(BeanConfig.ZHS_AUTHORIZATION);
        if (StringUtils.isNotBlank(authorization) && authorization.startsWith("Bearer ")) {
            try {
                String bearer = authorization.replace("Bearer ", "");
                JWTUtils jwtUtils = SpringContextUtil.getBean(JWTUtils.class);
                Map<String, Object> claims = jwtUtils.parseJwt(bearer, Map.class);

                // 验证token有效性
                if (claims.containsKey("uuid") && claims.containsKey("expiresAt")) {
                    long expiresAt = Long.parseLong(claims.get("expiresAt").toString());
                    if (expiresAt > Instant.now().getEpochSecond()) {
                        userUuid = claims.get("uuid").toString();
                    }
                }
            } catch (Exception e) {
                // 认证解析失败，userUuid保持为null
                e.printStackTrace();
//                logger.warn("Token解析失败: {}", e.getMessage());
            }
        }
        return loginService.firstShareShow(userUuid);
    }

    /**
     * 核心接口：下载网络文件并加水印，返回给客户端下载
     * @param netUrl 必传：网络文件URL（如https://xxx.com/xxx.jpg、https://xxx.com/xxx.mp4）
     * @param response 响应对象（用于流式输出）
     */
    @SkipLogin
    @GetMapping("/download/watermark")
    public void downloadWithWatermark(
            @RequestParam("netUrl") String netUrl,
//            @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid,
            @RequestParam("user_uuid")String uuid,
            HttpServletResponse response) {
        String watermarkText = "AI生成";
        File tempWatermarkedFile = null;
        OutputStream out = null; // 统一管理输出流
        try {
            // 1. 下载网络文件
            Object[] downloadResult = NetFileDownloadUtil.downloadNetFile(netUrl);
            byte[] fileBytes = (byte[]) downloadResult[0];
            String contentType = (String) downloadResult[1];
            String fileName = generateFileName(netUrl);

            // 2. 配置下载响应头
            setDownloadResponseHeader(response, fileName, contentType);

            // 3. 获取输出流（全程唯一的 OutputStream）
            out = response.getOutputStream();
            if(StringUtils.isBlank(uuid)){

                out.write(fileBytes);
                out.flush();
                return;
            }

            // 4. 分类型处理
            if (contentType.startsWith("image/")) {
                handleImageWatermark(fileBytes, contentType, out);
            } else if (contentType.startsWith("video/")) {
                tempWatermarkedFile = handleVideoWatermark(fileBytes, watermarkText,fileName.substring(fileName.indexOf(".")+1));
                FileUtils.copyFile(tempWatermarkedFile, out);
            } else {
                out.write(fileBytes);
                out.flush();
            }

        } catch (Exception e) {
            e.printStackTrace();
            // 异常时输出错误信息（已重构为 OutputStream 方式）
            return;
//            writeErrorResponse(response, "处理失败：" + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            // 5. 关闭流+清理临时文件
            if (out != null) {
                try {
                    out.close();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
            if (tempWatermarkedFile != null && tempWatermarkedFile.exists()) {
                FileUtils.deleteQuietly(tempWatermarkedFile);
            }
        }
    }
    /**
     * 生成下载文件名（UUID+原后缀，避免重复）
     */
    private String generateFileName(String netUrl) {
        int paramIndex = netUrl.lastIndexOf("?");
        if (paramIndex == -1) paramIndex = netUrl.length();
        String suffix = netUrl.substring(netUrl.lastIndexOf("."), paramIndex);
        return UUID.randomUUID().toString() + suffix;
    }
    /**
     * 设置下载响应头（兼容中文文件名、指定MIME类型）
     */
    private void setDownloadResponseHeader(HttpServletResponse response, String fileName, String contentType) throws UnsupportedEncodingException {
        response.setContentType(contentType);
        response.setCharacterEncoding("UTF-8");
        // 处理中文文件名乱码
        String encodedFileName = URLEncoder.encode(fileName, "UTF-8").replace("+", "%20");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFileName + "\"");
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache");
    }
    /**
     * 处理图片水印：字节数组→加水印→流式输出到客户端
     */
    private void handleImageWatermark(byte[] imageBytes, String contentType, OutputStream out) throws Exception {
        String format = contentType.substring(contentType.lastIndexOf("/") + 1);
        if ("jpeg".equals(format)) format = "jpg"; // 兼容ImageIO格式

        try (InputStream originIs = new ByteArrayInputStream(imageBytes)) {
            // 调用图片水印工具（文字水印，也可替换为图片水印）
//            ImageWatermarkUtil.addTextWatermark(originIs, out, watermarkText, format);
            ImageWatermarkUtil.addImageWatermark(originIs, out, new FileInputStream(WATER_MARK), format);
            out.flush();
        }
    }
    private static final String TEMP_DIR = System.getProperty("java.io.tmpdir"); // 系统临时目录
    /**
     * 处理视频水印：字节数组→临时文件→加水印→返回临时文件
     */
    private File handleVideoWatermark(byte[] videoBytes, String watermarkText, String substring) throws Exception {
        // 1. 创建原视频临时文件
        File tempOriginFile = File.createTempFile("origin_video_", ".tmp", new File(TEMP_DIR));
        tempOriginFile.deleteOnExit(); // JVM退出时删除
        FileUtils.writeByteArrayToFile(tempOriginFile, videoBytes);

        // 2. 创建加水印后的视频临时文件
        File tempWatermarkedFile = File.createTempFile("watermarked_video_", ".mp4", new File(TEMP_DIR));
        tempWatermarkedFile.deleteOnExit();

        // 3. 调用视频水印工具（文字水印）
        try (InputStream originIs = new FileInputStream(tempOriginFile);
             OutputStream watermarkedOs = new FileOutputStream(tempWatermarkedFile)) {
            VideoWatermarkUtil.addImageWatermarkToVideo(originIs, watermarkedOs, new FileInputStream(WATER_MARK),substring);
        } finally {
            FileUtils.deleteQuietly(tempOriginFile); // 删除原视频临时文件
        }
        return tempWatermarkedFile;
    }
    /**
     * 写入错误响应
     */
    private void writeErrorResponse(HttpServletResponse response, String message, HttpStatus status) {
        try {
            response.setStatus(status.value());
            response.setContentType(MediaType.TEXT_PLAIN_VALUE + ";charset=UTF-8");
            response.getWriter().write(message);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}