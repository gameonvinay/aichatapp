// Complex Event Detection Service - Implements fraud prevention and pattern detection

const EventEmitter = require("events");

class EventDetection {
  constructor() {
    this.eventPatterns = new Map();
    this.detectionRules = new Map();
    this.fraudIndicators = new Map();
    this.eventHistory = [];
    this.eventEmitter = new EventEmitter();

    // Initialize default fraud detection patterns
    this.initializeDefaultPatterns();
  }

  /**
   * Initialize default fraud prevention patterns and rules
   */
  initializeDefaultPatterns() {
    // Pattern: Rapid succession of similar events (common in fraud)
    this.detectionRules.set("rapid_event_pattern", {
      name: "Rapid Event Pattern",
      description:
        "Detects rapid succession of similar events that may indicate fraud",
      conditions: {
        timeWindow: 30000, // 30 seconds
        eventCountThreshold: 5,
        eventType: "transaction",
      },
      severity: "high",
      enabled: true,
    });

    // Pattern: Unusual transaction amounts (outliers)
    this.detectionRules.set("unusual_amount_pattern", {
      name: "Unusual Transaction Amount",
      description:
        "Detects transactions with amounts that are statistically unusual",
      conditions: {
        thresholdMultiplier: 3, // 3 standard deviations from mean
        minTransactionCount: 10,
        eventType: "transaction",
      },
      severity: "medium",
      enabled: true,
    });

    // Pattern: Multiple failed attempts in short time (brute force)
    this.detectionRules.set("failed_attempts_pattern", {
      name: "Failed Authentication Attempts",
      description:
        "Detects multiple failed authentication attempts in a short time window",
      conditions: {
        timeWindow: 60000, // 1 minute
        failedCountThreshold: 3,
        eventType: "auth_failure",
      },
      severity: "high",
      enabled: true,
    });

    // Pattern: Geographic anomaly (sudden location change)
    this.detectionRules.set("geographic_anomaly_pattern", {
      name: "Geographic Anomaly",
      description:
        "Detects sudden location changes that may indicate fraudulent activity",
      conditions: {
        timeWindow: 300000, // 5 minutes
        distanceThresholdKm: 100,
        eventType: "location_change",
      },
      severity: "medium",
      enabled: true,
    });

    // Pattern: High volume of events (potential DDoS)
    this.detectionRules.set("high_volume_pattern", {
      name: "High Event Volume",
      description:
        "Detects unusually high volume of events that may indicate DDoS or abuse",
      conditions: {
        timeWindow: 60000, // 1 minute
        eventCountThreshold: 100,
        eventType: "generic",
      },
      severity: "high",
      enabled: true,
    });
  }

  /**
   * Register a new event pattern for detection
   */
  registerEventPattern(patternId, patternConfig) {
    this.eventPatterns.set(patternId, {
      id: patternId,
      config: patternConfig,
      createdAt: new Date().toISOString(),
      lastMatched: null,
    });

    return true;
  }

  /**
   * Add a new fraud detection rule
   */
  addDetectionRule(ruleId, ruleConfig) {
    this.detectionRules.set(ruleId, {
      ...ruleConfig,
      id: ruleId,
      createdAt: new Date().toISOString(),
      enabled: true,
    });

    return true;
  }

