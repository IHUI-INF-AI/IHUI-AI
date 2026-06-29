package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsCoursePay;

/**
 * 课程价格Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsCoursePayService
{
    /**
     * 查询课程价格
     * 
     * @param uuid 课程价格主键
     * @return 课程价格
     */
    public ZhsCoursePay getByUuid(String uuid);

    /**
     * 查询课程价格列表
     * 
     * @param zhsCoursePay 课程价格
     * @return 课程价格集合
     */
    public List<ZhsCoursePay> getList(ZhsCoursePay zhsCoursePay);

    /**
     * 新增课程价格
     * 
     * @param zhsCoursePay 课程价格
     * @return 结果
     */
    public int add(ZhsCoursePay zhsCoursePay);

    /**
     * 修改课程价格
     * 
     * @param zhsCoursePay 课程价格
     * @return 结果
     */
    public int edit(ZhsCoursePay zhsCoursePay);

    /**
     * 批量删除课程价格
     * 
     * @param uuids 需要删除的课程价格主键集合
     * @return 结果
     */
    public int delByUuids(String[] uuids);

    /**
     * 删除课程价格信息
     * 
     * @param uuid 课程价格主键
     * @return 结果
     */
    public int delByUuid(String uuid);
}
