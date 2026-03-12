'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LogOut, Menu, X, Users, Activity, AlertTriangle,
  Calendar, LayoutGrid, PieChart, UserCheck,
  Clock, ChevronsLeft, ChevronRight, Eye, Clipboard,
  Edit, TrendingUp, Zap, Target, Award, Dumbbell,
} from 'lucide-react';
import AthletesList from './AthletesList';
import SessionsToday from './SessionsToday';
import Alerts from './Alerts';
import PlaceholderPage from './PlaceholderPage';
import AthleteAnalysis from './AthleteAnalysis';
import Attendance from './Attendance';
import LoadingOverlay from './LoadingOverlay';
import NotificationBell from './NotificationBell';
import WorkoutSchedulePlanner from './WorkoutSchedulePlanner';
import verificationApi from '../api/verification-api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logoutTrainer } from '../store/authSlice';
import {
  getTeamReadinessScore, getLoadBalanceScore,
} from '../lib/dataUtils';

const NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutGrid },
  { id: 'athletes', label: 'Athletes', icon: Users },
  { id: 'sessions', label: 'Sessions', icon: Calendar },
  { id: 'workouts', label: 'Workout Planner', icon: Dumbbell },
  { id: 'analytics', label: 'Analytics', icon: PieChart },
  { id: 'attendance', label: 'Attendance', icon: UserCheck },
];

