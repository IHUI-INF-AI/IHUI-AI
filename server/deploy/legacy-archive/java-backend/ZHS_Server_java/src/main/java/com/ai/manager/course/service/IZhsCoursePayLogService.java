package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsCoursePayLog;
import org.apache.ibatis.annotations.Param;

/**
 * 用户购买课程记录Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsCoursePayLogService
{
    /**
     * 查询用户购买课程记录
     * 
     * @param id 用户购买课程记录主键
     * @return 用户购买课程记录
     */
    public ZhsCoursePayLog getById(String id);

    /**
     * 查询用户购买课程记录列表
     * 
     * @param zhsCoursePayLog 用户购买课程记录
     * @return 用户购买课程记录集合
     */
    public List<ZhsCoursePayLog> getList(ZhsCoursePayLog zhsCoursePayLog);

    /**
     * 新增用户购买课程记录
     * 
     * @param zhsCoursePayLog 用户购买课程记录
     * @return 结果
     */
    public int add(ZhsCoursePayLog zhsCoursePayLog);

    /**
     * 修改用户购买课程记录
     * 
     * @param zhsCoursePayLog 用户购买课程记录
     * @return 结果
     */
    public int edit(ZhsCoursePayLog zhsCoursePayLog);

    /**
     * 批量删除用户购买课程记录
     * 
     * @param ids 需要删除的用户购买课程记录主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    /**
     * 删除用户购买课程记录信息
     * 
     * @param id 用户购买课程记录主键
     * @return 结果
     */
    public int delById(String id);

    Integer getProduct(int productType, String productId);

    ZhsCoursePayLog getByOutBillNo(String outBillOn);
}
