export const PASSWORD_GUIDANCE: string;
export function passwordRequirements(value: unknown): { label: string; met: boolean }[];
export function passwordError(value: unknown): string | null;
export function emailError(value: unknown): string | null;
