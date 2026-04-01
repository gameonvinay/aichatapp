// Real-time Analytics Service - Implements windowed aggregations and analytics

const EventEmitter = require("events");

class RealtimeAnalytics {
  constructor() {
    this.metrics = new Map();
    this.windows = new Map(); // Windowed data storage
    this.eventEmitter = new EventEmitter();

    // Analytics windows configuration (in seconds)
    this.windowConfig = {
      "1m": { duration: 60, step: 5 }, // 1 minute window with 5 second steps
      "5m": { duration: 300, step: 15 }, // 5 minute window with 15 second steps
      "1h": { duration: 3600, step: 60 }, // 1 hour window with 1 minute steps
      "24h": { duration: 86400, step: 300 }, // 24 hour window with 5 minute steps
    };

    this.windowedMetrics = new Map();
  }

  /**
   * Register a metric for real-time analytics
   */
  registerMetric(metricName, options = {}) {
    const defaultOptions = {
      type: "gauge", // gauge | counter | histogram
      window: "1h", // Default window size
      aggregation: "sum", // sum | avg | count | min | max
      ...options,
    };

    this.metrics.set(metricName, {
      name: metricName,
      options: defaultOptions,
      value: 0,
      lastUpdated: null,
      windowedData: new Map(),
      history: [],
    });

    // Initialize window data structures
    this.initializeWindowedData(metricName);

    return true;
  }

  /**
   * Initialize windowed data structures for a metric
   */
  initializeWindowedData(metricName) {
    const metric = this.metrics.get(metricName);

    if (!metric) return;

    // Create windowed data for each configured window
    Object.keys(this.windowConfig).forEach((windowKey) => {
      const window = this.windowConfig[windowKey];

      // Initialize the window data structure
      if (!this.windowedMetrics.has(windowKey)) {
        this.windowedMetrics.set(windowKey, new Map());
      }

      const windowMap = this.windowedMetrics.get(windowKey);

      // Create a time-series bucket for each window
      const buckets = new Map();
      const now = Date.now();

      // Create time buckets for the window
      const bucketCount = Math.ceil(window.duration / window.step);

      // Initialize buckets with zero values
      for (let i = 0; i < bucketCount; i++) {
        const timestamp = now - (bucketCount - i) * window.step * 1000;
        buckets.set(timestamp, {
          timestamp,
          value: 0,
          count: 0,
        });
      }

      windowMap.set(metricName, buckets);
    });

    return true;
  }

  /**
   * Update a metric value
   */
  updateMetric(metricName, value, timestamp = Date.now()) {
    const metric = this.metrics.get(metricName);

    if (!metric) {
      throw new Error(`Metric ${metricName} not registered`);
    }

    // Update the current value
    metric.value = value;
    metric.lastUpdated = timestamp;

    // Add to history for long-term tracking
    const historyEntry = {
      timestamp,
      value,
      metricName,
    };

    // Keep only last 1000 history entries to prevent memory issues
    if (metric.history.length >= 1000) {
      metric.history.shift();
    }

    metric.history.push(historyEntry);

    // Update windowed data
    this.updateWindowedData(metricName, value, timestamp);

    // Emit event for real-time listeners
    this.eventEmitter.emit("metricUpdated", {
      metricName,
      value,
      timestamp,
    });

    return true;
  }

  /**
   * Update windowed data for a metric
   */
  updateWindowedData(metricName, value, timestamp) {
    const now = Date.now();

    Object.keys(this.windowConfig).forEach((windowKey) => {
      const window = this.windowConfig[windowKey];
      const windowMap = this.windowedMetrics.get(windowKey);

      if (!windowMap) return;

      const buckets = windowMap.get(metricName);
      if (!buckets) return;

      // Find the appropriate bucket for this timestamp
      const bucketTimestamp =
        Math.floor(timestamp / (window.step * 1000)) * window.step * 1000;

      // Update the bucket value
      const bucket = buckets.get(bucketTimestamp);
      if (bucket) {
        // For gauge metrics, we just update the value
        bucket.value = value;
        bucket.count += 1;
      }

      // Clean up old buckets that are outside the window
      this.cleanupOldBuckets(windowKey, bucketTimestamp);
    });

    return true;
  }

