import { HttpException, HttpStatus } from '@nestjs/common';

/** Base domain exception */
export class AppException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super({ message, error: HttpStatus[status] }, status);
  }
}

export class NotFoundException extends AppException {
  constructor(resource: string) {
    super(`${resource} not found`, HttpStatus.NOT_FOUND);
  }
}

export class ValidationException extends AppException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class ForbiddenException extends AppException {
  constructor(message = 'Access denied') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class ConflictException extends AppException {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT);
  }
}

export class UnauthorizedException extends AppException {
  constructor(message = 'Unauthorized') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}
