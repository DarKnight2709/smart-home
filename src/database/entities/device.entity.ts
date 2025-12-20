import { DeviceStatus, DeviceType } from 'src/shared/enums/device.enum';
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('devices')
export class Device {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: DeviceType,
  })
  type: DeviceType;

  @Column({ type: 'varchar', length: 50 })
  lastState: string;

  @Column({ type: 'varchar', length: 100 })
  location: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: DeviceStatus,
    default: DeviceStatus.OFFLINE,
  })
  status: DeviceStatus;
}