const TrainerDashboard = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const trainer = useAppSelector((state) => state.auth.trainer);
  const jwtToken = useAppSelector((state) => state.auth.jwtToken);
  const authStatus = useAppSelector((state) => state.auth.status);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [athletes, setAthletes] = useState([]);
  const [athleteNames, setAthleteNames] = useState({});

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/signin');
      return;
    }

    if (authStatus !== 'authenticated' || !jwtToken) {
      return;
    }

    let isMounted = true;

    const initializeTrainer = async () => {
      try {
        setLoading(true);

        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${API_BASE_URL}/trainer-app/clients`, {
          headers: { Authorization: `Bearer ${jwtToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const athletesList = data.data || [];
          if (!isMounted) {
            return;
          }

          setAthletes(athletesList);

          // Fetch names for all athletes
          const namesMap = {};
          await Promise.all(
            athletesList.map(async (athlete) => {
              const id = athlete.id || athlete.odid;
              if (id && !athlete.name) {
                try {
                  const name = await verificationApi.getUserName(id);
                  if (name) namesMap[id] = name;
                } catch (e) {
                  console.error(`Failed to fetch name for ${id}`);
                }
              }
            })
          );
          if (isMounted) {
            setAthleteNames(namesMap);
          }
        }

        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to initialize trainer:', error);
        if (isMounted) {
          toast.error('Failed to load trainer data');
          setLoading(false);
        }
      }
    };

    initializeTrainer();

    return () => {
      isMounted = false;
    };
  }, [authStatus, jwtToken, router]);

  // Enrich athletes with names
  const enrichedAthletes = useMemo(() => {
    return athletes.map(athlete => {
      const id = athlete.id || athlete.odid;
      return {
        ...athlete,
        name: athlete.name || athleteNames[id] || null
      };
    });
  }, [athletes, athleteNames]);

  const handleLogout = async () => {
    await dispatch(logoutTrainer());
    toast.success('Logged out successfully');
    router.push('/');
  };

  if (authStatus === 'unauthenticated') return null;
  if (authStatus === 'idle' || authStatus === 'loading' || loading) return <LoadingOverlay />;
  if (!trainer) return null;

  const sidebarWidth = sidebarCollapsed ? 'w-[72px]' : 'w-64';
  const mainMargin = sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64';

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <CommandCenter trainer={trainer} jwtToken={jwtToken} onNavigate={setActiveTab} athletes={enrichedAthletes} />;
      case 'athletes':
        return <AthletesList jwtToken={jwtToken} />;
      case 'sessions':
        return <SessionsToday jwtToken={jwtToken} trainer={trainer} />;
      case 'alerts':
        return <Alerts jwtToken={jwtToken} />;
      case 'analytics':
        return <AthleteAnalysis jwtToken={jwtToken} athletes={enrichedAthletes} />;
      case 'attendance':
        return <Attendance jwtToken={jwtToken} />;
      case 'workouts':
        return <WorkoutSchedulePlanner jwtToken={jwtToken} trainer={trainer} />;
      default:
        return <PlaceholderPage title={NAV_ITEMS.find(n => n.id === activeTab)?.label || activeTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen ${sidebarWidth} bg-[#1e293b] text-white flex flex-col z-40 transition-all duration-300 shadow-xl
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">SMARTAN</h1>
                <p className="text-xs text-slate-400">Performance Hub</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full text-left py-3 rounded-xl font-medium transition-all flex items-center gap-3
                  ${sidebarCollapsed ? 'px-3 justify-center' : 'px-4'}
                  ${isActive
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0`} />
                {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <ChevronsLeft className={`w-5 h-5 shrink-0 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className={`${mainMargin} transition-all duration-300 min-h-screen`}>
        {/* Desktop Header Bar */}
        <header className="hidden lg:block sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-8 py-4">
            <div />
            <div className="flex items-center gap-4">
              <NotificationBell jwtToken={jwtToken} />
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">{trainer?.name?.[0]?.toUpperCase() || 'T'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition">
              {sidebarOpen ? <X className="w-6 h-6 text-gray-600" /> : <Menu className="w-6 h-6 text-gray-600" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="font-semibold text-gray-900">SMARTAN</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell jwtToken={jwtToken} />
              <button onClick={handleLogout} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

// ─── Command Center Dashboard ────────────────────────────────────────────────

const CommandCenter = ({ trainer, jwtToken, onNavigate, athletes = [] }) => {
  const [data, setData] = useState({ sessions: [], alerts: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const headers = { Authorization: `Bearer ${jwtToken}` };

        const [sessionsRes, alertsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/trainer-app/sessions/today`, { headers }),
          fetch(`${API_BASE_URL}/trainer-app/alerts`, { headers }),
        ]);

        const sessionsData = await sessionsRes.json();
        const alertsData = await alertsRes.json();

        setData({
          sessions: sessionsData.data || [],
          alerts: alertsData.data || [],
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (jwtToken) fetchAll();
  }, [jwtToken]);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const teamReadiness = getTeamReadinessScore(athletes);
  const loadBalance = getLoadBalanceScore(data.sessions);
  const inProgressCount = data.sessions.filter(s => s.status === 'in-progress').length;

  const groupedSessions = data.sessions.reduce((groups, session) => {
    const batch = session.batch || 'General';
    if (!groups[batch]) groups[batch] = [];
    groups[batch].push(session);
    return groups;
  }, {});

  const atRiskRows = data.alerts.map((alert) => {
    const athlete = athletes.find(a => a.id === alert.userId);
    return {
      ...alert,
      name: athlete?.name || 'Unknown Athlete',
      batch: athlete?.batch || 'General',
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-3 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{currentDate}</p>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {trainer?.name?.split(' ')[0] || 'Coach'}
          </h1>
        </div>
        <button
          onClick={() => onNavigate('athletes')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30"
        >
          <Users className="w-5 h-5" />
          View Athletes
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Team Readiness"
          value={`${teamReadiness}%`}
          subtext={`${athletes.length} athletes`}
          icon={Target}
        />
        <StatCard
          label="At Risk"
          value={data.alerts.length}
          subtext="Need attention"
          icon={AlertTriangle}
          alert={data.alerts.length > 0}
        />
        <StatCard
          label="Sessions Today"
          value={data.sessions.length}
          subtext={`${inProgressCount} in progress`}
          icon={Zap}
        />
        <StatCard
          label="Load Balance"
          value={`${loadBalance.score}%`}
          subtext={loadBalance.status}
          icon={Activity}
          progress={loadBalance.score}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* At-Risk Athletes */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="At-Risk Athletes"
              subtitle="Requiring immediate attention"
              action={
                data.alerts.length > 0 && (
                  <span className="text-sm font-medium px-3 py-1.5 bg-red-50 text-red-600 rounded-lg">
                    {data.alerts.length} alerts
                  </span>
                )
              }
            />
            {atRiskRows.length === 0 ? (
              <EmptyState icon={Award} message="All athletes performing well" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Athlete</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Risk</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {atRiskRows.slice(0, 5).map((row) => (
                      <tr key={row.sessionId} className="hover:bg-gray-50/50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                              {row.name?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{row.name}</p>
                              <p className="text-sm text-gray-500">{row.batch}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {row.incompleteExercises?.length || 0} incomplete
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                            row.risk === 'High' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {row.risk}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">{row.date}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <IconButton icon={Eye} title="View" />
                            <IconButton icon={Clipboard} title="Notes" />
                            <IconButton icon={Edit} title="Edit" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Today's Schedule */}
        <div>
          <Card>
            <CardHeader title="Today's Schedule" subtitle="Sessions by batch" />
            {Object.keys(groupedSessions).length === 0 ? (
              <EmptyState icon={Calendar} message="No sessions scheduled" />
            ) : (
              <div className="divide-y divide-gray-100">
                {Object.entries(groupedSessions).map(([batch, sessions]) => (
                  <BatchGroup key={batch} batch={batch} sessions={sessions} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader
          title="Execution Alerts"
          subtitle="Deviations from planned training"
          action={
            data.alerts.length > 0 && (
              <button
                onClick={() => onNavigate('sessions')}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                View all
              </button>
            )
          }
        />
        {data.alerts.length === 0 ? (
          <EmptyState icon={TrendingUp} message="All sessions on track" />
        ) : (
          <div className="divide-y divide-gray-100">
            {data.alerts.slice(0, 4).map((alert, i) => (
              <div key={alert.sessionId || i} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="font-medium text-gray-900">{alert.incompleteExercises?.length || 0} exercises incomplete</p>
                    <p className="text-sm text-gray-500">{alert.date}</p>
                  </div>
                </div>
                <button onClick={() => onNavigate('sessions')} className="text-sm font-medium text-gray-600 hover:text-emerald-600 px-4 py-2 bg-gray-100 hover:bg-emerald-50 rounded-lg transition-colors">
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ─── Reusable Components ─────────────────────────────────────────────────────

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, subtext, icon: Icon, alert, progress }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${alert ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <Icon className={`w-5 h-5 ${alert ? 'text-red-600' : 'text-emerald-600'}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {subtext && <p className="text-sm text-gray-400">{subtext}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </Card>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="py-12 text-center">
      <Icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500">{message}</p>
    </div>
  );
}

function IconButton({ icon: Icon, title, onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      title={title}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

function BatchGroup({ batch, sessions }) {
  const [open, setOpen] = useState(false);
  const hasActive = sessions.some(s => s.status === 'in-progress');
  const completedCount = sessions.filter(s => s.status === 'completed').length;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
          <div className="text-left">
            <p className="font-semibold text-gray-900">{batch}</p>
            <p className="text-sm text-gray-500">{sessions.length} sessions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasActive && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg">Active</span>
          )}
          <span className="text-sm text-gray-400">{completedCount}/{sessions.length}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-2">
          {sessions.map((session) => {
            const total = session.exercises?.length || 0;
            const completed = session.exercises?.filter(e => e.completed).length || 0;

            return (
              <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">{session.startTime || '09:00'}</span>
                  <StatusBadge status={session.status} />
                </div>
                <span className="text-sm text-gray-500">{completed}/{total}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    'in-progress': 'bg-blue-50 text-blue-700',
    scheduled: 'bg-gray-100 text-gray-600',
    completed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-600',
  };

  const labels = {
    'in-progress': 'Active',
    scheduled: 'Upcoming',
    completed: 'Done',
    cancelled: 'Cancelled',
  };

  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${styles[status] || styles.scheduled}`}>
      {labels[status] || status}
    </span>
  );
}

export default TrainerDashboard;
