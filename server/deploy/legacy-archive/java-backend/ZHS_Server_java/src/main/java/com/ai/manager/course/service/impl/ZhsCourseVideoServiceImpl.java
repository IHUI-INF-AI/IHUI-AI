package com.ai.manager.course.service.impl;

import com.ai.manager.course.domain.ZhsCourse;
import com.ai.manager.course.domain.ZhsCourseAudit;
import com.ai.manager.course.domain.ZhsCourseVideo;
import com.ai.manager.course.mapper.ZhsCourseAuditMapper;
import com.ai.manager.course.mapper.ZhsCourseMapper;
import com.ai.manager.course.mapper.ZhsCourseVideoMapper;
import com.ai.manager.course.service.IZhsCourseVideoService;
import com.ai.manager.small.domain.vo.AgentCategoryVO;
import com.ai.manager.small.mapper.AgentCategoryLinkMapper;
import com.ai.manager.small.mapper.AgentCategoryMapper;
import com.alibaba.druid.support.json.JSONUtils;
import com.google.common.collect.Maps;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.collections.MapUtils;
import org.apache.commons.lang3.StringUtils;
import org.assertj.core.util.Lists;
import org.json.JSONObject;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 课程视频Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsCourseVideoServiceImpl implements IZhsCourseVideoService 
{
    @Autowired
    private ZhsCourseVideoMapper zhsCourseVideoMapper;
    @Autowired
    private ZhsCourseMapper courseMapper;
    @Autowired
    private AgentCategoryLinkMapper categoryLinkMapper;
    @Autowired
    private AgentCategoryMapper categoryMapper;
    @Autowired
    private ZhsCourseAuditMapper courseAuditMapper;

    /**
     * 查询课程视频
     *
     * @param id       课程视频主键
     * @param userUuid
     * @param platform
     * @return 课程视频
     */
    @Override
    public ZhsCourseVideo getById(String id, String userUuid, String platform)
    {
        ZhsCourseVideo byId = zhsCourseVideoMapper.getById(id, userUuid, platform);
        if(Objects.isNull(byId)) return null;

        // 查询标签
        List<AgentCategoryVO> byLinkIds = categoryMapper.getByLinkIds(Lists.newArrayList(byId.getId()));
        Map<String, List<AgentCategoryVO>> collect = Maps.newHashMap();
        if(CollectionUtils.isNotEmpty(byLinkIds)){
            collect = byLinkIds.stream().collect(Collectors.groupingBy(AgentCategoryVO::getAgentId));
        }

        byId.setTypeList(collect.get(byId.getId()));
        if (StringUtils.isNotBlank(byId.getAgentIds()))
            byId.setAgentMap(new JSONObject(byId.getAgentIds()).toMap());

        return byId;
    }

    /**
     * 查询课程视频列表
     * 
     * @param zhsCourseVideo 课程视频
     * @return 课程视频
     */
    @Override
    public List<ZhsCourseVideo> getList(ZhsCourseVideo zhsCourseVideo)
    {
        List<ZhsCourseVideo> list = zhsCourseVideoMapper.getList(zhsCourseVideo);
        if(CollectionUtils.isEmpty(list)){
            return list;
        }

        List<String> agentIds = list.stream().map(ZhsCourseVideo::getId).collect(Collectors.toList());
        // 查询标签
        List<AgentCategoryVO> byLinkIds = categoryMapper.getByLinkIds(agentIds);
        Map<String, List<AgentCategoryVO>> collect = Maps.newHashMap();
        if(CollectionUtils.isNotEmpty(byLinkIds)){
            collect = byLinkIds.stream().collect(Collectors.groupingBy(AgentCategoryVO::getAgentId));
        }

        for (ZhsCourseVideo item : list) {
            item.setTypeList(collect.get(item.getId()));
            if (StringUtils.isNotBlank(item.getAgentIds()))
                item.setAgentMap(new JSONObject(item.getAgentIds()).toMap());
        }

        return list;
    }

    /**
     * 新增课程视频
     * 
     * @param zhsCourseVideo 课程视频
     * @return 结果
     */
    @Override
    public int add(ZhsCourseVideo zhsCourseVideo)
    {
        // 查询最大排序值
        Integer maxSort = zhsCourseVideoMapper.getMaxSort(zhsCourseVideo.getCourseId());
        if(Objects.isNull(maxSort)) maxSort = 0;
        zhsCourseVideo.setSort(maxSort + 1);

        // 添加智能体
        Map<String, Object> agentMap = zhsCourseVideo.getAgentMap();
        if(MapUtils.isNotEmpty(agentMap)){
            zhsCourseVideo.setAgentIds(JSONUtils.toJSONString(agentMap));
        }

        zhsCourseVideo.setId(UUID.randomUUID().toString());
        int i = zhsCourseVideoMapper.addZhsCourseVideo(zhsCourseVideo);

        // 添加课程标签
        addCategoryLink(zhsCourseVideo);
        return i;
    }
    private void addCategoryLink(ZhsCourseVideo zhsCourse){
        // 判断是否添加的种类有哪几个
        String types = zhsCourse.getTypes();
        String categroys = zhsCourse.getCategorys();

        if(StringUtils.isBlank(types)){
            types = "";
        }
        if(StringUtils.isBlank(categroys)){
            categroys = "";
        }

        // 添加关联关系
        categoryLinkMapper.addTypeAndCategory(zhsCourse.getId(), Lists.newArrayList(types.split(",")), Lists.newArrayList(categroys.split(",")));
    }

    /**
     * 修改课程视频
     *
     * @param zhsCourseVideo 课程视频
     * @param uuid
     * @return 结果
     */
    @Override
    public int edit(ZhsCourseVideo zhsCourseVideo, String uuid)
    {
        // 添加智能体
        Map<String, Object> agentMap = zhsCourseVideo.getAgentMap();
        if(MapUtils.isNotEmpty(agentMap)){
            zhsCourseVideo.setAgentIds(JSONUtils.toJSONString(agentMap));
        }

        if(zhsCourseVideo.getAuditStatus() == 0){
            // 删除标签
            categoryLinkMapper.removeByAgentIds(Lists.newArrayList(zhsCourseVideo.getId()));
            addCategoryLink(zhsCourseVideo);

            return zhsCourseVideoMapper.edit(zhsCourseVideo);
        }


        // 添加或修改当前当前记录的操作
        ZhsCourseVideo temp = ZhsCourseVideo.builder().build();
        BeanUtils.copyProperties(zhsCourseVideo, temp);
        temp.setId(UUID.randomUUID().toString());
        temp.setCreator(uuid);


        zhsCourseVideoMapper.addTemp(temp);
        addCategoryLink(temp);

        // 发起审批
        courseAuditMapper.addZhsCourseAudit(ZhsCourseAudit.builder()
                .sourceId(zhsCourseVideo.getId())
                .type(1)
                .operate(1)
                .targetId(temp.getId())
                .creator(uuid)
                .build());

        // 修改当前审批记录
        ZhsCourseVideo build = ZhsCourseVideo.builder().id(zhsCourseVideo.getId()).auditStatus(1).build();
        return zhsCourseVideoMapper.edit(build);
    }
//    public int edit(ZhsCourseVideo zhsCourseVideo)
//    {
//
//        // 添加智能体
//        Map<String, Object> agentMap = zhsCourseVideo.getAgentMap();
//        if(MapUtils.isNotEmpty(agentMap)){
//            zhsCourseVideo.setAgentIds(JSONUtils.toJSONString(agentMap));
//        }
//
//        return zhsCourseVideoMapper.edit(zhsCourseVideo);
//    }

    /**
     * 批量删除课程视频
     *
     * @param ids  需要删除的课程视频主键
     * @param uuid
     * @return 结果
     */
    @Override
    public int delByIds(String[] ids, String uuid)
    {
        List<ZhsCourseVideo> list = zhsCourseVideoMapper.getByIds(ids, uuid);

        if(CollectionUtils.isEmpty(list)){
            return 0;
        }

        List<String> ids0 = list.stream().filter(item -> item.getAuditStatus() == 0).map(ZhsCourseVideo::getId).collect(Collectors.toList());
        int i1 = zhsCourseVideoMapper.delByIds(ids0, uuid);


        List<String> idList = list.stream().filter(item -> item.getAuditStatus() != 0).map(ZhsCourseVideo::getId).collect(Collectors.toList());
        if(CollectionUtils.isEmpty(idList)){
            return 0;
        }
        idList.forEach(item ->{
            // 发起审批
            courseAuditMapper.addZhsCourseAudit(ZhsCourseAudit.builder()
                    .sourceId(item)
                    .operate(2)
                    .creator(uuid)
                    .build());
        });

        return zhsCourseVideoMapper.delByIds2(ids,uuid);
    }

    /**
     * 删除课程视频信息
     * 
     * @param id 课程视频主键
     * @return 结果
     */
    @Override
    public int delById(String id)
    {
        return zhsCourseVideoMapper.delById(id);
    }

    @Override
    public Integer addBatch(List<ZhsCourseVideo> zhsCourseVideos) {

        zhsCourseVideos.forEach(item -> {
            // 添加智能体
            Map<String, Object> agentMap = item.getAgentMap();
            if(MapUtils.isNotEmpty(agentMap)){
                item.setAgentIds(JSONUtils.toJSONString(agentMap));
            }
        });

        return zhsCourseVideoMapper.addBatch(zhsCourseVideos);
    }

    @Override
    public void move(String videoId, Integer type, String userUuid) {
        List<ZhsCourseVideo> list;
        if(type.equals("0")){
            list = stickylist(videoId,userUuid);
        }else {
            list = upList(videoId,userUuid, type);
        }
        int i = zhsCourseVideoMapper.moveList(list);
    }

    @Override
    public Integer issue(String ids, String uuid) {
        if(StringUtils.isBlank(ids)){
            return 0;
        }

        List<String> idList  = Lists.newArrayList(ids.split(","));
        if(CollectionUtils.isEmpty(idList)){
            return 0;
        }

        if(true){
            idList.forEach(item ->{
                zhsCourseVideoMapper.edit(ZhsCourseVideo.builder().id(item).auditStatus(4).build());
            });
            List<ZhsCourseVideo> byIds = zhsCourseVideoMapper.getByIds(ids.split(","), uuid);
            for (int i = 0; i < byIds.size(); i++) {
                ZhsCourseVideo zhsCourseVideo = byIds.get(0);
                courseMapper.edit(ZhsCourse.builder().id(zhsCourseVideo.getCourseId()).auditStatus(4).build());
            }

            return 0;
        }
        List<ZhsCourseAudit> audits = Lists.newArrayList();
        idList.forEach(item ->{
            audits.add(ZhsCourseAudit.builder()
                    .sourceId(item)
                    .type(1)
                    .operate(0)
                    .creator(uuid)
                    .build());
            zhsCourseVideoMapper.edit(ZhsCourseVideo.builder().id(item).auditStatus(1).build());
        });
        return courseAuditMapper.addZhsCourseAudits(audits);
    }

    /** 移动列表 */
    private List<ZhsCourseVideo> upList(String videoId, String userUuid, Integer type) {
        List<ZhsCourseVideo> list = zhsCourseVideoMapper.getNeedMoveList(videoId, userUuid, type);
        if(list.size() == 2){
            ZhsCourseVideo item1 = list.get(0);
            ZhsCourseVideo item2 = list.get(1);

            Integer sort1 = item1.getSort();
            item1.setSort(item2.getSort());
            item2.setSort(sort1);
        }
        return list;
    }

    /** 置顶列表 */
    private List<ZhsCourseVideo> stickylist(String videoId, String userUuid) {
        List<ZhsCourseVideo> list = zhsCourseVideoMapper.getNeedStickyList(videoId, userUuid);
        list.forEach(item -> {
            if(item.getId().equals(videoId)){
                item.setSort(1);
            } else{
                item.setSort(item.getSort() + 1);
            }
        });
        return list;
    }
}
