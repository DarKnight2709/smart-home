import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from "class-validator"
import { Gender } from 'src/shared/enums/gender.enum';


export class LoginDto {
  // username
  @ApiProperty({
    example: "admin",
  })
  @IsString()
  @IsNotEmpty()
  username: string;



  // password
  @ApiProperty({
    description: "Mật khẩu",
    example: "password123",
  })
  @IsString()
  @IsNotEmpty()
  password: string
}


// response không cần validation
export class LoginResponseDto {
  // token
  @ApiProperty({
    description: "Access token",
    example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9"
  })
  accessToken: string;



  // refresh token
  @ApiProperty({
    description: "Refresh token",
    example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9"
  })
  refreshToken: string;
}

export class RefreshTokenResponseDto {
  // new access token
  @ApiProperty({
    description: "New access token",
    example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9"
  })
  accessToken: string;


  // new refresh token
  @ApiProperty({
    description: "New refresh token",
    example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9"
  })
  refreshToken: string;
}


export class RefreshTokenDto {
  // refresh token cũ muốn làm mới 
  @ApiProperty({
    description: "New refresh token",
    example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9"
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}


export class LogoutResponseDto {
  @ApiProperty({
    description: "Thông báo logout thành công",
    example: "Đăng xuất thành công",
  })
  message: string;
}

export class UpdatePersonalInfoDto {
  @ApiProperty({
    description: 'Họ và tên',
    example: 'Trần Quyen',
    required: false,
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    description: 'Username',
    example: 'quyentran',
    required: false,
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({
    description: 'Giới tính',
    example: 'male',
    required: false,
    enum: Gender,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({
    description: 'Số điện thoại',
    example: '+84901234567',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Email',
    example: '',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Địa chỉ hiện tại',
    example: '123 Lê Lợi, Hà Nội',
    required: false,
  })
  @IsOptional()
  @IsString()
  currentAddress?: string;

  @ApiProperty({
    description: 'Ngày sinh',
    example: '1990-01-01',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Mật khẩu cũ',
    example: 'oldPassword123',
  })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({
    description: 'Mật khẩu mới',
    example: 'newPassword123',
  })
  @IsString()
  @IsNotEmpty()
  newPassword: string;
}