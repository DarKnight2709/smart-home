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
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { getDeviceStatistics } from 'src/shared/utils/getDeviceStatistics';
import { SettingService } from '../setting/setting.service';
import { Device } from 'src/database/entities/device.entity';
import { EmailService } from '../notification/email.service';
import { SecuritySettingService } from '../setting/security-setting.service';
import { NotificationService } from '../notification/notification.service';
import {
  NotificationSeverity,
  NotificationType,
} from 'src/shared/enums/notification.enum';
import { SecuritySettingKey } from 'src/shared/enums/security-setting-key.enum';

interface SensorData {
  value: number;
  timestamp: number;
  deviceId: string;
  sensorType: string;
}

// Track failed password attempts
interface FailedAttempt {
  count: number;
  firstAttemptTime: Date;
  lastAttemptTime: Date;
  notificationSent: boolean;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;
  private readonly brokerUrl: string;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  // Track failed password attempts: key = "room:deviceId"
  private failedPasswordAttempts: Map<string, FailedAttempt> = new Map();

  // Track last sensor warning to avoid spamming duplicate notifications
  private lastSensorWarningKeyByRoom: Map<string, string> = new Map();

  // Track last offline notification to avoid spamming
  private lastOfflineNotifiedAtByRoom: Map<string, number> = new Map();

  constructor(
    private configService: ConfigService,
    private deviceService: DeviceService,
    private readonly socketGateway: SocketGateway,
    private settingSevice: SettingService,
    @InjectRepository(RoomSensorSnapshotEntity)
    private readonly roomSensorSnapshotRepo: Repository<RoomSensorSnapshotEntity>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly notificationService: NotificationService,
    private readonly securitySettingService: SecuritySettingService,
    private readonly emailService: EmailService,
  ) {
    this.brokerUrl =
      this.configService.get('MQTT_BROKER_URL') ||
      'mqtt://test.mosquitto.org:1883';

    // Initialize cleanup interval for failed attempts (every 5 minutes)
    setInterval(() => this.cleanupOldFailedAttempts(), 5 * 60 * 1000);
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

    // Subscribe to device status: +/status/+
    this.client.subscribe('+/device-status/+/+', { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(
          `❌ Failed to subscribe to '+/device-status/+': ${err.message}`,
        );
      } else {
        this.logger.log('✅ Subscribed to device status topics: +/status/+');
      }
    });