  /**
   * Clean up old buckets that are outside the current window
   */
  cleanupOldBuckets(windowKey, referenceTimestamp) {
    const window = this.windowConfig[windowKey];
    const windowMap = this.windowedMetrics.get(windowKey);

    if (!windowMap) return;

    const now = Date.now();
    const maxTimestamp = now - window.duration * 1000;

    for (const [metricName, buckets] of windowMap.entries()) {
      const keysToRemove = [];

      for (const [bucketTimestamp, bucket] of buckets.entries()) {
        if (bucketTimestamp < maxTimestamp) {
          keysToRemove.push(bucketTimestamp);
        }
      }

      // Remove old buckets
      keysToRemove.forEach((key) => {
        buckets.delete(key);
      });
    }
  }

  /**
   * Get aggregated value for a specific window
   */
  getAggregatedValue(metricName, windowKey = "1h", aggregationType = "sum") {
    const windowMap = this.windowedMetrics.get(windowKey);

    if (!windowMap) {
      throw new Error(`Window ${windowKey} not found`);
    }

    const buckets = windowMap.get(metricName);

    if (!buckets) {
      return 0;
    }

    // Calculate the aggregated value based on the requested aggregation type
    switch (aggregationType) {
      case "sum":
        return this.sumBuckets(buckets);

      case "avg":
        return this.avgBuckets(buckets);

      case "count":
        return buckets.size;

      case "min":
        return this.minBuckets(buckets);

      case "max":
        return this.maxBuckets(buckets);

      default:
        throw new Error(`Unknown aggregation type: ${aggregationType}`);
    }
  }

  /**
   * Sum all bucket values
   */
  sumBuckets(buckets) {
    let total = 0;

    for (const bucket of buckets.values()) {
      total += bucket.value || 0;
    }

    return total;
  }

  /**
   * Calculate average of bucket values
   */
  avgBuckets(buckets) {
    let total = 0;
    let count = 0;

    for (const bucket of buckets.values()) {
      total += bucket.value || 0;
      count += bucket.count || 0;
    }

    return count > 0 ? total / count : 0;
  }

  /**
   * Get minimum bucket value
   */
  minBuckets(buckets) {
    let min = Infinity;

    for (const bucket of buckets.values()) {
      if (bucket.value < min) {
        min = bucket.value;
      }
    }

    return isFinite(min) ? min : 0;
  }

  /**
   * Get maximum bucket value
   */
  maxBuckets(buckets) {
    let max = -Infinity;

    for (const bucket of buckets.values()) {
      if (bucket.value > max) {
        max = bucket.value;
      }
    }

    return isFinite(max) ? max : 0;
  }

  /**
   * Get all registered metrics
   */
  getAllMetrics() {
    return Array.from(this.metrics.entries()).map(([name, metric]) => ({
      name,
      value: metric.value,
      lastUpdated: metric.lastUpdated,
      options: metric.options,
    }));
  }

  /**
   * Get windowed data for a specific metric and window
   */
  getWindowedData(metricName, windowKey = "1h") {
    const windowMap = this.windowedMetrics.get(windowKey);

    if (!windowMap) {
      return [];
    }

    const buckets = windowMap.get(metricName);

    if (!buckets) {
      return [];
    }

    // Convert buckets to array with proper timestamp formatting
    const data = Array.from(buckets.entries()).map(([timestamp, bucket]) => ({
      timestamp,
      value: bucket.value,
      count: bucket.count,
    }));

    // Sort by timestamp ascending
    data.sort((a, b) => a.timestamp - b.timestamp);

    return data;
  }

