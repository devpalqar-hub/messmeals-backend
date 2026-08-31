import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global error logger + response formatter. Catches every exception thrown
 * anywhere in the app (controllers, guards, pipes) and:
 *  - logs it (console via Nest's Logger, plus a persisted line in
 *    `logs/error.log`) with request context and, for real server errors, a
 *    full stack trace,
 *  - returns a consistent JSON error response.
 *
 * Registered globally in main.ts via `app.useGlobalFilters(...)`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');
  private readonly logDir = path.join(process.cwd(), 'logs');
  private readonly logFile = path.join(this.logDir, 'error.log');

  constructor() {
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch {
      // If the directory can't be created (e.g. read-only filesystem), file
      // logging is skipped further down — console logging still works.
    }
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // For expected/handled errors (BadRequestException, NotFoundException, ...) keep
    // returning whatever body the exception carries — unchanged from before. For
    // anything unexpected, never leak the raw error/stack to the client — just a
    // generic message; the real detail still goes to the logs below.
    const message = isHttpException
      ? exception.getResponse()
      : 'Internal server error';

    const errorMessage =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const timestamp = new Date().toISOString();

    // Server errors (5xx, including anything that isn't an HttpException at
    // all) are real bugs — log with the full stack. Client errors (4xx) are
    // expected/handled — log a quieter one-liner so real problems don't get
    // buried under routine 400/404s.
    const logLine = `${request.method} ${request.url} -> ${status} ${errorMessage}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logLine, stack);
    } else {
      this.logger.warn(logLine);
    }

    this.writeToFile({
      timestamp,
      method: request.method,
      path: request.url,
      statusCode: status,
      message: errorMessage,
      ...(stack ? { stack } : {}),
    });

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp,
      path: request.url,
      message,
    });
  }

  private writeToFile(entry: Record<string, unknown>) {
    // Fire-and-forget — a logging failure must never break the actual request.
    fs.appendFile(this.logFile, JSON.stringify(entry) + '\n', (err) => {
      if (err) {
        this.logger.warn(`Failed to write error log to ${this.logFile}: ${err.message}`);
      }
    });
  }
}
