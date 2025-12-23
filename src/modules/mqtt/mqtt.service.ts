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
import { SocketGateway } from '../socket/socket.gateway';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { getDeviceStatistics } from 'src/shared/utils/getDeviceStatistics';
import { SettingService } from '../setting/setting.service';

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
    private readonly socketGateway: SocketGateway,
    private settingSevice: SettingService,
    @InjectRepository(RoomSensorSnapshotEntity)
    private readonly roomSensorSnapshotRepo: Repository<RoomSensorSnapshotEntity>,
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
    // Subscribe to sensor data: +/sensor/+
    this.client.subscribe('+/sensor-device', { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(
          `❌ Failed to subscribe to sensor topics: ${err.message}`,
        );
      } else {
        this.logger.log('✅ Subscribed to sensor topics: +/sensor/+');
      }
    });
    this.client.subscribe('+/device-register', { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(
          `❌ Failed to subscribe to sensor topics: ${err.message}`,
        );
      } else {
        this.logger.log('✅ Subscribed to sensor topics: +/sensor/+');
      }
    });
    // this.client.subscribe('room/living/status', { qos: 1 }, (err) => {
    //   if (err) {
    //     this.logger.error(`❌ Failed to subscribe to sensor topics: ${err.message}`);
    //   } else {
    //     this.logger.log('✅ Subscribed to sensor topics: devices/+/sensor/+');
    //   }
    // });

    // Subscribe to device status: +/status/+
    this.client.subscribe('+/device-status/+', { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(
          `❌ Failed to subscribe to '+/device-status/+': ${err.message}`,
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
    const parts = topic.split('/');
    if (parts.length < 2) {
      return;
    }
    let room = parts[0];
    let category = parts[1];
    let device = '';
    if (parts.length === 3) {
      device = parts[2];
    }
    console.log(topic);
    console.log(message.toString());

    switch (category) {
      case 'device-register':
        // đăng kí thiết bị
        await this.handleDeviceTopic(room, message);
        break;

      // hiển thị trạng thái (đèn, cửa)
      case 'device-status':
        await this.handleStatusTopic(room, device, message);
        break;

      // hiển thị độ ẩm, nhiệt độ, gas, ánh sáng...
      case 'sensor-device':
        await this.handleSensorTopic(room, message);
        break;

      default:
        return;
    }
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

  private async handleDeviceTopic(room: string, message: Buffer) {
    // đăng kí thiết bị (sensors)

    try {
      const payload = JSON.parse(message.toString());
      console.log('Register payload:', payload);

      await this.deviceService.upsert({
        ...payload,
        location: room,
        status: DeviceStatus.ONLINE,
      });

      this.logger.log(`📟 Sensor registered [${room}] → ${payload.id}`);
    } catch (err) {
      this.logger.error('❌ Device register failed', err);
    }
  }

  private async handleStatusTopic(
    room: string,
    device: string,
    message: Buffer,
  ) {
    // light/door
    const payload = message.toString().trim();

    const state = this.mapStatusToState(device, payload);
    if (!state) return;

    // RAM
    // this.updateDeviceState(room, device, state);

    // gửi về cho front bằng socket.

    // DB
    await this.deviceService.upsert({
      id: `${room}-${device}`,
      name: `${room} ${device}`,
      type: device === 'light' ? DeviceType.LIGHT : DeviceType.DOOR,
      location: room,
      lastState: state,
      status: DeviceStatus.ONLINE,
    });

    const devices = await this.deviceService.findAll();
    const eachRoomDevices = devices.filter((d) => d.location === room);

    const deviceStatistics = getDeviceStatistics(devices);
    const eachRoomDeviceStatistics = getDeviceStatistics(eachRoomDevices);

    // gửi cho từng phòng.
    this.socketGateway.emitDevice(room, eachRoomDeviceStatistics);

    // gửi tổng quan tất cả thiết bị
    this.socketGateway.emitDevices(deviceStatistics);
  }

  private mapStatusToState(
    device: string,
    payload: string,
  ): string | undefined {
    const map = {
      light: {
        ON: 'on',
        OFF: 'off',
      },
      door: {
        LOCKED: 'closed',
        UNLOCKED: 'open',
      },
    };

    return map[device]?.[payload];
  }

  private async handleSensorTopic(room: string, message: Buffer) {
    const payload = JSON.parse(message.toString());
    console.log(room);
    console.log('Sensor data payload:', payload);
    // kiểm tra xem nhiệt độ, độ ẩm, gas có đạt yêu cầu không. Nếu không đưa ra cảnh báo.

    const data = {
      ...payload,
      hasWarning: false,
    };
    const settings = await this.settingSevice.findAll();
    const settingMap = new Map(
      settings.map((s) => [s.sensorType, { min: s.min, max: s.max }]),
    );

    const sensors: { key: string; label: string }[] = [
      { key: 'temperature', label: 'Nhiệt độ' },
      { key: 'humidity', label: 'Độ ẩm' },
      { key: 'gas', label: 'Gas' },
    ];

    for (const sensor of sensors) {
      const value = data[sensor.key];
      const setting = settingMap.get(sensor.key);

      if (typeof value === 'number' && setting) {
        const warning = this.checkWarning(value, sensor.label, setting);
        if (warning) {
          data.hasWarning = true;
          data[`${sensor.key}WarningMessage`] = warning;
        } else {
          data[`${sensor.key}WarningMessage`] = "";
        }
      }
    }
    console.log(data);

    this.socketGateway.emitSensor(room, data);
    // lưu vào DB nếu cần
    const roomExists = await this.roomSensorSnapshotRepo.findOne({
      where: { location: room },
    });
    if (roomExists) {
      await this.roomSensorSnapshotRepo.save({
        ...roomExists,
        ...data,
        location: room,
      });
    } else {
      const newSnapshot = this.roomSensorSnapshotRepo.create({
        ...data,
        location: room,
      });
      await this.roomSensorSnapshotRepo.save(newSnapshot);
    }
  }

  private checkWarning(
    value: number | undefined,
    label: string,

    setting?: { min: number; max: number },
  ) {
    if (value == null || !setting) return null;

    if (value < setting.min) {
      return `${label} dưới mức cho phép`;
    }

    if (value > setting.max) {
      return `${label} trên mức cho phép`;
    }

    return null;
  }

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

  async getSensorData(room: string) {
    const topic = `${room}/command/get-sensor-data`;
    const message = JSON.stringify({ command: 'get-sensor-data' });
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
            this.logger.log(`✅ Published command to ${topic}:`, message);
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
