package com.ai.manager.course.service.impl;

import com.ai.manager.course.domain.ZhsCourse;
import com.ai.manager.course.domain.ZhsCourseAudit;
import com.ai.manager.course.domain.ZhsCoursePlatformLog;
import com.ai.manager.course.domain.ZhsCourseVideo;
import com.ai.manager.course.domain.vo.ZhsCategoryDictionaryVO;
import com.ai.manager.course.mapper.*;
import com.ai.manager.course.service.IZhsCourseService;
import com.ai.manager.small.domain.vo.AgentCategoryVO;
import com.ai.manager.small.mapper.AgentCategoryLinkMapper;
import com.ai.manager.small.mapper.AgentCategoryMapper;
import com.google.common.collect.Maps;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.assertj.core.util.Lists;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 课程Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsCourseServiceImpl implements IZhsCourseService 
{
    @Autowired
    private ZhsCourseMapper zhsCourseMapper;
    @Autowired
    private AgentCategoryLinkMapper categoryLinkMapper;
    @Autowired
    private AgentCategoryMapper categoryMapper;
    @Autowired
    private ZhsCategoryDictionaryMapper categoryDictionaryMapper;
    @Autowired
    private ZhsCourseVideoMapper courseVideoMapper;
    @Autowired
    private ZhsCoursePlatformLogMapper coursePlatformLogMapper;
    @Autowired
    private ZhsCourseAuditMapper courseAuditMapper;

    /**
     * 查询课程
     * 
     * @param id 课程主键
     * @return 课程
     */
    @Override
    public ZhsCourse getById(String id)
    {
        ZhsCourse byId = zhsCourseMapper.getById(id);


        if(Objects.isNull(byId)){
            return byId;
        }
        // 查询标签
        List<AgentCategoryVO> byLinkIds = categoryMapper.getByLinkIds(Lists.newArrayList(byId.getId()));
        Map<String, List<AgentCategoryVO>> collect = Maps.newHashMap();
        if(CollectionUtils.isNotEmpty(byLinkIds)){
            collect = byLinkIds.stream().collect(Collectors.groupingBy(AgentCategoryVO::getAgentId));
        }
        // 查询赛道
        List<ZhsCategoryDictionaryVO> categoryDictionaryVOS = categoryDictionaryMapper.getByLinkIds(Lists.newArrayList(byId.getId()));

        Map<String, List<ZhsCategoryDictionaryVO>> categoryDictionaryVOScCollect = Maps.newHashMap();
        if(CollectionUtils.isNotEmpty(categoryDictionaryVOS)){
            categoryDictionaryVOScCollect = categoryDictionaryVOS.stream().collect(Collectors.groupingBy(ZhsCategoryDictionaryVO::getAgentId));
        }

        byId.setTypeList(collect.get(byId.getId()));
        byId.setCategoryList(categoryDictionaryVOScCollect.get(byId.getId()));

        return byId;
    }

    /**
     * 查询课程列表
     *INTELLIGENCE
     * @param zhsCourse 课程
     * @return 课程
     */
    @Override
    public List<ZhsCourse> getList(ZhsCourse zhsCourse)
    {
        if(StringUtils.isNotBlank(zhsCourse.getTypes())){
            zhsCourse.setTypeArray(Lists.newArrayList(zhsCourse.getTypes().split(",")));
        }
        if(StringUtils.isNotBlank(zhsCourse.getCategorys())){
            zhsCourse.setCategoryArray(Lists.newArrayList(zhsCourse.getCategorys().split(",")));
        }

        List<ZhsCourse> list = zhsCourseMapper.getList(zhsCourse);

        if(CollectionUtils.isEmpty(list)){
         return list;
        }

        List<String> agentIds = list.stream().map(ZhsCourse::getId).collect(Collectors.toList());
        // 查询标签
        List<AgentCategoryVO> byLinkIds = categoryMapper.getByLinkIds(agentIds);
        Map<String, List<AgentCategoryVO>> collect = Maps.newHashMap();
        if(CollectionUtils.isNotEmpty(byLinkIds)){
            collect = byLinkIds.stream().collect(Collectors.groupingBy(AgentCategoryVO::getAgentId));
        }
        // 查询赛道
        List<ZhsCategoryDictionaryVO> categoryDictionaryVOS = categoryDictionaryMapper.getByLinkIds(agentIds);

        Map<String, List<ZhsCategoryDictionaryVO>> categoryDictionaryVOScCollect = Maps.newHashMap();
        if(CollectionUtils.isNotEmpty(categoryDictionaryVOS)){
            categoryDictionaryVOScCollect = categoryDictionaryVOS.stream().collect(Collectors.groupingBy(ZhsCategoryDictionaryVO::getAgentId));
        }

        for (ZhsCourse item : list) {
            item.setTypeList(collect.get(item.getId()));
            item.setCategoryList(categoryDictionaryVOScCollect.get(item.getId()));
        }
        return list;
    }

    /**
     * 新增课程
     *
     * @param zhsCourse 课程
     * @return 结果
     */
    @Override
    public String add(ZhsCourse zhsCourse)
    {
        zhsCourse.setId(UUID.randomUUID().toString());
        int i = zhsCourseMapper.addZhsCourse(zhsCourse);
        addCategoryLink(zhsCourse);
        addCoursePlatformLink(zhsCourse.getId(), zhsCourse.getPlatform());
        return zhsCourse.getId();
    }

    private void addCategoryLink(ZhsCourse zhsCourse){
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
    private void addCoursePlatformLink(String courseId, String platformId){
        // 获取平台信息
        if(StringUtils.isNotBlank(platformId)){
            // 添加课程与平台关系
            ZhsCoursePlatformLog build = ZhsCoursePlatformLog.builder().courseId(courseId).platformId(platformId).type(1).build();
            coursePlatformLogMapper.addZhsCoursePlatformLog(build);
        }
    }

    /**
     * 修改课程
     * 
     * @param zhsCourse 课程
     * @return 结果
     */
    @Override
    public int edit(ZhsCourse zhsCourse) {
        if(zhsCourse.getAuditStatus() == 0){
            // 删除所有关联关系
            categoryLinkMapper.removeByAgentIds(Lists.newArrayList(zhsCourse.getId()));
            addCategoryLink(zhsCourse);

            return zhsCourseMapper.edit(zhsCourse);
        }

        // 添加或修改当前当前记录的操作
        ZhsCourse temp = ZhsCourse.builder().build();
        BeanUtils.copyProperties(zhsCourse, temp);
        temp.setCourseId(zhsCourse.getId());
        temp.setId(UUID.randomUUID().toString());
        temp.setCreator(zhsCourse.getUpdator());
        zhsCourseMapper.addTemp(temp);
        addCategoryLink(temp);

        // 发起审批
        courseAuditMapper.addZhsCourseAudit(ZhsCourseAudit.builder()
                .sourceId(zhsCourse.getId())
                .operate(1)
                .targetId(temp.getId())
                .targetId(temp.getId())
                .creator(zhsCourse.getUpdator())
                .build());

        // 修改当前审批记录
        ZhsCourse build = ZhsCourse.builder().id(zhsCourse.getId()).auditStatus(1).build();
        return zhsCourseMapper.edit(build);
    }

    /**
     * 批量删除课程
     *
     * @param ids  需要删除的课程主键
     * @param uuid
     * @return 结果
     */
    @Override
    public int delByIds(String[] ids, String uuid)
    {
        List<ZhsCourse> list = zhsCourseMapper.getByIds(ids, uuid);
        if(CollectionUtils.isEmpty(list)){
            return 0;
        }

        List<String> ids0 = list.stream().filter(item -> item.getAuditStatus() == 0).map(ZhsCourse::getId).collect(Collectors.toList());
        int i1 = zhsCourseMapper.delByIds(ids0, uuid);


        List<String> idList = list.stream().filter(item -> item.getAuditStatus() != 0).map(ZhsCourse::getId).collect(Collectors.toList());
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

        // 修改当前审批记录
        return zhsCourseMapper.delByIds2(ids, uuid);
    }
    /*public int delByIds(String[] ids, String uuid)
    {

        int i = zhsCourseMapper.delByIds(ids, uuid);
        // 删除所有关联关系
        categoryLinkMapper.removeByAgentIds(Arrays.asList(ids));

        // 删除所有关联视频
        courseVideoMapper.delByCourseIds(Arrays.asList(ids));

        // 删除所有关联平台
        coursePlatformLogMapper.delByCourseIds(Arrays.asList(ids));
        return i;
    }*/

    /**
     * 删除课程信息
     * 
     * @param id 课程主键
     * @return 结果
     */
    @Override
    public int delById(String id)
    {
        // 发起审批
        courseAuditMapper.addZhsCourseAudit(ZhsCourseAudit.builder()
                .sourceId(id)
                .operate(2)
//                .creator(zhsCourse.getUpdator())
                .build());

        // 修改当前审批记录
        ZhsCourse build = ZhsCourse.builder().id(id).auditStatus(1).build();
        return zhsCourseMapper.edit(build);
    }

    @Override
    public Integer delist(String ids, String uuid) {
        // 获取合计下所有视频
        if(StringUtils.isBlank(ids)){
            return null;
        }
        List<String> idList = Lists.newArrayList(ids.split(","));
        if(CollectionUtils.isEmpty(idList)){
            return null;
        }
        if(true){
            idList.forEach(item ->{
                zhsCourseMapper.edit(ZhsCourse.builder().id(item).auditStatus(0).build());
                courseVideoMapper.edit(ZhsCourseVideo.builder().courseId(item).auditStatus(0).build());
            });
            return 0;
        }

        List<ZhsCourseAudit> audits = Lists.newArrayList();
        idList.forEach(item ->{
            audits.add(ZhsCourseAudit.builder()
                    .sourceId(item)
                    .type(0)
                    .operate(3)
                    .creator(uuid)
                    .build());
            zhsCourseMapper.edit(ZhsCourse.builder().id(item).auditStatus(1).build());
        });

        return courseAuditMapper.addZhsCourseAudits(audits);
    }
}
