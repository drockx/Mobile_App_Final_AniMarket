export class ApiError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); }
}
