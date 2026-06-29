package com.ai.manager.course.mapper;

import com.ai.manager.course.domain.ZhsCourseAudit;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 课程审批Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-09-06
 */
@DS("course")
public interface ZhsCourseAuditMapper 
{
    /**
     * 查询课程审批
     * 
     * @param id 课程审批主键
     * @return 课程审批
     */
    public ZhsCourseAudit getById(String id);

    /**
     * 查询课程审批列表
     * 
     * @param zhsCourseAudit 课程审批
     * @return 课程审批集合
     */
    public List<ZhsCourseAudit> getList(ZhsCourseAudit zhsCourseAudit);

    /**
     * 新增课程审批
     * 
     * @param zhsCourseAudit 课程审批
     * @return 结果
     */
    public int addZhsCourseAudit(ZhsCourseAudit zhsCourseAudit);

    /**
     * 修改课程审批
     * 
     * @param zhsCourseAudit 课程审批
     * @return 结果
     */
    public int edit(ZhsCourseAudit zhsCourseAudit);

    /**
     * 删除课程审批
     * 
     * @param id 课程审批主键
     * @return 结果
     */
    public int delById(String id);

    /**
     * 批量删除课程审批
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    Integer addZhsCourseAudits(@Param("audits") List<ZhsCourseAudit> audits);
}
