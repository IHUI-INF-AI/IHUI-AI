package com.ai.manager.small.service.agent;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.small.domain.AgentUpload;
import com.ai.manager.small.service.impl.ISysFileService;
import com.google.gson.*;
import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.bytedeco.javacv.FrameGrabber;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URL;
import java.util.*;

/**
 * Transforms agent responses into the structured output format and handles media uploads/token accounting.
 */
@Component
public class AgentResponseAssembler {

    private final ISysFileService fileUploadService;

    @Autowired
    public AgentResponseAssembler(ISysFileService fileUploadService) {
        this.fileUploadService = fileUploadService;
    }

    public JsonObject assemble(AgentUpload agent, JsonObject answerObject, Integer countingUnit) {
        if (agent == null) {
            throw new IllegalArgumentException("Agent must not be null");
        }
        if (answerObject == null) {
            return new JsonObject();
        }

        int videoToken = answerObject.has("token") && !answerObject.get("token").isJsonNull()
                ? answerObject.get("token").getAsInt()
                : 0;
        String ratio = answerObject.has("ratio") && !answerObject.get("ratio").isJsonNull()
                ? answerObject.get("ratio").getAsString()
                : null;

        String variablesOutStr = Optional.ofNullable(agent.getAgentVariablesOut()).orElse("[]");
        JsonArray variablesOutArray = AgentJsonHelper.parseArray(variablesOutStr, "agentVariablesOut");

        Map<String, JsonObject> outputTypeMap = new LinkedHashMap<>();
        for (JsonElement outElement : variablesOutArray) {
            JsonObject variableOutObject = outElement.getAsJsonObject();
            String targetParameterName = Optional.ofNullable(variableOutObject.get("parameterName"))
                    .map(JsonElement::getAsString)
                    .orElse(null);
            if (targetParameterName == null) {
                continue;
            }
            String targetType = Optional.ofNullable(variableOutObject.get("type"))
                    .map(JsonElement::getAsString)
                    .map(s -> s.toLowerCase(Locale.ROOT))
                    .orElse("");

            JsonElement answerValue = answerObject.get(targetParameterName);
            if (answerValue == null || answerValue.isJsonNull()
                    || (answerValue.isJsonPrimitive() && answerValue.getAsJsonPrimitive().isString()
                    && answerValue.getAsString().trim().isEmpty())) {
                answerValue = variableOutObject.get("default");
            }
            answerValue = AgentJsonHelper.normalize(answerValue);
            if (answerValue == null || answerValue.isJsonNull()) {
                continue;
            }

            JsonObject typeBucket = outputTypeMap.computeIfAbsent(targetType, k -> new JsonObject());
            typeBucket.add(targetParameterName, answerValue.deepCopy());
        }

        JsonObject finalOutput = new JsonObject();
        JsonObject textParams = new JsonObject();
        JsonObject imageParams = new JsonObject();
        JsonObject videoParams = new JsonObject();
        JsonObject audioParams = new JsonObject();

        int totalTokensUsed = 0;
        List<String> agentFileUrlParts = new ArrayList<>();
        boolean videoTokenCounted = false;

        for (Map.Entry<String, JsonObject> typeEntry : outputTypeMap.entrySet()) {
            String typeKey = typeEntry.getKey();
            JsonObject paramsByName = typeEntry.getValue();

            for (Map.Entry<String, JsonElement> paramEntry : paramsByName.entrySet()) {
                String paramName = paramEntry.getKey();
                JsonElement value = paramEntry.getValue();

                switch (typeKey) {
                    case "text":
                        if (value != null && value.isJsonPrimitive()) {
                            String textValue = value.getAsString();
                            textParams.addProperty(paramName, textValue);
                            if (countingUnit != null) {
                                totalTokensUsed += textValue.length() * countingUnit;
                            }
                        } else if (value != null) {
                            textParams.add(paramName, value.deepCopy());
                            if (countingUnit != null) {
                                totalTokensUsed += value.toString().length() * countingUnit;
                            }
                        }
                        break;
                    case "image":
                        totalTokensUsed += handleImageValue(paramName, value, imageParams, agentFileUrlParts, countingUnit);
                        break;
                    case "video":
                        totalTokensUsed += handleVideoValue(paramName, value, videoParams, agentFileUrlParts, countingUnit);
                        if (!videoTokenCounted && countingUnit != null && videoToken > 0) {
                            totalTokensUsed += videoToken;
                            videoTokenCounted = true;
                        }
                        break;
                    case "audio":
                        totalTokensUsed += handleAudioValue(paramName, value, audioParams, agentFileUrlParts, countingUnit);
                        break;
                    default:
                        if (value != null) {
                            JsonElement normalized = AgentJsonHelper.normalize(value);
                            if (normalized != null && !normalized.isJsonNull()) {
                                if (normalized.isJsonPrimitive()) {
                                    String textValue = normalized.getAsString();
                                    textParams.addProperty(paramName, textValue);
                                    if (countingUnit != null) {
                                        totalTokensUsed += textValue.length() * countingUnit;
                                    }
                                } else {
                                    textParams.add(paramName, normalized.deepCopy());
                                    if (countingUnit != null) {
                                        totalTokensUsed += normalized.toString().length() * countingUnit;
                                    }
                                }
                            }
                        }
                        break;
                }
            }
        }

        if (textParams.entrySet().isEmpty()) {
            for (Map.Entry<String, JsonElement> entry : answerObject.entrySet()) {
                String key = entry.getKey();
                if ("token".equalsIgnoreCase(key)
                        || "ratio".equalsIgnoreCase(key)
                        || "task_status".equalsIgnoreCase(key)
                        || "task_id".equalsIgnoreCase(key)) {
                    continue;
                }
                JsonElement rawValue = entry.getValue();
                JsonElement normalized = AgentJsonHelper.normalize(rawValue);
                if (normalized == null || normalized.isJsonNull()) {
                    continue;
                }
                if (normalized.isJsonPrimitive()) {
                    String textValue = normalized.getAsString();
                    textParams.addProperty(key, textValue);
                    if (countingUnit != null) {
                        totalTokensUsed += textValue.length() * countingUnit;
                    }
                } else {
                    textParams.add(key, normalized.deepCopy());
                    if (countingUnit != null) {
                        totalTokensUsed += normalized.toString().length() * countingUnit;
                    }
                }
            }
            if (textParams.entrySet().isEmpty() && answerObject.entrySet().size() > 0) {
                textParams.addProperty("raw", answerObject.toString());
            }
        }

        String agentFileUrl = agentFileUrlParts.isEmpty()
                ? ""
                : String.join(";", agentFileUrlParts);
        finalOutput.addProperty("agentFileUrl", agentFileUrl);

        if (ratio != null) {
            finalOutput.addProperty("ratio", ratio);
        }

        finalOutput.add("text", textParams);
        if (!imageParams.entrySet().isEmpty()) {
            finalOutput.add("image", imageParams);
        }
        if (!videoParams.entrySet().isEmpty()) {
            finalOutput.add("video", videoParams);
        }
        if (!audioParams.entrySet().isEmpty()) {
            finalOutput.add("audio", audioParams);
        }

        finalOutput.addProperty("totalTokensUsed", totalTokensUsed);
        return finalOutput;
    }

