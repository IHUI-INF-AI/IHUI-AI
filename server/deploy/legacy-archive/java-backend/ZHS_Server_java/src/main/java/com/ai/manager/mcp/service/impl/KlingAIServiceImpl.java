package com.ai.manager.mcp.service.impl;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.mcp.service.KlingAIService;
import com.ai.manager.small.domain.Order;
import com.ai.manager.small.domain.ZhsUserAgentContext;
import com.ai.manager.small.domain.ZhsUserAgentImage;
import com.ai.manager.small.domain.dto.OrderPageDTO;
import com.ai.manager.small.mapper.OrderMapper;
import com.ai.manager.small.mapper.ZhsUserAgentContextMapper;
import com.ai.manager.small.mapper.ZhsUserAgentImageMapper;
import com.ai.manager.small.service.impl.ISysFileService;
import com.alibaba.druid.support.json.JSONUtils;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.google.common.collect.Maps;
import org.apache.commons.lang3.StringUtils;
import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.bytedeco.javacv.FrameGrabber;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.time.Instant;
import java.util.*;

/**
 * 可灵视频
 */
@Service
public class KlingAIServiceImpl implements KlingAIService {

    static String ak = "A3CNdFEkmbaTatMJQ3hEkLAKECann4Qt"; // 填写access key
    static String sk = "FBf89QQn3baMkeTHPGKrMYQEaBgCfPHH"; // 填写secret key

    @Autowired
    private ZhsUserAgentContextMapper contextMapper;


    // 获取可灵Token
    private static String KLING_TOKEN = null;

    private static final String KLING_O1 = "kling-video-o1";
    private static final String KLING_O1_DB_NAME = "kling-video-o1";

    @Autowired
    private ISysFileService fileService;

    @Override
    public ResponseResultInfo generateVideo(Map<String, Object> param) {
        // 判断是否存在
        if (StringUtils.isBlank(KLING_TOKEN)) {
            KLING_TOKEN = sign(ak, sk);
        }
        // 创建数据
        String image = param.getOrDefault("image", "").toString();
        String soundFile = param.getOrDefault("soundFile", "").toString();
        String prompt = param.getOrDefault("prompt", "").toString();
//        String prompt = "";
        String mode = param.getOrDefault("mode", "std").toString();
        String creator = param.getOrDefault("creator", "").toString();
        String chatId = param.getOrDefault("chatId", "").toString();

        String s = create(image, soundFile, prompt, mode);
        // 判断结果是否是token过期
        Object parse = JSONUtils.parse(s);
        if (parse instanceof Map) {
            Map result = (Map) parse;
            String code = result.get("code").toString();
            if (code.equals("1004")) {
                KLING_TOKEN = null;
                return generateVideo(param);
            }

            Object o = result.get("data");
            // 任务状态，枚举值：submitted（已提交）、processing（处理中）、succeed（成功）、failed（失败）
//            String status = ((Map) o).get("status");

            // 保存上下文
            ZhsUserAgentContext build = ZhsUserAgentContext.builder()
                    .id(UUID.randomUUID().toString())
                    .agentId("keling")
                    .userUuid(creator)
                    .problem(prompt)
                    .userUrl(image + "," + soundFile)
                    .sendTime(Instant.now().getEpochSecond())
                    .modelName("keling")
                    .chatId(chatId)
                    .videoRatio("0")
                    .build();
            if (o instanceof Map) {
                String string = ((Map) o).get("task_id").toString();
                build.setAnswer(string);
            }
            contextMapper.insertZhsUserAgentContext(build);

            return ResponseResultInfo.success(o);
        }
        return ResponseResultInfo.error(null, "生成失败");
    }

