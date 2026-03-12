'use client';

import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiActivity, FiUser } from 'react-icons/fi';
import {
  calculateBMI,
  getHealthRisk,
  getFormScore,
  getConsistencyScore,
  getAttendance7d,
  getAttendance30d,
} from '../lib/dataUtils';
import { apiFetch } from '../api/client';
import verificationApi from '../api/verification-api';

const AthleteDetail = ({ athlete, onBack }) => {
  const [athleteSessions, setAthleteSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName,setuserName] = useState('');
  const fetchuserName = async () =>  {
    try {
        const userName = await verificationApi.getUserName(athlete.id);
        console.log(userName);
        setuserName(userName);
    }
    catch (error) {
      console.error('Failed to fetch the user name', error);
    }
  }
  useEffect(() =>{
    fetchuserName();
  }, []);

  useEffect(() => {
    fetchAthleteSessions();
  }, [athlete.id]);
  console.log(athlete);
  const fetchAthleteSessions = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/trainer-app/sessions/today');

      if (response.ok) {
        const data = await response.json();
        const filtered = data.data.filter((s) => s.userId === athlete.id);
        setAthleteSessions(filtered);
      }
    } catch (error) {
      console.error('Failed to fetch athlete sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const bmi = calculateBMI(athlete);
  const risk = getHealthRisk(athlete);
  const formScore = getFormScore(athlete);
  const consistencyScore = getConsistencyScore(athlete);
  const attendance7d = getAttendance7d(athlete);
  const attendance30d = getAttendance30d(athlete);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
        >
          <FiArrowLeft className="text-2xl" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {athlete.name || 'Athlete Profile'}
          </h2>
          <p className="text-gray-500">{athlete.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Physical Metrics */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Physical Metrics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                label="Height"
                value={athlete.heightInCm || 'N/A'}
                unit="cm"
              />
              <MetricCard
                label="Weight"
                value={athlete.weightInKg || 'N/A'}
                unit="kg"
              />
              <MetricCard
                label="BMI"
                value={bmi || 'N/A'}
                unit={bmi ? 'kg/m²' : ''}
              />
              <MetricCard
                label="Health Issues"
                value={athlete.hasHealthIssues ? 'Yes' : 'No'}
                unit=""
                highlight={athlete.hasHealthIssues ? 'red' : 'green'}
              />
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Performance Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard label="Form" value={formScore.toFixed(1)} unit="/10" />
              <MetricCard
                label="Consistency"
                value={consistencyScore.toFixed(1)}
                unit="/10"
              />
              <MetricCard label="Attendance (7d)" value={`${attendance7d}%`} unit="" />
              <MetricCard label="Attendance (30d)" value={`${attendance30d}%`} unit="" />
            </div>
          </div>

          {/* Today's Sessions */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FiActivity className="text-lg text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Today&apos;s Sessions
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block w-6 h-6 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : athleteSessions.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No sessions scheduled for today
              </p>
            ) : (
              <div className="space-y-4">
                {athleteSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          {/* Athlete ID Card */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              Athlete Name
            </h4>
            <p className="text-sm font-medium text-gray-900">
              {userName || athlete.name || 'Unknown Athlete'}
            </p>
          </div>

          {/* Status Badge */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              Status
            </h4>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  risk.level === 'high'
                    ? 'bg-red-500'
                    : risk.level === 'medium'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
              <span className="text-sm font-semibold text-gray-900">
                Active Athlete
              </span>
            </div>
            <span
              className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                risk.level === 'high'
                  ? 'bg-red-100 text-red-700'
                  : risk.level === 'medium'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {risk.label}
            </span>
          </div>

          {/* Batch */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              Batch
            </h4>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-sm font-medium">
              {athlete.batch || 'U-16'}
            </span>
          </div>

          {/* Additional Info */}
          {athlete.age && (
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Age
              </h4>
              <p className="text-lg font-semibold text-gray-900">
                {athlete.age} years
              </p>
            </div>
          )}

          {athlete.gender && (
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Gender
              </h4>
              <p className="text-lg font-semibold text-gray-900 capitalize">
                {athlete.gender}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, unit, highlight }) => (
  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className="text-xl font-bold text-gray-900">
      {highlight === 'red' && (
        <span className="text-red-600">{value}</span>
      )}
      {highlight === 'green' && (
        <span className="text-emerald-600">{value}</span>
      )}
      {!highlight && value}{' '}
      <span className="text-sm font-normal text-gray-400">{unit}</span>
    </p>
  </div>
);

const SessionCard = ({ session }) => {
  const totalExercises = session.exercises?.length || 0;
  const completedExercises =
    session.exercises?.filter((e) => e.completed === true).length || 0;
  const completionPercentage =
    totalExercises > 0
      ? Math.round((completedExercises / totalExercises) * 100)
      : 0;

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-semibold text-gray-900 capitalize text-sm">
            Status: {session.status}
          </p>
          <p className="text-xs text-gray-500">{session.date}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            completionPercentage === 100
              ? 'bg-emerald-100 text-emerald-700'
              : completionPercentage >= 50
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {completionPercentage}%
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500">
            {completedExercises} of {totalExercises} exercises
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-600 h-full transition-all"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {session.exercises && session.exercises.length > 0 && (
        <div className="text-sm space-y-1">
          {session.exercises.map((ex, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span
                className={`text-xs ${
                  ex.completed ? 'line-through text-gray-400' : 'text-gray-700'
                }`}
              >
                {ex.name}
              </span>
              <span
                className={`text-xs ${
                  ex.completed ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {ex.completed ? '✓' : '○'} {ex.current_reps}/{ex.reps}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AthleteDetail;
