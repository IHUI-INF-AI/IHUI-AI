import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { getLiveCalendar, type Live } from '@/api'

interface DayCell {
  day: number | null
  has: boolean
  date: string
  lives: Live[]
}

export default function LiveCalendar() {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const [date, setDate] = useState(new Date())
  const [calendar, setCalendar] = useState<Array<{ date: string; lives: Live[] }>>([])
  const [selectedDate, setSelectedDate] = useState('')
  const dateRef = useRef(new Date())

  const currentMonth = useMemo(() => {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`
  }, [date])

  const days = useMemo<DayCell[]>(() => {
    const y = date.getFullYear()
    const m = date.getMonth()
    const firstDay = new Date(y, m, 1).getDay()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const arr: DayCell[] = []
    for (let i = 0; i < firstDay; i++) arr.push({ day: null, has: false, date: '', lives: [] })
    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      const found = calendar.find(c => c.date === dStr)
      arr.push({ day: i, has: !!found?.lives?.length, date: dStr, lives: found?.lives || [] })
    }
    return arr
  }, [date, calendar])

  const selectedLives = useMemo(() => {
    return days.find(d => d.date === selectedDate)?.lives || []
  }, [days, selectedDate])

  const load = useCallback(async () => {
    const d = dateRef.current
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    try {
      const res = await getLiveCalendar({ month })
      setCalendar(res.list || [])
    } catch (e) {
      // 统一提示
    }
  }, [])

  const prevMonth = useCallback(() => {
    const d = new Date(dateRef.current.getFullYear(), dateRef.current.getMonth() - 1, 1)
    dateRef.current = d
    setDate(d)
    load()
  }, [load])

  const nextMonth = useCallback(() => {
    const d = new Date(dateRef.current.getFullYear(), dateRef.current.getMonth() + 1, 1)
    dateRef.current = d
    setDate(d)
    load()
  }, [load])

  const onDay = useCallback((d: DayCell) => {
    if (d.day) setSelectedDate(d.date)
  }, [])

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="p-4 bg-white">
        <View className="flex justify-center items-center gap-4">
          <Text className="text-xl text-[#007aff] px-2" onClick={prevMonth}>‹</Text>
          <Text className="text-base text-[#333] font-semibold">{currentMonth}</Text>
          <Text className="text-xl text-[#007aff] px-2" onClick={nextMonth}>›</Text>
        </View>
      </View>
      <View className="m-3 p-3 bg-white rounded-2xl">
        <View className="flex">
          {weekdays.map(w => (
            <Text key={w} className="flex-1 text-center text-xs text-[#999] py-2">{w}</Text>
          ))}
        </View>
        <View className="flex flex-wrap">
          {days.map((d, i) => (
            <View
              key={i}
              className={`w-[14.28%] h-[45px] flex flex-col items-center justify-center relative ${!d.day ? 'invisible' : ''}`}
              onClick={() => onDay(d)}
            >
              <Text className="text-sm text-[#333]">{d.day || ''}</Text>
              {d.has && <View className="w-1 h-1 bg-[#007aff] rounded-full mt-0.5" />}
            </View>
          ))}
        </View>
      </View>
      {selectedLives.length > 0 && (
        <View className="mx-3">
          <Text className="text-sm text-[#333] font-semibold mb-2 block">{selectedDate}的直播</Text>
          {selectedLives.map(l => (
            <View
              key={l.id}
              className="flex bg-white rounded-xl p-2 mb-2"
              onClick={() => goDetail(l.id)}
            >
              <Image className="w-[80px] h-[50px] rounded bg-[#f5f5f5]" src={l.coverUrl} mode="aspectFill" />
              <View className="ml-2 flex-1">
                <Text className="text-sm text-[#333]">{l.title}</Text>
                <Text className="block text-xs text-[#999] mt-1">{l.startTime}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
