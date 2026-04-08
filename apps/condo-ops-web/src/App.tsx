import { startTransition, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { beginSignIn, beginSignOut, restoreAuthSession } from './lib/auth';
import { loadCondoOpsData } from './lib/data-client';
import { loadRuntimeConfig } from './lib/runtime-config';
import type { AuthSession, CondoOpsData, RuntimeConfig } from './types';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 0,
});

function App() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [data, setData] = useState<CondoOpsData | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setIsBooting(true);
      const runtimeConfig = await loadRuntimeConfig();
      const authSession = await restoreAuthSession(runtimeConfig);
      setConfig(runtimeConfig);
      setSession(authSession);
      setIsBooting(false);
    })();
  }, []);

  useEffect(() => {
    if (!config || !session) {
      return;
    }

    void fetchAndStoreData({
      config,
      session,
      setData,
      setErrorMessage,
      setIsRefreshing,
    });
  }, [config, session]);

  async function handleSignIn(): Promise<void> {
    if (!config) {
      return;
    }

    await beginSignIn(config);
  }

  async function handleSignOut(): Promise<void> {
    if (!config) {
      return;
    }

    setErrorMessage(null);
    await beginSignOut(config);
    const authSession = await restoreAuthSession(config);
    setSession(authSession);
  }

  async function handleRefresh(): Promise<void> {
    if (!config || !session) {
      return;
    }

    await fetchAndStoreData({
      config,
      session,
      setData,
      setErrorMessage,
      setIsRefreshing,
    });
  }

  if (isBooting || !config || !session) {
    return <LoadingScreen headline="Preparing Condo Ops" message="Loading runtime configuration and auth state." />;
  }

  if (config.mode === 'aws' && session.status !== 'authenticated') {
    return (
      <SignInScreen
        plannedDomain={config.plannedDomain}
        onSignIn={handleSignIn}
      />
    );
  }

  if (!data) {
    return <LoadingScreen headline="Loading property activity" message="Pulling bookings, ledger entries, and open tasks." />;
  }

  const frame = (content: React.ReactNode) => (
    <PageFrame
      config={config}
      data={data}
      session={session}
      errorMessage={errorMessage}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      onSignOut={handleSignOut}
    >
      {content}
    </PageFrame>
  );

  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/dashboard" />} />
      <Route
        path="/auth/callback"
        element={
          <LoadingScreen
            headline="Finalizing sign-in"
            message="Handing off from Cognito back into the app."
          />
        }
      />
      <Route path="/dashboard" element={frame(<DashboardPage data={data} />)} />
      <Route path="/finances" element={frame(<FinancesPage data={data} />)} />
      <Route path="/bookings" element={frame(<BookingsPage data={data} />)} />
      <Route path="/operations" element={frame(<OperationsPage data={data} />)} />
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );
}

