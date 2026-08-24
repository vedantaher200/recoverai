import { useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Database,
  Gauge,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
  Zap,
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
  { label: 'Settings', path: '/settings' },
];

const gatewayOptions = ['Razorpay', 'Cashfree', 'PayU', 'Stripe', 'Instamojo'];

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState(null);
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
  const pageSize = 10;
  const navigate = useNavigate();

  const loadAppData = async () => {
    try {
      setLoading(true);
      setError('');
      const [dashboardRes, txRes, incidentsRes, auditRes, settingsRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/transactions'),
        api.get('/incidents'),
        api.get('/audit-logs'),
        api.get('/settings'),
      ]);
      setDashboard(dashboardRes.data);
      setTransactions(txRes.data);
      setIncidents(incidentsRes.data);
      setAuditLogs(auditRes.data);
      setSettings(settingsRes.data);
      const analysis = await api.post('/ai/analyze', { incident_id: 'INC-1042' });
      setAiResult(analysis.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load RecoverAI data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppData();
  }, []);

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
      const res = await api.post('/ai/analyze', { incident_id: 'INC-1042' });
      setAiResult(res.data);
      navigate('/agent');
    } catch (err) {
      console.error(err);
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">R</div>
          <div>
            <strong>RecoverAI</strong>
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
          <div className="status-row"><span className="status-dot" /><span>System Status: Operational</span></div>
          <div className="merchant-label">Demo Merchant</div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-search"><input type="text" placeholder="Search" /></div>
          <div className="topbar-actions">
            <button className="toolbar-btn">30 days <ChevronDown size={14} /></button>
            <button className="toolbar-btn"><Bell size={16} /></button>
            <div className="agent-badge"><Zap size={14} /> AI Agent Online</div>
            <div className="merchant-picker">Demo Commerce <ChevronDown size={14} /></div>
            <div className="profile-pill"><User size={16} /> Admin</div>
          </div>
        </header>

        {error && <div className="banner error-banner">{error}</div>}
        {loading ? (
          <div className="loader">Loading RecoverAI...</div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardSection dashboard={dashboard} onLoadDemo={handleLoadDemoIncident} onAnalyze={handleAnalyze} />} />
            <Route path="/transactions" element={<TransactionsSection transactions={transactions} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} gatewayFilter={gatewayFilter} setGatewayFilter={setGatewayFilter} riskFilter={riskFilter} setRiskFilter={setRiskFilter} eligibleFilter={eligibleFilter} setEligibleFilter={setEligibleFilter} paginatedTransactions={paginatedTransactions} filteredTransactions={filteredTransactions} page={page} setPage={setPage} pageCount={pageCount} />} />
            <Route path="/agent" element={<AgentSection aiResult={aiResult} onAnalyze={handleAnalyze} onReview={handleReviewRecovery} />} />
            <Route path="/incidents" element={<IncidentsSection incidents={incidents} activeIncident={activeIncident} onReview={handleReviewRecovery} onLoadDemo={handleLoadDemoIncident} />} />
            <Route path="/recovery" element={<RecoverySection onReview={handleReviewRecovery} />} />
            <Route path="/analytics" element={<AnalyticsSection dashboard={dashboard} />} />
            <Route path="/audit" element={<AuditSection auditLogs={auditLogs} />} />
            <Route path="/settings" element={<SettingsSection settings={settings} />} />
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

function DashboardSection({ dashboard, onLoadDemo, onAnalyze }) {
  return (
    <div className="page-grid">
      <div className="top-row">
        <div>
          <h1>Revenue Recovery Overview</h1>
          <p className="subtle">Monitor payment failures, revenue at risk, and recovery performance.</p>
        </div>
        <button className="primary-btn" onClick={onLoadDemo}>Load Demo Incident</button>
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
          <div className="card-title-row"><h3>Recovery Trend</h3></div>
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
          <div className="card-title-row">
            <h3>AI Recovery Intelligence</h3>
            <button className="secondary-btn" onClick={onAnalyze}>Review Recovery Plan</button>
          </div>
          <div className="ai-intel">
            <p className="insight-text">{dashboard?.ai_summary?.summary || 'Payment failures increased by 34% during the last 30 minutes. Gateway timeout errors are the strongest correlated failure pattern.'}</p>
            <div className="meta-grid">
              <div><span>Confidence</span><strong>{dashboard?.ai_summary?.confidence || 94}%</strong></div>
              <div><span>Revenue at Risk</span><strong>{formatCurrency(dashboard?.ai_summary?.revenue_at_risk || 125000)}</strong></div>
              <div><span>Eligible Transactions</span><strong>{dashboard?.ai_summary?.eligible_transactions || 127}</strong></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function TransactionsSection({
  transactions,
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

function RecoverySection({ onReview }) {
  return (
    <div className="page-grid">
      <div className="top-row"><div><h1>Recovery Center</h1><p className="subtle">Review and execute safe recovery strategies.</p></div></div>
      <Card>
        <table>
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>Transactions</th>
              <th>Revenue at Risk</th>
              <th>Expected Recovery</th>
              <th>Strategy</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gateway Timeout Recovery</td>
              <td>127</td>
              <td>{formatCurrency(125000)}</td>
              <td>₹82K–₹105K</td>
              <td>Retry</td>
              <td><RiskBadge level="Low" /></td>
              <td>Ready</td>
              <td><button className="link-btn" onClick={onReview}>Review</button></td>
            </tr>
          </tbody>
        </table>
      </Card>
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
