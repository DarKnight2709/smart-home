import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger"
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsUUID,
} from "class-validator"
import { Gender } from "src/shared/enums/gender.enum";



export class CreateUserDto {
  // username
  @ApiProperty({
    description: "username",
    example: "quyentran",
  })
  @IsNotEmpty()
  @IsString()
  username: string;

  // password
  @ApiProperty({
    description: "mật khẩu",
    example: "quyentran123",
  })
  @IsNotEmpty()
  @IsString()
  password: string;

  // fullname
  @ApiProperty({
    description: "Họ và tên đầy đủ",
    example: "Trần Duy Quyến",
  })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  // giới tính
  @ApiProperty({
    description: "Giới tính",
    enum: Gender,
    example: 'MALE',
  })
  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender;

  // ngày/tháng/năm sinh
  @ApiProperty({
    description: "Ngày sinh (YYYY-MM-DD)",
    example: "2000-01-01",
    required: false
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  // phone
  @ApiProperty({
    description: "Số điện thoại",
    example: "+84901234567",
    required: false
  })
  @IsOptional()
  @IsString()
  phone?: string;

  // email
  @ApiProperty({
    description: 'Email',
    example: 'nguyenvana@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;
  // address
  @ApiProperty({
    description: "Địa chỉ",
    example: "123 Đường ABC, Quận 1, TP. HCM",
    required: false
  })
  @IsOptional()
  @IsString()
  currentAddress?: string;

  // roleIds
  @ApiPropertyOptional({
    description: "Danh sách ID vai trò (UUID)",
    example: ["123e4567-e89b-12d3-a456-426614174000"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

export class UpdateUserDto {

  // password
  @ApiPropertyOptional({
    description: "mật khẩu",
    example: "quyentran123",
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  password?: string;

  // fullname
  @ApiPropertyOptional({
    description: "Họ và tên đầy đủ",
    example: "Trần Duy Quyến",
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  fullName?: string;

  // giới tính
  @ApiPropertyOptional({
    description: "Giới tính",
    enum: Gender,
    example: 'MALE',
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  // ngày/tháng/năm sinh
  @ApiPropertyOptional({
    description: "Ngày sinh (YYYY-MM-DD)",
    example: "2000-01-01",
    required: false
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  // phone
  @ApiPropertyOptional({
    description: "Số điện thoại",
    example: "+84901234567",
    required: false
  })
  @IsOptional()
  @IsString()
  phone?: string;

  // email
  @ApiProperty({
    description: 'Email',
    example: 'nguyenvana@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  // address
  @ApiPropertyOptional({
    description: "Địa chỉ",
    example: "123 Đường ABC, Quận 1, TP. HCM",
    required: false
  })
  @IsOptional()
  @IsString()
  currentAddress?: string;

  // roleIds
  @ApiPropertyOptional({
    description: "Danh sách ID vai trò (UUID)",
    example: ["123e4567-e89b-12d3-a456-426614174000"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
