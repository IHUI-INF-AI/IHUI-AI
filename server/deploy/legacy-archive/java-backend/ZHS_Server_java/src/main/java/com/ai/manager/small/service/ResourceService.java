package com.ai.manager.small.service;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.core.constants.WXConfig;
import com.ai.manager.small.domain.*;
import com.ai.manager.small.domain.dto.*;
import com.ai.manager.small.mapper.*;
import com.ai.manager.core.utils.JsonUtils;
import com.ai.manager.core.utils.SSLClient;
import com.google.common.collect.Maps;
import lombok.SneakyThrows;
import org.apache.commons.beanutils.BeanUtils;
import org.apache.commons.lang3.time.DateUtils;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ResourceService {

    private static final Logger logger = LoggerFactory.getLogger(ResourceService.class);

    // 主 Resource 模型的 Mapper
    @Autowired
    private ResourceMapper mainResourceMapper;

    // PHP转换的 Mappers
    @Autowired
    private BannerCarouselMapper bannerCarouselMapper;
    @Autowired
    private PopularCourseMapper popularCourseMapper;
    @Autowired
    private KnowledgePlanetMapper knowledgePlanetMapper;
    @Autowired
    private UserAgentFreeTimesMapper userAgentFreeTimesMapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private ZhsUserMapper zhsUserMapper;
    @Autowired
    private OfficialInformationMapper officialInformationMapper;
    @Autowired
    private ProductMapper productMapper;
    @Autowired
    private ZhsProductIdentityMapper productIdentityMapper;
    @Autowired
    private ExchangeRateMapper exchangeRateMapper;
    @Autowired
    private OperateTokenFlowMapper operateTokenFlowMapper;

    @Autowired
    private ZhsUserAgentContextMapper contextMapper;

    @Value("${ai.default.margin.url}")
    private String marginUrl;

    public ResourceService(com.ai.manager.small.mapper.ResourceMapper mainResourceMapper) {
        this.mainResourceMapper = mainResourceMapper;
    }

    // --- 主资源 (Resource) 的 CRUD ---
    public Resource getResourceById(Long id) {
        return mainResourceMapper.findById(id);
    }

    public List<Resource> getAllResources() {
        return mainResourceMapper.findAll();
    }

    @Transactional
    public Resource createResource(Resource resource) {
        if (resource.getCreatedAt() == null) {
            resource.setCreatedAt(LocalDateTime.now());
        }
        if (resource.getUpdatedAt() == null) {
            resource.setUpdatedAt(LocalDateTime.now());
        }
        mainResourceMapper.insert(resource);
        return resource;
    }

    @Transactional
    public boolean updateResource(Resource resource) {
        resource.setUpdatedAt(LocalDateTime.now());
        return mainResourceMapper.update(resource) > 0;
    }

    @Transactional
    public boolean deleteResource(Long id) {
        return mainResourceMapper.deleteById(id) > 0;
    }

    // --- 从 PHP Resource.php 转换的方法 ---

    public ResponseResultInfo getBanner() {
        try {
            // TODO: 根据 PHP Resource.php 中的 getBanner 方法实现具体的查询逻辑
            // 确保 BannerCarouselMapper.selectAll() 方法存在并返回正确的数据结构
            List<BannerCarousel> banners = bannerCarouselMapper.selectAll(); // 假设方法存在
            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("查询成功")
                    .data(banners)
                    .build();
        } catch (Exception e) {
            logger.error("Error in getBanner: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("服务器错误: " + e.getMessage())
                    .data(Collections.emptyList())
                    .build();
        }
    }

    public ResponseResultInfo getCoursePlanet() {
        try {
            PopularCourseCriteria criteria = new PopularCourseCriteria();
            List<PopularCourse> beginnerCourses = popularCourseMapper.selectByType(1,0,3); // Assuming selectAll is the correct mapping without pagination
            List<PopularCourse> selectedCourses = popularCourseMapper.selectByType(2, 0, 3); // Assuming selectAll is the correct mapping without pagination
            List<PopularCourse> hotCourses = popularCourseMapper.selectByType(null, 1, 4); // Assuming selectAll is the correct mapping without pagination

            Map<String, Object> coursesData = new HashMap<>();
            coursesData.put("beginner_courses", beginnerCourses);
            coursesData.put("selected_courses", selectedCourses);
            coursesData.put("hot_courses", hotCourses);
            Map<String, Object> data = new HashMap<>();

            data.put("data", coursesData);
            // Removed pagination specific data like total_page, current_page, last_page
            // data.put("total", total); // Keep total if needed
            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("查询成功")
                    .data(data)
                    .build();
        } catch (Exception e) {
            logger.error("Error in getCoursePlanet: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("服务器错误: " + e.getMessage())
                    .data(Collections.emptyMap())
                    .build();
        }
    }

    public ResponseResultInfo getKnowledgePlanet(Integer type) {
        try {
            KnowledgePlanetCriteria criteria = new KnowledgePlanetCriteria();
            criteria.setType(type);

            List<KnowledgePlanet> planets;
            if (type != null) {
                planets = knowledgePlanetMapper.selectPlanetsByCriteria(new KnowledgePlanetCriteria() {{ setType(type); }}); // Use criteria
            } else {
                // PHP original getKnowledgePlanetInfo requires type, so type should likely be required here too.
                // If type is null, perhaps return error or all if PHP supported it (it didn't based on provided code).
                 return ResponseResultInfo.builder()
                         .code(ResultConfig.ERROR_PARAM_CODE.toString())
                         .msg("类型参数不能为空")
                         .build();
            }

            // Removed pagination specific data

            Map<String, Object> data = new HashMap<>();
            data.put("data", planets);

            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("查询成功")
                    .data(data)
                    .build();
        } catch (Exception e) {
            logger.error("Error in getKnowledgePlanet: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("服务器错误: " + e.getMessage())
                    .data(Collections.emptyMap())
                    .build();
        }
    }

    public ResponseResultInfo getPlantInformation(Long popularCourseId) {
        try {
            // TODO: 根据 PHP Resource.php 中的 getPlantInformation 方法实现具体的查询逻辑
            // 确保 OfficialInformationMapper.selectByPopularCourseId(popularCourseId) 方法存在并返回正确的数据结构
            List<OfficialInformation> list = officialInformationMapper.selectByPopularCourseId(popularCourseId); // 假设方法存在

            if (list != null && !list.isEmpty()) {
                // TODO: 根据 PHP 逻辑确认是否需要进行数据转换或进一步处理
                List<OfficialInformationDTO> dtoList = list.stream().map(entity -> {
                    OfficialInformationDTO dto = new OfficialInformationDTO();
                    dto.setId(entity.getId());
                    dto.setPopularCourseId(entity.getPopularCourseId());
                    dto.setTitle(entity.getTitle());
                    dto.setContent(entity.getContent());
                    dto.setCreatedAt(entity.getCreatedAt());
                    dto.setUpdatedAt(entity.getUpdatedAt());
                    dto.setImg(entity.getImg());
                    dto.setTag(entity.getTag());
                    dto.setDate(entity.getDate());
                    // TODO: 如果 OfficialInformation 实体有 businesses 字段且需要包含在 DTO 中，取消注释
                    // dto.setBusinesses(entity.getBusinesses());
                    return dto;
                }).collect(Collectors.toList());

                return ResponseResultInfo.builder()
                        .code(ResultConfig.SUCCESS_CODE.toString())
                        .msg("查询成功")
                        .data(dtoList)
                        .build();
            } else {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.ERROR_PARAM_CODE.toString())
                        .msg("未找到相关资讯")
                        .data(Collections.emptyList())
                        .build();
            }
        } catch (Exception e) {
            logger.error("Error in getPlantInformation: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("查询失败: " + e.getMessage())
                    .data(Collections.emptyList())
                    .build();
        }
    }

    @Transactional
    public ResponseResultInfo addUserAgentFreeTime(Integer userId, Long agentId, Integer degree) {
        try {
            // TODO: 根据 PHP Resource.php 中的 addUserAgentFreeTime 方法实现具体的逻辑
            // 确保 UserAgentFreeTimesMapper 中存在 selectByUserIdAndAgentId, update, insert 方法
            UserAgentFreeTimes existingEntry = userAgentFreeTimesMapper.selectByUserIdAndAgentId(userId, agentId); // 假设方法存在
            if (existingEntry != null) {
                existingEntry.setDegree(existingEntry.getDegree() + degree);
                // TODO: 确认 PHP 中更新时间戳的逻辑，这里使用 Unix 时间戳
                existingEntry.setUpdatedAt(System.currentTimeMillis() / 1000);
                userAgentFreeTimesMapper.update(existingEntry); // 假设方法存在
            } else {
                UserAgentFreeTimes newEntry = new UserAgentFreeTimes();
                newEntry.setUserId(userId);
                newEntry.setAgentId(agentId);
                newEntry.setDegree(degree);
                // TODO: 确认 PHP 中创建和更新时间戳的逻辑，这里使用 Unix 时间戳
                newEntry.setCreatedAt(System.currentTimeMillis() / 1000);
                newEntry.setUpdatedAt(System.currentTimeMillis() / 1000);
                userAgentFreeTimesMapper.insertUserAgentFreeTimes(newEntry); // 假设方法存在
            }
            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("操作成功")
                    .build();
        } catch (Exception e) {
            logger.error("Error in addUserAgentFreeTime: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("服务器错误: " + e.getMessage())
                    .build();
        }
    }

    public ResponseResultInfo getKnowledgePlanetCategorizedInfo(Integer type) {
        Map<String, Object> data = new HashMap<>();
        try {
            if (type == null) {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.ERROR_PARAM_CODE.toString())
                        .msg("类型参数不能为空")
                        .build();
            }
            // TODO: 根据 PHP Resource.php 中的 getKnowledgePlanetCategorizedInfo 方法实现具体的查询逻辑
            KnowledgePlanetCriteria allDataCriteria = new KnowledgePlanetCriteria();
            allDataCriteria.setType(type);
            List<KnowledgePlanet> allData = knowledgePlanetMapper.selectPlanetsByCriteria(allDataCriteria); // New call

            KnowledgePlanetCriteria hotCriteria = new KnowledgePlanetCriteria();
            hotCriteria.setType(type);
            hotCriteria.setOrderBy("NumberOfVisitors");
            hotCriteria.setOrderDirection("DESC");
            hotCriteria.setLimit(5);
            hotCriteria.setSelectIdAndTitleOnly(true);
            List<KnowledgePlanet> hotPlanets = knowledgePlanetMapper.selectPlanetsByCriteria(hotCriteria);

            // TODO: 确认 PHP 中 hot_data 的具体结构，这里映射了 id 和 title
            // The selectIdAndTitleOnly flag in criteria and XML handles selecting only id and title
            List<Map<String, Object>> hotDataMapped = hotPlanets.stream()
                .map(kp -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", kp.getId());
                    item.put("title", kp.getTitle());
                    return item;
                })
                .collect(Collectors.toList());

            data.put("all_data", allData);
            data.put("hot_data", hotDataMapped);

            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("查询成功")
                    .data(data)
                    .build();

        } catch (Exception e) {
            logger.error("Error in getKnowledgePlanetCategorizedInfo: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("服务器错误: " + e.getMessage())
                    .data(Collections.emptyMap())
                    .build();
        }
    }

    public ResponseResultInfo getUserAgentFreeTimeInfo(Integer userId, Long agentId) {
        Map<String, Object> dataOutput = new HashMap<>();
        try {
            if (userId == null || agentId == null) {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.ERROR_PARAM_CODE.toString())
                        .msg("参数不完整")
                        .build();
            }
            // TODO: 根据 PHP Resource.php 中的 getUserAgentFreeTimeInfo 方法实现具体的逻辑
            // 确保 UserMapper.selectById(userId) 方法存在并返回 User 对象
            // 确保 UserAgentFreeTimesMapper.selectByUserIdAndAgentId(userId, agentId) 方法存在并返回 UserAgentFreeTimes 对象
            User user = userMapper.selectById(userId); // 假设方法存在
            // TODO: 确认 User 对象中表示 VIP 状态的字段名，这里假设是 isVIP
            Integer isVip = (user != null) ? user.getIsVIP() : null;

            UserAgentFreeTimes freeTimeData = userAgentFreeTimesMapper.selectByUserIdAndAgentId(userId, agentId); // 假设方法存在
            // TODO: 确认 UserAgentFreeTimes 对象中表示免费时长的字段名，这里假设是 degree
            Integer freeTimeDegree = (freeTimeData != null) ? freeTimeData.getDegree() : null;

            dataOutput.put("is_vip", isVip);
            dataOutput.put("free_time", freeTimeDegree);

            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("查询成功")
                    .data(dataOutput)
                    .build();
        } catch (Exception e) {
            logger.error("Error in getUserAgentFreeTimeInfo: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("服务器错误: " + e.getMessage())
                    .build();
        }
    }

    @Transactional
    public ResponseResultInfo addSharePlanetPublicBatch(SharePlanetPublicBatchRequest request) {
        if (request == null || request.getAddData() == null || request.getAddData().isEmpty()) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("请求参数无效或列表为空")
                    .build();
        }

        try {

            // TODO: 根据 PHP Resource.php 中的 addSharePlanetPublicBatch 方法实现具体的逻辑
            for (SharePlanetPublicItemDto item : request.getAddData()) {
                KnowledgePlanet planet = new KnowledgePlanet();
                planet.setImg(item.getImg());
                planet.setTitle(item.getTitle());
                planet.setTime(item.getTime());
                planet.setClassification(item.getClassification());
                planet.setType(item.getType());
                planet.setCreatedAt(item.getCreatedAt());
                planet.setUpdatedAt(item.getUpdatedAt());
                planet.setBusinesses(item.getBusinesses());
                planet.setBusinessesImage(item.getBusinessesImage());
                planet.setStatus(item.getStatus());
                planet.setLikes(0);
                planet.setNumberOfVisitors(0);

                knowledgePlanetMapper.insert(planet); // 假设 insert 方法会设置ID (useGeneratedKeys="true")
                Long planetId = planet.getId();

                if (planetId == null || planetId <= 0) {
                    throw new RuntimeException("插入knowledge_planet表失败或未能获取ID for item title: " + item.getTitle());
                }

                OfficialInformationContentDto contentDto = item.getContent();
                if (contentDto != null) {
                    OfficialInformation info = new OfficialInformation();
                    info.setPopularCourseId(planetId);
                    info.setImg(contentDto.getImg());
                    info.setContent(contentDto.getContent());
                    info.setTitle(contentDto.getTitle());
                    info.setCreatedAt(contentDto.getCreatedAt());
                    info.setUpdatedAt(contentDto.getUpdatedAt());
                    info.setTag(contentDto.getTag());
                    info.setDate(DateUtils.parseDate(contentDto.getDate()).getTime() /1000);

                    int insertedInfoCount = officialInformationMapper.insert(info); // 假设方法存在
                    if (insertedInfoCount <= 0) {
                        throw new RuntimeException("插入official_information表失败 for planetId: " + planetId);
                    }
                }
            }
            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("批量添加分享内容成功")
                    .build();
        } catch (Exception e) {
            logger.error("Error in addSharePlanetPublicBatch: ", e);
            // TODO: 确认 PHP 中是否抛出异常或返回错误码，这里选择抛出运行时异常以触发事务回滚
            throw new RuntimeException("Batch insert failed: " + e.getMessage(), e);
        }
    }

    // PHP: getHomeResource - 直接返回错误，Java 中作为占位接口
    public Map<String, Object> getHomeResource() {
        Map<String, Object> result = new HashMap<>();
        result.put("code", 400);
        result.put("msg", "缺少 open_id"); // 模仿 PHP 返回
        return result;
    }

    public ResponseResultInfo recharge(Long userId) {
        try {
            // 根据id获取open_id
            String openId = userMapper.selectOpenIdById(userId); // 假设 Mapper 方法存在
            if (openId == null) {
                return ResponseResultInfo.builder()
                        .code("404")
                        .msg("未找到对应的open_id或输入的id不正确")
                        .build();
            }

            Integer isVip = userMapper.selectIsVipByOpenId(openId); // 假设 Mapper 方法存在
            if (isVip == null) {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.SUCCESS_CODE.toString())
                        .msg("未找到用户VIP状态")
                        .data(isVip)
                        .build();
            }

            //1:会员 0:非会员
            if (isVip == 1) { // 若用户类型为会员
                return ResponseResultInfo.builder()
                        .code(ResultConfig.SUCCESS_CODE.toString())
                        .msg("会员页面")
                        .data(isVip)
                        .build();
            } else if (isVip == 0) { // 若用户类型为非会员
                return ResponseResultInfo.builder()
                        .code(ResultConfig.SUCCESS_CODE.toString())
                        .msg("非会员页面")
                        .data(isVip)
                        .build();
            } else {
                return ResponseResultInfo.builder()
                        .code("500")
                        .msg("未知的用户类型")
                        .data(isVip)
                        .build();
            }
        } catch (Exception e) {
            logger.error("Error in recharge: ", e);
            throw new RuntimeException("Failed to recharge", e);
        }
    }

    public ResponseResultInfo selectsGoods(Integer type) {
        Map<String, Object> result = new HashMap<>();
        try {
            // 查询 exchange_rate 汇率表
//            List<ExchangeRate> exchangeRate = exchangeRateMapper.selectAll();

            List<Product> productList;
            if (type == null) {
                 return ResponseResultInfo.builder()
                         .code(ResultConfig.ERROR_PARAM_CODE.toString())
                         .msg("无效的商品类型")
                         .build();
            } else if (type == 0) {
                 productList = productMapper.selectByType(0); // 假设 ProductMapper 有 selectByType 方法
            } else if (type == 1) {
                 productList = productMapper.selectByType(1); // 假设 ProductMapper 有 selectByType 方法
            } else {
                 return ResponseResultInfo.builder()
                         .code(ResultConfig.ERROR_PARAM_CODE.toString())
                         .msg("无效的商品类型")
                         .build();
            }
            productList.forEach(item->item.setPrice(item.getPrice() / 100));

            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("查询成功")
//                    .exchangeRate(exchangeRate)
                    .data(productList)
                    .build();

        } catch (Exception e) {
            logger.error("Error in selectsGoods: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("服务器错误: " + e.getMessage())
                    .build();
        }
    }

    @Transactional // 需要事务支持
    public ResponseResultInfo<User> getTokenCount(String uuid, Integer quantity, String remarks) {
        try {
            User user = zhsUserMapper.getByUuid(uuid);
            if (Objects.isNull(user)) {
                return ResponseResultInfo.<User>builder()
                        .code("404")
                        .msg("未找到用户")
                        .build();
            }
            // 判断 token 是否充足
            if (quantity > (user.getTokenQuantity() + user.getTokenFree())) {
                return ResponseResultInfo.<User>builder()
                        .code(ResultConfig.ERROR_PARAM_CODE.toString())
                        .msg("用户token不足，无法调用本次服务，请充值！")
                        .build();
            }


            // 插入 operate_token_flow 记录
            OperateTokenFlow operateTokenFlow = new OperateTokenFlow(); // 假设您有 OperateTokenFlow Domain 类
            // TODO 移除每日免费次数
//            if(quantity <= user.getTokenFree()){
//                user.setTokenFree(user.getTokenFree() - quantity);
//                operateTokenFlow.setTokenFree(quantity);
//            }
//            if(quantity > user.getTokenFree()){
                user.setTokenQuantity(user.getTokenQuantity() + user.getTokenFree() - quantity);
                operateTokenFlow.setTokenQuantity((long) (quantity - user.getTokenFree()));
                user.setTokenFree(0);
                operateTokenFlow.setTokenFree(0);
//            }

            // 更新用户 token 数量
            int updatedRows = userMapper.updateTokenQuantityById(user);
            if (updatedRows <= 0) {
                return ResponseResultInfo.<User>builder()
                        .code(ResultConfig.ERROR_CODE.toString())
                        .msg("智汇力不足！")
                        .data(user) // 可以返回更新后的用户信息
                        .flowId(operateTokenFlow.getId())
                        .build();
//                throw new RuntimeException("更新用户token数量失败");
            }

            operateTokenFlow.setUserUuid(user.getToken());
            operateTokenFlow.setCreatedAt(System.currentTimeMillis() / 1000); // 示例：使用当前时间戳（秒），并强制转换为 Integer
            operateTokenFlow.setType(1); // 示例：类型为 1 (消耗), Use Integer 1 based on Domain
            operateTokenFlow.setOperateDesc(remarks); // 示例：类型为 1 (消耗), Use Integer 1 based on Domain

            int insertedRows = operateTokenFlowMapper.insert(operateTokenFlow); // 假设 OperateTokenFlowMapper 有 insert 方法
            if (insertedRows <= 0) {

                return ResponseResultInfo.<User>builder()
                        .code(ResultConfig.ERROR_CODE.toString())
                        .msg("插入流水记录失败！")
                        .data(user) // 可以返回更新后的用户信息
                        .flowId(operateTokenFlow.getId())
                        .build();
            }

            // 获取coze使用token
//            String accessToken = cozeService.getAccessToken(user.getOpenId());

            return ResponseResultInfo.<User>builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("Token 操作成功")
                    .data(user) // 可以返回更新后的用户信息
                    .flowId(operateTokenFlow.getId())
//                    .accessToken(accessToken)
                    .build();

        } catch (Exception e) {
            logger.error("Error in getTokenCount: ", e);
            // 抛出异常以触发事务回滚
            throw new RuntimeException("Failed to process token count", e);
        }
    }

    public ResponseResultInfo<User> getTokenReturn(Long id, String contextId, String authorization) {
        int i1 = contextMapper.deleteZhsUserAgentContextById(contextId);
        // 查询记录
        OperateTokenFlow operateTokenFlow = operateTokenFlowMapper.getById(id);
//        User build = User.builder().id(operateTokenFlow.get()).build();
        User user = zhsUserMapper.getByUuid(operateTokenFlow.getUserUuid());
        if(Objects.isNull(user)){
            return ResponseResultInfo.<User>builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("不存在的用户").build();
        }

        return operateToken(user.getOpenId(), Integer.valueOf(user.getTokenQuantity().toString()), authorization);

//        user.setTokenQuantity(user.getTokenQuantity() + operateTokenFlow.getTokenQuantity());
//        user.setTokenFree(user.getTokenFree() + operateTokenFlow.getTokenFree());
//        int i = userMapper.updateUser(user);
//        return ResponseResultInfo.<User>builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).data(user).build();
    }

    public ResponseResultInfo postPopularCourses() {
        try {
            // 查询 popular_courses 表的所有记录
            // List<PopularCourse> popularCourses = popularCourseMapper.selectAll(); // Old call
            PopularCourseCriteria criteria = new PopularCourseCriteria();
            List<PopularCourse> popularCourses = popularCourseMapper.selectCoursesByCriteria(criteria); // New call


            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("查询成功")
                    .data(popularCourses)
                    .build();

        } catch (Exception e) {
            logger.error("Error in postPopularCourses: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("服务器错误: " + e.getMessage())
                    .data(Collections.emptyList())
                    .build();
        }
    }

    public ResponseResultInfo getHomePageResources(Integer position) {
        Map<String, Object> data = new HashMap<>();
        try {
            // 轮播图 (type = 1)
            List<BannerCarousel> bannerCarousel = bannerCarouselMapper.selectByType(1, position); // Assuming this method is still needed or covered elsewhere

            /*// 课程星球 (入门 type = 1, 精选 type = 2, 限制 4 条)
            Map<String, Object> popularCourses = new HashMap<>();
            // popularCourses.put("gettingStarted", popularCourseMapper.selectByTypeWithLimit(1, 4)); // Old call
            PopularCourseCriteria gettingStartedCriteria = new PopularCourseCriteria();
            gettingStartedCriteria.setType(1);
            gettingStartedCriteria.setLimit(4);
            popularCourses.put("gettingStarted", popularCourseMapper.selectCoursesByCriteria(gettingStartedCriteria)); // New call

            // popularCourses.put("featured", popularCourseMapper.selectByTypeWithLimit(2, 4)); // Old call
            PopularCourseCriteria featuredCriteria = new PopularCourseCriteria();
            featuredCriteria.setType(2);
            featuredCriteria.setLimit(4);
            popularCourses.put("featured", popularCourseMapper.selectCoursesByCriteria(featuredCriteria)); // New call

            // 分析星球 (官方 type = 1, 社区 type = 2, 限制 4 条)
            // List<KnowledgePlanet> knowledgePlanetOfficial = knowledgePlanetMapper.selectByTypeWithLimit(1, 4); // Old call
            KnowledgePlanetCriteria officialPlanetCriteria = new KnowledgePlanetCriteria();
            officialPlanetCriteria.setType(1);
            officialPlanetCriteria.setLimit(4);
            List<KnowledgePlanet> knowledgePlanetOfficial = knowledgePlanetMapper.selectPlanetsByCriteria(officialPlanetCriteria); // New call

            // List<KnowledgePlanet> knowledgePlanetCommunity = knowledgePlanetMapper.selectByTypeWithLimit(2, 4); // Old call
            KnowledgePlanetCriteria communityPlanetCriteria = new KnowledgePlanetCriteria();
            communityPlanetCriteria.setType(2);
            communityPlanetCriteria.setLimit(4);
            List<KnowledgePlanet> knowledgePlanetCommunity = knowledgePlanetMapper.selectPlanetsByCriteria(communityPlanetCriteria); // New call

            Map<String, Object> knowledgePlanet = new HashMap<>();
            knowledgePlanet.put("official", knowledgePlanetOfficial);
            knowledgePlanet.put("community", knowledgePlanetCommunity);*/

            data.put("banner_carousel", bannerCarousel);
            /*data.put("popular_courses", popularCourses);
            data.put("knowledge_planet", knowledgePlanet);*/

            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("查询成功")
                    .data(data)
                    .build();

        } catch (Exception e) {
            logger.error("Error in getHomePageResources: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("服务器错误: " + e.getMessage())
                    .build();
        }
    }

    public ResponseResultInfo postHomeInformation() {
        Map<String, Object> data = new HashMap<>();
        try {
            // 课程 (限制 4 条)
            List<PopularCourse> popularCourses = popularCourseMapper.selectCoursesByCriteria(new PopularCourseCriteria() {{ setLimit(4); }}); // Using new criteria

            // 官方资讯推荐 (type = 1, status = 1, 按 Likes 倒序，限制 4 条)
            // List<KnowledgePlanet> officialRecommendation = knowledgePlanetMapper.selectByTypeAndStatusOrderByLikesDescLimit(1, 1, 4); // Old call
            KnowledgePlanetCriteria officialRecommendationCriteria = new KnowledgePlanetCriteria();
            officialRecommendationCriteria.setType(1);
            officialRecommendationCriteria.setStatus(1);
            officialRecommendationCriteria.setOrderBy("Likes");
            officialRecommendationCriteria.setOrderDirection("DESC");
            officialRecommendationCriteria.setLimit(4);
            List<KnowledgePlanet> officialRecommendation = knowledgePlanetMapper.selectPlanetsByCriteria(officialRecommendationCriteria); // New call

            // 官方资讯喜欢 (type = 1, status = 2, 按 Likes 倒序，限制 4 条)
            // List<KnowledgePlanet> officialLikes = knowledgePlanetMapper.selectByTypeAndStatusOrderByLikesDescLimit(1, 2, 4); // Old call
            KnowledgePlanetCriteria officialLikesCriteria = new KnowledgePlanetCriteria();
            officialLikesCriteria.setType(1);
            officialLikesCriteria.setStatus(2);
            officialLikesCriteria.setOrderBy("Likes");
            officialLikesCriteria.setOrderDirection("DESC");
            officialLikesCriteria.setLimit(4);
            List<KnowledgePlanet> officialLikes = knowledgePlanetMapper.selectPlanetsByCriteria(officialLikesCriteria); // New call

            // 星球社区推荐 (type = 2, status = 1, 按 Likes 倒序，限制 4 条)
            // List<KnowledgePlanet> communityRecommendations = knowledgePlanetMapper.selectByTypeAndStatusOrderByLikesDescLimit(2, 1, 4); // Old call
            KnowledgePlanetCriteria communityRecommendationsCriteria = new KnowledgePlanetCriteria();
            communityRecommendationsCriteria.setType(2);
            communityRecommendationsCriteria.setStatus(1);
            communityRecommendationsCriteria.setOrderBy("Likes");
            communityRecommendationsCriteria.setOrderDirection("DESC");
            communityRecommendationsCriteria.setLimit(4);
            List<KnowledgePlanet> communityRecommendations = knowledgePlanetMapper.selectPlanetsByCriteria(communityRecommendationsCriteria); // New call

            // 星球社区喜欢 (type = 2, status = 2, 按 Likes 倒序，限制 4 条)
            // List<KnowledgePlanet> communityLikes = knowledgePlanetMapper.selectByTypeAndStatusOrderByLikesDescLimit(2, 2, 4); // Old call
            KnowledgePlanetCriteria communityLikesCriteria = new KnowledgePlanetCriteria();
            communityLikesCriteria.setType(2);
            communityLikesCriteria.setStatus(2);
            communityLikesCriteria.setOrderBy("Likes");
            communityLikesCriteria.setOrderDirection("DESC");
            communityLikesCriteria.setLimit(4);
            List<KnowledgePlanet> communityLikes = knowledgePlanetMapper.selectPlanetsByCriteria(communityLikesCriteria); // New call

            Map<String, Object> officialInfo = new HashMap<>();
            officialInfo.put("recommendation", officialRecommendation);
            officialInfo.put("likes", officialLikes);

            Map<String, Object> communityInfo = new HashMap<>();
            communityInfo.put("recommendation", communityRecommendations);
            communityInfo.put("likes", communityLikes);

            data.put("popularCourses", popularCourses);
            data.put("official", officialInfo);
            data.put("community", communityInfo);

            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg("查询成功")
                    .data(data)
                    .build();

        } catch (Exception e) {
            logger.error("Error in postHomeInformation: ", e);
            return ResponseResultInfo.builder()
                    .code("500")
                    .msg("服务器错误: " + e.getMessage())
                    .data(Collections.emptyList())
                    .build();
        }
    }

    public List<ZhsAgent> getAgentList(String id) {
        return mainResourceMapper.getAgentList(id);
    }


    @SneakyThrows
    public ResponseResultInfo operateToken(String userUUid, Integer quantity, String authorization){
        Map<String, Object> param = Maps.newHashMap();
        param.put("uuid",userUUid);
        param.put("quantity", quantity);
        Map<String, Object> heads = Maps.newHashMap();
        heads.put(BeanConfig.ZHS_AUTHORIZATION, String.format(BeanConfig.ZHS_ACCESS_PREFIX, authorization));
        heads.put(BeanConfig.ZHS_CONTENT_TYPE, BeanConfig.ZHS_CONTENT_TYPE_JSON);
        heads.put(WXConfig.DEVICE_TYPE_HEAD, WXConfig.DEVICE_CODE);

        SSLClient sslClient = new SSLClient();
        String s = sslClient.doPost(marginUrl, JsonUtils.toJson(param), heads);
        Map map = JsonUtils.fromJson(s, Map.class);

        Map result = Maps.newHashMap();
        BeanUtils.copyProperties(map.get("data"), result);
        ResponseResultInfo success = ResponseResultInfo.success();
        success.setData(((JSONObject)map.get("data")).toMap());
        return success;
    }

    public ResponseResultInfo<List<ZhsProductIdentity>> getDeveloperPrice() {
        return ResponseResultInfo.success(productIdentityMapper.getDeveloperPrice());
    }
}