'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { FiSearch, FiUser, FiActivity, FiCalendar } from 'react-icons/fi';
import AthleteDetail from './AthleteDetail';
import { apiFetch } from '../api/client';
import verificationApi from '../api/verification-api';

const AthletesList = () => {
  const [athletes, setAthletes] = useState([]);
  const [attendanceData, setAttendanceData] = useState(null);
  const [athleteNames, setAthleteNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [riskFilter, setRiskFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [attendanceLow, setAttendanceLow] = useState(false);
  const [formDeclining, setFormDeclining] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch athletes and attendance data in parallel
      const [athletesRes, attendance7dRes, attendance30dRes] = await Promise.all([
        apiFetch('/trainer-app/clients'),
        apiFetch('/trainer-app/attendance?range=7d'),
        apiFetch('/trainer-app/attendance?range=30d'),
      ]);

      if (!athletesRes.ok) throw new Error('Failed to fetch athletes');

      const athletesData = await athletesRes.json();
      const attendance7d = attendance7dRes.ok ? await attendance7dRes.json() : null;
      const attendance30d = attendance30dRes.ok ? await attendance30dRes.json() : null;

      const fetchedAthletes = athletesData.data || [];
      setAthletes(fetchedAthletes);
      setAttendanceData({
        week: attendance7d?.data || null,
        month: attendance30d?.data || null,
      });

      // Fetch names for all athletes
      if (fetchedAthletes.length > 0) {
        const namesMap = {};
        await Promise.all(
          fetchedAthletes.map(async (athlete) => {
            const id = athlete.id;
            if (id) {
              try {
                const name = await verificationApi.getUserName(id);
                if (name) namesMap[id] = name;
              } catch (e) {
                console.error(`Failed to fetch name for ${id}`, e);
              }
            }
          })
        );
        setAthleteNames(namesMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load athletes');
    } finally {
      setLoading(false);
    }
  };

  // Merge athlete data with attendance stats and names
  const enrichedAthletes = useMemo(() => {
    if (!attendanceData?.month) return athletes.map(a => ({
      ...a,
      name: a.name || athleteNames[a.id] || null,
      stats: null
    }));

    const weekAthletes = attendanceData.week?.athletes || [];
    const monthAthletes = attendanceData.month?.athletes || [];

    // Create lookup maps
    const weekMap = {};
    weekAthletes.forEach(a => { weekMap[a.id] = a; });
    const monthMap = {};
    monthAthletes.forEach(a => { monthMap[a.id] = a; });

    return athletes.map(athlete => {
      // Add athlete name from fetched names
      const athleteName = athlete.name || athleteNames[athlete.id] || null;
      const week = weekMap[athlete.id] || null;
      const month = monthMap[athlete.id] || null;

      // Calculate real metrics
      const attendance7d = week ? Math.round(week.attendanceRate) : 0;
      const attendance30d = month ? Math.round(month.attendanceRate) : 0;
      const avgCompletion = month ? month.avgCompletionRate : 0;
      const totalSessions = month ? month.totalSessions : 0;
      const completedSessions = month ? month.completedSessions : 0;
      const lastSession = month?.lastSession || null;

      // Form score: based on completion rate (0-100 -> 0-10 scale)
      const formScore = avgCompletion / 10;

      // Consistency score: based on how many sessions out of expected
      // If 30 days, expect ~20 workout days, so ratio * 10
      const expectedSessions = 20; // rough estimate for 30 days
      const consistencyScore = Math.min(10, (totalSessions / expectedSessions) * 10);

      // Determine trends by comparing week vs month averages
      const weekCompletion = week?.avgCompletionRate || 0;
      const monthCompletion = month?.avgCompletionRate || 0;
      const formTrend = weekCompletion >= monthCompletion ? 'up' : 'down';

      const weekSessions = week?.totalSessions || 0;
      const expectedWeekSessions = 5;
      const consistencyTrend = weekSessions >= expectedWeekSessions * 0.6 ? 'up' : 'down';

      // Calculate health risk based on real data
      let riskLevel = 'low';
      let riskLabel = 'Ready';

      if (athlete.hasHealthIssues) {
        riskLevel = 'high';
        riskLabel = 'At Risk';
      } else if (attendance30d < 50 || avgCompletion < 50) {
        riskLevel = 'medium';
        riskLabel = 'Monitor';
      } else if (attendance30d < 30 || avgCompletion < 30) {
        riskLevel = 'high';
        riskLabel = 'At Risk';
      }

      // Risk icon type
      let riskIcon = 'none';
      if (riskLevel === 'high' && formScore < 5) riskIcon = 'critical';
      else if (riskLevel === 'high') riskIcon = 'high';
      else if (riskLevel === 'medium') riskIcon = 'medium';
      else if (attendance7d < 50) riskIcon = 'attendance';

      return {
        ...athlete,
        name: athleteName,
        stats: {
          attendance7d,
          attendance30d,
          formScore,
          formTrend,
          consistencyScore,
          consistencyTrend,
          totalSessions,
          completedSessions,
          lastSession,
          avgCompletion,
          risk: { level: riskLevel, label: riskLabel },
          riskIcon,
        },
      };
    });
  }, [athletes, attendanceData, athleteNames]);

  const uniqueBatches = [...new Set(enrichedAthletes.map((a) => a.batch || 'General'))];

  const filteredAthletes = enrichedAthletes.filter((athlete) => {
    const matchesSearch = (athlete.name || athlete.email || '')
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const risk = athlete.stats?.risk || { level: 'low' };
    const matchesRisk =
      riskFilter === 'all' ||
      (riskFilter === 'red' && risk.level === 'high') ||
      (riskFilter === 'amber' && risk.level === 'medium') ||
      (riskFilter === 'green' && risk.level === 'low');

    const matchesBatch =
      batchFilter === 'all' || (athlete.batch || 'General') === batchFilter;

    const attendance7d = athlete.stats?.attendance7d || 0;
    const formTrend = athlete.stats?.formTrend || 'up';
    const matchesAttendance = !attendanceLow || attendance7d < 75;
    const matchesForm = !formDeclining || formTrend === 'down';

    return matchesSearch && matchesRisk && matchesBatch && matchesAttendance && matchesForm;
  });

  const riskCounts = {
    high: enrichedAthletes.filter((a) => a.stats?.risk?.level === 'high').length,
    medium: enrichedAthletes.filter((a) => a.stats?.risk?.level === 'medium').length,
    low: enrichedAthletes.filter((a) => a.stats?.risk?.level === 'low').length,
  };

  if (selectedAthlete) {
    return (
      <AthleteDetail
        athlete={selectedAthlete}
        onBack={() => setSelectedAthlete(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Athletes</h2>
        <p className="text-gray-500 mt-1">
          <span>{enrichedAthletes.length} athletes</span>
          <span className="text-red-500 font-medium"> | {riskCounts.high} at risk</span>
          <span className="text-amber-500 font-medium"> | {riskCounts.medium} monitoring</span>
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          icon={<FiUser className="text-emerald-600" />}
          label="Total Athletes"
          value={enrichedAthletes.length}
          subtext={`${riskCounts.low} ready`}
        />
        <SummaryCard
          icon={<FiActivity className="text-emerald-600" />}
          label="Avg Completion"
          value={`${Math.round(
            enrichedAthletes.reduce((sum, a) => sum + (a.stats?.avgCompletion || 0), 0) /
              Math.max(enrichedAthletes.length, 1)
          )}%`}
          subtext="30-day average"
        />
        <SummaryCard
          icon={<FiCalendar className="text-emerald-600" />}
          label="Active This Week"
          value={enrichedAthletes.filter(a => (a.stats?.attendance7d || 0) > 0).length}
          subtext={`of ${enrichedAthletes.length} athletes`}
        />
        <SummaryCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
          label="Need Attention"
          value={riskCounts.high + riskCounts.medium}
          subtext={`${riskCounts.high} high risk`}
          warning={riskCounts.high > 0}
        />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-64">
            <FiSearch className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search athletes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="h-6 w-px bg-gray-300" />

          {/* Batch filter chips */}
          <span className="text-xs font-semibold text-gray-500 uppercase">Batch:</span>
          {uniqueBatches.map((batch) => (
            <button
              key={batch}
              onClick={() => setBatchFilter(batchFilter === batch ? 'all' : batch)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                batchFilter === batch
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {batch}
            </button>
          ))}

          <div className="h-6 w-px bg-gray-300" />

          {/* Risk filter chips */}
          <span className="text-xs font-semibold text-gray-500 uppercase">Risk:</span>
          {[
            { key: 'red', label: 'Red', dotColor: 'bg-red-500' },
            { key: 'amber', label: 'Amber', dotColor: 'bg-amber-500' },
            { key: 'green', label: 'Green', dotColor: 'bg-emerald-500' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setRiskFilter(riskFilter === item.key ? 'all' : item.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition border flex items-center gap-1.5 ${
                riskFilter === item.key
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${item.dotColor}`} />
              {item.label}
            </button>
          ))}

          <div className="h-6 w-px bg-gray-300" />

          {/* Toggle filters */}
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            Attendance Low:
            <button
              onClick={() => setAttendanceLow(!attendanceLow)}
              className={`relative w-9 h-5 rounded-full transition ${
                attendanceLow ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  attendanceLow ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </label>

          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            Form Declining:
            <button
              onClick={() => setFormDeclining(!formDeclining)}
              className={`relative w-9 h-5 rounded-full transition ${
                formDeclining ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  formDeclining ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Athletes Table */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 mt-3 text-sm">Loading athletes and stats...</p>
        </div>
      ) : filteredAthletes.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-lg">
            {searchTerm
              ? 'No athletes found matching your search'
              : 'No athletes assigned yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Athlete
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Batch
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Form Score
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Sessions
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Attendance
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Risk
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAthletes.map((athlete) => (
                  <AthleteRow
                    key={athlete.id}
                    athlete={athlete}
                    onSelect={() => setSelectedAthlete(athlete)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Summary card component
const SummaryCard = ({ icon, label, value, subtext, warning = false }) => (
  <div className={`bg-white rounded-xl border p-4 ${warning ? 'border-amber-200' : 'border-gray-200'}`}>
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${warning ? 'text-amber-600' : 'text-gray-900'}`}>{value}</div>
    <div className="text-xs text-gray-400 mt-1">{subtext}</div>
  </div>
);

// Trend line SVG component
const TrendLine = ({ direction }) => {
  if (direction === 'up') {
    return (
      <svg width="24" height="12" viewBox="0 0 24 12" className="text-emerald-500">
        <path d="M2 10 L8 6 L14 8 L22 2" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    );
  }
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" className="text-red-500">
      <path d="M2 2 L8 6 L14 4 L22 10" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
};

// Mini sparkline for showing session activity
const MiniSparkline = ({ sessions }) => {
  const bars = Array(7).fill(0);
  const sessionsPerDay = sessions > 0 ? Math.min(sessions, 7) : 0;
  for (let i = 0; i < sessionsPerDay; i++) {
    bars[6 - i] = 1;
  }

  return (
    <div className="flex items-end gap-0.5 h-4">
      {bars.map((active, i) => (
        <div
          key={i}
          className={`w-1 rounded-sm ${active ? 'bg-emerald-500' : 'bg-gray-200'}`}
          style={{ height: active ? '100%' : '40%' }}
        />
      ))}
    </div>
  );
};

// Risk icon component
const RiskIconDisplay = ({ type }) => {
  switch (type) {
    case 'critical':
      return (
        <span className="text-red-500" title="Critical risk">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </span>
      );
    case 'high':
      return (
        <span className="text-red-500" title="High risk">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </span>
      );
    case 'medium':
      return (
        <span className="text-amber-500" title="Medium risk">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z" />
          </svg>
        </span>
      );
    case 'attendance':
      return (
        <span className="text-blue-500" title="Low attendance">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
      );
    default:
      return <span className="text-emerald-500">✓</span>;
  }
};

const AthleteRow = ({ athlete, onSelect }) => {
  const stats = athlete.stats || {};
  const risk = stats.risk || { level: 'low', label: 'Ready' };
  const formScore = stats.formScore || 0;
  const formTrend = stats.formTrend || 'up';
  const totalSessions = stats.totalSessions || 0;
  const attendance7d = stats.attendance7d || 0;
  const attendance30d = stats.attendance30d || 0;
  const riskIcon = stats.riskIcon || 'none';
  const lastSession = stats.lastSession;

  const readinessColors = {
    high: 'text-red-600',
    medium: 'text-amber-600',
    low: 'text-emerald-600',
  };

  const readinessDots = {
    high: 'bg-red-500',
    medium: 'bg-amber-500',
    low: 'bg-emerald-500',
  };

  // Format last session date
  const lastActive = lastSession
    ? new Date(lastSession).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Never';

  return (
    <tr
      className="hover:bg-gray-50 transition cursor-pointer"
      onClick={onSelect}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <FiUser className="text-emerald-600 text-sm" />
          </div>
          <div>
            <span className="font-medium text-gray-900 text-sm block">
              {athlete.name || 'Unknown Athlete'}
            </span>
            <span className="text-xs text-gray-400">Last: {lastActive}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
          {athlete.batch || 'General'}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${readinessDots[risk.level]}`} />
          <span className={`text-sm font-medium ${readinessColors[risk.level]}`}>
            {risk.label}
          </span>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{formScore.toFixed(1)}</span>
          <TrendLine direction={formTrend} />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">{totalSessions}</span>
          <MiniSparkline sessions={totalSessions} />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="text-sm">
          <span className={`font-medium ${attendance7d < 75 ? 'text-red-600' : 'text-emerald-600'}`}>
            7d: {attendance7d}%
          </span>
          <span className="text-gray-400 ml-2">30d: {attendance30d}%</span>
        </div>
      </td>
      <td className="px-4 py-4 text-right">
        <RiskIconDisplay type={riskIcon} />
      </td>
    </tr>
  );
};

export default AthletesList;
