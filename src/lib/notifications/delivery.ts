export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'expired';

export const MAX_DELIVERY_ATTEMPTS = 3;

/** Classifica a resposta HTTP do serviço de push. */
export function classifyPushResponse(httpStatus: number): DeliveryStatus {
  if (httpStatus >= 200 && httpStatus < 300) return 'sent';
  if (httpStatus === 404 || httpStatus === 410) return 'expired';
  return 'failed';
}

/** Endpoint expirado (404/410) deve desativar o device. */
export function shouldDisableDevice(httpStatus: number): boolean {
  return classifyPushResponse(httpStatus) === 'expired';
}

export function shouldRetry(attempts: number, status: DeliveryStatus): boolean {
  if (status !== 'failed') return false;
  return attempts < MAX_DELIVERY_ATTEMPTS;
}

export interface DeviceFailureState {
  failure_count: number;
  disabled_at: string | null;
}

/** Estado do device após uma tentativa. */
export function nextDeviceFailureState(
  current: DeviceFailureState,
  httpStatus: number,
  now = new Date().toISOString(),
): DeviceFailureState {
  const status = classifyPushResponse(httpStatus);
  if (status === 'sent') return { failure_count: 0, disabled_at: null };
  if (status === 'expired') return { failure_count: current.failure_count + 1, disabled_at: now };
  const failure_count = current.failure_count + 1;
  return {
    failure_count,
    disabled_at: failure_count >= 10 ? now : current.disabled_at,
  };
}

/** Divide os devices em lotes para não estourar o tempo da Edge Function. */
export function chunk<T>(items: T[], size = 100): T[][] {
  if (size <= 0) throw new Error('chunk size must be positive');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
