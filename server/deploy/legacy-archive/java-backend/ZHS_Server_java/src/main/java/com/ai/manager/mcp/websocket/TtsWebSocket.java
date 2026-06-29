package com.ai.manager.mcp.websocket;

import com.ai.manager.core.utils.EncryptUtil;
import com.ai.manager.mcp.websocket.audio.RealtimePcmPlayer;
import com.ai.manager.small.domain.ZhsUserAgentContext;
import com.ai.manager.small.service.IZhsUserAgentContextService;
import com.ai.manager.small.service.impl.MinioSysFileServiceImpl;
import com.alibaba.dashscope.audio.qwen_tts_realtime.*;
import com.alibaba.dashscope.exception.NoApiKeyException;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

/**
 * TTS WebSocket服务端点
 * 提供实时语音合成服务，支持通过WebSocket连接发送文本并接收合成的音频数据
 */
@Component
@ServerEndpoint("/tts-websocket")
public class TtsWebSocket {

    private final String ttsModel = "qwen3-tts-flash-realtime";
        // 在类中添加新的字段
    private String userUuid;           // 用户UUID
    private String chatId;            // 聊天ID
    private String problemText;       // 问题文本
    private String fileUrl;           // 音频文件URL
    private long sendTime;           // 发送时间

    // 不再直接使用@Value注入，而是通过ApplicationContext获取
    private String ttsApiKey;

    // 在TtsWebSocket类中添加静态ApplicationContext引用
    private static ApplicationContext applicationContext;

    // 添加设置ApplicationContext的方法
    public static void setApplicationContext(ApplicationContext context) {
        applicationContext = context;
    }

    // 获取配置属性的方法
    private String getApiKey() {
        if (ttsApiKey == null) {
            if (applicationContext != null) {
                ttsApiKey = applicationContext.getEnvironment().getProperty("app.ali.ai.api.key");
            }
            // 如果仍为空，使用默认值
            if (ttsApiKey == null || ttsApiKey.trim().isEmpty()) {
                System.out.println("---------------ttsApiKey 未正确注入-----------------" );
//                ttsApiKey = "sk-84ee5a834c67446a9125ae85a3e4906d";
            }
        }
        return ttsApiKey;
    }

    // 获取Minio服务实例的方法
    private MinioSysFileServiceImpl getMinioService() {
        return applicationContext.getBean(MinioSysFileServiceImpl.class);
    }
    // 获取用户代理上下文服务的方法
    private IZhsUserAgentContextService getUserAgentContextService() {
        return applicationContext.getBean(IZhsUserAgentContextService.class);
    }

