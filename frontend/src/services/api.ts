import type {
  ChatRequest,
  ChatResponse,
  Conversation,
  ConversationWithMessages,
} from '@/types';
import { getAccessToken } from '@/lib/auth';

interface ErrorPayload {
  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ApiService {
  private readonly baseUrl: string;

  constructor(baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getAccessToken();
    const authorizationHeader: Record<string, string> = token
      ? { Authorization: ['Bearer', token].join(' ') }
      : {};

    return {
      'Content-Type': 'application/json',
      ...authorizationHeader,
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(await this.getAuthHeaders()),
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      let payload: ErrorPayload | null = null;

      try {
        payload = (await response.json()) as ErrorPayload;
      } catch {
        payload = null;
      }

      throw new ApiError(
        payload?.message ?? payload?.error ?? 'An unexpected API error occurred.',
        response.status,
        payload?.code,
        payload?.details,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async listConversations(): Promise<Conversation[]> {
    return this.request<Conversation[]>('/conversations', {
      method: 'GET',
    });
  }

  async getConversation(id: string): Promise<ConversationWithMessages> {
    return this.request<ConversationWithMessages>(`/conversations/${id}`, {
      method: 'GET',
    });
  }

  async deleteConversation(id: string): Promise<void> {
    await this.request<void>(`/conversations/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiService = new ApiService();
