import { Prisma } from '@prisma/client';

export function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function toPositiveDecimal(value: number) {
  return new Prisma.Decimal(value);
}
