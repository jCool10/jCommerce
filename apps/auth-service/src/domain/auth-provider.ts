export const AUTH_PROVIDERS = ['credentials'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];
