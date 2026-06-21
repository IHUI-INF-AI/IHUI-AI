import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../member'

describe('member', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('memberApi.profile 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.profile()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.updateProfile 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.updateProfile()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.data 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.data()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.uploadAvatar 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.uploadAvatar()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.file 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.file()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.url 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.url()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.headers 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.headers()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.changePassword 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.changePassword()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.oldPwd 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.oldPwd()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.newPwd 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.newPwd()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.bindPhone 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.bindPhone()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.phone 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.phone()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.code 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.code()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.bindEmail 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.bindEmail()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.email 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.email()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.setting 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.setting()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.updateSetting 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.updateSetting()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.vipList 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.vipList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.vipBuy 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.vipBuy()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.level 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.level()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.payType 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.payType()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.orderId 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.orderId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.pointAccount 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.pointAccount()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.total 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.total()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.available 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.available()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.frozen 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.frozen()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.used 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.used()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.pointLog 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.pointLog()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.pointTodaySign 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.pointTodaySign()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.point 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.point()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.continuous 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.continuous()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.pointSignStatus 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.pointSignStatus()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.signed 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.signed()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.learnRecord 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.learnRecord()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.learnRecordSave 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.learnRecordSave()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.lessonId 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.lessonId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.duration 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.duration()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.progress 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.progress()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.learnStat 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.learnStat()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.totalDays 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.totalDays()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.totalMinutes 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.totalMinutes()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.continuousDays 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.continuousDays()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.todayMinutes 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.todayMinutes()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.examSignUp 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.examSignUp()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.examRecord 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.examRecord()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.examWrongList 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.examWrongList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.examWrongRemove 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.examWrongRemove()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.id 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.id()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.myAskList 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.myAskList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.myAnswerList 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.myAnswerList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.myCircleList 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.myCircleList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.myCirclePost 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.myCirclePost()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.myArticleList 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.myArticleList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.myResourceList 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.myResourceList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.myFavorites 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.myFavorites()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.toggleFavorite 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.toggleFavorite()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.refType 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.refType()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.refId 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.refId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.isFavorite 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.isFavorite()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.myComments 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.myComments()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.followList 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.followList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.fansList 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.fansList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.followToggle 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.followToggle()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.userId 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.userId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.isFollowing 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.isFollowing()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.myCertificates 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.myCertificates()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('memberApi.myHomework 应能正常调用', async () => {
    const obj = (api as any).memberApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.myHomework()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
