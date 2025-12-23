import { Exclude } from 'class-transformer';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('room_sensor_snapshot')
export class RoomSensorSnapshotEntity {
  @Exclude()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // mỗi phòng chỉ có 1 snapshot
  @Column({ length: 50 })
  location: string; // living-room, bed-room,...

  // ===== Sensor values =====
  @Column({ type: 'real', nullable: true })
  temperature?: number;

  @Column({ type: 'real', nullable: true })
  humidity?: number;

  @Column({ type: 'real', nullable: true })
  gasLevel?: number;

  @Column({ type: 'real', nullable: true })
  lightLevel?: number;

  // ===== Warning =====
  @Column({ default: false })
  hasWarning: boolean;

  @Column({ type: 'text', nullable: true })
  temperatureWarningMessage?: string;

  @Column({ type: 'text', nullable: true })
  gasWarningMessage?: string;

  @Column({ type: 'text', nullable: true })
  humidityWarningMessage?: string;

  @Exclude()
  // cập nhật mỗi lần có sensor gửi lên
  @UpdateDateColumn()
  updatedAt: Date;
}
