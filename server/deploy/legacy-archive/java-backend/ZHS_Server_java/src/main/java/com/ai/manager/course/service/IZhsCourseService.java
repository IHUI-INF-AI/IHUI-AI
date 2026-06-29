package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsCourse;

/**
 * 课程Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsCourseService
{
    /**
     * 查询课程
     * 
     * @param id 课程主键
     * @return 课程
     */
    public ZhsCourse getById(String id);

    /**
     * 查询课程列表
     *
     * @param zhsCourse 课程
     * @return 课程集合
     */
    public List<ZhsCourse> getList(ZhsCourse zhsCourse);

    /**
     * 新增课程
     *
     * @param zhsCourse 课程
     * @return 结果
     */
    public String add(ZhsCourse zhsCourse);

    /**
     * 修改课程
     * 
     * @param zhsCourse 课程
     * @return 结果
     */
    public int edit(ZhsCourse zhsCourse);

    /**
     * 批量删除课程
     *
     * @param ids  需要删除的课程主键集合
     * @param uuid
     * @return 结果
     */
    public int delByIds(String[] ids, String uuid);

    /**
     * 删除课程信息
     * 
     * @param id 课程主键
     * @return 结果
     */
    public int delById(String id);

    Integer delist(String ids, String uuid);
}
