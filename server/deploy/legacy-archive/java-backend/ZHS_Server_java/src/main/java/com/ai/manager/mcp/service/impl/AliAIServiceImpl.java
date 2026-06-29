package com.ai.manager.mcp.service.impl;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.utils.EncryptUtil;
import com.ai.manager.mcp.service.AgentService;
import com.ai.manager.mcp.service.AliAIService;
import com.ai.manager.mcp.service.McpResourceService;
import com.ai.manager.small.domain.Order;
import com.ai.manager.small.domain.ZhsUserAgentContext;
import com.ai.manager.small.domain.ZhsUserAgentImage;
import com.ai.manager.small.domain.dto.OrderPageDTO;
import com.ai.manager.small.mapper.OrderMapper;
import com.ai.manager.small.mapper.ZhsUserAgentContextMapper;
import com.ai.manager.small.mapper.ZhsUserAgentImageMapper;
import com.ai.manager.small.service.IZhsUserAgentAudioService;
import com.ai.manager.small.service.impl.ISysFileService;
import com.alibaba.dashscope.audio.ttsv2.SpeechSynthesisParam;
import com.alibaba.dashscope.audio.ttsv2.SpeechSynthesizer;
import com.alibaba.dashscope.audio.ttsv2.enrollment.Voice;
import com.alibaba.dashscope.audio.ttsv2.enrollment.VoiceEnrollmentService;
import com.google.common.collect.Maps;
import lombok.SneakyThrows;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import javax.annotation.PostConstruct;
import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AliAIServiceImpl implements AliAIService {

    @Value("${app.ali.ai.api.key}")
    private String ALI_API_KEY;// 如果您没有配置环境变量，请在此处用您的API-KEY进行替换

    @Autowired
    private IZhsUserAgentAudioService audioService;
    @Autowired
    private ISysFileService service;
    @Autowired
    private ZhsUserAgentContextMapper contextMapper;

    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private ZhsUserAgentImageMapper imageMapper;

    @Autowired
    private VideoFrameMinioUploader minioUploader;
    @Autowired
    private McpResourceService mcpResourceService;
    @Autowired
    private AgentService agentService;

    private final Map<String, List<ZhsUserAgentImage>> userImageMap = Maps.newHashMap();
    private final Map<String, List<Order>> userImageOrderMap = Maps.newHashMap();

    private final String PREFIX = "aizhs";
    private final String QUERY_MODEL_NAME = "cosyvoice-v3-plus";
    private final String DB_MODEL_NAME = "cosyvoice-v3";

    @PostConstruct
    private void base64ToKey(){
        ALI_API_KEY = EncryptUtil.decodeBase64(ALI_API_KEY);
    }

    @SneakyThrows
    @Override
    public ResponseResultInfo generateTimbre(Map<String, Object> param) {
        String audioId = param.getOrDefault("audioId", "").toString();
        String audioPathUpload = param.getOrDefault("audioPath", "").toString();
        String creator = param.get("creator").toString();
        String copyWriting = param.get("copyWriting").toString();
        String chatId = param.get("chatId").toString();
        String audioName = param.getOrDefault("audioName","").toString();

        // TODO 购买虚拟形象
        String tempAudioId = null;
        if(StringUtils.isNotBlank(audioPathUpload)){ // 如果上传了音频代表想要更新音频 同时判断是否已购
            tempAudioId = saveAudioImage(audioId,audioPathUpload, creator, audioName);
        }

        if(StringUtils.isNotBlank(audioPathUpload)){
            agentService.sendMessageToPublic(creator, DB_MODEL_NAME, chatId, "user", null, "audio", audioPathUpload, null);
        }
        agentService.sendMessageToPublic(creator, DB_MODEL_NAME, chatId, "user", null, "text", copyWriting, null);

        if(StringUtils.isNotBlank(tempAudioId)){
            audioId = tempAudioId;
        } else if (StringUtils.isBlank(tempAudioId) && StringUtils.isBlank(audioId)){
            return ResponseResultInfo.error(null, "未选择输出音色！");
        }

        System.out.println("临时AudioId: " + tempAudioId);
        System.out.println("真实AudioId: " + audioId);
        // 使用复刻的声音来合成文本为语音
        SpeechSynthesisParam synthesisParam = SpeechSynthesisParam.builder()
                .apiKey(ALI_API_KEY)
                .model(QUERY_MODEL_NAME)
                .voice(audioId)
                .build();
        SpeechSynthesizer synthesizer = new SpeechSynthesizer(synthesisParam, null);
        System.out.println(copyWriting);
        ByteBuffer audio = null;
        try {
            // 阻塞直至音频返回
            audio = synthesizer.call(copyWriting);
        } catch (Exception e) {
            throw new RuntimeException(e);
        } finally {
            // 任务结束关闭websocket连接
            synthesizer.getDuplexApi().close(1000, "bye");
        }
        String s = null;
        if (audio != null) {
            byte[] array = audio.array();
            s = service.uploadMinio(array, UUID.randomUUID().toString() + ".mp3");
        } else {
            System.out.println("未生成音频");
            s = null;
        }
        // 计算消耗
        int length = copyWriting.length();

        // 查看消耗总数  1.6元/秒
        Integer i = contextMapper.userConsume(creator, length * 2 * 4 * 2L);

        agentService.sendMessageToPublic(creator, DB_MODEL_NAME, chatId, null, "stop", "audio", s, length * 2 * 4 * 2L);

        // 保存上下文
        ZhsUserAgentContext build = ZhsUserAgentContext.builder()
                .id(UUID.randomUUID().toString())
//                .agentId("cosyvoice-v3")
                .agentId(DB_MODEL_NAME)
                .userUuid(creator)
                .problem(copyWriting)
                .userUrl(audioPathUpload)
                .sendTime(Instant.now().getEpochSecond())
                .modelName(DB_MODEL_NAME)
                .chatId(chatId)
                .videoRatio("0")
                .agentUrl(s)
                .field1(String.valueOf((length * 2 * 4 * 2L)))
                .build();
        contextMapper.insertZhsUserAgentContext(build);

        Map result = Maps.newHashMap();
        result.put("url", s);
        result.put("total_tokens", length * 2 * 4 * 2L);
        return ResponseResultInfo.success(result);
    }

    @SneakyThrows
    private String saveAudioImage(String audioId, String audioPathUpload, String creator, String audioName){

        String tempAudioId = null;
        if(!checkPay(creator, 0,audioId)){
            throw new RuntimeException("需要再次购买虚拟形象!");
        }
        String imageKey = creator + "_" + 0;
        // 判断是否存在音色
        List<ZhsUserAgentImage> agentAudios = userImageMap.get(imageKey);

        // 复刻声音
        VoiceEnrollmentService service = new VoiceEnrollmentService(ALI_API_KEY);
        // 如果音色id与当前是当前用户已有音色，且存在音频上传路径则修改当前音色
        ZhsUserAgentImage agentAudio = null;
        if(CollectionUtils.isEmpty(agentAudios) || StringUtils.isBlank(audioId)){
            // 创建音色
            Voice myVoice = service.createVoice(QUERY_MODEL_NAME, PREFIX, audioPathUpload);
            System.out.println("RequestId: " + service.getLastRequestId());
            System.out.println("your voice id is " + myVoice.getVoiceId());
            agentAudio = ZhsUserAgentImage.builder()
                    .userUuid(creator)
                    .type(0)
                    .modelName(QUERY_MODEL_NAME)
                    .imageId(myVoice.getVoiceId())
                    .imagePath(audioPathUpload)
                    .platform("ali")
                    .imageName(audioName)
                    .build();
            tempAudioId = myVoice.getVoiceId();
        }else {
//            Map<String, ZhsUserAgentImage> audioIdToImage = agentAudios.stream().collect(Collectors.groupingBy(ZhsUserAgentImage::getImageId, Collectors.collectingAndThen(Collectors.toList(), item -> item.get(0))));
            Map<String, ZhsUserAgentImage> audioIdToImage = Maps.newHashMap();
            Long maxUseTime = null;

            for (ZhsUserAgentImage item : agentAudios) {
                audioIdToImage.put(item.getImageId(), item);
                long epochSecond = item.getCreatedAt().toInstant().getEpochSecond();
                if (maxUseTime == null || maxUseTime < epochSecond) {
                    maxUseTime = epochSecond;
                }
            }

            // 修改用户指定音色
            if(StringUtils.isNotBlank(audioId) && audioIdToImage.containsKey(audioId)){
                service.updateVoice(audioId, audioPathUpload);
                // 获取购买记录
                List<Order> orders = userImageOrderMap.get(imageKey);
//                    List<Long> paidAtList = orders.stream().mapToLong(Order::getPaidAt).boxed().collect(Collectors.toList());
                Long finalMaxUseTime = maxUseTime;
                OptionalLong min = orders.stream().mapToLong(Order::getPaidAt).filter(time -> time > finalMaxUseTime).min();
                if(min.isPresent()){
                    long asLong = min.getAsLong();

                    agentAudio = audioIdToImage.get(audioId);
                    agentAudio.setImagePath(audioPathUpload);
                    agentAudio.setUpdatedAt(Date.from(Instant.ofEpochSecond(asLong)));
                }
            }
        }

        do {
            // 判断当前复刻声音完成度
            Voice voice = service.queryVoice(tempAudioId);
            System.out.println("当前复刻状态：" + voice.getStatus());
            if (voice.getStatus().equals("OK")){
                break;
            }
            Thread.sleep(2000);
        }while (true);

        if(Objects.nonNull(agentAudio)){
            // 保存用户信息
            Integer i = imageMapper.addOrUpdate(agentAudio);
            tempAudioId = agentAudio.getImageId();

            userImageMap.remove(imageKey);
            userImageOrderMap.remove(imageKey);
        }
        return tempAudioId;
    }

    @Override
    public ResponseResultInfo getAudioSys() {
        return ResponseResultInfo.success(audioService.getAudioSys());
    }


    /**
     * 判断是否需要重新购买
     * @param uuid
     * @param imageType 形象类型 0音频 | 1图片 | 2视频
     * @return
     */
    @Override
    public Boolean checkPay(String uuid, Integer imageType, String audioId) {
        // TODO 模拟已购未使用
        if(true) return true;
        // 存储允许修改的用户数字形象
        String imageMapKey = uuid + "_" + imageType;
        List<ZhsUserAgentImage> images;
        if(userImageMap.containsKey(imageMapKey)){
            // 获取最终修改虚拟形象
            images =  imageMapper.getByUuidAndType(uuid, imageType);
            userImageMap.put(imageMapKey, images);
        } else {
            images = userImageMap.get(imageMapKey);
        }
        // 判断是否是修改
        if(!CollectionUtils.isEmpty(images) && StringUtils.isNotBlank(audioId)){
            List<String> audioIds = images.stream().map(ZhsUserAgentImage::getImageId).collect(Collectors.toList());
            if(audioIds.contains(audioId)){
                // 只做修改虚拟形象
                return true;
            }
        }

        // 获取购买记录
        OrderPageDTO dto = new OrderPageDTO();
        dto.setOpenId(uuid);
        // 虚拟形象类型为6
        dto.setOrderType(6);
        List<Order> orders = orderMapper.getOrder(dto);
        // 未购
        if (CollectionUtils.isEmpty(orders)){
            return false;
        }
        // 已购
        if(CollectionUtils.isEmpty(images)){
            return true;
        }

        // 存在已购，但是已用的部分虚拟形象 需要判断
        Order order = orders.stream().filter(item -> item.getStatus() == 6 && item.getPaymentStatus() == 3).max(Comparator.comparingLong(Order::getPaidAt)).get();
        Long paidAt = order.getPaidAt();
        // 获取时间
        ZhsUserAgentImage image = images.stream().max(Comparator.comparingLong(item -> item.getCreatedAt().toInstant().getEpochSecond())).get();
        Long imageUseTime = image.getCreatedAt().toInstant().getEpochSecond();
        if(Objects.nonNull(image.getUpdatedAt())){
            imageUseTime = image.getUpdatedAt().toInstant().getEpochSecond();
        }

        // 判断时间是否在最新购买之前 在 允许生成数字形象 不在 不允许
        return paidAt > imageUseTime;
//        if(paidAt <= imageUseTime){
//            userAgentImageMap.remove(imageMapKey);
//            return false;
//        }
//        return true;
    }

    @Override
    public Map<String, List<ZhsUserAgentImage>> getUserImageMap() {
        return userImageMap;
    }

    @Override
    public Map<String, List<Order>> getUserImageOrderMap() {
        return userImageOrderMap;
    }

    @Override
    public ResponseResultInfo videoToDigital(String videoUrl, String userUuid, Integer progress, String imageName) {
        if(progress != 3 && progress != 4 && !checkPay(userUuid, progress, null)){
            return ResponseResultInfo.error(null, "当前没有权限生成数字人");
        }

        String toAudio = null;
        String toPicture = null;
        // 进展 0提交音频 | 1提交图像 | 2提交视频 | 3提交全部
        switch (progress){
            case 2: {
                // 2提交视频
                ZhsUserAgentImage videoImage = ZhsUserAgentImage.builder()
                        .userUuid(userUuid)
                        .imagePath(videoUrl)
                        .type(progress)
                        .imageName(imageName)
                        .platform("Ali")
                        .build();
                imageMapper.addOrUpdate(videoImage);
                break;
            }
            case 0: {
                // 0保存音频
                // 解析音频
                toAudio = mcpResourceService.videoToAudio(videoUrl);
                saveAudioImage(null, toAudio, userUuid, imageName);
                break;
            }
            case 1: {
                // 1提交图像
                toPicture = minioUploader.extractAndUploadFirstFrame(videoUrl, "jpg", 5);
                ZhsUserAgentImage pictureImage = ZhsUserAgentImage.builder()
                        .userUuid(userUuid)
                        .imagePath(toPicture)
                        .type(progress)
                        .imageName(imageName)
                        .platform("Ali")
                        .build();
                imageMapper.addOrUpdate(pictureImage);
                break;
            }
            case 3:
                // 3提交所有
            {
                toAudio = mcpResourceService.videoToAudio(videoUrl);
                saveAudioImage(null, toAudio, userUuid, imageName);

                // 1提交图像
                toPicture = minioUploader.extractAndUploadFirstFrame(videoUrl, "jpg", 5);
                ZhsUserAgentImage pictureImage = ZhsUserAgentImage.builder()
                        .userUuid(userUuid)
                        .imagePath(toPicture)
                        .type(1)
                        .imageName(imageName)
                        .platform("Ali")
                        .build();
                imageMapper.addOrUpdate(pictureImage);

                // 2提交视频
                ZhsUserAgentImage videoImage = ZhsUserAgentImage.builder()
                        .userUuid(userUuid)
                        .imagePath(videoUrl)
                        .type(2)
                        .imageName(imageName)
                        .platform("Ali")
                        .build();
                imageMapper.addOrUpdate(videoImage);
                break;
            }
            case 4:
                // 4提交图片路径
            {
                ZhsUserAgentImage pictureImage = ZhsUserAgentImage.builder()
                        .userUuid(userUuid)
                        .imagePath(videoUrl)
                        .type(1)
                        .imageName(imageName)
                        .platform("Ali")
                        .build();
                imageMapper.addOrUpdate(pictureImage);

                break;
            }
            default:
                break;
        }
        Map<String, String> result = Maps.newHashMap();
        result.put("audioUtl",toAudio);
        result.put("imgUtl",toPicture);
        return ResponseResultInfo.success(result);
    }

    @Override
    public ResponseResultInfo getDigital(String userUuid, Integer type) {
        List<ZhsUserAgentImage> list = imageMapper.getList(ZhsUserAgentImage.builder().userUuid(userUuid).type(type).build());
        if(type == 3){
            Map<String, List<ZhsUserAgentImage>> collect = list.stream().collect(Collectors.groupingBy(ZhsUserAgentImage::getImageName));
            return ResponseResultInfo.success(collect);
        }
        return ResponseResultInfo.success(list);
    }

}