  /**
   * Update an existing detection rule
   */
  updateDetectionRule(ruleId, updatedConfig) {
    const rule = this.detectionRules.get(ruleId);

    if (!rule) {
      throw new Error(`Detection rule ${ruleId} not found`);
    }

    this.detectionRules.set(ruleId, {
      ...rule,
      ...updatedConfig,
      updatedAt: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Enable or disable a detection rule
   */
  setRuleEnabled(ruleId, enabled) {
    const rule = this.detectionRules.get(ruleId);

    if (!rule) {
      throw new Error(`Detection rule ${ruleId} not found`);
    }

    rule.enabled = enabled;

    return true;
  }

  /**
   * Process an event through the detection system
   */
  async processEvent(event) {
    const detectionResult = {
      eventId: event.id || Date.now().toString(),
      timestamp: new Date().toISOString(),
      eventType: event.type,
      source: event.source || "unknown",
      detectedPatterns: [],
      fraudIndicators: [],
      severity: "low",
      confidence: 0,
    };

    // Track event in history for pattern analysis
    this.eventHistory.push({
      ...event,
      timestamp: detectionResult.timestamp,
    });

    // Keep only last 1000 events to prevent memory issues
    if (this.eventHistory.length > 1000) {
      this.eventHistory.shift();
    }

    // Check all enabled detection rules
    for (const [ruleId, rule] of this.detectionRules.entries()) {
      if (!rule.enabled) continue;

      const patternMatch = await this.checkRule(event, rule);

      if (patternMatch) {
        detectionResult.detectedPatterns.push({
          patternId: ruleId,
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          matchDetails: patternMatch,
        });

        // Update overall severity and confidence based on this detection
        const severityScore = this.getSeverityScore(rule.severity);
        if (severityScore > this.getSeverityScore(detectionResult.severity)) {
          detectionResult.severity = rule.severity;
        }

        // Increase confidence based on severity and match details
        detectionResult.confidence = Math.min(
          100,
          detectionResult.confidence + severityScore * 20,
        );
      }
    }

    // Add any fraud indicators if detected
    const fraudIndicators = this.analyzeForFraudIndicators(event);
    detectionResult.fraudIndicators.push(...fraudIndicators);

    // Emit event for real-time monitoring
    this.eventEmitter.emit("eventDetected", detectionResult);

    return detectionResult;
  }

  /**
   * Check if an event matches a specific rule
   */
  async checkRule(event, rule) {
    switch (rule.id) {
      case "rapid_event_pattern":
        return this.checkRapidEventPattern(event, rule);

      case "unusual_amount_pattern":
        return this.checkUnusualAmountPattern(event, rule);

      case "failed_attempts_pattern":
        return this.checkFailedAttemptsPattern(event, rule);

      case "geographic_anomaly_pattern":
        return this.checkGeographicAnomalyPattern(event, rule);

      case "high_volume_pattern":
        return this.checkHighVolumePattern(event, rule);

      default:
        // For custom rules or unknown patterns
        return this.checkGenericPattern(event, rule);
    }
  }

  /**
   * Check for rapid succession of similar events
   */
  async checkRapidEventPattern(event, rule) {
    const { timeWindow, eventCountThreshold, eventType } = rule.conditions;

    if (event.type !== eventType) return null;

    const now = Date.now();
    let count = 0;

    // Count recent events of the same type within time window
    for (const historyEvent of this.eventHistory) {
      if (
        historyEvent.type === eventType &&
        now - new Date(historyEvent.timestamp).getTime() <= timeWindow
      ) {
        count++;
      }
    }

    if (count >= eventCountThreshold) {
      return {
        matchedEvents: count,
        timeWindowSeconds: timeWindow / 1000,
        threshold: eventCountThreshold,
      };
    }

    return null;
  }

  /**
   * Check for unusual transaction amounts (statistical outliers)
   */
  async checkUnusualAmountPattern(event, rule) {
    const { thresholdMultiplier, minTransactionCount, eventType } =
      rule.conditions;

    if (event.type !== eventType) return null;

    // For demonstration, we'll check if amount is unusually high
    const transactionAmount = event.amount || 0;

    // In a real implementation, this would calculate statistical outliers
    if (transactionAmount > 10000) {
      // Simple threshold for demo purposes
      return {
        amount: transactionAmount,
        thresholdMultiplier,
        isUnusual: true,
      };
    }

    return null;
  }

  /**
   * Check for failed authentication attempts in short time
   */
  async checkFailedAttemptsPattern(event, rule) {
    const { timeWindow, failedCountThreshold, eventType } = rule.conditions;

    if (event.type !== eventType) return null;

    const now = Date.now();
    let count = 0;

    // Count recent failed auth attempts
    for (const historyEvent of this.eventHistory) {
      if (
        historyEvent.type === eventType &&
        now - new Date(historyEvent.timestamp).getTime() <= timeWindow
      ) {
        count++;
      }
    }

    if (count >= failedCountThreshold) {
      return {
        failedAttempts: count,
        timeWindowSeconds: timeWindow / 1000,
        threshold: failedCountThreshold,
      };
    }

    return null;
  }

  /**
   * Check for geographic anomalies (sudden location changes)
   */
  async checkGeographicAnomalyPattern(event, rule) {
    const { timeWindow, distanceThresholdKm, eventType } = rule.conditions;

    if (event.type !== eventType) return null;

    // For demonstration, we'll check for location changes
    if (event.location && event.previousLocation) {
      const distance = this.calculateDistance(
        event.previousLocation,
        event.location,
      );

      if (distance > distanceThresholdKm) {
        return {
          previousLocation: event.previousLocation,
          currentLocation: event.location,
          distanceKm: distance,
          thresholdKm: distanceThresholdKm,
        };
      }
    }

    return null;
  }

  /**
   * Calculate distance between two geographic points (Haversine formula)
   */
  calculateDistance(location1, location2) {
    // Simplified for demonstration - in real implementation use proper geolocation libraries
    const lat1 = location1.lat || 0;
    const lon1 = location1.lon || 0;
    const lat2 = location2.lat || 0;
    const lon2 = location2.lon || 0;

    // Haversine formula
    const R = 6371; // Earth radius in km

    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check for high volume of events (potential DDoS)
   */
  async checkHighVolumePattern(event, rule) {
    const { timeWindow, eventCountThreshold, eventType } = rule.conditions;

    // For generic events (not specific to type)
    const now = Date.now();
    let count = 0;

    // Count recent events within time window
    for (const historyEvent of this.eventHistory) {
      if (now - new Date(historyEvent.timestamp).getTime() <= timeWindow) {
        count++;
      }
    }

    if (count >= eventCountThreshold) {
      return {
        totalEvents: count,
        timeWindowSeconds: timeWindow / 1000,
        threshold: eventCountThreshold,
      };
    }

    return null;
  }

  /**
   * Check generic pattern (fallback for custom rules)
   */
  async checkGenericPattern(event, rule) {
    // In a real implementation, this would use more sophisticated pattern matching
    return null;
  }

  /**
   * Analyze event for fraud indicators (more detailed analysis)
   */
  analyzeForFraudIndicators(event) {
    const indicators = [];

    // Check for suspicious patterns in event data
    if (event.amount && event.amount > 10000) {
      indicators.push({
        type: "high_amount",
        severity: "medium",
        description: `High transaction amount detected: ${event.amount}`,
        confidence: 0.7,
      });
    }

    if (event.ip && event.ip.includes("192.168")) {
      indicators.push({
        type: "private_ip",
        severity: "medium",
        description: `Private IP address detected: ${event.ip}`,
        confidence: 0.6,
      });
    }

    if (event.userAgent && event.userAgent.includes("bot")) {
      indicators.push({
        type: "bot_detection",
        severity: "low",
        description: `Bot user agent detected`,
        confidence: 0.4,
      });
    }

    return indicators;
  }

  /**
   * Get severity score for classification purposes
   */
  getSeverityScore(severity) {
    switch (severity.toLowerCase()) {
      case "low":
        return 1;
      case "medium":
        return 2;
      case "high":
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Get all registered detection rules
   */
  getAllDetectionRules() {
    return Array.from(this.detectionRules.entries()).map(([id, rule]) => ({
      id,
      ...rule,
    }));
  }

  /**
   * Get recent event detections for monitoring
   */
  getRecentDetections(limit = 50) {
    // In a real implementation, this would maintain a separate detection log
    return [];
  }

  /**
   * Get statistics about event detections
   */
  getDetectionStatistics() {
    return {
      totalEventsProcessed: this.eventHistory.length,
      detectionRulesCount: this.detectionRules.size,
      patternsRegistered: this.eventPatterns.size,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all fraud indicators for a specific event
   */
  getEventFraudIndicators(eventId) {
    // In a real implementation, this would look up indicators by event ID
    return [];
  }

  /**
   * Get detection rule details
   */
  getDetectionRule(ruleId) {
    return this.detectionRules.get(ruleId);
  }

  /**
   * Remove a detection rule
   */
  removeDetectionRule(ruleId) {
    return this.detectionRules.delete(ruleId);
  }

  /**
   * Get all detected patterns for a specific event type
   */
  getPatternsForEventType(eventType) {
    const patterns = [];

    for (const [ruleId, rule] of this.detectionRules.entries()) {
      if (rule.conditions.eventType === eventType) {
        patterns.push({
          id: ruleId,
          name: rule.name,
          description: rule.description,
        });
      }
    }

    return patterns;
  }

  /**
   * Get event detection history with filtering capabilities
   */
  getEventHistory(filters = {}) {
    let filteredEvents = this.eventHistory;

    // Apply filters if provided
    if (filters.type) {
      filteredEvents = filteredEvents.filter((e) => e.type === filters.type);
    }

    if (filters.source) {
      filteredEvents = filteredEvents.filter(
        (e) => e.source === filters.source,
      );
    }

    if (filters.startTime) {
      const startTime = new Date(filters.startTime).getTime();
      filteredEvents = filteredEvents.filter(
        (e) => new Date(e.timestamp).getTime() >= startTime,
      );
    }

    if (filters.endTime) {
      const endTime = new Date(filters.endTime).getTime();
      filteredEvents = filteredEvents.filter(
        (e) => new Date(e.timestamp).getTime() <= endTime,
      );
    }

    // Return limited results (default 100)
    const limit = filters.limit || 100;
    return filteredEvents.slice(-limit).reverse();
  }

  /**
   * Add event listener for detection events
   */
  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Remove event listener for detection events
   */
  off(event, callback) {
    this.eventEmitter.off(event, callback);
  }

  /**
   * Get real-time fraud detection dashboard data
   */
  getDashboardData() {
    return {
      statistics: this.getDetectionStatistics(),
      rules: this.getAllDetectionRules(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get top fraud indicators by frequency
   */
  getTopFraudIndicators(limit = 10) {
    const indicatorCounts = new Map();

    // In a real implementation, this would count actual fraud indicators
    return [];
  }

  /**
   * Get detection trends over time (for analytics)
   */
  getDetectionTrends(timeWindow = "1h") {
    // In a real implementation, this would analyze detection patterns over time
    return {
      period: timeWindow,
      totalDetections: 0,
      bySeverity: { low: 0, medium: 0, high: 0 },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get recent fraud alerts (high severity detections)
   */
  getRecentFraudAlerts(limit = 20) {
    // In a real implementation, this would return actual fraud alerts
    return [];
  }

  /**
   * Get detection rule performance metrics
   */
  getRulePerformanceMetrics() {
    // In a real implementation, this would track rule effectiveness
    return {};
  }

  /**
   * Reset detection statistics (for testing or maintenance)
   */
  resetStatistics() {
    this.eventHistory = [];

    return true;
  }
}

// Export singleton instance
module.exports = new EventDetection();
