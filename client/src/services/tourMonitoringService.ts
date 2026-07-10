export interface AnomalyDetection {
  id: string
  metric: string
  threshold: number
  currentValue: number
  detectedAt: string
  type: string
  severity: string
  value: number
  expectedValue: number
  acknowledged: boolean
  [key: string]: unknown
}

export interface PerformanceSnapshot {
  tour: {
    activeCount: number
    completionRate: number
    errorRate: number
    [key: string]: unknown
  }
  memory: {
    percentage: number
    [key: string]: unknown
  }
  cpu: {
    usage: number
    [key: string]: unknown
  }
  render: {
    fps: number
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface MetricDataPoint {
  timestamp: number
  value: number
}

export interface MetricSeries {
  name: string
  data: MetricDataPoint[]
}

class TourMonitoringService {
  private anomalies: AnomalyDetection[] = []
  private monitoring = false

  detectAnomaly(metric: string, value: number): AnomalyDetection | null {
    return null
  }

  getAnomalies(): AnomalyDetection[] {
    return this.anomalies
  }

  clearAnomalies(): void {
    this.anomalies = []
  }

  getPerformanceSnapshot(): PerformanceSnapshot {
    return {
      tour: { activeCount: 0, completionRate: 0, errorRate: 0 },
      memory: { percentage: 0 },
      cpu: { usage: 0 },
      render: { fps: 60 },
    }
  }

  getMetricSeries(metric: string, _duration?: number): MetricSeries[] {
    return [
      {
        name: metric,
        data: [],
      },
    ]
  }

  acknowledgeAnomaly(id: string): void {
    const anomaly = this.anomalies.find(a => a.id === id)
    if (anomaly) {
      anomaly.acknowledged = true
    }
  }

  startMonitoring(): void {
    this.monitoring = true
  }

  stopMonitoring(): void {
    this.monitoring = false
  }
}

export const tourMonitoringService = new TourMonitoringService()
export default tourMonitoringService
