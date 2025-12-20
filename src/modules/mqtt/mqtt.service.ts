import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as mqtt from 'mqtt';
import { ConfigService } from '../../shared/services/config.service';
import { DeviceService } from '../device/device.service';
import { DeviceStatus, DeviceType } from 'src/shared/enums/device.enum';

interface SensorData {
  value: number;
  timestamp: number;
  deviceId: string;
  sensorType: string;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;
  private readonly brokerUrl: string;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private deviceState = {
    light: new Map<string, 'on' | 'off'>(),
    door: new Map<string, 'open' | 'closed'>(),
  };

  constructor(
    private configService: ConfigService,
    private deviceService: DeviceService,
  ) {
    this.brokerUrl =
      this.configService.get('MQTT_BROKER_URL') ||
      'mqtt://test.mosquitto.org:1883';
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    // const username = this.configService.get('MQTT_USERNAME');
    // const password = this.configService.get('MQTT_PASSWORD');

    const connectOptions: mqtt.IClientOptions = {
      clientId: `backend-${Date.now()}`,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
    };

    // Thêm authentication nếu có
    // if (username && password) {
    //   connectOptions.username = username;
    //   connectOptions.password = password;
    //   this.logger.log(`🔐 Using MQTT authentication with username: ${username}`);
    // } else {
    //   this.logger.warn('⚠️ MQTT_USERNAME or MQTT_PASSWORD not set, connecting without authentication');
    // }

    this.client = mqtt.connect(this.brokerUrl, connectOptions);

    this.client.on('connect', () => {
      this.logger.log(`✅ Connected to MQTT broker at ${this.brokerUrl}`);
      this.subscribeToTopics();
    });

    this.client.on('error', (error) => {
      this.logger.error('❌ MQTT connection error:', error);
      this.logger.error(`   Broker URL: ${this.brokerUrl}`);
      // this.logger.error(`   Username: ${username || 'not set'}`);
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });

    this.client.on('reconnect', () => {
      this.logger.warn('🔄 Reconnecting to MQTT broker...');
    });

    this.client.on('close', () => {
      this.logger.warn('⚠️ MQTT connection closed');
    });

    this.client.on('offline', () => {
      this.logger.warn('📴 MQTT client went offline');
    });
  }

