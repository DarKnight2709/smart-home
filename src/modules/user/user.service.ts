import { HashingService } from 'src/shared/services/hashing.service';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/database/entities/user.entity';
import { In, QueryFailedError, Repository } from 'typeorm';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { RoleEntity } from 'src/database/entities/role.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,

    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,

    private readonly hashingService: HashingService
  ) {}

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
      return await this.usersRepository.save(user);
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
