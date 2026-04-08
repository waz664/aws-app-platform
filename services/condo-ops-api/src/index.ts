import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

type AccessProfile = {
  email: string;
  roles: string[];
  mode: 'aws';
  canManageUsers: boolean;
};

type DashboardResponse = {
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
  alerts: Array<{ title: string; detail: string; severity: 'info' | 'warning' | 'success' }>;
};

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const APP_KEY = process.env.APP_KEY ?? 'condo-ops';
const APP_ACCESS_TABLE_NAME = process.env.APP_ACCESS_TABLE_NAME ?? '';
const ALLOW_AUTHENTICATED_READS = process.env.ALLOW_AUTHENTICATED_READS === 'true';
const BOOTSTRAP_ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? '';

const dashboard: DashboardResponse = {
  propertyName: 'Myrtle Beach Condo',
  monthLabel: 'April 2026',
  revenue: 8425,
  expenses: 3112,
  netIncome: 5313,
  occupancy: 0.78,
  maintenanceReserve: 640,
  nextArrival: '2026-04-11',
  nextDeparture: '2026-04-15',
  propertyNote:
    'This starter app is seeded with demo operations data so the full stack can be validated before we wire real bookkeeping and reservation feeds.',
  alerts: [
    {
      title: 'Cleaning Turnover Pending',
      detail: 'A same-day turnover is scheduled for April 15 and still needs cleaner confirmation.',
      severity: 'warning',
    },
    {
      title: 'Reserve Funding Healthy',
      detail: 'The current reserve balance covers the planned HVAC tune-up and one minor repair.',
      severity: 'success',
    },
    {
      title: 'Insurance Renewal In 19 Days',
      detail: 'Review coverage before the policy auto-renews at the end of the month.',
      severity: 'info',
    },
  ],
};

const bookings = [
  {
    id: 'stay-1042',
    guestName: 'Jordan & Casey',
    source: 'VRBO',
    checkIn: '2026-04-11',
    checkOut: '2026-04-15',
    nights: 4,
    grossAmount: 1625,
    status: 'Upcoming',
  },
  {
    id: 'stay-1043',
    guestName: 'The Alvarez Family',
    source: 'Airbnb',
    checkIn: '2026-04-18',
    checkOut: '2026-04-23',
    nights: 5,
    grossAmount: 2140,
    status: 'Confirmed',
  },
  {
    id: 'stay-1044',
    guestName: 'Owner Block',
    source: 'Direct',
    checkIn: '2026-05-02',
    checkOut: '2026-05-05',
    nights: 3,
    grossAmount: 0,
    status: 'Owner Stay',
  },
];

const transactions = [
  {
    id: 'txn-2001',
    date: '2026-04-02',
    category: 'Rental Income',
    vendor: 'VRBO Payout',
    amount: 2480,
    type: 'income',
  },
  {
    id: 'txn-2002',
    date: '2026-04-04',
    category: 'Cleaning',
    vendor: 'Coastal Turnovers LLC',
    amount: 185,
    type: 'expense',
  },
  {
    id: 'txn-2003',
    date: '2026-04-06',
    category: 'HOA',
    vendor: 'Ocean Dunes HOA',
    amount: 640,
    type: 'expense',
  },
  {
    id: 'txn-2004',
    date: '2026-04-07',
    category: 'Maintenance',
    vendor: 'Atlantic Appliance Repair',
    amount: 210,
    type: 'expense',
  },
  {
    id: 'txn-2005',
    date: '2026-04-08',
    category: 'Rental Income',
    vendor: 'Airbnb Payout',
    amount: 1795,
    type: 'income',
  },
];

const tasks = [
  {
    id: 'task-3001',
    title: 'Confirm cleaner for April 15 turnover',
    dueDate: '2026-04-13',
    owner: 'Property Manager',
    priority: 'High',
    status: 'Open',
  },
  {
    id: 'task-3002',
    title: 'Order replacement balcony chair cushions',
    dueDate: '2026-04-20',
    owner: 'Family Admin',
    priority: 'Medium',
    status: 'In Progress',
  },
  {
    id: 'task-3003',
    title: 'Schedule spring HVAC inspection',
    dueDate: '2026-04-24',
    owner: 'Maintenance Vendor',
    priority: 'Medium',
    status: 'Open',
  },
];

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const path = event.rawPath || '/';

  if (path === '/health') {
    return json(200, {
      status: 'ok',
      service: 'condo-ops-api',
      timestamp: new Date().toISOString(),
    });
  }

  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  const userId = claim(claims.sub);
  const email = claim(claims.email) || claim(claims['cognito:username']);

  if (!userId || !email) {
    return json(401, {
      message: 'Authentication is required.',
    });
  }

  const roles = await resolveRoles(userId, email);

  if (roles.length === 0) {
    return json(403, {
      message: 'You are signed in, but do not currently have access to Condo Ops.',
    });
  }

  if (path === '/me') {
    return json(200, {
      email,
      roles,
      mode: 'aws',
      canManageUsers: roles.includes('admin'),
    } satisfies AccessProfile);
  }

  if (path === '/dashboard') {
    return json(200, dashboard);
  }

  if (path === '/bookings') {
    return json(200, bookings);
  }

  if (path === '/transactions') {
    return json(200, transactions);
  }

  if (path === '/tasks') {
    return json(200, tasks);
  }

  return json(404, {
    message: `No route defined for ${path}.`,
  });
}

async function resolveRoles(userId: string, email: string): Promise<string[]> {
  const roles = new Set<string>();

  if (BOOTSTRAP_ADMIN_EMAIL && email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
    roles.add('admin');
    roles.add('user');
  }

  if (APP_ACCESS_TABLE_NAME) {
    const response = await dynamo.send(
      new GetCommand({
        TableName: APP_ACCESS_TABLE_NAME,
        Key: {
          userId,
          appKey: APP_KEY,
        },
      }),
    );

    const item = response.Item;

    if (item?.status === 'ACTIVE' && Array.isArray(item.roles)) {
      for (const role of item.roles) {
        if (typeof role === 'string' && role.trim()) {
          roles.add(role);
        }
      }
    }
  }

  if (roles.size === 0 && ALLOW_AUTHENTICATED_READS) {
    roles.add('user');
  }

  return [...roles];
}

function claim(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function json(
  statusCode: number,
  body: object,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}
