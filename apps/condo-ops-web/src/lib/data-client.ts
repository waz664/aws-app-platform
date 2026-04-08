import { demoData } from '../demo-data';
import type {
  AccessProfile,
  Booking,
  CondoOpsData,
  DashboardSnapshot,
  RuntimeConfig,
  TaskItem,
  Transaction,
} from '../types';
import { isAwsConfig } from './runtime-config';

export async function loadCondoOpsData(
  config: RuntimeConfig,
  idToken: string | null,
): Promise<CondoOpsData> {
  if (!isAwsConfig(config) || !idToken) {
    return demoData;
  }

  const [dashboard, bookings, transactions, tasks, access] = await Promise.all([
    fetchJson<DashboardSnapshot>(`${config.apiBaseUrl}/dashboard`, idToken),
    fetchJson<Booking[]>(`${config.apiBaseUrl}/bookings`, idToken),
    fetchJson<Transaction[]>(`${config.apiBaseUrl}/transactions`, idToken),
    fetchJson<TaskItem[]>(`${config.apiBaseUrl}/tasks`, idToken),
    fetchJson<AccessProfile>(`${config.apiBaseUrl}/me`, idToken),
  ]);

  return {
    dashboard,
    bookings,
    transactions,
    tasks,
    access,
  };
}

async function fetchJson<T>(url: string, idToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed for ${url}: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}
