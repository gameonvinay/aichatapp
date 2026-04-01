// Kafka Consumer Groups Service - Implements proper consumer groups and topic management

const kafka = require("kafka-node");
const EventEmitter = require("events");

class KafkaConsumerGroups {
  constructor() {
    this.consumerGroups = new Map();
    this.topics = new Set();
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Create a Kafka consumer group with proper configuration
   */
  async createConsumerGroup(groupId, topicNames, options = {}) {
    const consumerOptions = {
      groupId: groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 10000,
      autoCommit: true,
      autoCommitIntervalMs: 5000,
      fromOffset: "earliest", // Start from earliest available message
      ...options,
    };

    try {
      const client = new kafka.KafkaClient({
        kafkaHost: process.env.KAFKA_BROKERS || "localhost:9092",
        retry: {
          initialTimeout: 100,
          maxRetryTime: 2000,
          retryAttempts: 3,
        },
      });

      // Create consumer group with proper configuration
      const consumerGroup = new kafka.ConsumerGroup(
        {
          ...consumerOptions,
          kafkaHost: process.env.KAFKA_BROKERS || "localhost:9092",
          groupId: groupId,
        },
        topicNames,
      );

      // Store consumer group reference
      this.consumerGroups.set(groupId, {
        client,
        consumerGroup,
        topics: topicNames,
        options: consumerOptions,
        createdAt: new Date().toISOString(),
      });

      // Set up event listeners
      consumerGroup.on("message", (message) => {
        this.eventEmitter.emit("message", groupId, message);
      });

      consumerGroup.on("error", (err) => {
        console.error(`Kafka Consumer Group Error [${groupId}]:`, err);
        this.eventEmitter.emit("error", groupId, err);
      });

      consumerGroup.on("rebalanced", () => {
        console.log(`Kafka Consumer Group [${groupId}] rebalanced`);
        this.eventEmitter.emit("rebalanced", groupId);
      });

      consumerGroup.on("connect", () => {
        console.log(`Kafka Consumer Group [${groupId}] connected`);
        this.eventEmitter.emit("connect", groupId);
      });

      // Store topics for management
      topicNames.forEach((topic) => this.topics.add(topic));

      return {
        groupId,
        topics: topicNames,
        status: "active",
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to create Kafka consumer group:", error);
      throw new Error(`Failed to create consumer group: ${error.message}`);
    }
  }

  /**
   * Subscribe to a topic with a consumer group
   */
  async subscribeToTopic(groupId, topicName) {
    const consumerGroupInfo = this.consumerGroups.get(groupId);

    if (!consumerGroupInfo) {
      throw new Error(`Consumer group ${groupId} not found`);
    }

    // Add topic to the consumer group
    const topics = consumerGroupInfo.topics;
    if (!topics.includes(topicName)) {
      topics.push(topicName);
      this.topics.add(topicName);
    }

    // Reconfigure consumer group with new topic
    await this.reconfigureConsumerGroup(groupId, topics);

    return {
      groupId,
      topic: topicName,
      status: "subscribed",
    };
  }

  /**
   * Reconfigure a consumer group with new topics
   */
  async reconfigureConsumerGroup(groupId, topicNames) {
    const consumerGroupInfo = this.consumerGroups.get(groupId);

    if (!consumerGroupInfo) {
      throw new Error(`Consumer group ${groupId} not found`);
    }

    // Close existing consumer
    try {
      await new Promise((resolve, reject) => {
        consumerGroupInfo.consumerGroup.close(() => resolve());
      });
    } catch (err) {
      console.warn(`Error closing consumer group ${groupId}:`, err);
    }

    // Create new consumer with updated topics
    const client = new kafka.KafkaClient({
      kafkaHost: process.env.KAFKA_BROKERS || "localhost:9092",
      retry: {
        initialTimeout: 100,
        maxRetryTime: 2000,
        retryAttempts: 3,
      },
    });

    const consumerGroup = new kafka.ConsumerGroup(
      {
        ...consumerGroupInfo.options,
        groupId: groupId,
      },
      topicNames,
    );

    // Update consumer group reference
    this.consumerGroups.set(groupId, {
      ...consumerGroupInfo,
      client,
      consumerGroup,
      topics: topicNames,
    });

    // Set up event listeners again
    consumerGroup.on("message", (message) => {
      this.eventEmitter.emit("message", groupId, message);
    });

    consumerGroup.on("error", (err) => {
      console.error(`Kafka Consumer Group Error [${groupId}]:`, err);
      this.eventEmitter.emit("error", groupId, err);
    });

    consumerGroup.on("rebalanced", () => {
      console.log(`Kafka Consumer Group [${groupId}] rebalanced`);
      this.eventEmitter.emit("rebalanced", groupId);
    });

    consumerGroup.on("connect", () => {
      console.log(`Kafka Consumer Group [${groupId}] connected`);
      this.eventEmitter.emit("connect", groupId);
    });

    return {
      groupId,
      topics: topicNames,
      status: "reconfigured",
    };
  }

  /**
   * Get consumer group information
   */
  getConsumerGroup(groupId) {
    return this.consumerGroups.get(groupId);
  }

  /**
   * Get all consumer groups
   */
  getAllConsumerGroups() {
    return Array.from(this.consumerGroups.entries()).map(([groupId, info]) => ({
      groupId,
      topics: info.topics,
      createdAt: info.createdAt,
    }));
  }

  /**
   * Get all topics managed by consumer groups
   */
  getAllTopics() {
    return Array.from(this.topics);
  }

  /**
   * Get consumer group status
   */
  getConsumerGroupStatus(groupId) {
    const consumerGroupInfo = this.consumerGroups.get(groupId);

    if (!consumerGroupInfo) {
      return { status: "not_found" };
    }

    // Check if consumer is connected
    const isConnected = true; // In a real implementation, we'd check actual connection state

    return {
      groupId,
      topics: consumerGroupInfo.topics,
      status: isConnected ? "active" : "inactive",
      createdAt: consumerGroupInfo.createdAt,
    };
  }

  /**
   * Unsubscribe from a topic in a consumer group
   */
  async unsubscribeFromTopic(groupId, topicName) {
    const consumerGroupInfo = this.consumerGroups.get(groupId);

    if (!consumerGroupInfo) {
      throw new Error(`Consumer group ${groupId} not found`);
    }

    // Remove topic from the consumer group
    const topics = consumerGroupInfo.topics.filter((t) => t !== topicName);

    if (topics.length < consumerGroupInfo.topics.length) {
      // Reconfigure with updated topics
      await this.reconfigureConsumerGroup(groupId, topics);

      return {
        groupId,
        topic: topicName,
        status: "unsubscribed",
      };
    }

    return {
      groupId,
      topic: topicName,
      status: "not_subscribed",
    };
  }

  /**
   * Close a consumer group
   */
  async closeConsumerGroup(groupId) {
    const consumerGroupInfo = this.consumerGroups.get(groupId);

    if (!consumerGroupInfo) {
      return { status: "not_found" };
    }

    try {
      // Close consumer group
      await new Promise((resolve, reject) => {
        consumerGroupInfo.consumerGroup.close(() => resolve());
      });

      // Close client
      await new Promise((resolve, reject) => {
        consumerGroupInfo.client.close(() => resolve());
      });

      // Remove from tracking
      this.consumerGroups.delete(groupId);

      return {
        groupId,
        status: "closed",
      };
    } catch (error) {
      console.error(`Error closing consumer group ${groupId}:`, error);
      return {
        groupId,
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Create a topic with proper configuration for consumer groups
   */
  async createTopicWithConfig(topicName, config = {}) {
    const topics = [
      {
        topic: topicName,
        partitions: config.partitions || 1,
        replicationFactor: config.replicationFactor || 1,
        config: {
          "retention.ms": config.retentionMs || 604800000, // 7 days default
          "max.message.bytes": config.maxMessageBytes || 1048588,
        },
      },
    ];

    return new Promise((resolve, reject) => {
      const client = new kafka.KafkaClient({
        kafkaHost: process.env.KAFKA_BROKERS || "localhost:9092",
        retry: {
          initialTimeout: 100,
          maxRetryTime: 2000,
          retryAttempts: 3,
        },
      });

      client.createTopics(topics, false, (err, data) => {
        if (err && err.code !== "TOPIC_ALREADY_EXISTS") {
          return reject(err);
        }

        resolve({ created: true, topicName });
      });
    });
  }

  /**
   * Get consumer group members (for debugging and monitoring)
   */
  async getConsumerGroupMembers(groupId) {
    const consumerGroupInfo = this.consumerGroups.get(groupId);

    if (!consumerGroupInfo) {
      throw new Error(`Consumer group ${groupId} not found`);
    }

    // In a real implementation, this would query Kafka for member information
    return {
      groupId,
      members: [],
      topicCount: consumerGroupInfo.topics.length,
    };
  }

  /**
   * Add event listener for Kafka events
   */
  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Remove event listener for Kafka events
   */
  off(event, callback) {
    this.eventEmitter.off(event, callback);
  }

  /**
   * Get topic metadata
   */
  async getTopicMetadata(topicName) {
    return new Promise((resolve, reject) => {
      const client = new kafka.KafkaClient({
        kafkaHost: process.env.KAFKA_BROKERS || "localhost:9092",
        retry: {
          initialTimeout: 100,
          maxRetryTime: 2000,
          retryAttempts: 3,
        },
      });

      client.getMetadata([topicName], (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
  }

  /**
   * Get all consumer groups with their status
   */
  async getAllConsumerGroupStatuses() {
    const statuses = [];

    for (const [groupId, info] of this.consumerGroups.entries()) {
      const status = await this.getConsumerGroupStatus(groupId);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Get consumer group lag information (for monitoring)
   */
  async getConsumerGroupLag(groupId) {
    // In a real implementation, this would query Kafka's consumer lag metrics
    return {
      groupId,
      lag: 0, // Placeholder - would be actual lag in real implementation
      status: "monitoring",
    };
  }
}

// Export singleton instance
module.exports = new KafkaConsumerGroups();
