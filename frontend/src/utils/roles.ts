import { UserRole } from '../types';

export const isAdminRole = (role?: UserRole) => role === 'ADMIN' || role === 'SUPERADMIN';
export const isSuperAdminRole = (role?: UserRole) => role === 'SUPERADMIN';
