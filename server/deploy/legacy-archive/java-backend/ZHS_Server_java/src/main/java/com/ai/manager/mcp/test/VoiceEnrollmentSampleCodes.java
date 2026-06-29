package com.ai.manager.mcp.test;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.utils.EncryptUtil;
import com.alibaba.dashscope.audio.ttsv2.SpeechSynthesisParam;
import com.alibaba.dashscope.audio.ttsv2.SpeechSynthesizer;
import com.alibaba.dashscope.audio.ttsv2.enrollment.Voice;
import com.alibaba.dashscope.audio.ttsv2.enrollment.VoiceEnrollmentService;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import com.alibaba.druid.support.json.JSONUtils;
import com.google.gson.Gson;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import static java.lang.System.exit;

public class VoiceEnrollmentSampleCodes {
    public static String apiKey = EncryptUtil.decodeBase64("c2stZTdkOGNlMTU3ZjE2NDAxNzg1ZDg0MTc2MmMzNTZiOTY=");  // 如果您没有配置环境变量，请在此处用您的API-KEY进行替换
    private static String fileUrl = "https://file.aizhs.top/sys-backs/本地录音-9月20日10点18分.mp3";  // 请按实际情况进行替换
    private static String prefix = "prefix";
    private static String targetModel = "cosyvoice-v2";

    public static void main(String[] args)
            throws NoApiKeyException, InputRequiredException {
////        // 复刻声音
////        VoiceEnrollmentService service = new VoiceEnrollmentService(apiKey);
////        Voice myVoice = service.createVoice(targetModel, prefix, fileUrl);
////        System.out.println("RequestId: " + service.getLastRequestId());
////        System.out.println("your voice id is " + myVoice.getVoiceId());
//
//
//        // 使用复刻的声音来合成文本为语音
//        SpeechSynthesisParam param = SpeechSynthesisParam.builder()
//                .apiKey(apiKey)
//                .model(targetModel)
////                .voice(myVoice.getVoiceId())
//                .voice("longyingcui")
//                .build();
//        SpeechSynthesizer synthesizer = new SpeechSynthesizer(param, null);
//        ByteBuffer audio = synthesizer.call("这是一段标准测试文案，适合检查麦克风的音量和音质表现。");
//        // 保存合成的语音到文件
//        System.out.println("TTS RequestId: " + synthesizer.getLastRequestId());
//        File file = new File("E:\\job\\test\\output.mp3");
//        try (FileOutputStream fos = new FileOutputStream(file)) {
//            fos.write(audio.array());
//        } catch (IOException e) {
//            throw new RuntimeException(e);
//        }
//        exit(0);

//        VoiceEnrollmentService service = new VoiceEnrollmentService(apiKey);
//        // 查询音色
//        Voice[] voices = service.listVoice(null, 0, 10);
//        System.out.println("request id为：" + service.getLastRequestId());
//        // 将voices打印成json
//        Gson gson = new Gson();
//        System.out.println("查询到的音色为：" + gson.toJson(voices));
//        exit(0);


//        VoiceEnrollmentService service = new VoiceEnrollmentService(apiKey);
//
//        String prefix = ""; // 可选，用于过滤音色前缀
//        int pageIndex = 0;  // 分页索引，从0开始
//        int pageSize = 10;  // 每页返回的音色数量
//
//        try {
//            Voice[] voices = service.listVoice(prefix, pageIndex, pageSize);
//            Gson gson = new Gson();
//            System.out.println("查询到的音色列表为：" + gson.toJson(voices));
//        } catch (Exception e) {
//            e.printStackTrace();
//        }



        HttpResponse postResponse = HttpRequest.post("https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization")
//                .setSSLProtocol("TLSv1.2")
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .body("{\"model\":\"voice-enrollment\",\"input\":{\"action\":\"list_voice\",\"prefix\":\"\",\"page_index\":0,\"page_size\":10}}")
                .execute();
        System.out.println(postResponse.body());

    }

}