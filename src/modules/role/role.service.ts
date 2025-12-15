import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleEntity } from 'src/database/entities/role.entity';
import { ILike, In, QueryFailedError, Repository } from 'typeorm';
import { CreateRoleDto, GetRolesQueryDto, UpdateRoleDto } from './role.dto';
import { SystemRole } from 'src/shared/enums/system-role';
import { PermissionEntity } from 'src/database/entities/permission.entity';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);
  constructor(
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
  ) {}

  // Lấy danh sách vai trò
  async findAll(queryDto: GetRolesQueryDto) {
    const { page = 1, limit = 10, search, isSystemRole, isActive } = queryDto;
    const [data, total] = await this.rolesRepository.findAndCount({
      where: {
        name: search ? ILike(`%${search}%`) : undefined,
        description: search ? ILike(`%${search}%`) : undefined,
        isSystemRole: isSystemRole !== undefined ? isSystemRole : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
      skip: (page - 1) * limit,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    try {
      const role = await this.rolesRepository.findOne({
        where: { id },
        relations: {
          permissions: true,
        },
      });
      if (!role) {
        throw new NotFoundException('Không tìm thấy vai trò');
      }
      return role;
    } catch (error) {
      console.log(error);
      if (!(error instanceof InternalServerErrorException)) {
        throw error;
      }
      throw new InternalServerErrorException('Lỗi khi xóa vai trò');
    }
  }

  // Tạo mới vai trò
  async create(payload: CreateRoleDto) {
    try {
      const existed = await this.rolesRepository.findOne({
        where: { name: payload.name },
      });
  
      if (existed) {
        throw new ConflictException('Tên vai trò đã tồn tại');
      }
  
      let permissions: PermissionEntity[] = [];
      if (payload.permissionIds?.length) {
        permissions = await this.permissionRepository.findBy({
          id: In(payload.permissionIds),
        });
  
        if (permissions.length !== payload.permissionIds.length) {
          throw new BadRequestException('Có permission không tồn tại');
        }
      }
  
      const role = this.rolesRepository.create({
        ...payload,
        description: payload.description ?? '',
        isActive: true,
        isSystemRole: false,
        permissions,
      });
  
      return await this.rolesRepository.save(role);
  
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  // Cập nhật vai trò
  async update(id: string, payload: UpdateRoleDto) {
    try {
      const role = await this.findOne(id);
      if (role.isSystemRole) {
        throw new ForbiddenException('Bạn không có quyền sửa quyền này.');
      }
      Object.assign(role, {
        name: payload.name ?? role.name,
        description: payload.description ?? role.description,
      });

      if (payload.permissionIds) {
        const permissions = await this.permissionRepository.findBy({
          id: In(payload.permissionIds),
        })
        
        if(permissions.length !== payload.permissionIds.length) {
          throw new BadRequestException("Có permission không tồn tại")
        }
        role.permissions = permissions;
      }
      return await this.rolesRepository.save(role);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  // Xóa vai trò
  async remove(id: string) {
    try {
      // kiểm tra nếu là role hệ thống thì không cho xóa
      const role = await this.findOne(id);
      if (role.isSystemRole) {
        throw new ForbiddenException('Bạn không có quyền xóa quyền này.');
      }
      await this.rolesRepository.remove(role);
      return { deleted: true };
    } catch (error) {
      console.log(error);
      if (!(error instanceof InternalServerErrorException)) {
        throw error;
      }
      throw new InternalServerErrorException('Lỗi khi xóa vai trò');
    }
  }

  async syncSystemRole() {
    try {
      let systemRole = await this.rolesRepository.findOne({
        where: {
          name: SystemRole.ADMIN,
          isSystemRole: true,
        },
      });

      const permissions = await this.permissionRepository.find();

      if (systemRole) {
        systemRole.isActive = true;
        systemRole.description = 'Admin role';
        systemRole.permissions = permissions;
      } else {
        systemRole = this.rolesRepository.create({
          name: SystemRole.ADMIN,
          description: 'Admin role',
          isActive: true,
          isSystemRole: true,
          permissions,
        });
      }

      await this.rolesRepository.save(systemRole);

      return true;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Lỗi khi tạo vai trò hệ thống');
    }
  }
}
