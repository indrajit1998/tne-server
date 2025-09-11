class ApiError extends Error {
  statusCode: number;
  details?: any;
  error: string;

  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.error = message;
  }
}

export default ApiError;
