import { Device } from 'src/database/entities/device.entity';
import { DeviceStatus, DeviceType } from '../enums/device.enum';

export const getDeviceStatistics = (devices: Device[]) => {
  // Đèn bật: type=LIGHT, lastState='on'
  const lightsOn = devices.filter(
    (d) => d.type === DeviceType.LIGHT && d.lastState === 'on',
  ).length;
  const lightsTotal = devices.filter((d) => d.type === DeviceType.LIGHT).length;
  // Cửa mở: type=DOOR, lastState='open'
  const doorsOpen = devices.filter(
    (d) => d.type === DeviceType.DOOR && d.lastState === 'open',
  ).length;
  const doorsTotal = devices.filter((d) => d.type === DeviceType.DOOR).length;
  // Thiết bị online
  const devicesOnline = devices.filter(
    (d) => d.status === DeviceStatus.ONLINE,
  ).length;
  const devicesTotal = devices.length;

  return {
    lightsOn,
    lightsTotal,
    doorsOpen,
    doorsTotal,
    devicesOnline,
    devicesTotal
  }
};
