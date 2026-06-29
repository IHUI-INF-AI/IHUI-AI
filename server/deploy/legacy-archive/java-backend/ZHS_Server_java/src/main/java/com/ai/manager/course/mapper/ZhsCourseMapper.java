package com.ai.manager.course.mapper;

import java.util.List;
import com.ai.manager.course.domain.ZhsCourse;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

/**
 * 课程Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@DS("course")
public interface ZhsCourseMapper 
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
    public int addZhsCourse(ZhsCourse zhsCourse);

    /**
     * 修改课程
     * 
     * @param zhsCourse 课程
     * @return 结果
     */
    public int edit(ZhsCourse zhsCourse);

    /**
     * 删除课程
     * 
     * @param id 课程主键
     * @return 结果
     */
    public int delById(String id);

    /**
     * 批量删除课程
     *
     * @param ids  需要删除的数据主键集合
     * @param uuid
     * @return 结果
     */
//    public int delByIds(@Param("ids") String[] ids, @Param("uuid") String uuid);
    public int delByIds(@Param("ids") List<String> ids, @Param("uuid") String uuid);

    void addTemp(ZhsCourse zhsCourse);

    int delByIds2(@Param("ids") String[] ids, @Param("uuid") String uuid);

    List<ZhsCourse> getByIds(@Param("ids") String[] ids, @Param("uuid") String uuid);
}