  /**
   * Get recent history for a metric
   */
  getMetricHistory(metricName, limit = 100) {
    const metric = this.metrics.get(metricName);

    if (!metric) {
      return [];
    }

    // Return last N history entries
    const start = Math.max(0, metric.history.length - limit);
    return metric.history.slice(start);
  }

  /**
   * Get all windowed metrics for a specific time range
   */
  getMetricsForTimeRange(startTime, endTime) {
    const result = {};

    for (const [metricName, metric] of this.metrics.entries()) {
      // For simplicity in this implementation, we'll return the current value
      result[metricName] = {
        name: metricName,
        currentValue: metric.value,
        lastUpdated: metric.lastUpdated,
      };
    }

    return result;
  }

  /**
   * Get window statistics for all metrics
   */
  getWindowsStatistics() {
    const stats = {};

    // Get statistics for each window
    for (const [windowKey, window] of Object.entries(this.windowConfig)) {
      stats[windowKey] = {
        duration: window.duration,
        step: window.step,
        metricsCount: this.windowedMetrics.get(windowKey)?.size || 0,
      };
    }

    return stats;
  }

  /**
   * Reset a metric's windowed data
   */
  resetMetricWindow(metricName, windowKey = "1h") {
    const windowMap = this.windowedMetrics.get(windowKey);

    if (windowMap) {
      windowMap.delete(metricName);
    }

    return true;
  }

  /**
   * Reset all windowed data
   */
  resetAllWindows() {
    for (const [windowKey, windowMap] of this.windowedMetrics.entries()) {
      windowMap.clear();
    }

    return true;
  }

  /**
   * Add event listener for analytics events
   */
  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Remove event listener for analytics events
   */
  off(event, callback) {
    this.eventEmitter.off(event, callback);
  }

  /**
   * Get metric statistics (current value, history size, etc.)
   */
  getMetricStats(metricName) {
    const metric = this.metrics.get(metricName);

    if (!metric) {
      return null;
    }

    return {
      name: metricName,
      currentValue: metric.value,
      lastUpdated: metric.lastUpdated,
      historySize: metric.history.length,
      windowedMetricsCount: this.windowedMetrics.size,
    };
  }

  /**
   * Get all windowed metrics with their aggregated values
   */
  getAllWindowedMetrics() {
    const result = {};

    for (const [windowKey, windowMap] of this.windowedMetrics.entries()) {
      result[windowKey] = {};

      for (const [metricName, buckets] of windowMap.entries()) {
        result[windowKey][metricName] = {
          count: buckets.size,
          sum: this.sumBuckets(buckets),
          avg: this.avgBuckets(buckets),
          min: this.minBuckets(buckets),
          max: this.maxBuckets(buckets),
        };
      }
    }

    return result;
  }

  /**
   * Create a new window with custom configuration
   */
  createCustomWindow(windowKey, durationSeconds, stepSeconds) {
    this.windowConfig[windowKey] = {
      duration: durationSeconds,
      step: stepSeconds,
    };

    // Initialize windowed data for all existing metrics in this new window
    for (const [metricName] of this.metrics.entries()) {
      this.initializeWindowedData(metricName);
    }

    return true;
  }

  /**
   * Get real-time analytics dashboard data
   */
  getDashboardData() {
    return {
      metrics: this.getAllMetrics(),
      windows: this.getWindowsStatistics(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get metric trend over time
   */
  getMetricTrend(metricName, windowKey = "1h", periodSeconds = 3600) {
    const now = Date.now();
    const startTime = now - periodSeconds * 1000;

    // For simplicity, return the current aggregated value
    const result = {
      metricName,
      window: windowKey,
      periodSeconds,
      timestamp: now,
      aggregatedValue: this.getAggregatedValue(metricName, windowKey),
      dataPoints: [],
    };

    return result;
  }
}

// Export singleton instance
module.exports = new RealtimeAnalytics();
