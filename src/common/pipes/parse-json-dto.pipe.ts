import { BadRequestException, PipeTransform, Type } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

/** Validates a JSON-encoded multipart field against a DTO. */
export class ParseJsonDtoPipe<T extends object> implements PipeTransform<
  string | T,
  T
> {
  constructor(private readonly dtoClass: Type<T>) {}

  transform(value: string | T): T {
    let parsed: unknown = value;

    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new BadRequestException('Expected a valid JSON object.');
      }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('Expected a JSON object.');
    }

    const dto = plainToInstance(this.dtoClass, parsed);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new BadRequestException('Invalid multipart JSON field.');
    }

    return dto;
  }
}
