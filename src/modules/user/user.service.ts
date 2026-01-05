import { HashingService } from 'src/shared/services/hashing.service';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/database/entities/user.entity';
import { In, QueryFailedError, Repository } from 'typeorm';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { RoleEntity } from 'src/database/entities/role.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from 'src/database/entities/audit-log.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,

    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,

    private readonly hashingService: HashingService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private toRoleSummary(roles: RoleEntity[] | undefined) {
    const safeRoles = roles ?? [];
    const ids = safeRoles.map((r) => r.id).filter(Boolean);
    const names = safeRoles.map((r) => r.name).filter(Boolean);
    return { ids, names };
  }

  // get all users
  async findAll() {
    const users = await this.usersRepository
    .createQueryBuilder("user")
    .leftJoinAndSelect("user.roles", "role")
    .select([
      "user.id",
      "user.username",
      "user.fullName",
      "user.gender",
      "user.email",
      "user.phone",
      "user.currentAddress",
      "user.dateOfBirth",
      "user.createdAt",
      "user.updatedAt",
      "role.id",
      "role.name",
      "role.description"
    ])
    .getMany();
  
    return {
      users
    };
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { roles: true },
      select: {
        id: true,
        username: true,
        fullName: true,
        gender: true,
        phone: true,
        currentAddress: true,
        dateOfBirth: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          id: true,
          name: true,
          description: true,
        },
      },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return user;
  }

  // create user
  async create(user: CreateUserDto) {
    try {
      // 1. Check tồn tại
      const existingUser = await this.usersRepository.findOne({
        where: [{ username: user.username }, { email: user.email }],
      });
      if (existingUser) {
        throw new ConflictException('Username hoặc email đã tồn tại');
      }

      // 2. Roles (nếu có)
      const roles = user.roleIds?.length
        ? await this.rolesRepository.findBy({ id: In(user.roleIds) })
        : undefined;

      // 3. Hash password
      const hashedPassword = this.hashingService.hash(user.password);

      // 4. Tạo entity mới
      const { roleIds, ...rest } = user;
      const newUser = this.usersRepository.create({
        ...rest,
        password: hashedPassword,
        roles,
      });

      // 5. Lưu DB
      await this.usersRepository.save(newUser);

    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException(
          'Username hoặc email đã tồn tại',
        );
      }
      throw error;
    }
  }

  async update(id: string, payload: UpdateUserDto) {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { roles: true },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Roles
    // gán undefined thì nó sẽ lấy giá trị cũ hoặc null.
    const roles = payload.roleIds?.length
      ? await this.rolesRepository.findBy({ id: In(payload.roleIds) })
      : undefined;

    const beforeRoleEntities = user.roles ?? [];
    const nextRoleEntities = roles ?? beforeRoleEntities;

    const beforeRoles = this.toRoleSummary(beforeRoleEntities);
    const nextRoles = this.toRoleSummary(nextRoleEntities);

    const beforeSet = new Set(beforeRoles.ids);
    const nextSet = new Set(nextRoles.ids);
    const addedRoleIds = nextRoles.ids.filter((rid) => !beforeSet.has(rid));
    const removedRoleIds = beforeRoles.ids.filter((rid) => !nextSet.has(rid));
    const rolesChanged = addedRoleIds.length > 0 || removedRoleIds.length > 0;

    // Hash password nếu có
    const hashedPassword = payload.password
      ? this.hashingService.hash(payload.password)
      : undefined;

    const { roleIds, ...rest } = payload;

    Object.assign(user, rest, {
      password: hashedPassword ?? user.password,
      roles: roles ?? user.roles,
    });

    try {
      const savedUser = await this.usersRepository.save(user);

      if (rolesChanged) {
        const addedRoleNames = nextRoleEntities
          .filter((r) => addedRoleIds.includes(r.id))
          .map((r) => r.name)
          .filter(Boolean);
        const removedRoleNames = beforeRoleEntities
          .filter((r) => removedRoleIds.includes(r.id))
          .map((r) => r.name)
          .filter(Boolean);

        const parts: string[] = [];
        if (addedRoleNames?.length) {
          parts.push(`Thêm: ${addedRoleNames.join(', ')}`);
        }
        if (removedRoleNames?.length) {
          parts.push(`Gỡ: ${removedRoleNames.join(', ')}`);
        }

        await this.auditLogService.logCustom({
          action: AuditAction.UPDATE,
          entityName: 'User',
          entityId: savedUser.id,
          changedFields: ['roles'],
          oldValues: { roles: beforeRoles.names },
          newValues: { roles: nextRoles.names },
          description:
            parts.length > 0
              ? `Cập nhật vai trò người dùng "${savedUser.username}": ${parts.join(' | ')}`
              : `Cập nhật vai trò người dùng "${savedUser.username}"`,
          metadata: {
            roleChange: {
              addedRoleIds,
              removedRoleIds,
              beforeRoleIds: beforeRoles.ids,
              afterRoleIds: nextRoles.ids,
            },
          },
        });
      }

      return savedUser;
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Username hoặc email đã tồn tại');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    await this.usersRepository.remove(user);
    return { deleted: true };
  }
}
