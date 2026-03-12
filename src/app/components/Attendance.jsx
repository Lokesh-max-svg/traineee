"use client";

import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../api/client";
import verificationApi from "../api/verification-api";

// Import modular components
import AttendanceHeader from "./attendance/AttendanceHeader";
import AttendanceKPI from "./attendance/AttendanceKPI";
import AttendanceHeatmapCard from "./attendance/AttendanceHeatmapCard";
import TopPerformersCard from "./attendance/TopPerformersCard";
import SessionOverviewCard from "./attendance/SessionOverviewCard";
import DateSessionsDialog from "./attendance/DateSessionsDialog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Loading Card
function LoadingCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <div className="w-8 h-8 border-3 border-gray-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-500">Loading analytics...</p>
    </div>
  );
}

export default function Attendance() {
  const [range, setRange] = useState("30d");
  const [attendance, setAttendance] = useState(null);
  const [athleteNames, setAthleteNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateDetail, setDateDetail] = useState(null);
  const [dateLoading, setDateLoading] = useState(false);

  // Fetch attendance data
  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`${API_BASE}/trainer-app/attendance?range=${range}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setAttendance(data.data);

        // Fetch names for all athletes
        const athletes = data.data?.athletes || [];
        if (athletes.length > 0) {
          const namesMap = {};
          await Promise.all(
            athletes.map(async (athlete) => {
              const id = athlete.id || athlete.odid;
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
      } catch (err) {
        console.error("Attendance error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [range]);

  // Fetch date details
  useEffect(() => {
    if (!selectedDate) {
      setDateDetail(null);
      return;
    }
    const fetchDateDetail = async () => {
      setDateLoading(true);
      try {
        const res = await apiFetch(`${API_BASE}/trainer-app/attendance/by-date?date=${selectedDate}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setDateDetail(data.data);
      } catch (err) {
        console.error("Date error:", err);
      } finally {
        setDateLoading(false);
      }
    };
    fetchDateDetail();
  }, [selectedDate]);

  // Enrich athletes with names
  const enrichedAthletes = useMemo(() => {
    if (!attendance?.athletes) return [];
    return attendance.athletes.map(athlete => {
      const id = athlete.id || athlete.odid;
      return {
        ...athlete,
        name: athleteNames[id] || athlete.name || athlete.athleteName || null
      };
    });
  }, [attendance, athleteNames]);

  // Calculate streak
  const streak = useMemo(() => {
    if (!attendance?.calendar?.length) return 0;
    const dates = [...attendance.calendar]
      .filter(d => d.count > 0)
      .map(d => d.date)
      .sort()
      .reverse();
    if (dates.length === 0) return 0;
    let count = 0;
    let check = new Date();
    for (let i = 0; i < 90; i++) {
      const str = check.toISOString().split("T")[0];
      if (dates.includes(str)) count++;
      else if (count > 0) break;
      check.setDate(check.getDate() - 1);
    }
    return count;
  }, [attendance]);

  // Computed analytics
  const analytics = useMemo(() => {
    if (!attendance) return null;

    const athletes = attendance.athletes || [];
    const avgCompletion = athletes.length > 0
      ? (athletes.reduce((sum, a) => sum + (a.avgCompletionRate || 0), 0) / athletes.length).toFixed(0)
      : 0;

    const highRisk = athletes.filter(a => (a.avgCompletionRate || 0) < 50).length;

    return { avgCompletion, highRisk };
  }, [attendance]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <AttendanceHeader streak={streak} range={range} setRange={setRange} />

      {loading ? (
        <LoadingCard />
      ) : (
        <>
          {/* Section A: KPI Cards */}
          <AttendanceKPI summary={attendance?.summary} analytics={analytics} />

          {/* Section B: Heatmap + Top Performers Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <AttendanceHeatmapCard data={attendance} onDateClick={setSelectedDate} range={range} />
            </div>
            <div className="lg:col-span-2">
              <TopPerformersCard athletes={enrichedAthletes} />
            </div>
          </div>

          {/* Section C: Session Analytics - Full Width */}
          <SessionOverviewCard
            calendar={attendance?.calendar}
            athletes={enrichedAthletes}
          />

          {/* Date Sessions Dialog */}
          <DateSessionsDialog
            isOpen={!!selectedDate}
            date={selectedDate}
            data={dateDetail}
            loading={dateLoading}
            onClose={() => setSelectedDate(null)}
          />
        </>
      )}
    </div>
  );
}
