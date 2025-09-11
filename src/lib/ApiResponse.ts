class ApiResponse<T> {
  status: number;
  data: T | null;
  message: string;
  constructor(status: number, data: T | null = null, message: string = "") {
    this.status = status;
    this.data = data;
    this.message = message;
  }
}

const sendResponse = <T>(
  status: number,
  data: T | null = null,
  message: string = ""
): ApiResponse<T> => {
  return new ApiResponse<T>(status, data, message);
};

export default sendResponse;