type FrameProps = {
  config: RuntimeConfig;
  data: CondoOpsData;
  session: AuthSession;
  errorMessage: string | null;
  isRefreshing: boolean;
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

function PageFrame({
  config,
  data,
  session,
  errorMessage,
  isRefreshing,
  children,
  onRefresh,
  onSignOut,
}: FrameProps) {
  const isAws = config.mode === 'aws';

  return (
    <div className="app-shell">
      <aside className="app-rail">
        <div className="brand-block">
          <p className="eyebrow">Wasikowski Family Platform</p>
          <h1>Condo Ops</h1>
          <p className="brand-copy">
            Track bookings, income, maintenance, and owner tasks for the Myrtle Beach property.
          </p>
        </div>

        <nav className="nav-list" aria-label="Primary">
          <NavLink className="nav-link" to="/dashboard">
            Dashboard
          </NavLink>
          <NavLink className="nav-link" to="/finances">
            Finances
          </NavLink>
          <NavLink className="nav-link" to="/bookings">
            Bookings
          </NavLink>
          <NavLink className="nav-link" to="/operations">
            Operations
          </NavLink>
        </nav>

        <section className="rail-card">
          <p className="rail-label">Runtime</p>
          <strong>{config.mode === 'demo' ? 'Demo Mode' : 'AWS Mode'}</strong>
          <p>
            {config.mode === 'demo'
              ? 'Local-first preview with sample data.'
              : `Connected for ${config.region} deployment.`}
          </p>
        </section>

        <section className="rail-card">
          <p className="rail-label">Signed In</p>
          <strong>{session.email ?? data.access.email}</strong>
          <p>{data.access.roles.join(', ')}</p>
        </section>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Property Overview</p>
            <h2>{data.dashboard.propertyName}</h2>
            <p className="topbar-copy">
              Shared sign-in across apps, with app-specific access and roles layered on top.
            </p>
          </div>

          <div className="topbar-actions">
            <div className={`mode-pill mode-pill--${config.mode}`}>{config.mode}</div>
            <button className="secondary-button" onClick={() => void onRefresh()} type="button">
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            {isAws ? (
              <button className="ghost-button" onClick={() => void onSignOut()} type="button">
                Sign Out
              </button>
            ) : null}
          </div>
        </header>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

        <section className="summary-grid">
          <SummaryCard label="Net Income" value={currency.format(data.dashboard.netIncome)} accent="teal" />
          <SummaryCard label="Occupancy" value={percent.format(data.dashboard.occupancy)} accent="sand" />
          <SummaryCard label="Reserve" value={currency.format(data.dashboard.maintenanceReserve)} accent="coral" />
          <SummaryCard label="Next Arrival" value={formatDate(data.dashboard.nextArrival)} accent="navy" />
        </section>

        {children}
      </main>
    </div>
  );
}

function DashboardPage({ data }: { data: CondoOpsData }) {
  return (
    <section className="page-grid">
      <div className="panel panel--feature">
        <p className="eyebrow">Monthly Snapshot</p>
        <h3>{data.dashboard.monthLabel}</h3>
        <p className="feature-copy">{data.dashboard.propertyNote}</p>
        <dl className="metric-list">
          <div>
            <dt>Revenue</dt>
            <dd>{currency.format(data.dashboard.revenue)}</dd>
          </div>
          <div>
            <dt>Expenses</dt>
            <dd>{currency.format(data.dashboard.expenses)}</dd>
          </div>
          <div>
            <dt>Arrival</dt>
            <dd>{formatDate(data.dashboard.nextArrival)}</dd>
          </div>
          <div>
            <dt>Departure</dt>
            <dd>{formatDate(data.dashboard.nextDeparture)}</dd>
          </div>
        </dl>
      </div>

      <div className="panel">
        <p className="eyebrow">Alerts</p>
        <div className="alert-list">
          {data.dashboard.alerts.map((alert) => (
            <article key={alert.title} className={`alert-card alert-card--${alert.severity}`}>
              <strong>{alert.title}</strong>
              <p>{alert.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">Upcoming Stays</p>
        <div className="stack-list">
          {data.bookings.slice(0, 3).map((booking) => (
            <article key={booking.id} className="stack-item">
              <div>
                <strong>{booking.guestName}</strong>
                <p>
                  {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
                </p>
              </div>
              <span>{booking.status}</span>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">Open Operations</p>
        <div className="stack-list">
          {data.tasks.map((task) => (
            <article key={task.id} className="stack-item">
              <div>
                <strong>{task.title}</strong>
                <p>
                  {task.owner} | due {formatDate(task.dueDate)}
                </p>
              </div>
              <span>{task.priority}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinancesPage({ data }: { data: CondoOpsData }) {
  return (
    <section className="page-grid">
      <div className="panel panel--wide">
        <p className="eyebrow">Ledger</p>
        <h3>Income and expense activity</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{formatDate(transaction.date)}</td>
                <td>{transaction.category}</td>
                <td>{transaction.vendor}</td>
                <td>{transaction.type}</td>
                <td className={transaction.type === 'income' ? 'amount-positive' : 'amount-negative'}>
                  {currency.format(transaction.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <p className="eyebrow">Takeaways</p>
        <div className="stack-list">
          <article className="stack-item stack-item--plain">
            <strong>Rental income is outpacing spend</strong>
            <p>Net cash flow is comfortably positive for the month with the current booking pace.</p>
          </article>
          <article className="stack-item stack-item--plain">
            <strong>Reserve funding is visible</strong>
            <p>Operational spending and reserve contributions are separated so capital planning is easier.</p>
          </article>
          <article className="stack-item stack-item--plain">
            <strong>Next phase candidate</strong>
            <p>We can add CSV imports from Airbnb and VRBO to reduce manual entry once the platform is deployed.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function BookingsPage({ data }: { data: CondoOpsData }) {
  return (
    <section className="page-grid">
      <div className="panel panel--wide">
        <p className="eyebrow">Booking Pipeline</p>
        <div className="booking-grid">
          {data.bookings.map((booking) => (
            <article key={booking.id} className="booking-card">
              <div className="booking-card__header">
                <strong>{booking.guestName}</strong>
                <span>{booking.source}</span>
              </div>
              <p>
                {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
              </p>
              <div className="booking-card__meta">
                <span>{booking.nights} nights</span>
                <span>{currency.format(booking.grossAmount)}</span>
              </div>
              <div className="status-chip">{booking.status}</div>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">Why This Matters</p>
        <p>
          This page is where we can eventually add owner blocks, cleaner scheduling, and channel-specific
          performance without changing the shared platform underneath.
        </p>
      </div>
    </section>
  );
}

function OperationsPage({ data }: { data: CondoOpsData }) {
  return (
    <section className="page-grid">
      <div className="panel">
        <p className="eyebrow">Task Queue</p>
        <div className="stack-list">
          {data.tasks.map((task) => (
            <article key={task.id} className="stack-item">
              <div>
                <strong>{task.title}</strong>
                <p>
                  {task.owner} | {formatDate(task.dueDate)}
                </p>
              </div>
              <span>{task.status}</span>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">Access Model</p>
        <dl className="metric-list">
          <div>
            <dt>Identity</dt>
            <dd>{data.access.email}</dd>
          </div>
          <div>
            <dt>Roles</dt>
            <dd>{data.access.roles.join(', ')}</dd>
          </div>
          <div>
            <dt>Can Manage Users</dt>
            <dd>{data.access.canManageUsers ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{data.access.mode === 'demo' ? 'Demo dataset' : 'AWS auth + API'}</dd>
          </div>
        </dl>
      </div>

      <div className="panel panel--wide">
        <p className="eyebrow">Next Build Steps</p>
        <div className="stack-list">
          <article className="stack-item stack-item--plain">
            <strong>Real transaction entry</strong>
            <p>Add create and edit flows that write to DynamoDB and enforce admin-only permissions for financial changes.</p>
          </article>
          <article className="stack-item stack-item--plain">
            <strong>User administration</strong>
            <p>Build an admin page for assigning users to apps and roles from the shared ecosystem directory.</p>
          </article>
          <article className="stack-item stack-item--plain">
            <strong>Data imports</strong>
            <p>Pull bookings and payouts from rental channels so the property runs with less manual effort.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function SignInScreen({
  plannedDomain,
  onSignIn,
}: {
  plannedDomain?: string;
  onSignIn: () => Promise<void>;
}) {
  return (
    <div className="loading-screen">
      <div className="sign-in-card">
        <p className="eyebrow">AWS Starter App</p>
        <h1>Condo Ops</h1>
        <p>
          The production version uses shared Cognito sign-in across the family app ecosystem, with per-app access
          and role checks handled by the API.
        </p>
        <div className="sign-in-card__meta">
          <span>Starter domain target: {plannedDomain ?? 'CloudFront default domain'}</span>
          <span>Roles: admin, user</span>
        </div>
        <button className="primary-button" onClick={() => void onSignIn()} type="button">
          Sign In With Cognito
        </button>
      </div>
    </div>
  );
}

function LoadingScreen({
  headline,
  message,
}: {
  headline: string;
  message: string;
}) {
  return (
    <div className="loading-screen">
      <div className="loading-card">
        <p className="eyebrow">Wasikowski App Platform</p>
        <h1>{headline}</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'teal' | 'sand' | 'coral' | 'navy';
}) {
  return (
    <article className={`summary-card summary-card--${accent}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

async function fetchAndStoreData({
  config,
  session,
  setData,
  setErrorMessage,
  setIsRefreshing,
}: {
  config: RuntimeConfig;
  session: AuthSession;
  setData: React.Dispatch<React.SetStateAction<CondoOpsData | null>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setIsRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  if (config.mode === 'aws' && session.status !== 'authenticated') {
    setData(null);
    return;
  }

  setIsRefreshing(true);
  setErrorMessage(null);

  try {
    const nextData = await loadCondoOpsData(config, session.idToken);
    startTransition(() => {
      setData(nextData);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load the condo dashboard.';
    setErrorMessage(message);
  } finally {
    setIsRefreshing(false);
  }
}

export default App;
