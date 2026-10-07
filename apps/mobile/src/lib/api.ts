import type {
  ApiErrorBody,
  DriverPersonalInput,
  DriverRegistrationDto,
  DriverVehicleInput,
  NotificationDto,
  PayoutInput,
  PresignUploadInput,
  PresignedUploadDto,
  SubmitDocumentInput,
  AppConfigDto,
  AuthResponseDto,
  AuthTokensDto,
  EmergencyContactInput,
  ErrorCode,
  MeDto,
  OtpRequestResponse,
  PassengerProfileInput,
  Role,
  UpdateMeInput,
} from '@zinu/shared';
import { API_URL } from './config';
import { getDeviceId, getDeviceInfo } from './device';
import { SecureKeys, secure } from './storage';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Access token lives in memory only; the refresh token is in secure storage. */
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

export async function storeTokens(tokens: AuthTokensDto) {
  accessToken = tokens.accessToken;
  await secure.set(SecureKeys.refreshToken, tokens.refreshToken);
}

export async function clearTokens() {
  accessToken = null;
  await secure.remove(SecureKeys.refreshToken);
}

export const hasStoredSession = async () => Boolean(await secure.get(SecureKeys.refreshToken));

/** Exchanges the refresh token for a new pair. Concurrent callers share one request. */
async function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await secure.get(SecureKeys.refreshToken);
      if (!refreshToken) return false;
      try {
        const tokens = await raw<AuthTokensDto>('POST', '/v1/auth/refresh', { refreshToken });
        await storeTokens(tokens);
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await clearTokens();
        else throw e;
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function raw<T>(method: string, path: string, body?: unknown, token?: string | null): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach ZINU. Check your internet connection.');
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    const err = json?.error;
    throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? 'Something went wrong', err?.details);
  }
  return json as T;
}

/** Authenticated request: refreshes the access token once on 401, then gives up and signs out. */
async function authed<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!accessToken && !(await refreshTokens())) {
    onSessionExpired?.();
    throw new ApiError(401, 'UNAUTHENTICATED', 'Please log in again');
  }
  try {
    return await raw<T>(method, path, body, accessToken);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || e.code === 'ACCOUNT_BLOCKED') throw e;
    if (!(await refreshTokens())) {
      onSessionExpired?.();
      throw e;
    }
    return raw<T>(method, path, body, accessToken);
  }
}

export const api = {
  appConfig: (platform: string, version: string) =>
    raw<AppConfigDto>('GET', `/v1/app/config?platform=${platform}&version=${encodeURIComponent(version)}`),

  requestOtp: async (phone: string) => raw<OtpRequestResponse>('POST', '/v1/auth/otp/request', { phone, deviceId: await getDeviceId() }),

  verifyOtp: async (phone: string, code: string) => {
    const res = await raw<AuthResponseDto>('POST', '/v1/auth/otp/verify', { phone, code, device: await getDeviceInfo() });
    await storeTokens(res);
    return res;
  },

  logout: async () => {
    try {
      await authed<void>('POST', '/v1/auth/logout');
    } finally {
      await clearTokens();
    }
  },

  me: () => authed<MeDto>('GET', '/v1/me'),
  updateMe: (patch: UpdateMeInput) => authed<MeDto>('PATCH', '/v1/me', patch),
  completePassengerProfile: (input: PassengerProfileInput) => authed<MeDto>('POST', '/v1/me/passenger-profile', input),
  activateRole: (role: Role) => authed<MeDto>('POST', '/v1/me/roles', { role }),
  replaceEmergencyContacts: (contacts: EmergencyContactInput[]) => authed<MeDto>('PUT', '/v1/me/emergency-contacts', { contacts }),
  deleteAccount: async () => {
    await authed<void>('DELETE', '/v1/me');
    await clearTokens();
  },

  // ---- Driver registration (Phase 2) ----
  cities: () => raw<{ id: string; name: string; state: string }[]>('GET', '/v1/cities'),
  registration: () => authed<DriverRegistrationDto>('GET', '/v1/driver/registration'),
  savePersonal: (input: DriverPersonalInput) => authed<DriverRegistrationDto>('PUT', '/v1/driver/registration/personal', input),
  saveVehicle: (input: DriverVehicleInput) => authed<DriverRegistrationDto>('PUT', '/v1/driver/registration/vehicle', input),
  submitDocument: (type: string, input: SubmitDocumentInput) => authed<DriverRegistrationDto>('PUT', `/v1/driver/documents/${type}`, input),
  savePayout: (input: PayoutInput) => authed<DriverRegistrationDto>('PUT', '/v1/driver/payout', input),
  submitRegistration: () => authed<DriverRegistrationDto>('POST', '/v1/driver/registration/submit'),

  presignUpload: (input: PresignUploadInput) => authed<PresignedUploadDto>('POST', '/v1/uploads/presign', input),
  confirmUpload: (id: string) => authed<{ uploadId: string }>('POST', `/v1/uploads/${id}/confirm`),
  uploadUrl: (id: string) => authed<{ url: string; contentType: string }>('GET', `/v1/uploads/${id}/url`),

  // ---- Notifications ----
  notifications: () => authed<NotificationDto[]>('GET', '/v1/me/notifications?limit=50'),
  markAllRead: () => authed<void>('POST', '/v1/me/notifications/read-all'),
  setPushToken: (token: string) => authed<void>('PUT', '/v1/me/push-token', { token, provider: 'expo' }),
};
