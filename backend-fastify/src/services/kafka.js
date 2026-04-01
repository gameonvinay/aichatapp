// Kafka service for event streaming between agents

const kafka = require('kafka-node');
require('dotenv').config();

/**
 * Create Kafka producer and consumer clients
 */
function createKafkaClients() {
  const brokers = process.env.KAFKA_BROKERS || 'localhost:9092';
  
  // Create Kafka client for producer and consumer
  const client = new kafka.KafkaClient({
    kafkaHost: brokers,
    retry: {
      initialTimeout: 100,
      maxRetryTime: 2000,
      retryAttempts: 3
    }
  });

  // Create producer for publishing events
  const producer = new kafka.Producer(client);

  return { client, producer };
}

/**
 * Initialize Kafka clients and wait for connection
 */
async function initializeKafka() {
  const { client, producer } = createKafkaClients();
  
  return new Promise((resolve, reject) => {
    client.once('ready', () => {
      console.log('Kafka clients initialized successfully');
      
      // Store clients globally for later use
      kafkaService.client = client;
      kafkaService.producer = producer;
      
      // Set up error handlers
      client.on('error', (err) => {
        console.error('Kafka client error:', err);
      });

      producer.on('error', (err) => {
        console.error('Kafka producer error:', err);
      });

      resolve();
    });

    client.once('BrokerInfoUpdated', () => {
      // Trigger controller selection
      client.getMetadata([], (err, data) => {});
    });

    setTimeout(() => reject(new Error('Kafka initialization timeout')), 10000);
  });
}

/**
 * Create a topic if it doesn't exist
 */
async function createTopic(topicName) {
  const topics = [{ topic: topicName, partitions: 1 }];
  
  return new Promise((resolve, reject) => {
    kafkaService.client.createTopics(topics, false, (err, data) => {
      if (err && err.code !== 'TOPIC_ALREADY_EXISTS') {
        return reject(err);
      }
      resolve({ created: true, topicName });
    });
  });
}

/**
 * Publish an event to a Kafka topic
 */
async function publishEvent(topicName, event, partitionKey = null) {
  // Auto-create topic if needed
  await createTopic(topicName);

  const messages = [{
    topic: topicName,
    messages: [JSON.stringify(event)],
    key: partitionKey || null
  }];

  return new Promise((resolve, reject) => {
    kafkaService.producer.send(messages, (error, data) => {
      if (error) return reject(error);
      resolve({ published: true, topicName });
    });
  });
}

/**
 * Create a consumer for subscribing to Kafka topics
 */
function createConsumer(topics) {
  const { client } = kafkaService;
  
  let consumer = null;

  if (topics.length > 1) {
    // Multiple topics - use MultiConsumer
    consumer = new kafka.MultiConsumer(client, {});
  } else {
    // Single topic - use Consumer
    consumer = new kafka.Consumer(client, topics);
  }

  return consumer;
}

/**
 * Subscribe to a Kafka topic and receive events
 */
function subscribeToTopic(topicName, onEvent) {
  const topics = [{ topic: topicName }];
  
  try {
    consumer = createConsumer(topics);

    // Handle incoming messages
    consumer.on('message', (message) => {
      try {
        const parsedMessage = JSON.parse(message.value);
        onEvent(parsedMessage, message);
      } catch (err) {
        console.error('Failed to parse event:', err);
      }
    });

    // Handle connection errors
    consumer.on('error', (err) => {
      console.error(`Kafka consumer error on topic ${topicName}:`, err);
    });

    // Handle broker updates (important for ZooKeeper-based Kafka)
    if (consumer.zookeeper) {
      consumer.on('BrokerInfoUpdated', () => {
        console.log('Kafka broker info updated');
        
        // Trigger controller selection to get all available brokers
        kafkaService.client.getMetadata([], (err, data) => {});
      });
    }

    return () => {
      consumer.close();
    };
  } catch (err) {
    console.error('Failed to subscribe to topic:', err);
    return () => {};
  }
}

/**
 * Subscribe to multiple topics and receive events
 */
function subscribeToTopics(topicNames, onEvent) {
  const topics = topicNames.map(name => ({ topic: name }));

  try {
    consumer = createConsumer(topics);

    // Handle incoming messages
    consumer.on('message', (message) => {
      try {
        const parsedMessage = JSON.parse(message.value);
        onEvent(parsedMessage, message);
      } catch (err) {
        console.error('Failed to parse event:', err);
      }
    });

    // Handle connection errors
    consumer.on('error', (err) => {
      console.error(`Kafka consumer error on topics ${topicNames}:`, err);
    });

    // Handle broker updates (important for ZooKeeper-based Kafka)
    if (consumer.zookeeper) {
      consumer.on('BrokerInfoUpdated', () => {
        console.log('Kafka broker info updated');
        
        // Trigger controller selection to get all available brokers
        kafkaService.client.getMetadata([], (err, data) => {});
      });
    }

    return () => {
      consumer.close();
    };
  } catch (err) {
    console.error('Failed to subscribe to topics:', err);
    return () => {};
  }
}

/**
 * Get consumer for a topic (for advanced usage)
 */
function getConsumer(topicName) {
  const topics = [{ topic: topicName }];
  
  try {
    consumer = createConsumer(topics);

    // Handle connection errors
    consumer.on('error', (err) => {
      console.error(`Kafka consumer error on topic ${topicName}:`, err);
    });

    return () => {
      consumer.close();
    };
  } catch (err) {
    console.error('Failed to get consumer:', err);
    return () => {};
  }
}

/**
 * Close all Kafka connections gracefully
 */
async function closeConnections() {
  if (kafkaService.client) await kafkaService.client.close();
}

// Global service object with lazy initialization
const kafkaService = {
  client: null,
  producer: null,
  consumer: null
};

// Export all functions and service object
module.exports = {
  ...kafkaService,
  initializeKafka,
  createTopic,
  publishEvent,
  subscribeToTopic,
  subscribeToTopics,
  getConsumer,
  closeConnections
};

// Initialize Kafka when module is loaded (development)
if (process.env.NODE_ENV !== 'production') {
  initializeKafka().catch(err => {
    console.error('Failed to initialize Kafka:', err);
  });
}