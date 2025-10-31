import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Logger } from 'pino';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responsePayload = exception.getResponse();
      if (typeof responsePayload === 'string') {
        message = responsePayload;
      } else if (
        responsePayload &&
        typeof responsePayload === 'object' &&
        'message' in responsePayload
      ) {
        const payloadMessage = (responsePayload as Record<string, unknown>).message;
        if (Array.isArray(payloadMessage)) {
          message = payloadMessage.map((value) => String(value));
        } else if (payloadMessage) {
          message = String(payloadMessage);
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    }

    const normalizedMessage = Array.isArray(message)
      ? message.join(', ')
      : message;

    this.logger.error(
      {
        method: request.method,
        url: request.url,
        status,
        message: normalizedMessage,
        exception
      },
      'HTTP exception handled'
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: normalizedMessage
    });
  }
}
