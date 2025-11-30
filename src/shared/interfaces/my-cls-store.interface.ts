import { ClsStore } from 'nestjs-cls';
import { AuditContext } from 'src/modules/audit-log/subscribers/audit-log.subscriber';


// ClsStore là interface mô tả cấu trúc dữ liệu được lưu trong CLS context. Nó định nghĩa bạn muốn lưu thông tin gì cho mỗi request.
// Giống như một "túi dữ liệu" riêng biệt cho từng request, giúp truy cập:
  // userID
  // requestId
  // roles
  // ...
// bất kì dữ liệu gì mà không cần truyền qua params, không cần inject
// Định nghĩa các giá trị bạn muốn lưu trong từng request
// VD:
// export interface ClsStore {
//   userId: string;
//   requestId: string;
//   role: string;
// }
// set: cls.set("userId", "123")
// get: cls.get("userId")

export interface MyClsStore extends ClsStore {
  auditContext: AuditContext;
}
