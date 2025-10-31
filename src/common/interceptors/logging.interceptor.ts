import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Logger } from 'pino';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { id?: string }>();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response & { statusCode: number }>();
          const durationMs = Date.now() - start;
          this.logger.info(
            {
              method,
              url,
              durationMs,
              statusCode: response?.statusCode
            },
            'Handled HTTP request'
          );
        },
        error: (err: unknown) => {
          const durationMs = Date.now() - start;
          this.logger.error(
            {
              method,
              url,
              durationMs,
              err
            },
            'HTTP request errored'
          );
        }
      })
    );
  }
}