  private subscribeToTopics() {
    // Subscribe to sensor data: devices/{deviceId}/sensor/{sensorType}
    // this.client.subscribe('devices/+/sensor/+', { qos: 1 }, (err) => {
    //   if (err) {
    //     this.logger.error(`❌ Failed to subscribe to sensor topics: ${err.message}`);
    //   } else {
    //     this.logger.log('✅ Subscribed to sensor topics: devices/+/sensor/+');
    //   }
    // });
    // this.client.subscribe('room/living/status', { qos: 1 }, (err) => {
    //   if (err) {
    //     this.logger.error(`❌ Failed to subscribe to sensor topics: ${err.message}`);
    //   } else {
    //     this.logger.log('✅ Subscribed to sensor topics: devices/+/sensor/+');
    //   }
    // });

    // Subscribe to device status: devices/{deviceId}/status
    this.client.subscribe('+/status/+', { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(
          `❌ Failed to subscribe to '+/status/+': ${err.message}`,
        );
      } else {
        this.logger.log('✅ Subscribed to device status topics: +/status/+');
      }
    });
  }

  // private handleMessage(topic: string, message: Buffer) {
  //   try {
  //     const data = JSON.parse(message.toString());
  //     this.logger.debug(`📨 Received message on ${topic}:`, data);

  //     // Parse topic: devices/{deviceId}/sensor/{sensorType}
  //     const topicParts = topic.split('/');

  //     if (topicParts.length >= 4 && topicParts[0] === 'devices') {
  //       const deviceId = topicParts[1];
  //       const sensorType = topicParts[3];

  //       // Gọi custom handler nếu có
  //       const handler = this.messageHandlers.get(topic);
  //       if (handler) {
  //         handler({ deviceId, sensorType, data });
  //       }

  //       // Xử lý dữ liệu cảm biến
  //       this.processSensorData(deviceId, sensorType, data);
  //     } else if (topicParts.length === 3 && topicParts[2] === 'status') {
  //       const deviceId = topicParts[1];
  //       this.logger.log(`📊 Device ${deviceId} status: ${data}`);
  //       this.handleStatus(deviceId, data);
  //     }
  //   } catch (error) {
  //     this.logger.error(`❌ Error parsing message from ${topic}:`, error);
  //   }
  // }
  private async handleMessage(topic: string, message: Buffer) {
    const payload = message.toString().trim();
    const [room, , device] = topic.split('/');

    let state: string | undefined;

    if (device === 'light') {
      if (payload === 'ON') state = 'on';
      if (payload === 'OFF') state = 'off';
    }

    if (device === 'door') {
      if (payload === 'LOCKED') state = 'closed';
      if (payload === 'UNLOCKED') state = 'open';
    }

    if (!state) {
      // this.logger.warn(`⚠️ Ignored payload ${payload} on ${topic}`);
      return;
    }

    // update RAM
    if (device === 'light') this.deviceState.light.set(room, state as any);
    if (device === 'door') this.deviceState.door.set(room, state as any);

    // update DB (có điều kiện)
    await this.deviceService.upsert({
      id: `${room}-${device}`,
      name: `${room} ${device}`,
      type: device === 'light' ? DeviceType.LIGHT : DeviceType.DOOR,
      location: room,
      lastState: state,
      status: DeviceStatus.ONLINE,
    });
  }
  // private async processSensorData(deviceId: string, sensorType: string, data: any) {
  //   const location = data?.location // lấy phòng từ payload nếu có
  //   await this.deviceService.upsert({
  //     id: deviceId,
  //     name: deviceId,
  //     type: 'sensor',
  //     capabilities: [sensorType],
  //     location,
  //   })
  //   await this.deviceService.updateStatus(deviceId, 'online')
  //   // TODO: lưu time-series (Phase 5) + broadcast WebSocket
  // }

  private async handleStatus(
    deviceId: string,
    room: string,
    location: string,
    lastState: string,
    name: string,
    type: DeviceType,
  ) {
    await this.deviceService.upsert({
      id: deviceId,
      name,
      type: type as DeviceType,
      location: room,
      lastState,
      status: DeviceStatus.ONLINE,
    });
  }

  // Đăng ký custom handler cho topic cụ thể
  onMessage(topic: string, handler: (data: any) => void) {
    this.messageHandlers.set(topic, handler);
    this.logger.log(`📝 Registered handler for topic: ${topic}`);
  }

  // Publish command to device
  publishCommand(room: string, device: string, payload: any) {
    // Kiểm tra kết nối trước khi publish
    if (!this.client || !this.client.connected) {
      const error = new Error(
        `MQTT client is not connected. Broker: ${this.brokerUrl}`,
      );
      this.logger.error(`❌ Cannot publish command: ${error.message}`);
      return Promise.reject(error);
    }

    const topic = `${room}/command/${device}`;
    const message = payload;

    this.logger.debug(
      `📤 Attempting to publish to ${topic} with payload:`,
      payload,
    );

    return new Promise<void>((resolve, reject) => {
      this.client.publish(
        topic,
        message,
        { qos: 1, retain: false },
        (error) => {
          if (error) {
            this.logger.error(`❌ Failed to publish to ${topic}:`, error);
            this.logger.error(`   Error details: ${error.message}`);
            reject(error);
          } else {
            this.logger.log(`✅ Published command to ${topic}:`, payload);
            resolve();
          }
        },
      );
    });
  }

  // Control light
  async controlLight(room: string, state: boolean) {
    await this.publishCommand(room, 'light', state ? 'ON' : 'OFF');
  }

  // Control door
  async controlDoor(room: string, state: boolean) {
    await this.publishCommand(room, 'door', state ? 'UNLOCK' : 'LOCK');
  }

  // Get MQTT client (để dùng ở nơi khác nếu cần)
  getClient(): mqtt.MqttClient {
    return this.client;
  }

  // Check connection status
  isConnected(): boolean {
    return this.client?.connected || false;
  }

  private async disconnect() {
    if (this.client) {
      this.client.end();
      this.logger.log('👋 Disconnected from MQTT broker');
    }
  }
}
