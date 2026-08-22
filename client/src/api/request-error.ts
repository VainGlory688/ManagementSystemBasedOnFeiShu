interface BackendErrorResponse {
  status?: number;
  data?: {
    message?: string | string[];
    error?: { message?: string };
  };
}

export function isOptimisticLockConflict(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && (error as { response?: BackendErrorResponse }).response?.status === 409;
}

export function getBackendErrorMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const data = (error as { response?: BackendErrorResponse }).response?.data;
  const message = data?.error?.message || data?.message;
  return Array.isArray(message) ? message.join('；') : message;
}
