import { BaseEntity, Column, Entity, JoinTable, ManyToMany } from "typeorm";
import { UserEntity } from "./user.entity";
import { PermissionEntity } from "./permission.entity";
import { AuditableEntity } from "../base/base.entity";

@Entity("roles")
export class RoleEntity extends AuditableEntity {
  // name
  @Column({
    comment: "tên vai trò",
    unique: true
  })
  name: string

  // description
  @Column({
    comment: "mô tả",
    type: "text",
    default: ""
  })
  description: string


  // is_active
  @Column({
    type: "boolean",
    name: "is_active",
    comment: "tình trạng hoạt động",
    default: true
  })
  isActive: boolean

  // is_system_role
  @Column({
    type: "boolean",
    name: "is_system_role",
    comment: "là vai trò hệ thống",
    default: false
  })
  isSystemRole: boolean


  // Many to many to User
  @ManyToMany(() => UserEntity, (user) => user.roles)
  users: UserEntity[];


  // Many to many to Permission
  @ManyToMany(() => PermissionEntity, (permission) => permission.roles, {
    cascade: false,
  })
  @JoinTable({
    name: "roles_permissions",
    joinColumn: { name: "role_id", referencedColumnName:"id"},
    inverseJoinColumn: { name: "permission_id", referencedColumnName: "id"}
  })
  permissions: PermissionEntity[]

}