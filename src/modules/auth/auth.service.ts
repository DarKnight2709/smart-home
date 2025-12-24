import { RsaKeyManager } from './../../shared/utils/RsaKeyManager';
import { ConfigService } from './../../shared/services/config.service';
import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ChangePasswordDto,
  LoginDto,
  LoginResponseDto,
  LogoutResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  UpdatePersonalInfoDto,
} from './auth.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/database/entities/user.entity';
import {
  DataSource,
  EntityManager,
  LessThan,
  MoreThan,
  Not,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { HashingService } from 'src/shared/services/hashing.service';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { RefreshTokenEntity } from 'src/database/entities/refresh-token.entity';
import { UserService } from '../user/user.service';

export interface JWTRefreshPayLoad {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokeRepository: Repository<RefreshTokenEntity>,
    private readonly keyManager: RsaKeyManager,
    private readonly hashingService: HashingService,
    private readonly configService: ConfigService,
    private readonly datasource: DataSource,
  ) {}

  async getCurrentUser(userId: string) {
    return await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('user.id = :id', { id: userId })
      .select([
        // User
        'user.id',
        'user.username',
        'user.fullName',
        'user.gender',
        'user.phone',
        'user.currentAddress',
        'user.dateOfBirth',
        'user.email',
        'user.createdAt',
        'user.updatedAt',

        // Role
        'role.id',
        'role.name',
        'role.description',
        'role.isActive',
        'role.isSystemRole',
        'role.createdAt',
        'role.updatedAt',

        // Permission
        'permission.id',
        'permission.name',
        'permission.description',
        'permission.module',
        'permission.path',
        'permission.method',
        'permission.createdAt',
        'permission.updatedAt',
      ])
      .getOne();
  }

  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponseDto> {
    const { username, password } = loginDto;

    // tìm user theo username
    const user = await this.userRepository.findOne({
      where: { username },
      relations: {
        roles: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Tên đăng nhập hoặc mặt khẩu không hợp lệ',
      );
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = this.hashingService.compare(
      password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Mật khẩu không hợp lệ');
    }

    // tạo access token và refresh token
    const accessToken = this.generateAccessToken(user);

    // create refresh token
    // store the refresh token into dabase.
    const refreshToken = await this.generateRefreshToken(
      user,
      ipAddress,
      userAgent,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(
    refreshToken: RefreshTokenDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RefreshTokenResponseDto> {
    // lấy token ra
    const rawRefreshToken = refreshToken.refreshToken;

    // check valid
    if (!rawRefreshToken) {
      throw new UnauthorizedException(
        'Không thực hiện được hành động này vì thiếu refresh token',
      );
    }

    try {
      //verify -> lấy payload
      const payload = jwt.verify(
        rawRefreshToken,
        this.keyManager.getPublicKeyRefresh(),
        {
          algorithms: ['RS256'],
        },
      ) as JWTRefreshPayLoad;

      // Transaction để revoke + tạo refresh token mới
      return await this.datasource.transaction(async (manager) => {
        // check trong database xem có bản ghi nào có userid/refresh token hợp lệ, expiresAt < now, ip/user-agent giống nhau, isRevoked  = false
        const tokenEntity = await manager.findOne(RefreshTokenEntity, {
          where: {
            token: this.hashToken(rawRefreshToken),
            userId: payload.sub,
            ipAddress,
            userAgent,
            isRevoked: false,
            expiresAt: MoreThan(new Date()),
          },
          relations: {
            user: {
              roles: true,
            },
          },
        });

        if (!tokenEntity) {
          throw new UnauthorizedException(
            'Refresh token không hợp lệ hoặc hết hạn',
          );
        }

        // revoke the old refresh.
        await manager.update(
          RefreshTokenEntity,
          { token: this.hashToken(rawRefreshToken) },
          { isRevoked: true },
        );

        // valid thì tạo mới access token và refresh token mới
        // tạo access token và refresh token

        const newAccessToken = this.generateAccessToken(tokenEntity.user);

        // create refresh token
        // store the refresh token into dabase.
        const newRefreshToken = await this.generateRefreshToken(
          tokenEntity.user,
          ipAddress,
          userAgent,
          manager,
        );

        return {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        };
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException(
          'Refresh token đã hết hạn, vui lòng đăng nhập lại',
        );
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException(
          'Refresh token không hợp lệ, vui lòng đăng nhập lại',
        );
      }
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Refresh token verification failed:', error);
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
  }

  async logout(refreshToken: string): Promise<LogoutResponseDto> {
    try {
      // verify refresh token
      jwt.verify(refreshToken, this.keyManager.getPublicKeyRefresh(), {
        algorithms: ['RS256'],
      }) as JWTRefreshPayLoad;

      // thu hồi refresh
      await this.refreshTokeRepository.update(
        { token: this.hashToken(refreshToken) },
        { isRevoked: true },
      );

      return {
        message: 'Đăng xuất thành công',
      };
    } catch (error) {
      this.logger.error('Logout failed:', error);
      // Vẫn trả về thành công để không leak thông tin
      return { message: 'Đăng xuất thành công' };
    }
  }

  private generateAccessToken(user: UserEntity): string {
    // mã hóa(sign) dữ liệu bằng private access key.
    const payload = {
      sub: user.id,
      username: user.username,
      roles: user.roles.map((role) => role.name),
    };

    return jwt.sign(payload, this.keyManager.getPrivateKeyAccess(), {
      algorithm: 'RS256',
      expiresIn: this.configService.get('ACCESS_TOKEN_EXPIRES_IN'),
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async generateRefreshToken(
    user: UserEntity,
    ipAddress?: string,
    userAgent?: string,
    manager?: EntityManager,
  ): Promise<string> {
    const jti = crypto.randomUUID();
    const payload = {
      sub: user.id,
      jti,
    };

    // tạo
    const refreshToken = jwt.sign(
      payload,
      this.keyManager.getPrivateKeyRefresh(),
      {
        algorithm: 'RS256',
        expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN'),
      },
    );

    // lưu refresh token vào database
    const saveRepo = manager
      ? manager.getRepository(RefreshTokenEntity)
      : this.refreshTokeRepository;

    await saveRepo.save({
      token: this.hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(
        Date.now() + this.configService.get('REFRESH_TOKEN_EXPIRES_IN') * 1000,
      ),
      ipAddress,
      userAgent,
    });
    return refreshToken;
  }

  async updatePersonalInfo(
    userId: string,
    updateDto: UpdatePersonalInfoDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (updateDto.username) {
      const usernameExists = await this.userRepository.findOne({
        where: {
          username: updateDto.username,
          id: Not(userId), // exclude current user
        },
      });
  
      if (usernameExists) {
        throw new ConflictException('Username đã tồn tại');
      }
    }
  
    // ===== Check email exist =====
    if (updateDto.email) {
      const emailExists = await this.userRepository.findOne({
        where: {
          email: updateDto.email,
          id: Not(userId), // exclude current user
        },
      });
  
      if (emailExists) {
        throw new ConflictException('Email đã tồn tại');
      }
    }

    Object.assign(user, updateDto);

    try {
      await this.userRepository.save(user);
      return { message: 'Cập nhật thông tin cá nhân thành công' };
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Username hoặc email đã tồn tại');
      }
      throw error;
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    try {
      const { oldPassword, newPassword } = changePasswordDto;

      // Tìm user
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: {
          id: true,
          password: true,
        },
      });

      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      // Kiểm tra mật khẩu cũ
      const isOldPasswordValid = this.hashingService.compare(
        oldPassword,
        user.password,
      );

      if (!isOldPasswordValid) {
        throw new BadRequestException('Mật khẩu cũ không đúng');
      }

      // Kiểm tra mật khẩu mới không được trùng với mật khẩu cũ
      const isSamePassword = this.hashingService.compare(
        newPassword,
        user.password,
      );

      if (isSamePassword) {
        throw new BadRequestException('Mật khẩu mới phải khác với mật khẩu cũ');
      }

      // Hash mật khẩu mới
      const hashedNewPassword = this.hashingService.hash(newPassword);

      // Cập nhật mật khẩu
      user.password = hashedNewPassword;
      await this.userRepository.save(user);

      await this.refreshTokeRepository.delete({
        userId: user.id,
      });

      this.logger.log(
        `Đã xóa tất cả refresh token của user ${userId} sau khi đổi mật khẩu`,
      );

      return {
        message: 'Đổi mật khẩu thành công',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Lỗi đổi mật khẩu', error);
      if (error instanceof QueryFailedError) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Không thể đổi mật khẩu',
        });
      }
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Không thể đổi mật khẩu',
      });
    }
  }
}
