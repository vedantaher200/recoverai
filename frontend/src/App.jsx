import { useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  CheckCircle2,
  ChevronDown,
  Database,
  Gauge,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
  Zap,
  Bot,
  Send,
  LogIn,
  CalendarDays,
  ArrowUpRight,
  Clock3,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './App.css';
import api from './services/api';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const navConfig = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Transactions', path: '/transactions' },
  { label: 'AI Recovery Agent', path: '/agent' },
  { label: 'Incidents', path: '/incidents' },
  { label: 'Recovery Center', path: '/recovery' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Audit Trail', path: '/audit' },
  { label: 'AI Assistant', path: '/assistant' },
  { label: 'Settings', path: '/settings' },
];

const gatewayOptions = ['Razorpay', 'Cashfree', 'PayU', 'Stripe', 'Instamojo'];

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [profile, setProfile] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('30 days');
  const [merchant, setMerchant] = useState('Demo Commerce');
  const [headerContext, setHeaderContext] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [readNotifications, setReadNotifications] = useState(new Set());
  const [openHeaderMenu, setOpenHeaderMenu] = useState('');
  const [agentProcessing, setAgentProcessing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approvePending, setApprovePending] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [gatewayFilter, setGatewayFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [eligibleFilter, setEligibleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('recoverai-demo-session') !== 'logged_out');
  const pageSize = 10;
  const navigate = useNavigate();

  const loadAppData = async () => {
    try {
      setLoading(true);
      setError('');
      const [dashboardRes, txRes, incidentsRes, auditRes, settingsRes, opportunitiesRes, analyticsRes, contextRes, notificationsRes, profileRes] = await Promise.all([
        api.get('/dashboard', { params: { period, merchant } }),
        api.get('/transactions', { params: { merchant } }),
        api.get('/incidents', { params: { merchant } }),
        api.get('/audit-logs'),
        api.get('/settings'),
        api.get('/recovery/opportunities', { params: { merchant } }),
        api.get('/analytics', { params: { period, merchant } }),
        api.get('/header-context', { params: { period, merchant } }),
        api.get('/notifications'),
        api.get('/profile'),
      ]);
      setDashboard(dashboardRes.data);
      setTransactions(txRes.data);
      setIncidents(incidentsRes.data);
      setAuditLogs(auditRes.data);
      setSettings(settingsRes.data);
      setOpportunities(opportunitiesRes.data);
      setAnalytics(analyticsRes.data);
      setHeaderContext(contextRes.data);
      setNotifications(notificationsRes.data);
      setProfile(profileRes.data);
      const analysis = await api.post('/ai/analyze', { incident_id: 'INC-1042' });
      setAiResult(analysis.data);
    } catch (err) {
      setHeaderContext(null);
      setError(err.response?.data?.detail || 'Failed to load RecoverAI data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppData();
  }, [period, merchant]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const haystack = `${tx.transaction_id} ${tx.customer_name} ${tx.failure_reason}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesStatus = statusFilter ? tx.status === statusFilter : true;
      const matchesGateway = gatewayFilter ? tx.gateway === gatewayFilter : true;
      const matchesRisk = riskFilter ? tx.risk_level === riskFilter : true;
      const matchesEligible = eligibleFilter
        ? eligibleFilter === 'Eligible'
          ? tx.recovery_eligible
          : !tx.recovery_eligible
        : true;
      return matchesSearch && matchesStatus && matchesGateway && matchesRisk && matchesEligible;
    });
  }, [transactions, search, statusFilter, gatewayFilter, riskFilter, eligibleFilter]);

  const paginatedTransactions = filteredTransactions.slice((page - 1) * pageSize, page * pageSize);
  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));

  const handleAnalyze = async () => {
    try {
      setAgentProcessing(true);
      const res = await api.post('/ai/analyze', { incident_id: 'INC-1042' });
      setAiResult(res.data);
      navigate('/agent');
      await loadAppData();
    } catch (err) {
      setError(err.response?.data?.detail || 'AI analysis failed.');
      console.error(err);
    } finally {
      setAgentProcessing(false);
    }
  };

  const handleLoadDemoIncident = async () => {
    try {
      await api.get('/load-demo-incident');
      navigate('/incidents');
      setError('');
    } catch (err) {
      setError('Unable to load the demo incident.');
      console.error(err);
    }
  };

  const handleReviewRecovery = async () => {
    try {
      const res = await api.post('/recovery/preview', {
        incident_id: 'INC-1042',
        strategy: 'Retry eligible transactions',
      });
      setPreview(res.data);
      setConfirmOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteRecovery = async () => {
    try {
      setApprovePending(true);
      const res = await api.post('/recovery/execute', {
        incident_id: 'INC-1042',
        strategy: 'Retry eligible transactions',
        approved: true,
        actor: 'Merchant',
      });
      setExecutionResult(res.data);
      setConfirmOpen(false);
      setApprovePending(false);
      await loadAppData();
    } catch (err) {
      setApprovePending(false);
      setError(err.response?.data?.detail || 'Recovery execution failed.');
      console.error(err);
    }
  };

  const activeIncident = incidents.find((incident) => incident.incident_id === 'INC-1042') || incidents[0];
  const logout = async () => {
    try { await api.post('/logout'); } catch { /* preserve local logout when API is unavailable */ }
    sessionStorage.setItem('recoverai-demo-session', 'logged_out');
    setLoggedIn(false);
  };
  const login = () => { sessionStorage.removeItem('recoverai-demo-session'); setLoggedIn(true); loadAppData(); };

  if (!loggedIn) return <DemoLogin onLogin={login} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">R</div>
          <div>
            <strong>RecoverAI</strong><span className="brand-subtitle">AI Recovery Platform</span>
          </div>
        </div>

        <nav className="nav">
          {navConfig.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-profile"><div className="sidebar-avatar">VA</div><div><strong>{profile?.full_name || 'Vedant Aher'}</strong><span>Merchant Admin</span><small><i className="status-dot" /> Online</small></div></div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-search"><input type="text" placeholder="Search transactions, incidents, users..." /></div>
          <div className="topbar-actions">
            <div className="header-control"><button className="toolbar-btn" onClick={() => setOpenHeaderMenu(openHeaderMenu === 'period' ? '' : 'period')}><CalendarDays size={15} /> {period} <ChevronDown size={14} /></button>{openHeaderMenu === 'period' && <div className="header-popover">{['Today', '7 days', '30 days', '90 days', 'All time'].map((item) => <button key={item} className={period === item ? 'selected-menu-item' : ''} onClick={() => { setPeriod(item); setOpenHeaderMenu(''); }}>{item}</button>)}</div>}</div>
            <div className="header-control"><button className="toolbar-btn icon-only" aria-label="Notifications" onClick={() => setOpenHeaderMenu(openHeaderMenu === 'notifications' ? '' : 'notifications')}><Bell size={16} /><span className="notification-count">{notifications.filter((item) => !readNotifications.has(item.id)).length}</span></button>{openHeaderMenu === 'notifications' && <div className="header-popover notification-popover"><div className="popover-title">Notifications <button onClick={() => setReadNotifications(new Set(notifications.map((item) => item.id)))}>Mark all read</button></div>{notifications.length ? notifications.map((item) => <button className={`notification-item ${readNotifications.has(item.id) ? 'read' : ''}`} key={item.id} onClick={() => setReadNotifications((current) => new Set([...current, item.id]))}><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.timestamp).toLocaleString()}</small></button>) : <p className="empty-popover">No new notifications.</p>}</div>}</div>
            <div className="header-control"><button className={`agent-badge ${agentProcessing ? 'processing' : headerContext ? 'online' : 'offline'}`} onClick={() => setOpenHeaderMenu(openHeaderMenu === 'agent' ? '' : 'agent')}><Zap size={14} /> AI Agent {agentProcessing ? 'Processing' : headerContext ? 'Online' : 'Offline'}</button>{openHeaderMenu === 'agent' && <div className="header-popover status-popover"><strong>AI Recovery Agent</strong><p>Status: {agentProcessing ? 'Processing' : headerContext ? 'Online' : 'Offline'}</p><p>Mode: {headerContext?.agent?.mode || 'Backend unavailable'}</p><p>Last analysis: {headerContext?.agent?.last_analysis ? new Date(headerContext.agent.last_analysis).toLocaleString() : 'Unavailable'}</p><p>Current incidents: {headerContext?.agent?.current_incidents ?? '—'}</p><p>Recoverable transactions: {headerContext?.agent?.recoverable_transactions ?? '—'}</p><p>Revenue at risk: {headerContext ? formatCurrency(headerContext.agent.revenue_at_risk) : '—'}</p></div>}</div>
            <div className="header-control workspace-control"><span>Workspace</span><button className="merchant-picker" onClick={() => setOpenHeaderMenu(openHeaderMenu === 'merchant' ? '' : 'merchant')}>{merchant} <ChevronDown size={14} /></button>{openHeaderMenu === 'merchant' && <div className="header-popover">{(headerContext?.merchants || ['Demo Commerce', 'Demo Retail', 'Demo SaaS']).map((item) => <button key={item} className={merchant === item ? 'selected-menu-item' : ''} onClick={() => { setMerchant(item); setOpenHeaderMenu(''); }}>{item}</button>)}</div>}</div>
            <div className="header-control"><button className="profile-pill" onClick={() => setOpenHeaderMenu(openHeaderMenu === 'admin' ? '' : 'admin')}><User size={16} /> {profile?.full_name?.split(' ')[0] || 'Vedant'}</button>{openHeaderMenu === 'admin' && <div className="header-popover account-popover"><strong>{profile?.full_name || 'Vedant Aher'}</strong><span>Merchant Admin</span><button onClick={() => { navigate('/profile'); setOpenHeaderMenu(''); }}>View Profile</button><button onClick={() => { navigate('/profile?edit=1'); setOpenHeaderMenu(''); }}>Edit Profile</button><button onClick={() => { navigate('/settings'); setOpenHeaderMenu(''); }}>Settings</button><button onClick={() => { setOpenHeaderMenu(''); logout(); }}>Logout</button></div>}</div>
          </div>
        </header>

        {error && <div className="banner error-banner">{error}</div>}
        {loading ? (
          <div className="loader">Loading RecoverAI...</div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardSection dashboard={dashboard} incidents={incidents} auditLogs={auditLogs} onLoadDemo={handleLoadDemoIncident} onAnalyze={handleAnalyze} onAssistant={() => navigate('/assistant')} onNavigate={navigate} />} />
            <Route path="/transactions" element={<TransactionsSection search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} gatewayFilter={gatewayFilter} setGatewayFilter={setGatewayFilter} riskFilter={riskFilter} setRiskFilter={setRiskFilter} eligibleFilter={eligibleFilter} setEligibleFilter={setEligibleFilter} paginatedTransactions={paginatedTransactions} filteredTransactions={filteredTransactions} page={page} setPage={setPage} pageCount={pageCount} />} />
            <Route path="/agent" element={<AgentSection aiResult={aiResult} onAnalyze={handleAnalyze} onReview={handleReviewRecovery} />} />
            <Route path="/incidents" element={<IncidentsSection incidents={incidents} activeIncident={activeIncident} onReview={handleReviewRecovery} onLoadDemo={handleLoadDemoIncident} />} />
            <Route path="/recovery" element={<RecoverySection opportunities={opportunities} onReview={handleReviewRecovery} />} />
            <Route path="/analytics" element={<AnalyticsSection dashboard={dashboard} />} />
            <Route path="/audit" element={<AuditSection auditLogs={auditLogs} />} />
            <Route path="/settings" element={<SettingsSection settings={settings} />} /><Route path="/profile" element={<ProfileSection profile={profile} merchant={merchant} period={period} onSave={async (values) => { const res = await api.patch('/profile', values); setProfile(res.data); }} onNavigate={navigate} onLogout={logout} />} /><Route path="/assistant" element={<AssistantSection period={period} merchant={merchant} onNavigate={navigate} />} />
          </Routes>
        )}

        {preview && confirmOpen && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>Approve Recovery</h3>
              <div className="modal-body">
                <p><strong>Incident:</strong> {preview.incident}</p>
                <p><strong>Strategy:</strong> {preview.strategy}</p>
                <p><strong>Eligible Transactions:</strong> {preview.eligible_transactions}</p>
                <p><strong>Maximum Retry Attempts:</strong> {preview.maximum_retry_attempts}</p>
                <p><strong>Expected Recovery:</strong> {preview.expected_recovery}</p>
                <p><strong>Safety Rule:</strong> {preview.safety_rule}</p>
                <p><strong>Audit Logging:</strong> {preview.audit_logging}</p>
                <p><strong>Human Approval:</strong> {preview.human_approval ? 'Required' : 'Not Required'}</p>
              </div>
              <div className="modal-actions">
                <button className="secondary-btn" onClick={() => setConfirmOpen(false)}>Cancel</button>
                <button className="primary-btn" onClick={handleExecuteRecovery} disabled={approvePending}>
                  {approvePending ? 'Executing...' : 'Approve & Execute'}
                </button>
              </div>
            </div>
          </div>
        )}

        {executionResult && (
          <div className="success-box">
            <CheckCircle2 size={18} />
            <div>
              <strong>Recovery Completed</strong>
              <p>{formatCurrency(executionResult.recovered_amount)} Recovered</p>
              <p>{executionResult.transactions_recovered} Transactions Recovered</p>
              <p>Recovery Rate: {executionResult.recovery_rate}%</p>
              <button className="primary-btn" onClick={() => navigate('/audit')}>View Audit Trail</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DashboardSection({ dashboard, incidents, auditLogs, onLoadDemo, onAnalyze, onAssistant, onNavigate }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  return (
    <div className="page-grid">
      <div className="top-row">
        <div>
          <p className="eyebrow">{greeting}, Vedant <span aria-hidden="true">👋</span></p>
          <h1>Revenue Recovery Overview</h1>
          <p className="subtle">Here’s your payment recovery performance overview.</p>
          <span className="dashboard-agent-status"><i className="status-dot" /> AI Recovery Agent Online</span>
        </div>
        <div className="action-row compact-actions"><button className="secondary-btn" onClick={onAssistant}><Bot size={16} /> Ask Assistant</button><button className="primary-btn" onClick={onLoadDemo}>Load Demo Incident</button></div>
      </div>

      <div className="kpi-grid">
        <StatCard title="Transactions Analyzed" value={dashboard?.transactions_analyzed?.toLocaleString() || '0'} icon={<Database />} />
        <StatCard title="Revenue at Risk" value={formatCurrency(dashboard?.revenue_at_risk || 0)} icon={<Wallet />} accent="amber" />
        <StatCard title="Recovery Eligible" value={formatCurrency(dashboard?.recovery_eligible || 0)} icon={<ShieldCheck />} accent="green" />
        <StatCard title="Revenue Recovered" value={formatCurrency(dashboard?.revenue_recovered || 0)} icon={<TrendingUp />} accent="green" />
        <StatCard title="Recovery Rate" value={`${dashboard?.recovery_rate || 0}%`} icon={<Gauge />} accent="blue" />
        <StatCard title="Active Incidents" value={dashboard?.active_incidents || 0} icon={<Activity />} accent="red" />
      </div>

      <div className="content-grid two-up">
        <Card>
          <div className="card-title-row"><div><h3>Revenue Recovery Trend</h3><span className="card-caption">Selected performance window</span></div><div className="chart-periods"><span>7D</span><strong>30D</strong><span>90D</span></div></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dashboard?.trend || []}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `₹${value / 1000}k`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="revenue_at_risk" stroke="#4f46e5" fill="url(#riskGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="recovery_eligible" stroke="#f59e0b" fill="none" strokeWidth={2} />
                <Area type="monotone" dataKey="revenue_recovered" stroke="#10b981" fill="none" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <RecentActivity auditLogs={auditLogs} onNavigate={onNavigate} />
        </Card>
      </div>
      <div className="content-grid dashboard-lower-grid"><Card><div className="card-title-row"><div><h3>AI Recovery Intelligence</h3><span className="card-caption">Top issue detected</span></div><button className="secondary-btn" onClick={onAnalyze}>Review plan <ArrowUpRight size={15} /></button></div><div className="issue-title"><Zap size={18} /><div><strong>Gateway Timeout Degradation</strong><span>{dashboard?.ai_summary?.summary}</span></div></div><div className="meta-grid"><div><span>Confidence</span><strong>{dashboard?.ai_summary?.confidence || 94}%</strong></div><div><span>Revenue at Risk</span><strong>{formatCurrency(dashboard?.ai_summary?.revenue_at_risk || 125000)}</strong></div><div><span>Eligible</span><strong>{dashboard?.ai_summary?.eligible_transactions || 127}</strong></div></div><div className="intelligence-footer"><span>Recommended: <strong>Retry eligible transactions</strong></span><RiskBadge level="Low" /></div></Card><Card><div className="assistant-teaser"><div className="assistant-teaser-icon"><Bot size={22} /></div><div><span className="beta-badge">BETA</span><h3>AI Assistant</h3><p>Ask about recovery, incidents, transactions, and operations.</p></div></div><button className="assistant-prompt" onClick={onAssistant}>Ask me anything about recovery, incidents, or transactions… <Send size={16} /></button></Card></div>
      <ActiveIncidentsTable incidents={incidents} onNavigate={onNavigate} />
    </div>
  );
}

function RecentActivity({ auditLogs, onNavigate }) {
  const entries = auditLogs.slice(0, 4);
  return <><div className="card-title-row"><div><h3>Recent Recovery Activity</h3><span className="card-caption">Latest actions from your workspace</span></div><button className="link-btn" onClick={() => onNavigate('/audit')}>View all <ArrowUpRight size={14} /></button></div><div className="activity-list">{entries.length ? entries.map((entry) => <div className="activity-item" key={entry.id}><span className={entry.result === 'Success' ? 'activity-icon success' : 'activity-icon'}><CheckCircle2 size={15} /></span><div><strong>{entry.event_type}</strong><span>{entry.description}</span></div><small><Clock3 size={12} /> {new Date(entry.timestamp).toLocaleDateString()}</small></div>) : <p className="empty-popover">No recovery activity yet.</p>}</div></>;
}

function ActiveIncidentsTable({ incidents, onNavigate }) {
  return <Card><div className="card-title-row"><div><h3>Active Incidents</h3><span className="card-caption">Payment issues requiring attention</span></div><button className="link-btn" onClick={() => onNavigate('/incidents')}>View incidents <ArrowUpRight size={14} /></button></div><div className="table-wrap dashboard-table"><table><thead><tr><th>Incident</th><th>Severity</th><th>Gateway</th><th>Affected</th><th>Revenue at Risk</th><th>Status</th><th>Detected at</th><th /></tr></thead><tbody>{incidents.length ? incidents.slice(0, 4).map((incident) => <tr key={incident.incident_id}><td><strong>{incident.incident_id}</strong><br /><span className="table-muted">{incident.title}</span></td><td><RiskBadge level={incident.severity} /></td><td>{incident.metadata?.gateway || incident.metadata?.affected_gateway || 'Stripe'}</td><td>{incident.affected_transactions}</td><td>{formatCurrency(incident.revenue_at_risk)}</td><td><span className="status-pill danger">{incident.status}</span></td><td>{new Date(incident.detected_at).toLocaleDateString()}</td><td><button className="link-btn" onClick={() => onNavigate('/incidents')}>View</button></td></tr>) : <tr><td colSpan="8">No active incidents.</td></tr>}</tbody></table></div></Card>;
}

function TransactionsSection({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  gatewayFilter,
  setGatewayFilter,
  riskFilter,
  setRiskFilter,
  eligibleFilter,
  setEligibleFilter,
  paginatedTransactions,
  filteredTransactions,
  page,
  setPage,
  pageCount,
}) {
  return (
    <div className="page-grid">
      <div className="top-row">
        <div><h1>Transactions</h1><p className="subtle">Search and review all payments with recovery intelligence.</p></div>
      </div>

      <Card>
        <div className="toolbar-row">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transaction or customer" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Status</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
          </select>
          <select value={gatewayFilter} onChange={(e) => setGatewayFilter(e.target.value)}>
            <option value="">Gateway</option>
            {gatewayOptions.map((gateway) => <option key={gateway} value={gateway}>{gateway}</option>)}
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="">Risk</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          <select value={eligibleFilter} onChange={(e) => setEligibleFilter(e.target.value)}>
            <option value="">Eligibility</option>
            <option value="Eligible">Eligible</option>
            <option value="Not Eligible">Not Eligible</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Timestamp</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Gateway</th>
                <th>Failure Reason</th>
                <th>Risk</th>
                <th>Recovery Eligible</th>
                <th>Recovery Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((tx) => (
                <tr key={tx.transaction_id}>
                  <td>{tx.transaction_id}</td>
                  <td>{new Date(tx.timestamp).toLocaleString()}</td>
                  <td>{tx.customer_name}</td>
                  <td>{formatCurrency(tx.amount)}</td>
                  <td><span className={`status-pill ${tx.status === 'Failed' ? 'danger' : 'success'}`}>{tx.status}</span></td>
                  <td>{tx.gateway}</td>
                  <td>{tx.failure_reason}</td>
                  <td><RiskBadge level={tx.risk_level} /></td>
                  <td>{tx.recovery_eligible ? 'Eligible' : 'Not Required'}</td>
                  <td>{tx.recovery_status}</td>
                  <td><button className="link-btn">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <span>{filteredTransactions.length} records</span>
          <div>
            <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
            <button disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AgentSection({ aiResult, onAnalyze, onReview }) {
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyzeClick = async () => {
    setAnalyzing(true);
    try {
      await onAnalyze();
    } finally {
      setAnalyzing(false);
    }
  };

  const lifecycleSteps = ['OBSERVE', 'REASON', 'DECIDE', 'ACT', 'VERIFY'];
  const getStepStatus = (step) => {
    if (!aiResult) return 'pending';
    if (step === 'OBSERVE' || step === 'REASON' || step === 'DECIDE') return 'completed';
    if (step === 'ACT') return 'awaiting';
    return 'pending';
  };

  return (
    <div className="page-grid">
      <div className="top-row">
        <div><h1>AI Recovery Agent</h1><p className="subtle">Detect. Diagnose. Decide. Recover.</p></div>
        <button className="primary-btn" onClick={handleAnalyzeClick} disabled={analyzing}>
          {analyzing ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      <div className="lifecycle-row">
        {lifecycleSteps.map((step) => (
          <div key={step} className={`life-step ${getStepStatus(step)}`}>
            {step}
            {getStepStatus(step) === 'completed' && <span className="checkmark">✓</span>}
            {getStepStatus(step) === 'awaiting' && <span className="pending-dot">●</span>}
          </div>
        ))}
      </div>

      {aiResult && (
        <div className="content-grid two-up">
          <Card>
            <div className="card-title-row"><h3>AI Root Cause Analysis</h3><span className="confidence-box">Confidence: {aiResult.confidence}%</span></div>
            <div className="analysis-block">
              <p><strong>Summary:</strong> {aiResult.summary}</p>
              <p><strong>Root Cause:</strong> {aiResult.root_cause}</p>
              <p><strong>Affected Gateway:</strong> {aiResult.affected_gateway}</p>
              <p><strong>Dominant Error:</strong> {aiResult.dominant_reason}</p>
              <p><strong>Revenue at Risk:</strong> {formatCurrency(aiResult.revenue_at_risk)}</p>
              <p><strong>Eligible Transactions:</strong> {aiResult.eligible_transactions}</p>
              <p><strong>Expected Recovery:</strong> {aiResult.expected_recovery}</p>
              <p><strong>Risk Level:</strong> {aiResult.risk_level}</p>
              <p><strong>Stopping Rule:</strong> {aiResult.stopping_rule}</p>
            </div>
          </Card>
          <Card>
            <div className="card-title-row"><h3>Evidence & Analysis</h3></div>
            <ul className="evidence-list">
              {aiResult.evidence?.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
            <div className="action-row"><button className="primary-btn" onClick={onReview}>Review Recovery Plan</button></div>
          </Card>
        </div>
      )}
    </div>
  );
}

function IncidentsSection({ incidents, activeIncident, onReview, onLoadDemo }) {
  return (
    <div className="page-grid">
      <div className="top-row">
        <div><h1>Incidents</h1><p className="subtle">Track payment degradation and incident response.</p></div>
        <button className="primary-btn" onClick={onLoadDemo}>Load Demo Incident</button>
      </div>

      <div className="incident-list">
        {incidents.map((incident) => (
          <div key={incident.incident_id} className={`incident-card ${activeIncident?.incident_id === incident.incident_id ? 'selected' : ''}`}>
            <div className="incident-header">
              <span className="incident-id">{incident.incident_id}</span>
              <RiskBadge level={incident.severity} />
            </div>
            <h3>{incident.title}</h3>
            <p>{incident.root_cause}</p>
            <div className="incident-metrics">
              <span>{incident.affected_transactions} affected</span>
              <span>{formatCurrency(incident.revenue_at_risk)} at risk</span>
            </div>
          </div>
        ))}
      </div>

      {activeIncident && (
        <Card>
          <div className="card-title-row"><h3>Incident Details</h3><button className="secondary-btn" onClick={onReview}>Review Recovery</button></div>
          <div className="detail-grid three-col">
            <MetricBox label="Revenue at Risk" value={formatCurrency(activeIncident.revenue_at_risk)} />
            <MetricBox label="Affected Transactions" value={activeIncident.affected_transactions} />
            <MetricBox label="Eligible" value={activeIncident.eligible_transactions} />
            <MetricBox label="Recovered" value={formatCurrency(activeIncident.recovered_amount)} />
            <MetricBox label="Severity" value={activeIncident.severity} />
            <MetricBox label="Confidence" value={`${activeIncident.confidence}%`} />
          </div>
          <div className="timeline">
            {(activeIncident.metadata?.timeline || []).map((step, idx) => (
              <div key={idx} className="timeline-item"><span className="dot" /><span>{step}</span></div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function RecoverySection({ opportunities, onReview }) {
  return (
    <div className="page-grid"><div className="top-row"><div><h1>Recovery Center</h1><p className="subtle">Review and execute safe recovery strategies.</p></div></div>
      <Card><table><thead><tr><th>Opportunity</th><th>Transactions</th><th>Revenue at Risk</th><th>Expected Recovery</th><th>Strategy</th><th>Risk</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{opportunities.length ? opportunities.map((item) => <tr key={item.opportunity}><td>{item.opportunity}</td><td>{item.transactions}</td><td>{formatCurrency(item.revenue_at_risk)}</td><td>{item.expected_recovery}</td><td>{item.strategy}</td><td><RiskBadge level={item.risk} /></td><td>{item.status}</td><td><button className="link-btn" onClick={onReview}>Review</button></td></tr>) : <tr><td colSpan="8">No recovery opportunities available.</td></tr>}</tbody></table></Card>
    </div>
  );
}
function AnalyticsSection({ dashboard }) {
  return (
    <div className="page-grid">
      <div className="top-row"><div><h1>Analytics</h1><p className="subtle">Recovery trends and performance metrics.</p></div></div>
      <div className="content-grid two-up">
        <Card>
          <h3>Recovery Trend</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dashboard?.trend || []}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `₹${value / 1000}k`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="revenue_recovered" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3>Revenue by Failure Reason</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie dataKey="value" data={[
                  { name: 'Gateway Timeout', value: 180000 },
                  { name: 'Bank Declined', value: 120000 },
                  { name: 'Subscription Failed', value: 95000 },
                ]} outerRadius={80} innerRadius={28} paddingAngle={2}>
                  {['#4f46e5', '#f59e0b', '#ef4444'].map((color) => <Cell key={color} fill={color} />)}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AuditSection({ auditLogs }) {
  return (
    <div className="page-grid">
      <div className="top-row"><div><h1>Audit Trail</h1><p className="subtle">Decision history and recovery execution log.</p></div></div>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Event Type</th>
                <th>Description</th>
                <th>Incident</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.actor}</td>
                  <td>{log.event_type}</td>
                  <td>{log.description}</td>
                  <td>{log.incident_id || 'N/A'}</td>
                  <td>{log.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AssistantSection({ period, merchant, onNavigate }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'I’m RecoverAI Assistant. Ask me how to navigate the platform, review recovery work, or understand your current recovery metrics.' }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const suggestions = ['Show me today’s recovery status', 'Where are my transactions?', 'Explain revenue at risk', 'Open Recovery Center', 'Show active incidents', 'Open my profile'];
  const send = async (message = input) => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setMessages((current) => [...current, { role: 'user', text: trimmed }]);
    setInput(''); setError(''); setSending(true);
    try {
      const response = await api.post('/assistant', { message: trimmed, period, merchant });
      setMessages((current) => [...current, { role: 'assistant', text: response.data.answer, action: response.data.action }]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail === 'Not Found'
        ? 'RecoverAI Assistant is unavailable because the backend is running an older version. Restart the FastAPI server and try again.'
        : detail || 'Unable to reach RecoverAI Assistant. Please check the API connection and try again.');
    }
    finally { setSending(false); }
  };
  return <div className="page-grid assistant-page">
    <div className="top-row"><div><h1>RecoverAI Assistant</h1><p className="subtle">Your guide to recovery operations, workspace navigation, and current demo insights.</p></div><span className="agent-badge online"><span className="status-dot" /> AI online</span></div>
    <Card><div className="chat-header"><div><Bot size={22} /><strong>RecoverAI Assistant</strong></div><button className="secondary-btn" onClick={() => { setMessages([{ role: 'assistant', text: 'Chat cleared. How can I help with RecoverAI?' }]); setError(''); }}>Clear chat</button></div>
      <div className="chat-messages">{messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><div>{message.text}</div>{message.action && <button className="link-btn" onClick={() => onNavigate(message.action.path)}>{message.action.label} →</button>}</div>)}{sending && <div className="chat-message assistant">Analyzing your RecoverAI workspace…</div>}</div>
      {error && <div className="banner error-banner">{error}</div>}
      <div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about transactions, recovery, incidents, or metrics…" aria-label="Message RecoverAI Assistant"/><button className="primary-btn" disabled={sending || !input.trim()} aria-label="Send message"><Send size={16} /> Send</button></form>
    </Card>
  </div>;
}

function DemoLogin({ onLogin }) {
  return <main className="login-page"><div className="login-card"><div className="brand-mark">R</div><p className="eyebrow">RecoverAI demo workspace</p><h1>You’re signed out</h1><p className="subtle">Sign back in to access the Vedant Aher administrator workspace and simulated recovery operations.</p><button className="primary-btn login-button" onClick={onLogin}><LogIn size={16} /> Sign in as Vedant Aher</button></div></main>;
}

function ProfileSection({ profile, merchant, period, onSave, onNavigate, onLogout }) {
  const location = useLocation();
  const [editing, setEditing] = useState(() => new URLSearchParams(location.search).get('edit') === '1');
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(() => ({ full_name: profile?.full_name || 'Vedant Aher', email: profile?.email || 'vedantaher2003@gmail.com', notification_preference: profile?.notification_preference || 'Email and in-app' }));
  const save = async () => {
    setSaving(true);
    try { await onSave(values); setEditing(false); } finally { setSaving(false); }
  };
  const details = profile || {};
  const initials = (details.full_name || values.full_name).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <div className="page-grid profile-page">
    <div className="top-row"><div><h1>Administrator Profile</h1><p className="subtle">Manage your RecoverAI workspace access and demo preferences.</p></div><div className="action-row"><button className="secondary-btn" onClick={() => onNavigate('/settings')}>Settings</button><button className="primary-btn" onClick={() => editing ? save() : setEditing(true)} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Edit Profile'}</button></div></div>
    <Card><div className="profile-hero"><div className="profile-avatar">{initials}</div><div><h2>{details.full_name || values.full_name}</h2><p>{details.email || values.email}</p><span className="badge success">Active</span></div></div></Card>
  <div className="content-grid two-up"><Card><h3>Profile Information</h3><div className="profile-fields"><ProfileField label="Full name" value={values.full_name} editing={editing} onChange={(value) => setValues({...values, full_name: value})}/><ProfileField label="Email" value={values.email} editing={editing} onChange={(value) => setValues({...values, email: value})}/><ProfileField label="Role" value={details.role || 'Merchant Admin'}/><ProfileField label="Organization" value={details.organization || 'Demo Commerce'}/><ProfileField label="Account status" value={details.account_status || 'Active'}/></div></Card><Card><h3>Workspace</h3><div className="settings-list"><div><span>Current merchant/workspace</span><strong>{merchant}</strong></div><div><span>Environment</span><strong>Demo</strong></div><div><span>AI Recovery Agent access</span><strong>{details.ai_recovery_access || 'Enabled'}</strong></div><div><span>Dashboard time range</span><strong>{period}</strong></div></div></Card><Card><h3>Security &amp; Session</h3><div className="settings-list"><div><span>Session status</span><strong>{details.session_status || 'Active'}</strong></div><div><span>Last login</span><strong>{details.last_login ? new Date(details.last_login).toLocaleString() : 'Current demo session'}</strong></div><div><span>Current device</span><strong>{details.current_device || 'Local demo workspace'}</strong></div></div></Card><Card><h3>Preferences</h3><div className="profile-fields"><ProfileField label="Notifications" value={values.notification_preference} editing={editing} select onChange={(value) => setValues({...values, notification_preference: value})}/></div><div className="action-row"><button className="secondary-btn" onClick={() => onNavigate('/audit')}>Audit Activity</button><button className="secondary-btn" onClick={onLogout}>Logout</button></div></Card></div>
  </div>;
}

function ProfileField({ label, value, editing, onChange, select }) {
  return <div className="profile-field"><span>{label}</span>{editing && onChange ? (select ? <select value={value} onChange={(event) => onChange(event.target.value)}><option>Email and in-app</option><option>In-app only</option><option>Email only</option></select> : <input value={value} onChange={(event) => onChange(event.target.value)} />) : <strong>{value}</strong>}</div>;
}
function SettingsSection({ settings }) {
  return (
    <div className="page-grid">
      <div className="top-row"><div><h1>Settings</h1><p className="subtle">Configure merchant and recovery policy controls.</p></div></div>
      {settings && (
        <div className="settings-grid">
          <Card>
            <h3>Merchant Settings</h3>
            <div className="settings-list">
              <div><span>Merchant</span><strong>{settings.merchant_name}</strong></div>
              <div><span>Notification email</span><strong>{settings.notification_email}</strong></div>
              <div><span>AI Provider</span><strong>{settings.ai_provider}</strong></div>
            </div>
          </Card>
          <Card>
            <h3>Recovery Policies</h3>
            <div className="settings-list">
              <div><span>Max retry attempts</span><strong>{settings.max_retry_attempts}</strong></div>
              <div><span>Minimum amount</span><strong>{formatCurrency(settings.min_transaction_amount)}</strong></div>
              <div><span>Risk threshold</span><strong>{settings.risk_threshold}</strong></div>
              <div><span>Failure threshold</span><strong>{settings.failure_threshold}</strong></div>
              <div><span>Human approval required</span><strong>{settings.human_approval_required ? 'Yes' : 'No'}</strong></div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ children }) {
  return <div className="card">{children}</div>;
}

function StatCard({ title, value, icon, accent = 'blue' }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${accent}`}>{icon}</div>
      <div>
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value}</div>
      </div>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div className="metric-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RiskBadge({ level }) {
  const direction = {
    Low: 'success',
    Medium: 'warning',
    High: 'danger',
    Critical: 'danger',
  };
  return <span className={`badge ${direction[level] || 'default'}`}>{level}</span>;
}

export default App;
