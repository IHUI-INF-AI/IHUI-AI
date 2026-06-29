package com.ai.manager.mcp.service.impl;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.ai.manager.mcp.domain.AiGc;
import com.ai.manager.mcp.domain.AiGcUserLog;
import com.ai.manager.mcp.service.AgentService;
import com.ai.manager.small.domain.*;
import com.ai.manager.small.domain.dto.PageBean;
import com.ai.manager.small.mapper.*;
import com.alibaba.fastjson.JSON;
import com.github.pagehelper.PageHelper;
import com.google.common.collect.Maps;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.collections.MapUtils;
import org.apache.commons.lang3.StringUtils;
import org.assertj.core.util.Lists;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class AgentServiceImpl implements AgentService {

    @Value("${ai.agent.use_history}")
    private Integer USE_HISTORY;
    @Value("${app.py.socket.url}")
    private String PUBLIC_SOCKET_URL;

    // 1. 定义正则：匹配图片后缀（不区分大小写）
    // 覆盖：jpg/jpeg/png/gif/bmp/tiff/tif/webp/svg/ico/psd
    private static final Pattern IMAGE_PATTERN = Pattern.compile("\\.(jpg|jpeg|png|gif|bmp|tiff|tif|webp|svg|ico|psd)$", Pattern.CASE_INSENSITIVE);
    // 2. 定义正则：匹配视频后缀（不区分大小写）
    // 覆盖：mp4/avi/mkv/mov/wmv/flv/webm/m4v/mpeg/mpg/ts/3gp
    private static final Pattern VIDEO_PATTERN = Pattern.compile("\\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v|mpeg|mpg|ts|3gp)$", Pattern.CASE_INSENSITIVE);
    // 3. 定义正则：匹配音频后缀（不区分大小写）
    // 覆盖：mp3/wav/flac/aac/wma/ogg/m4a/amr/ape/aiff
    private static final Pattern AUDIO_PATTERN = Pattern.compile("\\.(mp3|wav|flac|aac|wma|ogg|m4a|amr|ape|aiff)$", Pattern.CASE_INSENSITIVE);

    @Autowired
    private AgentRuleMapper ruleMapper;

    @Autowired
    private AgentCategoryMapper categoryMapper;

    @Autowired
    private AgentsMapper agentsMapper;
    @Autowired
    private ZhsUserAgentContextMapper contextMapper;
    @Autowired
    private AiModelInfoMapper modelInfoMapper;

    @Override
    public Map<String,List<Agents>> searchRule(AgentRule rule) {
        // 查询规则信息
        Map<String,List<Agents>> result = Maps.newHashMap();
        List<AgentRule> list = ruleMapper.getList(null);

        Map<String, AgentCategory> cateGoryList = getCateGoryList();

        list.forEach(item -> {
            item.setPageNum(rule.getPageNum());
            item.setPageSize(rule.getPageSize());
            item.setAgentCategory(rule.getAgentCategory());
            item.setAgentMainCategory(rule.getAgentMainCategory());
            item.setCreator(rule.getCreator());
            List<Agents> agents = searchRuleById(item, cateGoryList);
            result.put(item.getTitle(),agents);
        });

        return result;
    }

    @Override
    public List<Agents> searchRuleById(AgentRule rule,Map<String, AgentCategory> categories) {
        // 根据规则查询数据
        List<AgentRuleParam> ruleParams = rule.getRuleParams();

        List<AgentRuleParam> searchParam = null;
        List<AgentRuleParam> orderParam = null;
        if(CollectionUtils.isNotEmpty(ruleParams)){
            searchParam = ruleParams.stream().filter(item -> item.getType() == 0).collect(Collectors.toList());
            orderParam = ruleParams.stream().filter(item -> item.getType() == 1).collect(Collectors.toList());
        }

        PageHelper.startPage(rule.getPageNum(), rule.getPageSize(), rule.getOrderByColumn()).setReasonable(true);
        List<Agents> agentListByRuleId = ruleMapper.getAgentListByRuleId(searchParam, orderParam, rule.getAgentCategory(), rule.getAgentMainCategory(), rule.getCreator());
        PageHelper.clearPage();
        // 查询标签
//        agentListByRuleId
        // 获取所有标签
        if(MapUtils.isEmpty(categories)){
            categories = getCateGoryList();
        }

        for (Agents item : agentListByRuleId) {
            if(rule.getId() == 13){
                // 热门所有的全家小火苗
                item.setIsHot(1);
            }

            ZhsAgentCategory categoryList = item.getCategoryList();
            if (Objects.nonNull(item.getAgentCategory())) {
                String agentCategory = categoryList.getAgentCategory();
                if(StringUtils.isNotBlank(agentCategory)){
                    List<Map<String, String>> agentCategoryList = Lists.newArrayList();
                    String[] split1 = agentCategory.split(",");

                    for (String s : split1) {
                        Map<String, String> agentCategoryParam = Maps.newHashMap();
                        agentCategoryParam.put("id", s);
                        agentCategoryParam.put("name", categories.get(s).getName());
                        agentCategoryList.add(agentCategoryParam);
                    }
                    item.setAgentCategory(agentCategoryList);
                }
            }


            if (Objects.isNull(item.getAgentMainCategory())) {
                continue;
            }

            String agentMainCategory = categoryList.getAgentMainCategory();
            if(StringUtils.isNotBlank(agentMainCategory)){
                List<Map<String, String>> agentMainCategoryList = Lists.newArrayList();
                String[] split2 = agentMainCategory.split(",");

                for (int i = 0; i < split2.length; i++) {
                    Map<String, String> agentMainCategoryParam = Maps.newHashMap();
                    agentMainCategoryParam.put("id", split2[i]);
                    agentMainCategoryParam.put("name", categories.get(split2[i]).getName());
                    agentMainCategoryList.add(agentMainCategoryParam);
                }
                item.setAgentMainCategory(agentMainCategoryList);
            }

        }

        return agentListByRuleId;
    }

    @Override
    public AgentRule getAgentRule(Long id) {
        // 查询单个规则
        AgentRule byId = ruleMapper.getById(id);
        return byId;
    }

    private Map<String, AgentCategory> getCateGoryList(){
        List<AgentCategory> agentCategories = categoryMapper.selectAgentCategoryList(null);
        Map<String, AgentCategory> collect = agentCategories.stream().collect(
                Collectors.groupingBy(
                        AgentCategory::getId, Collectors.collectingAndThen(Collectors.toList(), item -> item.get(0))
                ));

        return collect;
    }

    @Override
    public Map<String,List<Agents>> searchRuleByLink(AgentRule rule) {
        // 查询规则信息
        Map<String,List<Agents>> result = Maps.newHashMap();
        List<AgentRule> list = ruleMapper.getListByLink(null);

        Map<String, AgentCategory> cateGoryList = getCateGoryList();

        list.forEach(item -> {
            item.setPageNum(rule.getPageNum());
            item.setPageSize(rule.getPageSize());
            item.setAgentCategory(rule.getAgentCategory());
            item.setAgentMainCategory(rule.getAgentMainCategory());
            item.setCreator(rule.getCreator());
            List<Agents> agents;
            if(item.getId() == 13 || item.getId() == 14){
                agents = searchRuleById(item, cateGoryList);
            } else {
                agents = searchRuleByIdByLink(item, cateGoryList);
            }

            result.put(item.getTitle(),agents);
        });


        return result;
    }

    @Override
    public List<Agents> searchRuleByIdByLink(AgentRule rule, Map<String, AgentCategory> categories) {
        PageHelper.startPage(rule.getPageNum(), rule.getPageSize(), rule.getOrderByColumn()).setReasonable(true);
        List<Agents> agentList = ruleMapper.getAgentsByLink(rule.getId(), rule.getCreator(), rule.getAgentCategory(), rule.getAgentMainCategory());
        PageHelper.clearPage();

        // 获取所有标签
        if (MapUtils.isEmpty(categories)) {
            categories = getCateGoryList();
        }

        for (Agents item : agentList) {
            ZhsAgentCategory categoryList = item.getCategoryList();
            if(Objects.isNull(categoryList)){
                continue;
            }

            if (Objects.nonNull(categoryList.getAgentCategory())) {
                String agentCategory = categoryList.getAgentCategory();
                if (StringUtils.isNotBlank(agentCategory)) {
                    List<Map<String, String>> agentCategoryList = Lists.newArrayList();
                    String[] split1 = agentCategory.split(",");

                    for (String s : split1) {
                        Map<String, String> agentCategoryParam = Maps.newHashMap();
                        agentCategoryParam.put("id", s);
                        agentCategoryParam.put("name", categories.get(s).getName());
                        agentCategoryList.add(agentCategoryParam);
                    }
                    item.setAgentCategory(agentCategoryList);
                }
            }

            if (Objects.isNull(categoryList.getAgentMainCategory())) {
                continue;
            }

            String agentMainCategory = categoryList.getAgentMainCategory();
            if (StringUtils.isNotBlank(agentMainCategory)) {
                List<Map<String, String>> agentMainCategoryList = Lists.newArrayList();
                String[] split2 = agentMainCategory.split(",");

                for (int i = 0; i < split2.length; i++) {
                    Map<String, String> agentMainCategoryParam = Maps.newHashMap();
                    agentMainCategoryParam.put("id", split2[i]);
                    agentMainCategoryParam.put("name", categories.get(split2[i]).getName());
                    agentMainCategoryList.add(agentMainCategoryParam);
                }
                item.setAgentMainCategory(agentMainCategoryList);
            }
        }

        return agentList;
    }

    @Override
    public AgentRule getRuleByIdWithLink(Long id) {
        // 查询单个规则
        AgentRule byId = ruleMapper.getRuleByIdWithLink(id);
        return byId;
    }

    @Override
    public List<Agents> useHistory(String userUuid, String platform) {
        System.out.println(USE_HISTORY);
        return ruleMapper.useHistory(userUuid, USE_HISTORY);
    }

    @Override
    public String sendMessageToPublic(String userUuid, String modelId, String chatId, String role, String status, String type, String message, Long second) {
        Map<String, Object> param = Maps.newHashMap();
        param.put("status", StringUtils.defaultString(status,"run"));
        param.put("chat_id", chatId);
        param.put("event_name", StringUtils.defaultString(role,"custom_even"));

        Map<String, String> messageMap = Maps.newHashMap();
        messageMap.put("type", type);
        messageMap.put(type, message);
        if(Objects.nonNull(second))
            param.put("total_tokens", second);
        if (StringUtils.equals(role,"user"))
            messageMap.put("role", role);

        param.put("message", Lists.newArrayList(messageMap));
        HttpResponse execute = HttpRequest.post(String.format(PUBLIC_SOCKET_URL, userUuid, modelId)).body(JSON.toJSONString(param)).execute();
        return execute.body();
    }

    @Override
    public List<AgentRule> getRuleList() {
        List<AgentRule> list = ruleMapper.getList(null);
        return list;
    }

    @Override
    public List<ZhsUserAgentContext> myCreation(String userUuid, Integer type, PageBean bean) {
        // 获取有哪些type的大模型
        // 获取有哪些type的智能体
//        List<String> agentIds = Lists.newArrayList();
//        // 获取数据
//        List<ZhsUserAgentContext> agentConfig = null;
//        if(type == 4){
//            // 音频 e9d5fb14-7a78-11f0-943a-5254009a7d90
//            agentIds.addAll(agentsMapper.getLabel("e9d5fb14-7a78-11f0-943a-5254009a7d90"));
//            agentIds.addAll(agentsMapper.getModelLabel(type));
//            PageHelper.startPage(bean.getPageNum(), bean.getPageSize());
//            agentConfig = contextMapper.getByAgentId(agentIds);
//        } else if (type == 3) {
//            // 视频 9d40b5aa-7a78-11f0-943a-5254009a7d90
//            agentIds.addAll(agentsMapper.getLabel("9d40b5aa-7a78-11f0-943a-5254009a7d90"));
//        } else if (type == 2) {
//            // 图片 be30669e-7a78-11f0-943a-5254009a7d90
//            agentIds.addAll(agentsMapper.getLabel("be30669e-7a78-11f0-943a-5254009a7d90"));
//        } else {
//            // 文本
//            type = null;
//        }
//        if(type != null)
//            agentIds.addAll(agentsMapper.getModelLabel(type));

        PageHelper.startPage(bean.getPageNum(), bean.getPageSize());
        List<ZhsUserAgentContext> agentConfig = contextMapper.getByType(type, userUuid);
        PageHelper.clearPage();
        System.out.println("\n" + JSON.toJSONString(agentConfig) + "\n");
        return agentConfig;
    }

    @Override
    public void shareCreation(String userUuid, String contextId, String title, String coverUrl, String subtitle) {
        // 分享创作
        ZhsUserAgentContext context = contextMapper.selectZhsUserAgentContextById(contextId);
        if(!context.getUserUuid().equals(userUuid)){
            System.out.println("当前会话归属非本人！");
            return;
        }

        // 获取文件
        List<Integer> urlTypes = statFileTypes(context.getAgentUrl());
        if(!urlTypes.isEmpty()){
            for (Integer type : urlTypes) {
                // 如果带文件那么只存提示词和文件
                AiGc build = AiGc.builder()
                        .title(title)
                        .creator(userUuid)
                        .context(context.getProblem())
                        .field1(StringUtils.isBlank(context.getAgentUrl())?context.getAnswer():null)
                        .fileUrl(context.getAgentUrl())
                        .fileType(type)
                        .coverUrl(coverUrl)
                        .subtitle(subtitle)
                        .build();
                contextMapper.shareCreation(build);
            }
        } else {
            // 如果带文件那么只存提示词和文件
            AiGc build = AiGc.builder()
                    .title(title)
                    .creator(userUuid)
                    .context(context.getProblem())
                    .field1(StringUtils.isBlank(context.getAgentUrl())?context.getAnswer():null)
                    .fileUrl(context.getAgentUrl())
                    .fileType(4)
                    .coverUrl(coverUrl)
                    .subtitle(subtitle)
                    .build();
            contextMapper.shareCreation(build);
        }
    }

    @Override
    public void shareCustomCreation(String userUuid, String title, String coverUrl, String subtitle, String problem, String answer, String fileUrl) {
        if (StringUtils.isNotBlank(fileUrl)) {
            List<Integer> urlTypes = statFileTypes(fileUrl);
            for (Integer type : urlTypes) {
                // 如果带文件那么只存提示词和文件
                AiGc build = AiGc.builder()
                        .title(title)
                        .creator(userUuid)
                        .context(problem)
                        .field1(answer)
                        .fileUrl(fileUrl)
                        .fileType(type)
                        .coverUrl(coverUrl)
                        .subtitle(subtitle)
                        .build();
                contextMapper.shareCreation(build);
            }
        } else {
            // 如果带文件那么只存提示词和文件
            AiGc build = AiGc.builder()
                    .title(title)
                    .creator(userUuid)
                    .context(problem)
                    .field1(answer)
                    .fileUrl(fileUrl)
                    .fileType(4)
                    .coverUrl(coverUrl)
                    .subtitle(subtitle)
                    .build();
            contextMapper.shareCreation(build);
        }
    }

    /**
     * 统计逗号分隔路径字符串中的文件类型，返回编码列表
     * @param commaSeparatedPaths 逗号分隔的网络文件路径（如："a.jpg,b.mp4,c.mp3"）
     * @return 类型编码列表：0=图片 1=视频 3=音频，按0→1→3顺序排列，无则返回空列表
     */
    public static List<Integer> statFileTypes(String commaSeparatedPaths) {
        // 1. 初始化Set记录出现过的类型编码（自动去重）
        List<Integer> typeSet = Lists.newArrayList();

        // 2. 处理空值/空字符串
        if (commaSeparatedPaths == null || commaSeparatedPaths.trim().isEmpty()) {
            return Lists.newArrayList();
        }

        // 3. 拆分逗号分隔的路径（忽略逗号前后空格，处理连续逗号）
        String[] paths = commaSeparatedPaths.split("\\s*,\\s*");
        for (String path : paths) {
            // 跳过空路径（如连续逗号产生的空字符串）
            if (path == null || path.trim().isEmpty()) {
                continue;
            }
            String cleanPath = path.trim();

            // 处理URL参数（如 "a.mp4?param=1" 截取到?前）
            if (cleanPath.contains("?")) {
                cleanPath = cleanPath.substring(0, cleanPath.indexOf("?"));
            }

            // 4. 正则匹配判断类型，记录编码
            if (IMAGE_PATTERN.matcher(cleanPath).find()) {
                typeSet.add(0); // 图片=0
            } else if (VIDEO_PATTERN.matcher(cleanPath).find()) {
                typeSet.add(1); // 视频=1
            } else if (AUDIO_PATTERN.matcher(cleanPath).find()) {
                typeSet.add(3); // 音频/音乐=3
            }
            // 非图片/视频/音频的类型不记录
        }

        // 5. 按「0→1→3」的固定顺序整理结果列表
        List<Integer> result = Lists.newArrayList();
        if (typeSet.contains(0)) {
            result.add(0);
        }
        if (typeSet.contains(1)) {
            result.add(1);
        }
        if (typeSet.contains(3)) {
            result.add(3);
        }

        return result;
    }

    /**
     * 核心方法：找出每个id缺失的那一个前缀（前提：每个id只缺problem/answer中的一个）
     * @param originalList 原始列表（元素格式：problem_{id} / answer_{id}）
     * @return key=id，value=该id缺失的那一个前缀（如 "answer"）
     */
    public static Map<String, String> findSingleMissingPrefix(List<String> originalList) {
        // 步骤1：按id分组，收集每个id已有的前缀（Set去重）
        Map<String, Set<String>> idToPrefixMap = originalList.stream()
                .filter(Objects::nonNull)
                .filter(str -> str.matches("^(problem|answer)_.+")) // 校验格式
                .map(str -> {
                    String[] parts = str.split("_", 2);
                    return new AbstractMap.SimpleEntry<>(parts[1], parts[0]); // (id, 前缀)
                })
                .collect(Collectors.groupingBy(
                        Map.Entry::getKey,
                        Collectors.mapping(Map.Entry::getValue, Collectors.toSet())
                ));

        // 步骤2：遍历分组，找出每个id缺失的那一个前缀（利用“只缺一个”的前提简化逻辑）
        return idToPrefixMap.entrySet().stream()
                // 过滤掉前缀完整的id（只保留缺一个的）
                .filter(entry -> entry.getValue().size() == 1)
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> {
                            // 已有前缀是problem → 缺失answer；已有answer → 缺失problem
                            Set<String> existing = entry.getValue();
                            return existing.contains("problem") ? "answer" : "problem";
                        }
                ));
    }


    @Override
    public void operateCreation(String userUuid, String gcId, String type) {
        // 判断是否已经点赞 如果已经点赞那么移除这个点赞
        AiGcUserLog log = agentsMapper.getOperate(userUuid, gcId, type);

        if(Objects.nonNull(log)){
            agentsMapper.delLog(log.getId());
        } else {
            agentsMapper.addGcUserLog(userUuid, gcId, type);
        }
    }

    @Override
    public BufferedImage creation2Image(String userUuid, String chatId, String agentId, List<String> ids) {
        // 获取记录
        List<ZhsUserAgentContext> zhsUserAgentContexts = creation2third(userUuid, chatId, agentId, ids);

//        BufferedImage image = c

        // 创建图片
        return null;
    }

    @Override
    public List<ZhsUserAgentContext> creation2third(String userUuid, String chatId, String agentId, List<String> ids) {
        // 获取记录
        List<String> queryIds = ids.stream()
                // 步骤1：移除指定前缀
                .map(str -> {
                    if (str == null) {
                        return null;
                    }
                    // 依次移除 "problem_" 或 "answer_" 前缀
                    String processed = str.replaceFirst("^problem_", "");
                    processed = processed.replaceFirst("^answer_", "");
                    return processed;
                })
                // 过滤空值（可选，根据业务需求）
                .filter(str -> str != null && !str.isEmpty())
                // 步骤2：去重
                .distinct()
                // 步骤3：收集为List
                .collect(Collectors.toList());


        // 获取模型信息
        AiModelInfo modelName = getModelName(agentId);

        List<ZhsUserAgentContext> contexts = contextMapper.getContextToImg(userUuid, chatId, Objects.nonNull(modelName.getName())?modelName.getName():agentId, queryIds);
        // 删除不需要的数据
        Map<String, String> singleMissingPrefix = findSingleMissingPrefix(ids);

        for (ZhsUserAgentContext context : contexts) {
            context.setModelName(modelName.getName());
            context.setAvatar(modelName.getImg());
            if(singleMissingPrefix.containsKey(context.getId())){
                if(singleMissingPrefix.get(context.getId()).equals("problem")){
                    context.setProblem(null);
                    context.setUserUrl(null);
                }
                if(singleMissingPrefix.get(context.getId()).equals("answer")){
                    context.setAnswer(null);
                    context.setAgentUrl(null);
                }
            }
        }

        return contexts;
    }

    @Override
    public AiModelInfo getModelName(String agentId) {
        // 获取模型id
        AiModelInfo aiModelInfo = modelInfoMapper.queryById(agentId);
        if (Objects.isNull(aiModelInfo)){
            Agents byAgentId = agentsMapper.getByAgentId(agentId);
            aiModelInfo = new AiModelInfo();
            aiModelInfo.setSource(byAgentId.getAgentName());
            aiModelInfo.setImg(byAgentId.getAgentAvatar());
        }
        return aiModelInfo;
    }
}
