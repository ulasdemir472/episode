export class ExternalApiError extends Error {
  constructor(
    public readonly service: 'TMDB' | 'OMDb',
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }
}

export function shouldRetryExternalApiError(failureCount: number, error: Error): boolean {
  if (failureCount >= 2) return false;
  if (!(error instanceof ExternalApiError)) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}