    public String extractText(JsonObject output) {
        if (output == null) {
            return "";
        }
        try {
            if (output.has("text") && output.get("text").isJsonObject()) {
                JsonObject textObj = output.getAsJsonObject("text");
                if (textObj.has("answer") && !textObj.get("answer").isJsonNull()) {
                    return textObj.get("answer").getAsString();
                }
                StringBuilder sb = new StringBuilder();
                for (Map.Entry<String, JsonElement> e : textObj.entrySet()) {
                    JsonElement v = e.getValue();
                    if (v != null && v.isJsonPrimitive() && v.getAsJsonPrimitive().isString()) {
                        if (sb.length() > 0) {
                            sb.append('\n');
                        }
                        sb.append(v.getAsString());
                    }
                }
                if (sb.length() > 0) {
                    return sb.toString();
                }
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private int handleImageValue(String paramName, JsonElement value, JsonObject imageParams,
                                 List<String> agentFileUrlParts, Integer countingUnit) {
        if (value == null || value.isJsonNull()) {
            return 0;
        }
        if (value.isJsonArray()) {
            int tokens = 0;
            for (JsonElement element : value.getAsJsonArray()) {
                tokens += handleImageValue(paramName, element, imageParams, agentFileUrlParts, countingUnit);
            }
            return tokens;
        }
        int tokensUsed = 0;
        String imageUrl = null;
        try {
            if (value.isJsonObject()) {
                JsonObject fileObject = value.getAsJsonObject();
                String fileName = fileObject.has("fileName") && !fileObject.get("fileName").isJsonNull()
                        ? fileObject.get("fileName").getAsString()
                        : paramName;
                String base64 = fileObject.has("fileContentBase64") && !fileObject.get("fileContentBase64").isJsonNull()
                        ? fileObject.get("fileContentBase64").getAsString()
                        : null;
                if (base64 != null) {
                    byte[] fileBytes = Base64.getDecoder().decode(base64);
                    imageUrl = fileUploadService.uploadMinio(fileBytes, fileName);
                    if (countingUnit != null) {
                        tokensUsed += (fileBytes.length / 1024) * countingUnit;
                    }
                }
            } else if (value.isJsonPrimitive()) {
                String imagePath = value.getAsString();
                if (imagePath != null && !imagePath.trim().isEmpty()) {
                    ResponseResultInfo<String> uploadResult = fileUploadService.fileUploadNetworkPath(imagePath);
                    imageUrl = uploadResult.getData();
                    if (countingUnit != null) {
                        tokensUsed += estimateRemoteSizeInKB(imagePath) * countingUnit;
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (imageUrl != null) {
            AgentJsonHelper.appendStringValue(imageParams, paramName, imageUrl);
            agentFileUrlParts.add(imageUrl);
        }
        return tokensUsed;
    }

    private int handleVideoValue(String paramName, JsonElement value, JsonObject videoParams,
                                 List<String> agentFileUrlParts, Integer countingUnit) {
        if (value == null || value.isJsonNull()) {
            return 0;
        }
        if (value.isJsonArray()) {
            int tokens = 0;
            for (JsonElement element : value.getAsJsonArray()) {
                tokens += handleVideoValue(paramName, element, videoParams, agentFileUrlParts, countingUnit);
            }
            return tokens;
        }
        int tokensUsed = 0;
        String videoUrl = null;
        try {
            if (value.isJsonObject()) {
                JsonObject fileObject = value.getAsJsonObject();
                String fileName = fileObject.has("fileName") && !fileObject.get("fileName").isJsonNull()
                        ? fileObject.get("fileName").getAsString()
                        : paramName;
                String base64 = fileObject.has("fileContentBase64") && !fileObject.get("fileContentBase64").isJsonNull()
                        ? fileObject.get("fileContentBase64").getAsString()
                        : null;
                if (base64 != null) {
                    byte[] fileBytes = Base64.getDecoder().decode(base64);
                    videoUrl = fileUploadService.uploadMinio(fileBytes, fileName);
                    if (countingUnit != null) {
                        tokensUsed += (fileBytes.length / 1024) * countingUnit;
                    }
                }
            } else if (value.isJsonPrimitive()) {
                String videoPath = value.getAsString();
                if (videoPath != null && !videoPath.trim().isEmpty()) {
                    ResponseResultInfo<String> uploadResult = fileUploadService.fileUploadNetworkPath(videoPath);
                    videoUrl = uploadResult.getData();
                    if (countingUnit != null) {
                        tokensUsed += estimateRemoteSizeInKB(videoPath) * countingUnit;
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (videoUrl != null) {
            AgentJsonHelper.appendStringValue(videoParams, paramName, videoUrl);
            agentFileUrlParts.add(videoUrl);
        }
        return tokensUsed;
    }

    private int handleAudioValue(String paramName, JsonElement value, JsonObject audioParams,
                                 List<String> agentFileUrlParts, Integer countingUnit) {
        if (value == null || value.isJsonNull()) {
            return 0;
        }
        if (value.isJsonArray()) {
            int tokens = 0;
            for (JsonElement element : value.getAsJsonArray()) {
                tokens += handleAudioValue(paramName, element, audioParams, agentFileUrlParts, countingUnit);
            }
            return tokens;
        }

        int tokensUsed = 0;
        String audioUrl = null;
        try {
            if (value.isJsonObject()) {
                JsonObject fileObject = value.getAsJsonObject();
                String fileName = fileObject.has("fileName") && !fileObject.get("fileName").isJsonNull()
                        ? fileObject.get("fileName").getAsString()
                        : paramName;
                String base64 = fileObject.has("fileContentBase64") && !fileObject.get("fileContentBase64").isJsonNull()
                        ? fileObject.get("fileContentBase64").getAsString()
                        : null;
                if (base64 != null) {
                    byte[] fileBytes = Base64.getDecoder().decode(base64);
                    audioUrl = fileUploadService.uploadMinio(fileBytes, fileName);
                    if (countingUnit != null) {
                        ByteArrayInputStream audioStream = new ByteArrayInputStream(fileBytes);
                        FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(audioStream);
                        try {
                            grabber.start();
                            int audioDuration = (int) (grabber.getLengthInTime() / 1_000_000);
                            tokensUsed += audioDuration * countingUnit;
                        } finally {
                            try {
                                grabber.stop();
                            } catch (FrameGrabber.Exception ignored) {
                            }
                            try {
                                grabber.release();
                            } catch (FrameGrabber.Exception ignored) {
                            }
                            try {
                                audioStream.close();
                            } catch (IOException ignored) {
                            }
                        }
                    }
                }
            } else if (value.isJsonPrimitive()) {
                String audioPath = value.getAsString();
                if (audioPath != null && !audioPath.trim().isEmpty()) {
                    ResponseResultInfo<String> uploadAudioResult = fileUploadService.fileUploadNetworkPath(audioPath);
                    audioUrl = uploadAudioResult.getData();
                    if (countingUnit != null) {
                        FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(audioPath);
                        try {
                            grabber.start();
                            int audioDuration = (int) (grabber.getLengthInTime() / 1_000_000);
                            tokensUsed += audioDuration * countingUnit;
                        } finally {
                            try {
                                grabber.stop();
                            } catch (FrameGrabber.Exception ignored) {
                            }
                            try {
                                grabber.release();
                            } catch (FrameGrabber.Exception ignored) {
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (audioUrl != null) {
            AgentJsonHelper.appendStringValue(audioParams, paramName, audioUrl);
            agentFileUrlParts.add(audioUrl);
        }
        return tokensUsed;
    }

    private int estimateRemoteSizeInKB(String fileUrl) {
        if (fileUrl == null || fileUrl.trim().isEmpty()) {
            return 0;
        }
        try {
            URL url = new URL(fileUrl);
            java.net.URLConnection connection = url.openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            int length = connection.getContentLength();
            if (length > 0) {
                return length / 1024;
            }
        } catch (IOException ignored) {
        }
        return 0;
    }
}
