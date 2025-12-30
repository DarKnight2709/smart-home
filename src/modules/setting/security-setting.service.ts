import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SecuritySettingEntity } from 'src/database/entities/security-setting.entity';
import { SecuritySettingKey } from 'src/shared/enums/security-setting-key.enum';

export { SecuritySettingKey };

@Injectable()
export class SecuritySettingService implements OnModuleInit {
  constructor(
    @InjectRepository(SecuritySettingEntity)
    private readonly securitySettingRepo: Repository<SecuritySettingEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeDefaultSettings();
  }

  async getSetting(key: string): Promise<SecuritySettingEntity | null> {
    return await this.securitySettingRepo.findOne({ where: { settingKey: key } });
  }

  async getSettingValue<T = string>(key: string, defaultValue: T): Promise<T> {
    const setting = await this.getSetting(key);

    if (!setting) {
      return defaultValue;
    }

    switch (setting.valueType) {
      case 'number':
        return Number(setting.settingValue) as T;
      case 'boolean':
        return (String(setting.settingValue).toLowerCase() === 'true') as T;
      case 'json':
        return JSON.parse(setting.settingValue) as T;
      default:
        return setting.settingValue as T;
    }
  }

  async updateSetting(
    key: string,
    value: string,
    description?: string,
    valueType?: SecuritySettingEntity['valueType'],
  ): Promise<SecuritySettingEntity> {
    let setting = await this.getSetting(key);

    if (!setting) {
      setting = this.securitySettingRepo.create({
        settingKey: key,
        settingValue: value,
        description,
        valueType: valueType ?? 'string',
      });
    } else {
      setting.settingValue = value;
      if (description !== undefined) {
        setting.description = description;
      }
      if (valueType) {
        setting.valueType = valueType;
      }
    }

    return await this.securitySettingRepo.save(setting);
  }

  async updateMany(
    updates: Array<{
      key: string;
      value: string;
      description?: string;
      valueType?: SecuritySettingEntity['valueType'];
    }>,
  ): Promise<SecuritySettingEntity[]> {
    if (updates.length === 0) {
      return [];
    }

    const keys = updates.map((u) => u.key);
    const existing = await this.securitySettingRepo.find({
      where: { settingKey: In(keys) },
    });
    const existingByKey = new Map(existing.map((s) => [s.settingKey, s]));

    const entities = updates.map((u) => {
      const current = existingByKey.get(u.key);
      if (!current) {
        return this.securitySettingRepo.create({
          settingKey: u.key,
          settingValue: u.value,
          description: u.description,
          valueType: u.valueType ?? 'string',
        });
      }

      current.settingValue = u.value;
      if (u.description !== undefined) {
        current.description = u.description;
      }
      if (u.valueType) {
        current.valueType = u.valueType;
      }
      return current;
    });

    return await this.securitySettingRepo.save(entities);
  }

  async findAll(): Promise<SecuritySettingEntity[]> {
    return await this.securitySettingRepo.find({ order: { settingKey: 'ASC' } as any });
  }

  private async initializeDefaultSettings(): Promise<void> {
    const defaults = [
      {
        key: SecuritySettingKey.MAX_DOOR_PASSWORD_ATTEMPTS,
        value: '5',
        description: 'Số lần nhập sai mật khẩu tối đa trước khi cảnh báo',
        valueType: 'number' as const,
      },
      {
        key: SecuritySettingKey.PASSWORD_ATTEMPT_RESET_TIME_MINUTES,
        value: '30',
        description: 'Thời gian reset số lần nhập sai (phút)',
        valueType: 'number' as const,
      },
    ];

    for (const def of defaults) {
      const existing = await this.getSetting(def.key);
      if (!existing) {
        await this.securitySettingRepo.save(
          this.securitySettingRepo.create({
            settingKey: def.key,
            settingValue: def.value,
            description: def.description,
            valueType: def.valueType,
          }),
        );
      }
    }
  }
}
