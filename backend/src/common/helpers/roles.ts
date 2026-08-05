import { UserRole } from '@prisma/client';

export function isAdminRole(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
}