    @Override
    public ResponseResultInfo videoInfo(String id, String uuid) {
        // 判断是否存在
        if (StringUtils.isBlank(KLING_TOKEN)) {
            KLING_TOKEN = sign(ak, sk);
        }
        String aiTask = getAITask(id);
//        String aiTask = "{\"code\":0,\"message\":\"SUCCEED\",\"request_id\":\"0eb4d834-298a-4eee-847a-33400d340fea\",\"data\":{\"task_id\":\"797539647311749155\",\"task_status\":\"succeed\",\"task_info\":{\"external_task_id\":\"bf54fb9d-697a-493a-ab1d-e878b1ecbc92\"},\"task_result\":{\"videos\":[{\"id\":\"797539648649719813\",\"url\":\"https://v2-kling.kechuangai.com/bs2/upload-ylab-stunt/51684e87-bbdd-4c60-9cd7-82dd2000f783-LYbxBjP5NWio8-HhREr90A-output.mp4?x-kcdn-pid=112452\",\"duration\":\"14.666\"}]},\"task_status_msg\":\"\",\"created_at\":1758176788274,\"updated_at\":1758177101390}}";

        try {
            // 判断结果是否是token过期
            Object parse = JSONUtils.parse(aiTask);
            if (parse instanceof Map) {
                Map result = (Map) parse;
                String code = result.get("code").toString();
                if (code.equals("1004")) {
                    KLING_TOKEN = null;
                    return videoInfo(id, uuid);
                }
                // 判断是否是否成功
                Object data = result.get("data");
                Object message = result.get("message");
                if(Objects.isNull(data)){
                    return ResponseResultInfo.success(aiTask, message.toString());
                }

                if (data instanceof Map) {
                    JSONObject jsonObject = new JSONObject((Map) data);
                    if (!jsonObject.getString("task_status").equals("succeed")) {
                        return ResponseResultInfo.success(data);
                    }

                    JSONObject task_result = jsonObject.getJSONObject("task_result");
//                String answer = taskInfo.toString();

                    // 获取上下文记录
                    ZhsUserAgentContext context = contextMapper.getUserContextByTaskId(id);
                    if (Objects.isNull(context)) {
                        return ResponseResultInfo.error(data, "未找到当前任务");
                    }
                    context.setAnswer("");

                    JSONArray videos = task_result.getJSONArray("videos");
                    // 计算总长度
                    Long second = 0L;
                    Long total_tokens = 0L;
                    for (int i = 0; i < videos.length(); i++) {
                        JSONObject jsonObject1 = videos.getJSONObject(i);

                        // 将网络地址转成本地minio地址
                        String agentUrl = jsonObject1.getString("url");
//                        byte[] fileAsByte = getFileAsByte(agentUrl, 500);
                        //
                        String videoInfo = getVideoInfo(agentUrl);
                        String minioResult = create(agentUrl);
                        Map minioResultMap = (Map) JSONUtils.parse(minioResult);
                        agentUrl = minioResultMap.getOrDefault("data", "").toString();
//                    agentUrl = fileService.uploadMinio(fileAsByte, UUID.randomUUID().toString() + agentUrl.substring(agentUrl.lastIndexOf("."), agentUrl.lastIndexOf("?")));

                        context.setAgentUrl(StringUtils.isNotBlank(context.getAgentUrl()) ? "," + agentUrl : agentUrl);
                        context.setVideoRatio(StringUtils.isNotBlank(videoInfo) ? "," + videoInfo : videoInfo);

                        String duration = jsonObject1.getString("duration");
                        String[] split = duration.split("\\.");
                        total_tokens = Long.valueOf(split[0]);
                        if (Integer.valueOf(split[1]) != 0) {
                            total_tokens = total_tokens + 1;
                        }
                        jsonObject1.put("video_ratio", videoInfo);
                        second += total_tokens * 4 * 4 * 20000 / 10;
                        jsonObject1.put("total_tokens", total_tokens * 4 * 4 * 20000 / 10);
                    }

                    // 查看消耗总数  1.6元/秒
                    Integer i = contextMapper.userConsume(uuid, second);
                    contextMapper.updateZhsUserAgentContext(context);
                    return ResponseResultInfo.success(JSONUtils.parse(jsonObject.toString()));
//                    return ResponseResultInfo.success(jsonObject);
                }
                return ResponseResultInfo.success(data);
            }
        } catch (Exception e) {
            System.out.println(e.getMessage());
            return ResponseResultInfo.error(aiTask, "查询失败");
        }

        return ResponseResultInfo.error(aiTask, "查询失败");
    }

//    @Override
//    public ResponseResultInfo generateO1(Map<String, Object> param) {
//        // 判断是否存在
//        if (StringUtils.isBlank(KLING_TOKEN)) {
//            KLING_TOKEN = sign(ak, sk);
//        }
//        // 创建请求体
//        Map<String, Object> query = Maps.newHashMap();
//
//        String prompt = param.getOrDefault("prompt", "").toString();
//        query.put("model_name","");
//        // 解析数据
//        JSONArray zidingyican = new JSONArray(param.get("zidingyican"));
//        for (int i = 0; i < zidingyican.length(); i++) {
//            JSONObject jsonObject = zidingyican.getJSONObject(i);
//            // 获取是传参图片
//        }
//
//        String soundFile = param.getOrDefault("soundFile", "").toString();
////        String prompt = "";
//        String mode = param.getOrDefault("mode", "std").toString();
//        String creator = param.getOrDefault("creator", "").toString();
//        String chatId = param.getOrDefault("chatId", "").toString();
//
//        String s = create(image, soundFile, prompt, mode);
//        // 判断结果是否是token过期
//        Object parse = JSONUtils.parse(s);
//        if (parse instanceof Map) {
//            Map result = (Map) parse;
//            String code = result.get("code").toString();
//            if (code.equals("1004")) {
//                KLING_TOKEN = null;
//                return generateVideo(param);
//            }
//
//            Object o = result.get("data");
//            // 任务状态，枚举值：submitted（已提交）、processing（处理中）、succeed（成功）、failed（失败）
////            String status = ((Map) o).get("status");
//
//            // 保存上下文
//            ZhsUserAgentContext build = ZhsUserAgentContext.builder()
//                    .id(UUID.randomUUID().toString())
//                    .agentId("keling")
//                    .userUuid(creator)
//                    .problem(prompt)
//                    .userUrl(image + "," + soundFile)
//                    .sendTime(Instant.now().getEpochSecond())
//                    .modelName("keling")
//                    .chatId(chatId)
//                    .videoRatio("0")
//                    .build();
//            if (o instanceof Map) {
//                String string = ((Map) o).get("task_id").toString();
//                build.setAnswer(string);
//            }
//            contextMapper.insertZhsUserAgentContext(build);
//
//            return ResponseResultInfo.success(o);
//        }
//        return ResponseResultInfo.error(null, "生成失败");
//    }