    // Subscribe auto status từ ESP32
    this.client.subscribe('+/device-status/auto', { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(
          `❌ Failed to subscribe '+/device-status/auto': ${err.message}`,
        );
      } else {
        this.logger.log(
          '✅ Subscribed to auto device status: +/device-status/auto',
        );
      }
    });

    // Subscribe to password request: +/request/password hoặc +/request/password/+
    this.client.subscribe('+/request/password/+', { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(
          `❌ Failed to subscribe to '+/request/password/+': ${err.message}`,
        );
      } else {
        this.logger.log(
          '✅ Subscribed to password request topics: +/request/password/+',
        );
      }
    });

    // Subscribe to password validation results: +/password-validation/+
    this.client.subscribe('+/password-validation/+', { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(
          `❌ Failed to subscribe to '+/password-validation/+': ${err.message}`,
        );
      } else {
        this.logger.log(
          '✅ Subscribed to password validation topics: +/password-validation/+',
        );
      }
    });

    this.client.subscribe('+/current-status', { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(
          `❌ Failed to subscribe to '+/current-status': ${err.message}`,
        );
      } else {
        this.logger.log(
          '✅ Subscribed to password request topics: +/current-status',
        );
      }
    });
  }

  private async handleMessage(topic: string, message: Buffer) {
    console.log(topic);
    console.log(message.toString());
    const parts = topic.split('/');
    if (parts.length < 2) {
      return;
    }
    let room = parts[0];
    let category = parts[1];
    let device = '';

    console.log('topic: ', topic);
    console.log('message: ', message.toString());

    switch (category) {
      case 'device-register':
        // đăng kí thiết bị
        await this.handleDeviceTopic(room, message);
        break;

      // hiển thị trạng thái (đèn, cửa, password)
      case 'device-status':
        const devicePath = parts.slice(2).join('/'); // để lấy đúng device dạng light/LV_Light_01
        if (devicePath === 'auto') {
          await this.handleAutoStatus(room, message);
        } else {
          await this.handleStatusTopic(room, devicePath, message);
        }
        break;

      // hiển thị độ ẩm, nhiệt độ, gas, ánh sáng...
      case 'sensor-device':
        await this.handleSensorTopic(room, message);
        break;

      // yêu cầu lấy mật khẩu
      case 'request':
        device = parts[2]; // password
        const deviceId = parts[3]; // deviceId nếu có
        if (device === 'password') {
          await this.handlePasswordRequest(room, deviceId);
        }
        break;

      // password validation result
      case 'password-validation':
        const passwordDeviceId = parts[2]; // device ID
        const validationResult = message.toString().trim(); // SUCCESS or FAILED
        await this.handlePasswordValidation(
          room,
          passwordDeviceId,
          validationResult,
        );
        break;

      case 'current-status':
        await this.handleCurrentStatusTopic(room, message);
        break;

      default:
        return;
    }
  }

  private async handleAutoStatus(room: string, message: Buffer) {
    const payload = message.toString();
    this.logger.log(`🤖 Auto status from ${room}: ${payload}`);

    this.socketGateway.emitDeviceStatus(room, { auto: payload });
  }
  private async handleCurrentStatusTopic(room: string, message: Buffer) {
    const status = message.toString(); // online | offline
    console.log('status: ', status);

    await this.deviceRepository.update(
      { location: room },
      {
        status:
          status === 'online' ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE,
      },
    );

    this.socketGateway.emitDeviceStatus(room, {
      status: status === 'online' ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE,
    });

    // update light and door lastState
    if (status === 'offline') {
      // Create offline notification (once per room per 5 minutes)
      if (this.notificationService) {
        const nowMs = Date.now();
        const lastNotifiedAtMs = this.lastOfflineNotifiedAtByRoom.get(room) || 0;
        if (nowMs - lastNotifiedAtMs > 5 * 60 * 1000) {
          try {
            const notification = await this.notificationService.create({
              type: NotificationType.DEVICE_OFFLINE,
              title: `Thiết bị phòng ${room} đang offline`,
              message: `Mất kết nối với thiết bị trong phòng ${room}. Một số chức năng có thể không điều khiển được cho đến khi thiết bị online lại.`,
              severity: NotificationSeverity.HIGH,
              location: room,
              metadata: {
                roomStatus: 'offline',
                occurredAt: new Date().toISOString(),
              },
            });

            const usersWithPermission =
              await this.notificationService.getUsersWithNotificationPermission(
                'GET',
                '/notifications',
              );

            if (this.emailService && usersWithPermission.length > 0) {
              const emailAddresses = usersWithPermission
                .map((user: any) => user.email)
                .filter((email: string) => email);

              if (emailAddresses.length > 0) {
                const ok = await this.emailService.sendDeviceOfflineAlert(
                  emailAddresses,
                  notification.title,
                  notification.message,
                  notification.metadata,
                );
                if (ok) {
                  await this.notificationService.markEmailSent(notification.id);
                }
              }
            }

            this.lastOfflineNotifiedAtByRoom.set(room, nowMs);
          } catch (error) {
            this.logger.error('Failed to create device_offline notification', error);
          }
        }
      }

      // Lấy tất cả thiết bị trong phòng
      const devices = await this.deviceRepository.find({
        where: {
          location: room,
          type: In([DeviceType.LIGHT, DeviceType.DOOR, DeviceType.WINDOW]),
        },
      });

      // Cập nhật từng thiết bị theo type
      for (const device of devices) {
        let newState = '';
        switch (device.type) {
          case DeviceType.LIGHT:
            newState = 'off';
            break;
          case DeviceType.DOOR:
            newState = 'locked';
            break;
          case DeviceType.WINDOW:
            newState = 'closed';
            break;
        }

        await this.deviceRepository.update(
          { id: device.id },
          { lastState: newState },
        );
      }
    }

    const devices = await this.deviceService.findAll();
    const eachRoomDevices = devices.filter((d) => d.location === room);

    const deviceStatistics = getDeviceStatistics(devices);
    const eachRoomDeviceStatistics = getDeviceStatistics(eachRoomDevices);

    // gửi cho từng phòng.
    this.socketGateway.emitDevice(room, eachRoomDeviceStatistics);

    // gửi tổng quan tất cả thiết bị
    this.socketGateway.emitDevices(deviceStatistics);
  }

  private async handleDeviceTopic(room: string, message: Buffer) {
    // đăng kí thiết bị (sensors)

    try {
      const payload = JSON.parse(message.toString());
      console.log('Register payload:', payload);
      if (!payload.id || !payload.type) {
        this.logger.warn(
          `Invalid device payload from ${room}: ${message.toString()}`,
        );
        return;
      }

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
    devicePath: string,
    message: Buffer,
  ) {
    // light/door/password
    const payload = message.toString().trim();

    // Xử lý password từ wokwi
    if (devicePath === 'password') {
      await this.handlePasswordFromWokwi(room, payload);
      return;
    }

    console.log('devicePath: ', devicePath);
    // Tách type và id
    const [type, deviceId] = devicePath.split('/'); // type = "light" hoặc "door", deviceId = "LV_Light_01"

    if (!deviceId) {
      this.logger.warn(
        `⚠️ Ignoring device-status without deviceId: ${room}/${devicePath}`,
      );
      return;
    }

    const state = this.mapStatusToState(type, payload);
    if (!state) return;

    // DB
    await this.deviceService.upsert({
      // sửa id
      id: `${deviceId}`, // nếu deviceId undefined thì fallback
      name: `${room} ${deviceId || type}`,
      type:
        type === 'light'
          ? DeviceType.LIGHT
          : type === 'door'
            ? DeviceType.DOOR
            : DeviceType.WINDOW,
      location: room,
      lastState: state,
      status: DeviceStatus.ONLINE,
    });
    console.log(
      'Updated device status in DB' + room + ' ' + deviceId + ' ' + state,
    );

    const devices = await this.deviceService.findAll();
    const eachRoomDevices = devices.filter((d) => d.location === room);

    const deviceStatistics = getDeviceStatistics(devices);
    const eachRoomDeviceStatistics = getDeviceStatistics(eachRoomDevices);
    console.log('eachRoomDeviceStatistics: ', eachRoomDeviceStatistics);

    // gửi cho từng phòng.
    this.socketGateway.emitDevice(room, eachRoomDeviceStatistics);

    // gửi tổng quan tất cả thiết bị
    this.socketGateway.emitDevices(deviceStatistics);
  }

  private mapStatusToState(type: string, payload: string): string | undefined {
    const map = {
      light: {
        ON: 'on',
        OFF: 'off',
      },
      door: {
        LOCKED: 'locked',
        UNLOCKED: 'unlocked',
      },
      window: {
        CLOSED: 'closed',
        OPENED: 'opened',
      },
    };

    return map[type]?.[payload];
  }

  private async handleSensorTopic(room: string, message: Buffer) {
    const payload = JSON.parse(message.toString());
    console.log(room);
    console.log('Sensor data payload:', payload);
    // kiểm tra xem nhiệt độ, độ ẩm, gas có đạt yêu cầu không. Nếu không đưa ra cảnh báo.
    console.log('Gas' + payload.gas);

    const data = {
      ...payload,
      hasWarning: false,
    };

    if (payload?.gas) {
      data.hasWarning = true;
      data['gasWarningMessage'] = 'Phát hiện rò rỉ khí gas';
    } else {
      data['gasWarningMessage'] = '';
    }

    const settings = await this.settingSevice.findAll();
    const settingMap = new Map(
      settings.map((s) => [s.sensorType, { min: s.min, max: s.max }]),
    );

    const sensors: { key: string; label: string }[] = [
      { key: 'temperature', label: 'Nhiệt độ' },
      { key: 'humidity', label: 'Độ ẩm' },
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
          data[`${sensor.key}WarningMessage`] = '';
        }
      }
    }
    console.log(data);

    // Create sensor warning notification when needed (dedupe by warning key per room)
    if (data.hasWarning && this.notificationService) {
      const warningParts: string[] = [];
      if (data['gasWarningMessage']) warningParts.push(data['gasWarningMessage']);
      if (data['temperatureWarningMessage']) warningParts.push(data['temperatureWarningMessage']);
      if (data['humidityWarningMessage']) warningParts.push(data['humidityWarningMessage']);

      const warningKey = warningParts.join(' | ');
      const lastWarningKey = this.lastSensorWarningKeyByRoom.get(room);

      if (warningKey && warningKey !== lastWarningKey) {
        try {
          const severity = data['gasWarningMessage']
            ? NotificationSeverity.CRITICAL
            : NotificationSeverity.MEDIUM;

          const notification = await this.notificationService.create({
            type: NotificationType.SENSOR_WARNING,
            title: `Cảnh báo cảm biến phòng ${room}`,
            message: warningParts.join('. '),
            severity,
            location: room,
            metadata: {
              temperature: data.temperature,
              humidity: data.humidity,
              gas: data.gas,
              gasWarningMessage: data['gasWarningMessage'],
              temperatureWarningMessage: data['temperatureWarningMessage'],
              humidityWarningMessage: data['humidityWarningMessage'],
              occurredAt: new Date().toISOString(),
            },
          });

          const usersWithPermission =
            await this.notificationService.getUsersWithNotificationPermission(
              'GET',
              '/notifications',
            );

          if (this.emailService && usersWithPermission.length > 0) {
            const emailAddresses = usersWithPermission
              .map((user: any) => user.email)
              .filter((email: string) => email);

            if (emailAddresses.length > 0) {
              const ok = await this.emailService.sendSensorWarning(
                emailAddresses,
                notification.title,
                notification.message,
                notification.metadata,
              );
              if (ok) {
                await this.notificationService.markEmailSent(notification.id);
              }
            }
          }

          this.lastSensorWarningKeyByRoom.set(room, warningKey);
        } catch (error) {
          this.logger.error('Failed to create sensor_warning notification', error);
        }
      }
    }

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

  // Đăng ký custom handler cho topic cụ thể
  onMessage(topic: string, handler: (data: any) => void) {
    this.messageHandlers.set(topic, handler);
    this.logger.log(`📝 Registered handler for topic: ${topic}`);
  }

  // Publish command to device
  // async publishCommand(room: string, device: string, payload: any) {
  //   // Kiểm tra kết nối trước khi publish
  //   if (!this.client || !this.client.connected) {
  //     const error = new Error(
  //       `MQTT client is not connected. Broker: ${this.brokerUrl}`,
  //     );
  //     this.logger.error(`❌ Cannot publish command: ${error.message}`);
  //     return Promise.reject(error);
  //   }

  //   // // kiểm tra thiết bị xem có offline không?
  //   // const deviceEntity = await this.deviceRepository.findOne({
  //   //   where: {
  //   //     location: room,
  //   //     type: device === 'light' ? DeviceType.LIGHT : DeviceType.DOOR,
  //   //   },
  //   // });
  //   // if (!deviceEntity || deviceEntity.status === DeviceStatus.OFFLINE) {
  //   //   const error = new Error(`Device not found in ${room}`);
  //   //   this.logger.error(`❌ Cannot publish command: ${error.message}`);
  //   //   return Promise.reject(error);
  //   // }

  //   // sửa thêm đèn với id
  //   const topic = `${room}/command/${device}`;
  //   const message = payload;

  //   this.logger.debug(
  //     `📤 Attempting to publish to ${topic} with payload:`,
  //     payload,
  //   );

  //   return new Promise<void>((resolve, reject) => {
  //     this.client.publish(
  //       topic,
  //       message,
  //       { qos: 1, retain: false },
  //       (error) => {
  //         if (error) {
  //           this.logger.error(`❌ Failed to publish to ${topic}:`, error);
  //           this.logger.error(`   Error details: ${error.message}`);
  //           reject(error);
  //         } else {
  //           this.logger.log(`✅ Published command to ${topic}:`, payload);
  //           resolve();
  //         }
  //       },
  //     );
  //   });
  // }

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
  // sửa thêm id
  // async controlLight(room: string, state: boolean) {
  //   await this.publishCommand(room, 'light', state ? 'ON' : 'OFF');
  // }

  async sendAutoCommand(room: string, command: any) {
    if (!this.client || !this.client.connected) {
      const error = new Error(
        `MQTT client is not connected. Broker: ${this.brokerUrl}`,
      );
      this.logger.error(`❌ Cannot send auto command: ${error.message}`);
      return Promise.reject(error);
    }

    const topic = `${room}/command/auto`;
    const message =
      typeof command === 'string' ? command : JSON.stringify(command);

    this.logger.debug(`📤 Publishing auto command to ${topic}: ${message}`);

    return new Promise<void>((resolve, reject) => {
      this.client.publish(topic, message, { qos: 1, retain: false }, (err) => {
        if (err) {
          this.logger.error(
            `❌ Failed to publish auto command to ${topic}:`,
            err,
          );
          reject(err);
        } else {
          this.logger.log(`✅ Published auto command to ${topic}`);
          resolve();
        }
      });
    });
  }

  // Control specific light by device ID
  async controlSpecificLight(room: string, deviceId: string, state: boolean) {
    if (!this.client || !this.client.connected) {
      const error = new Error(
        `MQTT client is not connected. Broker: ${this.brokerUrl}`,
      );
      this.logger.error(`❌ Cannot control specific light: ${error.message}`);
      return Promise.reject(error);
    }

    const topic = `${room}/command/light/${deviceId}`;
    const message = state ? 'ON' : 'OFF';
    this.logger.debug(`📤 Publishing to ${topic}: ${message}`);

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
            this.logger.log(`✅ Published command to ${topic}: ${message}`);
            resolve();
          }
        },
      );
    });
  }

  // Control specific door by device ID
  async controlSpecificDoor(room: string, deviceId: string, state: boolean) {
    if (!this.client || !this.client.connected) {
      const error = new Error(
        `MQTT client is not connected. Broker: ${this.brokerUrl}`,
      );
      this.logger.error(`❌ Cannot control specific door: ${error.message}`);
      return Promise.reject(error);
    }

    const topic = `${room}/command/door/${deviceId}`;
    const message = state ? 'UNLOCK' : 'LOCK';
    this.logger.debug(`📤 Publishing to ${topic}: ${message}`);

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
            this.logger.log(`✅ Published command to ${topic}: ${message}`);
            resolve();
          }
        },
      );
    });
  }

  async controlSpecificWindow(room: string, deviceId: string, state: boolean) {
    if (!this.client || !this.client.connected) {
      const error = new Error(
        `MQTT client is not connected. Broker: ${this.brokerUrl}`,
      );
      this.logger.error(`❌ Cannot control specific window: ${error.message}`);
      return Promise.reject(error);
    }
    const topic = `${room}/command/window/${deviceId}`;
    const message = state ? 'OPEN' : 'CLOSE';
    this.logger.debug(`📤 Publishing to ${topic}: ${message}`);

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
            this.logger.log(`✅ Published command to ${topic}: ${message}`);
            resolve();
          }
        },
      );
    });
  }

  // Control door
  // async controlDoor(room: string, state: boolean) {
  //   await this.publishCommand(room, 'door', state ? 'UNLOCK' : 'LOCK');
  // }

  // Publish password to wokwi (when password changed)
  async publishPassword(room: string, deviceId: string, password: string) {
    if (!this.client || !this.client.connected) {
      const error = new Error(
        `MQTT client is not connected. Broker: ${this.brokerUrl}`,
      );
      this.logger.error(`❌ Cannot publish password: ${error.message}`);
      return Promise.reject(error);
    }

    const topic = `${room}/response/password/${deviceId}`;
    this.logger.debug(`📤 Publishing password to ${topic}`);

    return new Promise<void>((resolve, reject) => {
      this.client.publish(
        topic,
        password,
        { qos: 1, retain: false },
        (error) => {
          if (error) {
            this.logger.error(
              `❌ Failed to publish password to ${topic}:`,
              error,
            );
            reject(error);
          } else {
            this.logger.log(`✅ Published password to ${topic}`);
            resolve();
          }
        },
      );
    });
  }

  // Handle password request from wokwi
  private async handlePasswordRequest(room: string, deviceId?: string) {
    try {
      // Tìm door device và lấy password
      const whereCondition: any = {
        location: room,
        type: DeviceType.DOOR,
      };

      // Nếu có deviceId thì tìm cụ thể
      if (deviceId) {
        whereCondition.id = deviceId;
      }

      const doorDevice = await this.deviceRepository.findOne({
        where: whereCondition,
        select: {
          id: true,
          password: true,
        },
      });

      if (!doorDevice || !doorDevice.password) {
        this.logger.warn(`⚠️ No password found for door in ${room}`);
        return;
      }

      // Publish password về wokwi qua response topic
      const topic = `${room}/response/password/${doorDevice.id}`;
      this.logger.debug(`📤 Sending password to ${topic}`);

      this.client.publish(
        topic,
        doorDevice.password,
        { qos: 1, retain: false },
        (error) => {
          if (error) {
            this.logger.error(`❌ Failed to send password to ${topic}:`, error);
          } else {
            this.logger.log(`✅ Sent password to ${topic}`);
          }
        },
      );
    } catch (error) {
      this.logger.error(
        `❌ Error handling password request for ${room}:`,
        error,
      );
    }
  }

  // Handle password from wokwi (when wokwi sends password to save)
  private async handlePasswordFromWokwi(room: string, password: string) {
    try {
      // Tìm door device và lưu password
      const doorDevice = await this.deviceRepository.findOne({
        where: {
          location: room,
          type: DeviceType.DOOR,
        },
      });

      if (!doorDevice) {
        this.logger.warn(`⚠️ Door device not found in ${room}`);
        return;
      }

      // Lưu password plain text vào DB
      await this.deviceRepository.update(
        { id: doorDevice.id },
        { password: password.trim() },
      );

      this.logger.log(`✅ Password saved for door in ${room}`);
    } catch (error) {
      this.logger.error(`❌ Error saving password for ${room}:`, error);
    }
  }

  // Handle password validation result from ESP32
  private async handlePasswordValidation(
    room: string,
    deviceId: string,
    result: string,
  ): Promise<void> {
    if (result === 'SUCCESS') {
      // Reset failed attempts on successful login
      this.resetFailedPasswordAttempts(room, deviceId);
      this.logger.log(`✅ Password correct for ${deviceId} in ${room}`);
    } else if (result === 'FAILED') {
      // Track failed attempt
      await this.trackFailedPasswordAttempt(room, deviceId);
    }
  }

  // Track failed password attempt
  async trackFailedPasswordAttempt(
    room: string,
    deviceId: string,
  ): Promise<void> {
    const key = `${room}:${deviceId}`;
    const now = new Date();

    // lấy setting security reset time.
    const resetTimeMinutes = this.securitySettingService
      ? await this.securitySettingService.getSettingValue<number>(
          SecuritySettingKey.PASSWORD_ATTEMPT_RESET_TIME_MINUTES,
          30,
        )
      : 30;

    let attempt = this.failedPasswordAttempts.get(key);

    if (!attempt) {
      attempt = {
        count: 1,
        firstAttemptTime: now,
        lastAttemptTime: now,
        notificationSent: false,
      };
      this.failedPasswordAttempts.set(key, attempt);
    } else {
      if (
        (now.getTime() - attempt.lastAttemptTime.getTime()) / 1000 / 60 >
        resetTimeMinutes
      ) {
        // Nếu lần thử cuối cách đây hơn 30 phút, reset đếm
        attempt.count = 1;
        attempt.firstAttemptTime = now;
        attempt.lastAttemptTime = now;
        attempt.notificationSent = false;
      } else {
        attempt.count++;
        attempt.lastAttemptTime = now;
      }
    }

    this.logger.warn(
      `⚠️ Failed password attempt ${attempt.count} for ${deviceId} in ${room}`,
    );

    // Check if exceeded threshold
    await this.checkPasswordAttemptsThreshold(room, deviceId, attempt);
  }

  // Check if failed attempts exceeded threshold and create notification
  private async checkPasswordAttemptsThreshold(
    room: string,
    deviceId: string,
    attempt: FailedAttempt,
  ): Promise<void> {
    if (attempt.notificationSent) {
      return; // Already sent notification for this series of attempts
    }

    try {
      // Get max attempts from security settings (default 5)
      const maxAttempts = this.securitySettingService
        ? await this.securitySettingService.getSettingValue(
            SecuritySettingKey.MAX_DOOR_PASSWORD_ATTEMPTS,
            2,
          )
        : 5;

      if (attempt.count >= maxAttempts) {
        this.logger.error(
          `🚨 SECURITY ALERT: ${attempt.count} failed password attempts for ${deviceId} in ${room}!`,
        );

        const roomDevice = await this.deviceRepository.findOne({
          where: { id: deviceId, location: room },
        });

        // Create notification
        if (this.notificationService) {
          const notification = await this.notificationService.create({
            type: NotificationType.SECURITY_ALERT,
            title: `Cảnh báo nhập sai mật khẩu cửa ${room}`,
            message: `Đã nhập sai mật khẩu ${roomDevice?.name} tại ${room} ${attempt.count} lần liên tiếp. Có khả năng ai đó đang cố gắng truy cập trái phép.`,
            severity: NotificationSeverity.CRITICAL,
            location: room,
            metadata: {
              failedAttempts: attempt.count,
              firstAttemptTime: attempt.firstAttemptTime,
              lastAttemptTime: attempt.lastAttemptTime,
            },
          });

          // Get users with notification permission
          const usersWithPermission =
            await this.notificationService.getUsersWithNotificationPermission(
              'GET',
              '/notifications', // Permission name
            );

          // Send email to users with permission
          if (this.emailService && usersWithPermission.length > 0) {
            const emailAddresses = usersWithPermission
              .map((user: any) => user.email)
              .filter((email: string) => email);

            if (emailAddresses.length > 0) {
              await this.emailService.sendSecurityAlert(
                emailAddresses,
                notification.title,
                notification.message,
                notification.metadata,
              );
              console.log('email send 2');

              await this.notificationService.markEmailSent(notification.id);
            }
          }

          // Mark notification as sent for this series
          attempt.notificationSent = true;
        }
      }
    } catch (error) {
      this.logger.error('Failed to check password attempts threshold:', error);
    }
  }

  // Reset failed attempts for a device (call when password is correct)
  resetFailedPasswordAttempts(room: string, deviceId: string): void {
    const key = `${room}:${deviceId}`;
    this.failedPasswordAttempts.delete(key);
    this.logger.log(`✅ Reset failed attempts for ${deviceId} in ${room}`);
  }

  // Cleanup old failed attempts (older than reset time)
  private cleanupOldFailedAttempts(): void {
    const now = new Date();
    const resetTimeMinutes = 30; // Default, will be configurable

    for (const [key, attempt] of this.failedPasswordAttempts.entries()) {
      const ageMinutes =
        (now.getTime() - attempt.firstAttemptTime.getTime()) / 1000 / 60;

      if (ageMinutes > resetTimeMinutes) {
        this.failedPasswordAttempts.delete(key);
        this.logger.log(`🧹 Cleaned up old failed attempts for ${key}`);
      }
    }
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
