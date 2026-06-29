package com.ai.manager.course.service.impl;

import java.util.List;

import com.ai.manager.course.domain.ZhsCoursePay;
import com.ai.manager.course.domain.ZhsCourseVideo;
import com.ai.manager.course.mapper.ZhsCoursePayMapper;
import com.ai.manager.course.mapper.ZhsCourseVideoMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ai.manager.course.mapper.ZhsCoursePayLogMapper;
import com.ai.manager.course.domain.ZhsCoursePayLog;
import com.ai.manager.course.service.IZhsCoursePayLogService;

/**
 * 用户购买课程记录Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsCoursePayLogServiceImpl implements IZhsCoursePayLogService 
{
    @Autowired
    private ZhsCoursePayLogMapper zhsCoursePayLogMapper;

    @Autowired
    private ZhsCoursePayMapper coursePayMapper;
    @Autowired
    private ZhsCourseVideoMapper videoPayMapper;

    /**
     * 查询用户购买课程记录
     * 
     * @param id 用户购买课程记录主键
     * @return 用户购买课程记录
     */
    @Override
    public ZhsCoursePayLog getById(String id)
    {
        return zhsCoursePayLogMapper.getById(id);
    }

    /**
     * 查询用户购买课程记录列表
     * 
     * @param zhsCoursePayLog 用户购买课程记录
     * @return 用户购买课程记录
     */
    @Override
    public List<ZhsCoursePayLog> getList(ZhsCoursePayLog zhsCoursePayLog)
    {
        return zhsCoursePayLogMapper.getList(zhsCoursePayLog);
    }

    /**
     * 新增用户购买课程记录
     * 
     * @param zhsCoursePayLog 用户购买课程记录
     * @return 结果
     */
    @Override
    public int add(ZhsCoursePayLog zhsCoursePayLog)
    {
        return zhsCoursePayLogMapper.addZhsCoursePayLog(zhsCoursePayLog);
    }

    /**
     * 修改用户购买课程记录
     * 
     * @param zhsCoursePayLog 用户购买课程记录
     * @return 结果
     */
    @Override
    public int edit(ZhsCoursePayLog zhsCoursePayLog)
    {
        return zhsCoursePayLogMapper.edit(zhsCoursePayLog);
    }

    /**
     * 批量删除用户购买课程记录
     * 
     * @param ids 需要删除的用户购买课程记录主键
     * @return 结果
     */
    @Override
    public int delByIds(String[] ids)
    {
        return zhsCoursePayLogMapper.delByIds(ids);
    }

    /**
     * 删除用户购买课程记录信息
     * 
     * @param id 用户购买课程记录主键
     * @return 结果
     */
    @Override
    public int delById(String id)
    {
        return zhsCoursePayLogMapper.delById(id);
    }

    @Override
    public Integer getProduct(int productType, String productId) {
        Integer price = 0;
        if(productType == 6){
            ZhsCoursePay byCourseId = coursePayMapper.getByCourseId(productId);
            price = byCourseId.getAmount();
        }
        if(productType == 7){
            ZhsCourseVideo byId = videoPayMapper.getById(productId, null, null);
            price = byId.getAmount();
        }
        return price;
    }

    @Override
    public ZhsCoursePayLog getByOutBillNo(String outBillOn) {
        return zhsCoursePayLogMapper.getByOutBillNo(outBillOn);
    }
}