    private String sign(String ak, String sk) {
        try {
            Date expiredAt = new Date(System.currentTimeMillis() + 1800 * 1000); // 有效时间，此处示例代表当前时间+1800s(30min)
            Date notBefore = new Date(System.currentTimeMillis() - 5 * 1000); //开始生效的时间，此处示例代表当前时间-5秒
            Algorithm algo = Algorithm.HMAC256(sk);
            Map<String, Object> header = new HashMap<>();
            header.put("alg", "HS256");
            return JWT.create()
                    .withIssuer(ak)
                    .withHeader(header)
                    .withExpiresAt(expiredAt)
                    .withNotBefore(notBefore)
                    .sign(algo);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private String create(String image, String soundFile, String prompt, String mode) {

        Map<String, String> param = Maps.newHashMap();
//        param.put("image", FileStreamToBase64.fileStreamToBase64("D:\\Users\\Administrator\\Pictures\\微信图片_20250917142127_9_131.jpg")); // 数字人参考图 base64 不含前缀data:image/png;base64,
//        param.put("image", image);
        param.put("image", getFileAsBase64(image, 500));
//        param.put("sound_file","https:///fil/e.aizhs.top/sys-backs/9月16日 15点53分.mp3"); // 指定音色文件base64 或者url // 不能用
//        param.put("sound_file",FileStreamToBase64.fileStreamToBase64("E:\\job\\slackOff\\9月17日.MP3")); // 指定音色文件base64 或者url
//        param.put("sound_file",soundFile);
        param.put("sound_file", getFileAsBase64(soundFile, 500));
//        param.put("prompt",""); // 提示词
        param.put("prompt", prompt);
//        param.put("mode","std"); // 生成视频的模式 std标准模式（标准），基础模式，性价比高 | pro专家模式（高品质），高表现模式，生成视频质量更佳
        param.put("mode", mode);
        param.put("callback_url", ""); // 回调通知地址
        String uuid = UUID.randomUUID().toString();
        param.put("external_task_id", uuid); // 本地任务id
        System.out.println("当前创建任务id：" + uuid);

        // 2. POST 请求（JSON 数据）
        HttpResponse postResponse = HttpRequest.post("https://api-beijing.klingai.com/v1/videos/avatar/image2video")
                .header(BeanConfig.ZHS_CONTENT_TYPE, "application/json")
                .header(BeanConfig.ZHS_AUTHORIZATION, "Bearer " + KLING_TOKEN)
                .body(JSONUtils.toJSONString(param))
                .execute();
        String body = postResponse.body();
        System.out.println("POST 响应: " + body);

        return body;
        // {"code":0,"message":"SUCCEED","request_id":"a60990f3-b485-4dbb-b02f-6eea9cd000c5","data":{"task_id":"797182621750399062","task_status":"submitted","created_at":1758091666748,"updated_at":1758091666748}}

    }

    private String getAITask(String id) {
        Map<String, String> param = Maps.newHashMap();
        // 2. POST 请求（JSON 数据）
//        HttpResponse postResponse = HttpRequest.get("https://api-beijing.klingai.com/v1/videos/avatar/image2video/" + "797191640489828365")
        System.out.println("KLING_TOKEN: " + KLING_TOKEN);
        HttpResponse postResponse = HttpRequest.get("https://api-beijing.klingai.com/v1/videos/avatar/image2video/" + id)
                .header(BeanConfig.ZHS_CONTENT_TYPE, "application/json")
                .header(BeanConfig.ZHS_AUTHORIZATION, "Bearer " + KLING_TOKEN)
                .body(JSONUtils.toJSONString(param))
                .execute();
        String body = postResponse.body();
        System.out.println("POST 响应: " + body);

        return body;
    }

    /**
     * 通过GET请求获取网络文件并转换为Base64编码
     *
     * @param fileUrl 网络文件URL地址
     * @param timeout 超时时间(毫秒)
     * @return Base64编码字符串（带MIME类型前缀）
     */
    public static byte[] getFileAsByte(String fileUrl, int timeout) {
        // 发送GET请求并获取响应
        try (HttpResponse response = HttpRequest.get(fileUrl)
                .timeout(timeout) // 设置超时时间
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)") // 模拟浏览器请求
                .execute()) {

            // 检查请求是否成功
            if (response.isOk()) {
                // 获取文件字节数组
                byte[] fileBytes = response.bodyBytes();
                return fileBytes;
            } else {
                throw new RuntimeException("请求失败，状态码: " + response.getStatus());
            }
        } catch (Exception e) {
            throw new RuntimeException("文件获取或转换失败: " + e.getMessage(), e);
        }
    }

    public static String getFileAsBase64(String fileUrl, int timeout) {
        // 发送GET请求并获取响应
        try (HttpResponse response = HttpRequest.get(fileUrl)
                .timeout(timeout) // 设置超时时间
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)") // 模拟浏览器请求
                .execute()) {

            // 检查请求是否成功
            if (response.isOk()) {
                // 获取文件字节数组
                byte[] fileBytes = response.bodyBytes();

                // 获取文件MIME类型
                String mimeType = response.header("Content-Type");

                // 转换为Base64编码
                String base64Str = Base64.getEncoder().encodeToString(fileBytes);

                // 拼接完整格式（包含MIME类型，可直接用于img标签等场景）
//                return "data:" + mimeType + ";base64," + base64Str;
                return base64Str;
            } else {
                throw new RuntimeException("请求失败，状态码: " + response.getStatus());
            }
        } catch (Exception e) {
            throw new RuntimeException("文件获取或转换失败: " + e.getMessage(), e);
        }
    }


