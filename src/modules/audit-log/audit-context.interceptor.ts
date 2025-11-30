import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable, tap } from 'rxjs';
import { MyClsStore } from 'src/shared/interfaces/my-cls-store.interface';
import { IRequest } from 'src/shared/types';
import { AuditContext } from './subscribers/audit-log.subscriber';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditContextInterceptor.name);

  constructor(private readonly clsService: ClsService<MyClsStore>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request: IRequest = context.switchToHttp().getRequest();
    const user = request.user;

    // Thiết lập audit context
    const auditContext: AuditContext = {
      user,
      ipAddress: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: this.generateRequestId(),
      httpMethod: request.method,
      endpoint: request.route?.path || request.url,
      metadata: {
        params: request.params,
        query: this.sanitizeQuery(request.query),
        timestamp: new Date().toISOString(),
      },
    };

    this.clsService.set('auditContext', auditContext);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.debug(
            `✅ Request processed: ${request.method} ${request.url}`,
          );
        },
        error: (error) => {
          this.logger.error(
            `❌ Request failed: ${request.method} ${request.url}`,
            error,
          );

          // Có thể log audit cho failed requests
          this.logFailedRequest(auditContext, error);
        },
      }),
    );
  }

  private getClientIp(request: any): string {
    return (
      request.ip ||
      request.headers['cf-connecting-ip'] ||
      request.headers['x-real-ip'] ||
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeQuery(query: any): any {
    if (!query || typeof query !== 'object') return query;

    const sanitized = { ...query };
    const sensitiveKeys = ['password', 'token', 'secret', 'key'];

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '***ĐÃ ẨN***';
      }
    }

    return sanitized;
  }

  private async logFailedRequest(
    context: AuditContext,
    error: any,
  ): Promise<void> {
    // Implementation để log failed requests nếu cần
    this.logger.debug('Failed request context:', {
      endpoint: context.endpoint,
      method: context.httpMethod,
      user: context.user?.username,
      error: error?.message,
    });
  }
}
