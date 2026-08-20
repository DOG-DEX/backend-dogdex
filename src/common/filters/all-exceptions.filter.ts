import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const path = httpAdapter.getRequestUrl(ctx.getRequest());
    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    if (httpStatus >= 500) {
      this.logger.error(
        `[HTTP Exception] ${path} - Status: ${httpStatus} - Message: ${message}`,
        exception instanceof Error ? exception.stack : '',
      );
    } else if (!(httpStatus === 404 && path.startsWith('/public/'))) {
      this.logger.warn(
        `[HTTP Exception] ${path} - Status: ${httpStatus} - Message: ${message}`,
      );
    }

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path,
      message,
    };

    // Clean up temporary local uploaded files if request throws an error
    const req = ctx.getRequest();
    if (req) {
      import('fs').then(({ existsSync, promises }) => {
        if (req.file?.path && existsSync(req.file.path)) {
          promises.unlink(req.file.path).catch(() => {});
        }
        if (Array.isArray(req.files)) {
          for (const f of req.files) {
            if (f?.path && existsSync(f.path)) {
              promises.unlink(f.path).catch(() => {});
            }
          }
        }
      });
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}

