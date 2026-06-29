package com.ai.manager.small.service.impl;

import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.small.domain.ZhsUserVip;
import com.ai.manager.small.domain.ZhsVipLevel;
import com.ai.manager.small.mapper.ZhsVipLevelMapper;
import com.ai.manager.small.service.IZhsVipLevelService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * vip等级Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-06-09
 */
@Service
public class ZhsVipLevelServiceImpl implements IZhsVipLevelService
{
    @Autowired
    private ZhsVipLevelMapper vipLevelMapper;

    /**
     * 查询vip等级
     * 
     * @param id vip等级主键
     * @return vip等级
     */
    @Override
    public ZhsVipLevel selectZhsVipLevelById(String id)
    {
        return vipLevelMapper.selectZhsVipLevelById(id);
    }

    /**
     * 查询vip等级列表
     * 
     * @param zhsVipLevel vip等级
     * @return vip等级
     */
    @Override
    public List<ZhsVipLevel> selectZhsVipLevelList(ZhsVipLevel zhsVipLevel)
    {
        return vipLevelMapper.selectZhsVipLevelList(zhsVipLevel);
    }

    /**
     * 新增vip等级
     * 
     * @param zhsVipLevel vip等级
     * @return 结果
     */
    @Override
    public int insertZhsVipLevel(ZhsVipLevel zhsVipLevel)
    {
        return vipLevelMapper.insertZhsVipLevel(zhsVipLevel);
    }

    /**
     * 修改vip等级
     * 
     * @param zhsVipLevel vip等级
     * @return 结果
     */
    @Override
    public int updateZhsVipLevel(ZhsVipLevel zhsVipLevel)
    {
        return vipLevelMapper.updateZhsVipLevel(zhsVipLevel);
    }

    /**
     * 批量删除vip等级
     * 
     * @param ids 需要删除的vip等级主键
     * @return 结果
     */
    @Override
    public int deleteZhsVipLevelByIds(String[] ids)
    {
        return vipLevelMapper.deleteZhsVipLevelByIds(ids);
    }

    /**
     * 删除vip等级信息
     * 
     * @param id vip等级主键
     * @return 结果
     */
    @Override
    public int deleteZhsVipLevelById(String id)
    {
        return vipLevelMapper.deleteZhsVipLevelById(id);
    }

    @Override
    public ZhsUserVip getUserProgeress(String openId) {
        return vipLevelMapper.getUserProgeress(openId);
    }

    @Override
    public int setUserProgress(String openId, String vipId, Integer progress) {
        List<ZhsVipLevel> vipLevels = selectZhsVipLevelList(ZhsVipLevel.builder().build());
        // 最大等级不增加经验
        if(vipId.equals(BeanConfig.MAX_VIP_ID)){
            return 0;
        }
//        ZhsVipLevel zhsVipLevel = vipLevels.stream().filter(item -> item.getId().equals(vipId)).findFirst().get();
        Optional<ZhsVipLevel> filterResult = vipLevels.stream().filter(item -> item.getId().equals(vipId)).findFirst();
        if(!filterResult.isPresent()){
            return 0;
        }
        ZhsVipLevel vipLevel = filterResult.get();
        ZhsUserVip build = ZhsUserVip.builder()
                .openId(openId)
                .build();

        // 经验计算
        Integer vipProgress = vipLevel.getProgress();
        if(progress < vipProgress){
            build.setVipId(vipId);
            build.setProgress(progress);
        } else if(progress.equals(vipProgress) ){
            build.setProgress(0);
            ZhsVipLevel zhsVipLevel = vipLevels.stream().filter(item -> item.getLevel() == vipLevel.getLevel() + 1).findFirst().get();
            build.setVipId(zhsVipLevel.getId());
        } else/* if (progress > vipProgress)*/{
            ZhsVipLevel bulkingVIPLevel = vipProgressCount(vipLevels, vipLevel, progress);
            build.setVipId(bulkingVIPLevel.getId());
            build.setProgress(bulkingVIPLevel.getProgress());
        }

        return vipLevelMapper.editUserVIP(build);
    }
    private ZhsVipLevel vipProgressCount(List<ZhsVipLevel> vipLevels, ZhsVipLevel vipLevel, Integer progress){
        Integer vipProgress = vipLevel.getProgress();
        ZhsVipLevel bulkingVIPLevel = null;
        for (int i = vipLevels.size() - 1; i >= 0; i--) {
            bulkingVIPLevel = vipLevels.get(i);
            // 如果等级小于当前等级 则不做判断
            if (bulkingVIPLevel.getLevel() <= vipLevel.getLevel()) continue;
            else {
                vipProgress += bulkingVIPLevel.getProgress();
                if (progress.equals(vipProgress)){
                    bulkingVIPLevel = vipLevels.get(i-1);
                    bulkingVIPLevel.setProgress(0);
                    break;
                } else if(progress < vipProgress){
                    bulkingVIPLevel.setProgress(progress + bulkingVIPLevel.getProgress() - vipProgress);
                    break;
                }
            }
        }
        return bulkingVIPLevel;
    }
}
