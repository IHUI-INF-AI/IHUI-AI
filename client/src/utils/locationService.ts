import { logger } from './logger'

const LOGIN_LOCATIONS_KEY = 'login_locations'
const SUSPICIOUS_THRESHOLD = 500

export interface LoginLocation {
  ip: string
  country?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  loginTime: number
  deviceName?: string
}

interface LocationCheckResult {
  isSuspicious: boolean
  reason?: string
  distance?: number
  lastLocation?: LoginLocation
}

function calculateDistance(
  lat1: number | undefined,
  lon1: number | undefined,
  lat2: number | undefined,
  lon2: number | undefined
): number {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 0
  }

  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export const LocationService = {
  getLoginLocations(): LoginLocation[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(LOGIN_LOCATIONS_KEY)
    if (!stored) return []
    try {
      return JSON.parse(stored) as LoginLocation[]
    } catch {
      return []
    }
  },

  saveLoginLocation(location: LoginLocation): void {
    if (typeof window === 'undefined') return

    const locations = this.getLoginLocations()
    locations.unshift(location)

    const uniqueLocations = locations.filter(
      (loc: LoginLocation, index: number, self: LoginLocation[]) =>
        index === self.findIndex((l: LoginLocation) => l.ip === loc.ip)
    )

    const trimmedLocations = uniqueLocations.slice(0, 10)
    localStorage.setItem(LOGIN_LOCATIONS_KEY, JSON.stringify(trimmedLocations))
    logger.info('[LocationService] Login location saved', { ip: location.ip, city: location.city })
  },

  checkSuspiciousLogin(currentLocation: Partial<LoginLocation>): LocationCheckResult {
    const locations = this.getLoginLocations()

    if (locations.length === 0) {
      return { isSuspicious: false }
    }

    const lastLocation = locations[0]

    if (lastLocation.ip === currentLocation.ip) {
      return { isSuspicious: false, lastLocation }
    }

    const distance = calculateDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    )

    if (distance > SUSPICIOUS_THRESHOLD) {
      const reason = `[LocationService] Remote login detected：距离上次登录位置 ${distance.toFixed(0)} 公里`
      logger.warn('[LocationService] Suspicious login detected', {
        distance,
        lastCity: lastLocation.city,
        currentCity: currentLocation.city,
      })
      return { isSuspicious: true, reason, distance, lastLocation }
    }

    const timeDiff = Date.now() - lastLocation.loginTime
    const hoursDiff = timeDiff / (1000 * 60 * 60)

    if (hoursDiff < 1 && distance > 100) {
      const reason = `Rapid remote login：${hoursDiff.toFixed(1)} 小时内移动 ${distance.toFixed(0)} 公里`
      return { isSuspicious: true, reason, distance, lastLocation }
    }

    return { isSuspicious: false, distance, lastLocation }
  },

  clearLocations(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(LOGIN_LOCATIONS_KEY)
    logger.info('[LocationService] Login locations cleared')
  },

  async fetchCurrentLocation(): Promise<Partial<LoginLocation>> {
    try {
      const response = await fetch('https://ipapi.co/json/', {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch location')
      }

      const data = await response.json()
      return {
        ip: data.ip,
        country: data.country_name,
        region: data.region,
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
        loginTime: Date.now(),
      }
    } catch (error) {
      logger.warn('[LocationService] Failed to fetch location info', error)
      return {
        ip: 'unknown',
        loginTime: Date.now(),
      }
    }
  },
}
