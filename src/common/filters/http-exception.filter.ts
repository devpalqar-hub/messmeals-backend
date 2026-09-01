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

// Fields that must never be written to a log, request body or otherwise.
const REDACTED_KEYS = new Set([
  'password', 'newpassword', 'confirmpassword', 'otp', 'token', 'accesstoken',
  'refreshtoken', 'authorization', 'secret', 'apikey',
]);

/**
 * Global error logger + response formatter. Catches every exception thrown
 * anywhere in the app (controllers, guards, pipes) and:
 *  - logs it (console via Nest's Logger, plus a persisted line in
 *    `logs/error.log`) with full request context — method/path/query/body
 *    (sensitive fields redacted), the authenticated user (if any), the
 *    *actual* validation/error detail (not just the exception's generic
 *    class message), and a full stack trace for server errors,
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

    // The *detailed* error — e.g. for a ValidationPipe failure this pulls out the
    // actual per-field messages ("phone must be a valid phone number", ...) instead
    // of just the exception's generic class message ("Bad Request Exception").
    const detail = this.extractDetail(exception, isHttpException, message);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const timestamp = new Date().toISOString();
    const user = (request as any).user
      ? { id: (request as any).user.id, role: (request as any).user.role }
      : undefined;

    // Server errors (5xx, including anything that isn't an HttpException at
    // all) are real bugs — log with the full stack. Client errors (4xx) are
    // expected/handled — log a quieter one-liner so real problems don't get
    // buried under routine 400/404s.
    const summary = Array.isArray(detail) ? detail.join('; ') : detail;
    const logLine = `${request.method} ${request.url} -> ${status} ${summary}`;
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
      message: detail,
      ...(user ? { user } : {}),
      ...(Object.keys(request.query ?? {}).length ? { query: request.query } : {}),
      ...(this.hasBody(request.body) ? { body: this.redact(request.body) } : {}),
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

  /** Pulls the real, human-readable error detail out of an exception. */
  private extractDetail(
    exception: unknown,
    isHttpException: boolean,
    responseBody: unknown,
  ): string | string[] {
    if (isHttpException) {
      if (typeof responseBody === 'string') return responseBody;
      const innerMessage = (responseBody as any)?.message;
      if (Array.isArray(innerMessage)) return innerMessage; // e.g. ValidationPipe's per-field errors
      if (typeof innerMessage === 'string') return innerMessage;
    }
    return exception instanceof Error ? exception.message : String(exception);
  }

  private hasBody(body: unknown): boolean {
    return !!body && typeof body === 'object' && Object.keys(body).length > 0;
  }

  /** Deep-redacts known-sensitive keys (password/otp/token/...) before logging. */
  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.redact(v));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [
          key,
          REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : this.redact(val),
        ]),
      );
    }
    return value;
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
