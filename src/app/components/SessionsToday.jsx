'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  FiClock, FiUser, FiCalendar, FiChevronLeft, FiChevronRight,
  FiX, FiCheck, FiAlertTriangle, FiActivity, FiTarget, FiPlay,
} from 'react-icons/fi';
import { MotionReplayModal, useMotionReplayModal } from './sessions';
import { apiFetch } from '../api/client';
import verificationApi from '../api/verification-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Format date to YYYY-MM-DD
const formatDateForAPI = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const SessionsToday = ({ trainer }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const [athleteNames, setAthleteNames] = useState({});

  // Motion replay modal state
  const motionReplay = useMotionReplayModal();

  useEffect(() => {
    fetchSessions();
  }, [selectedDate]);

  const fetchSessions = async () => {
    setLoading(true);

    try {
      const dateStr = formatDateForAPI(selectedDate);
      const isToday = formatDateForAPI(new Date()) === dateStr;
      const endpoint = isToday
        ? `${API_BASE}/trainer-app/sessions/today`
        : `${API_BASE}/trainer-app/sessions/by-date?date=${dateStr}`;

      const response = await apiFetch(endpoint);

      if (!response.ok) throw new Error('Failed to fetch sessions');

      const data = await response.json();
      setSessions(data.data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch athlete names for sessions
  useEffect(() => {
    if (!sessions.length) return;
    const fetchNames = async () => {
      const uniqueUserIds = [...new Set(sessions.map(s => s.userId).filter(Boolean))];
      if (uniqueUserIds.length === 0) return;

      const namesMap = {};
      await Promise.all(
        uniqueUserIds.map(async (userId) => {
          if (!athleteNames[userId]) {
            try {
              const name = await verificationApi.getUserName(userId);
              if (name) namesMap[userId] = name;
            } catch (e) {
              console.error(`Failed to fetch name for ${userId}`, e);
            }
          }
        })
      );
      if (Object.keys(namesMap).length > 0) {
        setAthleteNames(prev => ({ ...prev, ...namesMap }));
      }
    };
    fetchNames();
  }, [sessions]);

  // Enrich sessions with athlete names
  const enrichedSessions = useMemo(() => {
    return sessions.map(session => ({
      ...session,
      athleteName: session.athleteName || athleteNames[session.userId] || null
    }));
  }, [sessions, athleteNames]);

  // Enrich selected session with athlete name
  const enrichedSelectedSession = useMemo(() => {
    if (!selectedSession) return null;
    return {
      ...selectedSession,
      athleteName: selectedSession.athleteName || athleteNames[selectedSession.userId] || null
    };
  }, [selectedSession, athleteNames]);

  const fetchSessionDetail = async (sessionId) => {
    setSessionDetailLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/trainer-app/sessions/${sessionId}`);

      if (!response.ok) throw new Error('Failed to fetch session details');

      const data = await response.json();
      setSelectedSession(data.data);
    } catch (error) {
      console.error('Error fetching session details:', error);
      toast.error('Failed to load session details');
    } finally {
      setSessionDetailLoading(false);
    }
  };

  // Date navigation
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = formatDateForAPI(selectedDate) === formatDateForAPI(new Date());

  // Compute stats
  const asPlanned = enrichedSessions.filter((s) => {
    const total = s.exercises?.length || 1;
    const completed = s.exercises?.filter((e) => e.completed).length || 0;
    return completed / total >= 0.8;
  }).length;
  const withDeviations = enrichedSessions.length - asPlanned;

  // Unique batches
  const uniqueBatches = [...new Set(enrichedSessions.map((s) => s.batch || 'General'))];

  // Filter logic
  const filteredSessions = enrichedSessions.filter((s) => {
    const total = s.exercises?.length || 1;
    const completed = s.exercises?.filter((e) => e.completed).length || 0;
    const pct = completed / total;

    let matchesTab = true;
    if (filterTab === 'completed') matchesTab = s.status === 'Closed' || pct >= 0.8;
    if (filterTab === 'flagged') matchesTab = pct < 0.5;

    const matchesBatch =
      batchFilter === 'all' || (s.batch || 'General') === batchFilter;

    return matchesTab && matchesBatch;
  });

  // Flag icons based on session status
  const getFlagIcon = (session) => {
    const total = session.exercises?.length || 1;
    const completed = session.exercises?.filter((e) => e.completed).length || 0;
    const pct = completed / total;
    const overCompleted = completed > total;

    if (pct < 0.5) {
      return (
        <span className="text-amber-500" title="Low completion">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </span>
      );
    }
    if (overCompleted) {
      return (
        <span className="text-red-500" title="Over-executed">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </span>
      );
    }
    if (pct >= 0.8) {
      return (
        <span className="text-emerald-500" title="Completed">
          <FiCheck />
        </span>
      );
    }
    return <span className="text-gray-300">—</span>;
  };

  // If a session is selected, show the detail view
  if (enrichedSelectedSession) {
    return (
      <>
        <SessionDetailView
          session={enrichedSelectedSession}
          onBack={() => setSelectedSession(null)}
          loading={sessionDetailLoading}
          onViewMotion={() => motionReplay.openModal(enrichedSelectedSession, enrichedSelectedSession.athleteName)}
        />
        <MotionReplayModal
          isOpen={motionReplay.isOpen}
          onClose={motionReplay.closeModal}
          session={motionReplay.session}
          athleteName={motionReplay.athleteName}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sessions</h2>
          <p className="text-sm text-gray-500">
            Review & Audit of Training · Planned vs Executed visibility
          </p>
        </div>
        {/* Top stats */}
        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-2xl font-bold text-gray-900">{enrichedSessions.length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Total Sessions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{asPlanned}</p>
            <p className="text-[10px] text-gray-500 uppercase">As Planned</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{withDeviations}</p>
            <p className="text-[10px] text-gray-500 uppercase">With Deviations</p>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Date picker with navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goToPreviousDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Previous day"
          >
            <FiChevronLeft className="text-gray-500" />
          </button>

          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700">
            <FiCalendar className="text-gray-400" />
            <input
              type="date"
              value={formatDateForAPI(selectedDate)}
              onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
              className="border-none bg-transparent focus:outline-none text-sm"
            />
          </div>

          <button
            onClick={goToNextDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Next day"
          >
            <FiChevronRight className="text-gray-500" />
          </button>

          {!isToday && (
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
            >
              Today
            </button>
          )}
        </div>

        {/* Batch dropdown */}
        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Batches</option>
          {uniqueBatches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        {/* Coach display */}
        <div className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700">
          All Coaches
        </div>

        {/* Tab filters */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-auto">
          {[
            { key: 'all', label: 'All' },
            { key: 'completed', label: 'Completed' },
            { key: 'flagged', label: 'Flagged' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${
                filterTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Showing count */}
      <p className="text-xs text-gray-500">
        Showing {filteredSessions.length} sessions from{' '}
        {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>

      {/* Sessions Table */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <p className="text-gray-500">
            {filterTab === 'all'
              ? 'No sessions for this date'
              : `No ${filterTab} sessions for this date`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Athlete
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Batch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Exercises
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Completion
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Flag
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSessions.map((session) => {
                  const total = session.exercises?.length || 0;
                  const completed = session.exercises?.filter((e) => e.completed).length || 0;
                  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

                  // Parse date for display
                  const dateStr = session.date || '';
                  const dateObj = dateStr ? new Date(dateStr) : null;
                  const displayDate = dateObj
                    ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : dateStr;

                  // Get time from closedAt or createdAt
                  let displayTime = '—';
                  if (session.createdAt) {
                    const createdDate = session.createdAt.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
                    displayTime = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  }

                  return (
                    <tr
                      key={session.id}
                      onClick={() => fetchSessionDetail(session.id)}
                      className="hover:bg-gray-50 transition cursor-pointer"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{displayDate}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <FiClock className="text-[10px]" /> {displayTime}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                            <FiUser className="text-gray-400 text-xs" />
                          </div>
                          <span className="text-sm text-gray-900">
                            {session.athleteName || 'Unknown Athlete'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-900">
                          {session.batch || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-900">{total} exercises</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                completionPct >= 80 ? 'bg-emerald-500' :
                                completionPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${completionPct}%` }}
                            />
                          </div>
                          <span className={`text-sm font-semibold ${
                            completionPct >= 80 ? 'text-emerald-600' :
                            completionPct >= 50 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {completionPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          session.status === 'Closed' ? 'bg-emerald-100 text-emerald-700' :
                          session.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {session.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {getFlagIcon(session)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Session Detail View ─────────────────────────────────────────────────────

const SessionDetailView = ({ session, onBack, loading, onViewMotion }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const exercises = session.exercises || [];
  const total = exercises.length;
  const completed = exercises.filter((e) => e.completed).length;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Check if any exercise has SMPL motion data
  const hasMotionData = exercises.some((ex) => ex.gcs_folders && ex.gcs_folders.length > 0);

  // Group exercises by muscle
  const exercisesByMuscle = exercises.reduce((acc, ex) => {
    const muscle = ex.muscle_name || 'Other';
    if (!acc[muscle]) acc[muscle] = [];
    acc[muscle].push(ex);
    return acc;
  }, {});

  // Calculate muscle stats for heatmap
  const muscleStats = Object.entries(exercisesByMuscle).map(([muscle, exs]) => {
    const muscleCompleted = exs.filter((e) => e.completed).length;
    const muscleTotal = exs.length;
    const completionRate = muscleTotal > 0 ? (muscleCompleted / muscleTotal) * 100 : 0;
    const totalReps = exs.reduce((sum, e) => sum + (e.current_reps || 0), 0);
    const targetReps = exs.reduce((sum, e) => sum + (e.reps || 0), 0);

    return {
      muscle,
      exercises: exs,
      completed: muscleCompleted,
      total: muscleTotal,
      completionRate,
      totalReps,
      targetReps,
    };
  }).sort((a, b) => b.total - a.total);

  // Sort exercises by addedAt for timeline
  const sortedExercises = [...exercises].sort((a, b) => {
    const aTime = a.addedAt?.seconds || a.addedAt || 0;
    const bTime = b.addedAt?.seconds || b.addedAt || 0;
    return aTime - bTime;
  });

  // Muscle colors for heatmap
  const getMuscleColor = (completionRate) => {
    if (completionRate >= 80) return 'bg-emerald-500';
    if (completionRate >= 50) return 'bg-amber-500';
    if (completionRate > 0) return 'bg-red-400';
    return 'bg-gray-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <FiChevronLeft className="text-gray-600 text-xl" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Session Details</h2>
          <p className="text-sm text-gray-500">
            {session.date} · {session.athleteName || 'Unknown Athlete'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Motion Replay Button */}
          {hasMotionData && onViewMotion && (
            <button
              onClick={onViewMotion}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-sm transition shadow-lg shadow-emerald-500/20"
            >
              <FiPlay className="w-4 h-4" />
              View Motion
            </button>
          )}
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{completionPct}%</p>
            <p className="text-xs text-gray-500">Completion</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
            session.status === 'Closed' ? 'bg-emerald-100 text-emerald-700' :
            session.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {session.status || 'Pending'}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FiActivity className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
              <p className="text-xs text-gray-500">Total Exercises</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <FiCheck className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{completed}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <FiAlertTriangle className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{total - completed}</p>
              <p className="text-xs text-gray-500">Incomplete</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <FiTarget className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(exercisesByMuscle).length}</p>
              <p className="text-xs text-gray-500">Muscle Groups</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Muscle Heatmap */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Muscle Group Heatmap</h3>
          <p className="text-xs text-gray-500 mb-4">Completion rate by muscle area</p>

          <div className="grid grid-cols-2 gap-3">
            {muscleStats.map((stat) => (
              <div
                key={stat.muscle}
                className="relative p-4 rounded-xl border border-gray-100 overflow-hidden"
              >
                {/* Background fill based on completion */}
                <div
                  className={`absolute inset-0 opacity-20 ${getMuscleColor(stat.completionRate)}`}
                  style={{ width: `${stat.completionRate}%` }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{stat.muscle}</span>
                    <span className={`text-sm font-bold ${
                      stat.completionRate >= 80 ? 'text-emerald-600' :
                      stat.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {Math.round(stat.completionRate)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{stat.completed}/{stat.total} exercises</span>
                    <span>{stat.totalReps}/{stat.targetReps} reps</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getMuscleColor(stat.completionRate)}`}
                      style={{ width: `${stat.completionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {muscleStats.length === 0 && (
            <p className="text-center text-gray-400 py-8">No exercise data available</p>
          )}
        </div>

        {/* Exercise Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Exercise Timeline</h3>
          <p className="text-xs text-gray-500 mb-4">Exercises ordered by execution time</p>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {sortedExercises.map((exercise, idx) => {
              const repsPct = exercise.reps > 0
                ? Math.round((exercise.current_reps / exercise.reps) * 100)
                : 0;

              return (
                <div
                  key={exercise.instanceId || idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    exercise.completed ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${
                      exercise.completed ? 'bg-emerald-500' : 'bg-gray-300'
                    }`} />
                    {idx < sortedExercises.length - 1 && (
                      <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                    )}
                  </div>

                  {/* Exercise content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 truncate">
                        {exercise.name || 'Unknown Exercise'}
                      </span>
                      {exercise.completed ? (
                        <FiCheck className="text-emerald-500 shrink-0" />
                      ) : (
                        <FiX className="text-gray-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                        {exercise.muscle_name || 'Unknown'}
                      </span>
                      <span>
                        {exercise.current_reps || 0} / {exercise.reps || 0} reps
                      </span>
                      {repsPct > 0 && (
                        <span className={`font-medium ${
                          repsPct >= 100 ? 'text-emerald-600' :
                          repsPct >= 80 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          ({repsPct}%)
                        </span>
                      )}
                    </div>

                    {/* Rep progress bar */}
                    {exercise.reps > 0 && (
                      <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            repsPct >= 100 ? 'bg-emerald-500' :
                            repsPct >= 80 ? 'bg-amber-500' : 'bg-red-400'
                          }`}
                          style={{ width: `${Math.min(repsPct, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Exercise image thumbnail */}
                  {exercise.image && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      <img
                        src={exercise.image}
                        alt={exercise.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {sortedExercises.length === 0 && (
              <p className="text-center text-gray-400 py-8">No exercises in this session</p>
            )}
          </div>
        </div>
      </div>

      {/* Exercises by Muscle Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Exercises by Muscle Group</h3>

        <div className="space-y-4">
          {muscleStats.map((stat) => (
            <div key={stat.muscle} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getMuscleColor(stat.completionRate)}`} />
                  <span className="font-medium text-gray-900">{stat.muscle}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {stat.completed}/{stat.total} completed
                </span>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stat.exercises.map((ex, i) => (
                  <div
                    key={ex.instanceId || i}
                    className={`p-3 rounded-lg border ${
                      ex.completed ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {ex.image && (
                        <img
                          src={ex.image}
                          alt={ex.name}
                          className="w-10 h-10 rounded object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{ex.name}</p>
                        <p className="text-xs text-gray-500">
                          {ex.current_reps || 0} / {ex.reps || 0} reps
                        </p>
                      </div>
                      {ex.completed ? (
                        <FiCheck className="text-emerald-500 shrink-0" />
                      ) : (
                        <FiX className="text-gray-300 shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SessionsToday;
