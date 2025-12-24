import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from 'src/shared/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { type Request } from 'express';
import {
  ChangePasswordDto,
  LoginDto,
  LoginResponseDto,
  LogoutResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  UpdatePersonalInfoDto,
} from './auth.dto';
import { IsProtected } from 'src/shared/decorators/protected.decorator';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { UserService } from '../user/user.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // login
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiOperation({
    summary: 'Đăng nhập (Public)',
    description: 'Đăng nhập với username và password',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    const ipAddress = request.ip;
    const userAgent = request.get('user-agent');

    return await this.authService.login(loginDto, ipAddress, userAgent);
  }

  // refresh token
  @Post('refresh-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RefreshTokenResponseDto })
  @ApiOperation({
    summary: 'Làm mới access token và refresh token (Public)',
    description: 'Sử dụng refresh token để lấy access và refresh token mới',
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<RefreshTokenResponseDto> {
    const ipAddress = request.ip;
    const userAgent = request.get('user-agent');

    return this.authService.refreshToken(refreshTokenDto, ipAddress, userAgent);
  }

  //logout
  @Post('logout')
  @IsProtected()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiOperation({
    summary: 'Đăng xuất (Protect)',
    description: 'Đăng xuất đồng thời thu hồi refresh token',
  })
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<LogoutResponseDto> {
    return await this.authService.logout(refreshTokenDto.refreshToken);
  }

  // lấy người dùng hiện tại
  @Get('me')
  @IsProtected()
  @ApiOkResponse({ type: Object })
  @ApiOperation({
    summary: 'Lấy thông tin user từ access token (Protect)',
  })
  async getCurrentUser(@CurrentUser() user: any) {
    return await this.authService.getCurrentUser(user.id);
  }

  @Patch('profile')
  @IsProtected()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cập nhật thông tin cá nhân',
    description:
      'Cập nhật thông tin cá nhân: tên nhân viên, ngày sinh,...',
  })
  async updatePersonalInfo(
    @CurrentUser() user: any,
    @Body() updateDto: UpdatePersonalInfoDto,
  ) {
    return await this.authService.updatePersonalInfo(user.id, updateDto);
  }

  @Patch('change-password')
  @IsProtected()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đổi mật khẩu',
    description:
      'Đổi mật khẩu. Sau khi đổi mật khẩu thành công, tất cả refresh token sẽ bị xóa.',
  })
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return await this.authService.changePassword(user.id, changePasswordDto);
  }
}
