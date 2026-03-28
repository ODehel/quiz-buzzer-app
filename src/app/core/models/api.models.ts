export interface TokenResponse {
  token: string;
  expires_in: number;
}

export interface PagedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ApiError {
  status: number;
  error: string;
  message: string;
}
