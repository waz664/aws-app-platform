export type RuntimeMode = 'demo' | 'aws';

export type AlertItem = {
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'success';
};

export type Booking = {
  id: string;
  guestName: string;
  source: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  grossAmount: number;
  status: string;
};

export type Transaction = {
  id: string;
  date: string;
  category: string;
  vendor: string;
  amount: number;
  type: 'income' | 'expense';
};

export type TaskItem = {
  id: string;
  title: string;
  dueDate: string;
  owner: string;
  priority: string;
  status: string;
};

export type AccessProfile = {
  email: string;
  roles: string[];
  mode: RuntimeMode;
  canManageUsers: boolean;
};

export type DashboardSnapshot = {
  propertyName: string;
  monthLabel: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  occupancy: number;
  maintenanceReserve: number;
  nextArrival: string;
  nextDeparture: string;
  propertyNote: string;
  alerts: AlertItem[];
};

export type CondoOpsData = {
  dashboard: DashboardSnapshot;
  bookings: Booking[];
  transactions: Transaction[];
  tasks: TaskItem[];
  access: AccessProfile;
};

export type DemoRuntimeConfig = {
  mode: 'demo';
  appName: string;
  appKey: string;
  region: string;
  plannedDomain?: string;
};

export type AwsRuntimeConfig = {
  mode: 'aws';
  appName: string;
  appKey: string;
  region: string;
  apiBaseUrl: string;
  plannedDomain?: string;
  auth: {
    userPoolId: string;
    userPoolClientId: string;
    domain: string;
    redirectSignIn: string;
    redirectSignOut: string;
  };
};

export type RuntimeConfig = DemoRuntimeConfig | AwsRuntimeConfig;

export type AuthSession = {
  status: 'demo' | 'guest' | 'authenticated';
  email: string | null;
  idToken: string | null;
};

