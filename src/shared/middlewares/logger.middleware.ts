import { Injectable, type LoggerService, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction } from 'express';
import { Request, Response } from 'express';

// Ghi lại mọi request: method, URL, Status code, thời gian xử lý, IP, request-id (bắt buộc)

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // lấy thông tin request
    // ip: IP client gửi tới
    const { method, originalUrl, ip } = req;

    // tạo hoặc lấy existing Request-ID
    // Trace từng request trong log
    // khi request đi qua nhiều service (microservice) -> dễ track
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();

    // Quan trọng: gán cho cả req và res
    // Gán request-id và res và res
      // Để tất cả middleware và controller sau đó đều dùng được
      // Để client cũng nhận được request-id trong response header
      // Lợi ích: Client có thể báo lỗi kèm theo request-id -> search log là ra 100%
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    // Ghi thời điểm bắt đầu để tí tính tổng thời gian sử lý request
    const start = Date.now();

    // lắng nghe sự kiện response finish
    // finish chạy khi response gửi xong -> ghi log lúc này là hoàn hảo
    res.on('finish', () => {
      const duration = Date.now() - start;
      // object log
      const logData = {
        requestId,
        method,
        url: originalUrl,
        status: res.statusCode,
        durationMs: duration,
        ip: ip?.replace('::ffff:', '') || 'unknown', // ip client
        userAgent: req.headers['user-agent'], // trình duyệt/thiết bị
      };

      // lỗi server (500+) -> ERROR
      if (res.statusCode >= 500) this.logger.error(logData, 'HTTP Request');
      // lỗi client (400-499) -> WARN
      else if (res.statusCode >= 400) this.logger.warn(logData, 'HTTP Request');
      // Thành công (200 -> 399) -> LOG
      else this.logger.log(logData, 'HTTP Request');
    });

    next();
  }
}