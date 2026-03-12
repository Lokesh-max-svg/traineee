'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { FiAlertTriangle, FiRefreshCw, FiClock, FiActivity } from 'react-icons/fi';
import { apiFetch } from '../api/client';
import verificationApi from '../api/verification-api';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [athleteNames, setAthleteNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeLastChecked, setTimeLastChecked] = useState(null);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await apiFetch('/api/trainer-app/alerts');

      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      const fetchedAlerts = data.data || [];
      setAlerts(fetchedAlerts);
      setTimeLastChecked(new Date());

      // Fetch names for all athletes in alerts
      if (fetchedAlerts.length > 0) {
        const uniqueUserIds = [...new Set(fetchedAlerts.map(a => a.userId).filter(Boolean))];
        const namesMap = {};
        await Promise.all(
          uniqueUserIds.map(async (userId) => {
            try {
              const name = await verificationApi.getUserName(userId);
              if (name) namesMap[userId] = name;
            } catch (e) {
              console.error(`Failed to fetch name for ${userId}`, e);
            }
          })
        );
        setAthleteNames(namesMap);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  // Enrich alerts with athlete names
  const enrichedAlerts = useMemo(() => {
    return alerts.map(alert => ({
      ...alert,
      athleteName: athleteNames[alert.userId] || null
    }));
  }, [alerts, athleteNames]);

  const incompleteExerciseCount = alerts.reduce(
    (sum, alert) => sum + alert.incompleteExercises.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">At-Risk Athletes</h2>
        <p className="text-gray-500 mt-1">
          Athletes requiring immediate attention
        </p>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">High Risk</p>
              <p className="text-4xl font-bold text-red-600 flex items-center gap-2">
                {alerts.length}
                {alerts.length > 0 && <FiAlertTriangle className="text-2xl" />}
              </p>
            </div>
            <div className="flex gap-1">
              {[...Array(Math.min(alerts.length, 7))].map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-red-400"></div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">Incomplete Exercises</p>
              <p className="text-4xl font-bold text-orange-600">{incompleteExerciseCount}</p>
            </div>
            <FiActivity className="text-5xl text-orange-200" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">Last Updated</p>
              <p className="text-lg font-semibold text-gray-900">
                {timeLastChecked
                  ? timeLastChecked.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </p>
            </div>
            <FiClock className="text-5xl text-gray-200" />
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <button
        onClick={fetchAlerts}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700"
      >
        <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        Refresh Alerts
      </button>

      {/* Alerts List */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl p-12 text-center border border-emerald-200">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-xl font-semibold text-emerald-900">Great Job!</p>
          <p className="text-emerald-700 mt-2">
            All athletes have completed their exercises today
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Athlete
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Batch
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Risk Reason
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Risk Level
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Last Session
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {enrichedAlerts.map((alert) => (
                  <AlertRow key={alert.sessionId} alert={alert} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Alert Row Component
const AlertRow = ({ alert }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-red-50 transition cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <FiAlertTriangle className="text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{alert.athleteName || 'Unknown Athlete'}</p>
              <p className="text-sm text-gray-500">{alert.date}</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
            Elite
          </span>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-orange-600">⚠️</span>
            <span className="text-sm font-medium text-gray-900">
              {alert.incompleteExercises.length} incomplete exercise{alert.incompleteExercises.length !== 1 ? 's' : ''}
            </span>
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold border border-red-200">
            {alert.risk}
          </span>
        </td>
        <td className="px-6 py-4">
          <div>
            <p className="text-sm font-medium text-gray-900">{alert.date}</p>
            <p className="text-xs text-gray-500">
              {Math.round((alert.completedExercises / alert.totalExercises) * 100)}% complete
            </p>
          </div>
        </td>
        <td className="px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition" title="View">
              👁️
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition" title="Edit">
              📝
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition" title="Message">
              💬
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan="6" className="px-6 py-4 bg-red-50">
            <div className="space-y-4">
              {/* Session Details */}
              <div className="bg-white rounded-lg p-4 border border-red-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Status</p>
                    <p className="font-semibold capitalize text-gray-900">{alert.status}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Risk Level</p>
                    <p className="font-semibold text-red-600">{alert.risk}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Total Exercises</p>
                    <p className="font-semibold text-gray-900">{alert.totalExercises}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Completed</p>
                    <p className="font-semibold text-gray-900">{alert.completedExercises}</p>
                  </div>
                </div>

                {/* Incomplete Exercises */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Incomplete Exercises:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {alert.incompleteExercises.map((exercise, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between bg-red-50 rounded-lg px-4 py-3 border border-red-200"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{exercise.name}</p>
                          <p className="text-sm text-red-600">
                            {exercise.current_reps} of {exercise.reps} reps completed
                          </p>
                        </div>
                        <span className="text-red-500 text-xl">⚠️</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Prompt */}
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <div className="flex items-start gap-3">
                  <FiAlertTriangle className="text-orange-600 text-xl flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-orange-900">Action Required</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Contact the athlete to complete remaining exercises. Monitor closely for next session.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default Alerts;