    // 添加文件上传方法
    private String uploadAudioFileToMinio(String filePath) {
        try {
            MinioSysFileServiceImpl minioService = getMinioService();

            // 读取文件内容
            byte[] fileBytes = Files.readAllBytes(Paths.get(filePath));

            // 生成文件名
            String fileName = "tts_" + System.currentTimeMillis() + ".wav";

            // 上传到MinIO
            String fileUrl = minioService.uploadMinio(fileBytes, fileName);

            return fileUrl;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    /**
     * WebSocket连接建立时的回调方法
     *
     * @param session WebSocket会话
     */
    @OnOpen
    public void onOpen(Session session) {
        try {
            session.getUserProperties().put("sessionId", session.getId());
            sendMessage(session, "type", "info", "message", "WebSocket 连接已建立");
        } catch (Exception e) {
            handleError(session, e);
        }
    }

    /**
     * 接收客户端消息时的回调方法
     *
     * @param message 客户端发送的消息
     * @param session WebSocket会话
     */
    @OnMessage
    public void onMessage(String message, Session session) {
        try {
            processTtsRequest(session, message);
        } catch (Exception e) {
            handleError(session, e);
        }
    }

    /**
     * WebSocket连接关闭时的回调方法
     *
     * @param session     WebSocket会话
     * @param closeReason 关闭原因
     */
    @OnClose
    public void onClose(Session session, CloseReason closeReason) {
        sendMessage(session, "type", "info", "message", "WebSocket 连接已关闭: " + closeReason.getReasonPhrase());
    }

    /**
     * WebSocket发生错误时的回调方法
     *
     * @param session   WebSocket会话
     * @param throwable 异常对象
     */
    @OnError
    public void onError(Session session, Throwable throwable) {
        handleError(session, throwable);
    }

    /**
     * 处理TTS请求的主要方法
     * 解析客户端参数，调用阿里云TTS服务进行语音合成，并将结果保存为音频文件
     *
     * @param session WebSocket会话
     * @param request 客户端请求参数（JSON格式）
     * @throws Exception 处理过程中可能抛出的异常
     */
    private void processTtsRequest(Session session, String request) throws Exception {
        // 解析客户端发送的请求参数
        String[] textToSynthesize = {"测试音频！", "请确定当前音频文本是否正确"};
        String voice = "Cherry";

        // 解析额外的业务参数
        JsonObject requestJson = JsonParser.parseString(request).getAsJsonObject();
        
        // 获取业务参数
        if (requestJson.has("userUuid")) {
            userUuid = requestJson.get("userUuid").getAsString();
        }
        
        if (requestJson.has("chatId")) {
            chatId = requestJson.get("chatId").getAsString();
        }
        if (requestJson.has("text")) {
            problemText = "{\"text\":" + requestJson.get("text") + ",\"voice\":\""+ requestJson.get("voice").getAsString() + "\"}";
        }

        // 保存原始问题文本
        StringBuilder problemBuilder = new StringBuilder();

        // 尝试解析客户端发送的JSON参数
        try {
            // 解析文本数组
            if (requestJson.has("text")) {
                JsonElement textElement = requestJson.get("text");
                if (textElement.isJsonArray()) {
                    List<String> textList = new ArrayList<>();
                    for (JsonElement element : textElement.getAsJsonArray()) {
                        // 校验每个文本元素
                        String textValue = element.getAsString();
                        if (textValue != null && !textValue.trim().isEmpty()) {
                            textList.add(textValue);
                            if (problemBuilder.length() > 0) {
                                problemBuilder.append("\n");
                            }
                            problemBuilder.append(textValue);
                        }
                    }
                    // 校验文本数组是否为空
                    if (textList.isEmpty()) {
                        sendMessage(session, "type", "error", "message", "文本内容不能为空");
                        return;
                    }
                    textToSynthesize = textList.toArray(new String[0]);
                } else if (textElement.isJsonPrimitive()) {
                    String textValue = textElement.getAsString();
                    // 校验单个文本是否为空
                    if (textValue == null || textValue.trim().isEmpty()) {
                        sendMessage(session, "type", "error", "message", "文本内容不能为空");
                        return;
                    }
                    textToSynthesize = new String[]{textValue};
                    problemBuilder.append(textValue);
                }
            }

            // 解析语音参数
            if (requestJson.has("voice") && requestJson.get("voice").isJsonPrimitive()) {
                String voiceValue = requestJson.get("voice").getAsString();
                // 校验语音参数是否为空
                if (voiceValue != null && !voiceValue.trim().isEmpty()) {
                    voice = voiceValue;
                }
            }

        } catch (Exception e) {
            sendMessage(session, "type", "warning", "message", "解析参数失败，使用默认值: " + e.getMessage());
        }
        
        // 保存问题文本
        sendTime = System.currentTimeMillis() / 1000; // Unix时间戳（秒）

        // 最终校验：确保至少有一个有效的文本
        boolean hasValidText = false;
        for (String text : textToSynthesize) {
            if (text != null && !text.trim().isEmpty()) {
                hasValidText = true;
                break;
            }
        }

        if (!hasValidText) {
            sendMessage(session, "type", "error", "message", "没有有效的文本内容可供合成");
            return;
        }

        // 设置输出文件路径 - 保存为WAV文件到临时目录
        String outputFilePath = System.getProperty("java.io.tmpdir") + File.separator +
                "tts_" + System.currentTimeMillis() + ".wav";

        // 使用getApiKey()方法获取API密钥
        String apiKey = getApiKey();
        System.out.println("API Key: " + apiKey);

        QwenTtsRealtimeParam param = QwenTtsRealtimeParam.builder()
                .model(ttsModel)
                .apikey(EncryptUtil.decodeBase64(apiKey))  // 使用获取到的API密钥
                .build();

        AtomicReference<CountDownLatch> completeLatch = new AtomicReference<>(new CountDownLatch(1));
        final AtomicReference<QwenTtsRealtime> qwenTtsRef = new AtomicReference<>(null);

        // 创建实时音频保存器实例
        RealtimePcmPlayer audioProcessor = new RealtimePcmPlayer(24000, outputFilePath, true);
        audioProcessor.start(); // 启动音频处理线程

        sendMessage(session, "type", "info", "message", "开始处理音频...");

        QwenTtsRealtime qwenTtsRealtime = new QwenTtsRealtime(param, new QwenTtsRealtimeCallback() {
            @Override
            public void onOpen() {
                // 连接建立时的处理
                sendMessage(session, "type", "event", "message", "建立连接");
            }

            @Override
            public void onEvent(JsonObject message) {
                String messageType = message.get("type").getAsString();
                sendMessage(session, "type", "tts_event", "event_type", messageType, "data", message.toString());

                switch (messageType) {
                    case "session.created":
                        // 会话创建时的处理
                        sendMessage(session, "type", "info", "message", "会话已创建");
                        break;
                    case "response.audio.delta":
                        String recvAudioB64 = message.get("delta").getAsString();
                        // 解码Base64音频数据并直接写入文件
                        byte[] audioData = Base64.getDecoder().decode(recvAudioB64);
                        audioProcessor.write(audioData);
                        break;
                    case "response.done":
                        // 响应完成时的处理
                        sendMessage(session, "type", "info", "message", "响应完成");
                        break;
                    case "session.finished":
                        // 会话结束时的处理
                        sendMessage(session, "type", "info", "message", "会话结束");
                        completeLatch.get().countDown();
                        break;
                    default:
                        break;
                }
            }

            @Override
            public void onClose(int code, String reason) {
                // 连接关闭时的处理
                sendMessage(session, "type", "info", "message", "连接关闭: " + reason);
            }

        });

        qwenTtsRef.set(qwenTtsRealtime);

        try {
            qwenTtsRealtime.connect();
        } catch (NoApiKeyException e) {
            throw new RuntimeException(e);
        }

        // 使用从客户端传入的voice参数
        QwenTtsRealtimeConfig config = QwenTtsRealtimeConfig.builder()
                .voice(voice)  // 使用变量
                .responseFormat(QwenTtsRealtimeAudioFormat.PCM_24000HZ_MONO_16BIT)
                .mode("server_commit")
                .build();
        qwenTtsRealtime.updateSession(config);

        sendMessage(session, "type", "info", "message", "开始合成语音...");

        // 使用从客户端传入的文本数组
        for (String text : textToSynthesize) {
            // 过滤掉空文本
            if (text != null && !text.trim().isEmpty()) {
                sendMessage(session, "type", "info", "message", "添加文本: " + text);
                qwenTtsRealtime.appendText(text);
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        qwenTtsRealtime.finish();
        sendMessage(session, "type", "info", "message", "等待语音合成完成...");
        completeLatch.get().await();

        // 关闭处理器
        sendMessage(session, "type", "info", "message", "关闭音频处理器...");
        audioProcessor.shutdown();

        // 等待音频处理完成
        sendMessage(session, "type", "info", "message", "等待音频处理完成...");
        try {
            audioProcessor.waitForComplete();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // 修改文件上传成功后的处理部分
        try {
            String uploadedFileUrl = uploadAudioFileToMinio(outputFilePath);

            if (uploadedFileUrl != null) {
                // 保存文件URL用于后续保存到数据库
                fileUrl = uploadedFileUrl;
                sendMessage(session, "type", "complete", "message", "处理完成", "fileUrl", fileUrl);

                // ✅ 在这里立即保存记录，确保不会丢失
                saveTtsRecord();
            } else {
                sendMessage(session, "type", "error", "message", "文件上传失败");
            }

            // 删除临时文件
            try {
                File tempFile = new File(outputFilePath);
                if (tempFile.exists()) {
                    tempFile.delete();
                }
            } catch (Exception e) {
                System.err.println("删除临时文件失败: " + e.getMessage());
            }
        } catch (Exception e) {
            sendMessage(session, "type", "error", "message", "文件上传失败: " + e.getMessage());
            e.printStackTrace();

            // 即使上传失败也删除临时文件
            try {
                File tempFile = new File(outputFilePath);
                if (tempFile.exists()) {
                    tempFile.delete();
                }
            } catch (Exception ex) {
                System.err.println("删除临时文件失败: " + ex.getMessage());
            }
        }
    }

    // 添加保存TTS记录的方法
    private void saveTtsRecord() {
        try {
            // 检查必要参数是否存在
            if (userUuid == null || problemText == null || fileUrl == null) {
                System.out.println("缺少必要参数，无法保存TTS记录");
                return;
            }

            // 获取服务实例
            IZhsUserAgentContextService service = getUserAgentContextService();

            // 创建记录对象
            ZhsUserAgentContext context = new ZhsUserAgentContext();
            context.setId(UUID.randomUUID().toString());
            context.setAgentId(ttsModel);
            context.setUserUuid(userUuid);
            context.setProblem(problemText);
            context.setAgentUrl(fileUrl);
            context.setSendTime(sendTime);
            context.setChatId(chatId != null ? chatId : "");
            context.setModelName(ttsModel);

            // 保存到数据库
            int result = service.insertZhsUserAgentContext(context);
            if (result > 0) {
                System.out.println("TTS记录保存成功");
            } else {
                System.out.println("TTS记录保存失败");
            }
        } catch (Exception e) {
            System.err.println("保存TTS记录时发生异常: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * 向客户端发送消息
     *
     * @param session       WebSocket会话
     * @param keyValuePairs 键值对参数，格式为 key1, value1, key2, value2, ...
     */
    private void sendMessage(Session session, String... keyValuePairs) {
        try {
            if (session.isOpen()) {
                StringBuilder jsonBuilder = new StringBuilder("{");
                for (int i = 0; i < keyValuePairs.length; i += 2) {
                    if (i > 0) jsonBuilder.append(",");
                    jsonBuilder.append("\"").append(keyValuePairs[i]).append("\":\"");
                    jsonBuilder.append(keyValuePairs[i + 1].replace("\"", "\\\"")).append("\"");
                }
                jsonBuilder.append("}");
                session.getBasicRemote().sendText(jsonBuilder.toString());
            }
        } catch (Exception e) {
            System.err.println("发送消息失败: " + e.getMessage());
        }
    }

    /**
     * 处理错误并向客户端发送错误信息
     *
     * @param session   WebSocket会话
     * @param throwable 异常对象
     */
    private void handleError(Session session, Throwable throwable) {
        try {
            sendMessage(session, "type", "error", "message", "发生错误: " + throwable.getMessage());
            throwable.printStackTrace();
        } catch (Exception e) {
            System.err.println("处理错误时发生异常: " + e.getMessage());
        }
    }
}