    static String create(String agentUrl) {
        Map<String, String> param = Maps.newHashMap();
//        param.put("base64ImageContent", "data:video/mp4;base64," + getFileAsBase64(agentUrl, 500));
        param.put("filePath", agentUrl);
        param.put("fileName", UUID.randomUUID().toString() + agentUrl.substring(agentUrl.lastIndexOf("."), agentUrl.lastIndexOf("?")));

        // 2. POST 请求（JSON 数据）
//        HttpResponse postResponse = HttpRequest.post("http://192.168.3.16:8002/resource/fileUpload")
//        HttpResponse postResponse = HttpRequest.post("http://192.168.3.16:8002/resource/fileUploadNetworkPath")
        HttpResponse postResponse = HttpRequest.post("http://127.0.0.1:8002/resource/fileUploadNetworkPath")
//        HttpResponse postResponse = HttpRequest.post("https://kou.aizhs.top/resource/fileUploadNetworkPath")
                .header(BeanConfig.ZHS_CONTENT_TYPE, "application/json")
                .body(JSONUtils.toJSONString(param))
                .execute();
        String body = postResponse.body();
        System.out.println("POST 响应: " + body);
        return body;
        // {"code":0,"message":"SUCCEED","request_id":"a60990f3-b485-4dbb-b02f-6eea9cd000c5","data":{"task_id":"797182621750399062","task_status":"submitted","created_at":1758091666748,"updated_at":1758091666748}}

    }

