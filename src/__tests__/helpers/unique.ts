import { randomUUID } from 'crypto';
export const uniqueEmail = (p='t') => `${p}-${randomUUID()}@test.local`;
export const uniqueId = (p='id') => `${p}-${randomUUID()}`;