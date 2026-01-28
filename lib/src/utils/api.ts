// src/utils/api.ts
// import axios, { AxiosError } from 'axios';

interface SessionRequestPayload {
  publicKey: string;
  userId?: string;
  email?: string;
  metadata?: Record<string, any>;
  redirectUrl?: string;
  origin: string;
  clientTimestamp?: string;
}

// interface SessionResponse {
//   success: boolean;
//   sessionUrl: string;
//   sessionId: string;
//   expiresAt?: string;
//   error?: {
//     code: string;
//     message: string;
//   };
// }

// const API_BASE_URL = 'https://usepresenz-api.com/v1';

// Optional: central Axios instance (recommended)
// const api = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     'Content-Type': 'application/json',
//     Accept: 'application/json',
//     'X-Presenz-SDK-Version': '1.0.0',
//   },
//   timeout: 15000,
// });

export async function createSession(
  config: Omit<SessionRequestPayload, 'origin' | 'clientTimestamp'>
): Promise<{ sessionUrl: string; sessionId: string }> {
  // const payload: SessionRequestPayload = {
  //   ...config,
  //   origin: window.location.origin,
  //   clientTimestamp: new Date().toISOString(),
  // };
  console.log(config)

  try {
    // const { data } = await api.post<SessionResponse>('/sessions', payload);

    // if (!data.success || !data.sessionUrl || !data.sessionId) {
    //   throw new Error('Invalid session response from server');
    // }

    // if (data.error) {
    //   const err = new Error(data.error.message || 'Session creation failed');
    //   (err as any).code = data.error.code;
    //   throw err;
    // }

    const sessionUrl = "https://presenz.netlify.app/";
    const sessionId = "test";

    // return {
    //   sessionUrl: data.sessionUrl,
    //   sessionId: data.sessionId,
    // };

    return {
      sessionUrl,
      sessionId,
    };
  } catch (error) {
    // const err = error as AxiosError<any>;

    // const normalizedError = {
    //   message:
    //     err.response?.data?.error?.message ||
    //     err.response?.data?.message ||
    //     err.message ||
    //     'Failed to create verification session',
    //   code:
    //     err.response?.data?.error?.code ||
    //     err.code ||
    //     'session_creation_failed',
    //   status: err.response?.status,
    //   details:
    //     err.response?.data ||
    //     err.stack?.split('\n')[0] ||
    //     undefined,
    // };

    // console.error('[Presenz SDK] Session creation failed:', normalizedError);
    // throw normalizedError;

    console.error('[Presenz SDK] Session creation failed:');
    return {
      sessionId:"",
      sessionUrl:""
    }
  }
}

// Optional: Public key validation helper
export function isValidPublicKey(key: string | undefined): boolean {
  if (!key) return false;
  return /^pk_(live|test)_[a-zA-Z0-9]{20,50}$/.test(key);
}