    private String getVideoInfo(String videoUrl) {

        // 网络视频地址示例
//        String videoUrl = "https://file.aizhs.top/sys-backs/2025/09/18/luyala_video_0e7f757d9c03499bbcb4592a62607721_20250918090618A147.mp4"; // 替换为实际视频URL

        try {
            // 创建网络视频抓取器
            FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(videoUrl);

            // 设置网络超时参数
            configureNetworkTimeout(grabber);

            // 启动抓取器
            System.out.println("正在连接到视频源: " + videoUrl);
            grabber.start();

            // 视频分辨率
            int width = grabber.getImageWidth();
            int height = grabber.getImageHeight();
            // 视频比例
            String aspectRatio = calculateAspectRatio(width, height);

            // 释放资源
            grabber.stop();
            grabber.release();
            return aspectRatio;

        } catch (FrameGrabber.Exception e) {
            System.err.println("分析网络视频时发生错误: " + e.getMessage());
            e.printStackTrace();
        }
        return "0";
    }

    /**
     * 配置网络连接超时参数
     */
    private static void configureNetworkTimeout(FFmpegFrameGrabber grabber) {
        // 设置连接超时
        grabber.setOption("timeout", String.valueOf(5 * 1000)); // FFmpeg使用微秒
        // 对于RTSP等协议可以设置更多参数
        grabber.setOption("rtsp_transport", "tcp"); // 使用TCP传输以提高稳定性
    }

    /**
     * 计算视频宽高比
     */
    private static String calculateAspectRatio(int width, int height) {
        if (width <= 0 || height <= 0) {
            return "未知";
        }

        // 计算最大公约数
        int gcd = gcd(width, height);
        int ratioWidth = width / gcd;
        int ratioHeight = height / gcd;

        return ratioWidth + ":" + ratioHeight;
    }
    /**
     * 计算最大公约数
     */
    private static int gcd(int a, int b) {
        return b == 0 ? a : gcd(b, a % b);
    }




}
