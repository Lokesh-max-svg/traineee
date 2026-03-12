"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FiActivity, FiTarget, FiUser, FiCalendar, FiArrowUp, FiArrowDown,
  FiChevronLeft, FiChevronRight, FiZap, FiPercent, FiSearch,
} from "react-icons/fi";
import { apiFetch } from "../api/client";
import verificationApi from "../api/verification-api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Mini Sparkline Component
function Sparkline({ data, color = "#10b981", height = 36, width = 90 }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Metric Card
function MetricCard({ title, value, previousValue, unit = "", sparklineData, icon: Icon }) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  const numPrev = typeof previousValue === "string" ? parseFloat(previousValue) : previousValue;

  const change = numPrev && numPrev > 0 ? ((numValue - numPrev) / numPrev * 100).toFixed(1) : null;
  const isPositive = change && parseFloat(change) > 0;
  const isNegative = change && parseFloat(change) < 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Icon className="w-4 h-4 text-emerald-600" />
            </div>
          )}
          <span className="text-sm text-gray-500">{title}</span>
        </div>
        {change && (
          <span className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${
            isPositive ? "bg-emerald-100 text-emerald-700" :
            isNegative ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
          }`}>
            {isPositive ? <FiArrowUp className="w-3 h-3" /> : isNegative ? <FiArrowDown className="w-3 h-3" /> : null}
            {isPositive ? "+" : ""}{change}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold text-gray-900">
          {typeof value === "number" ? value.toLocaleString() : value}
          {unit && <span className="text-base font-normal text-gray-500 ml-1">{unit}</span>}
        </p>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color="#10b981" height={32} width={70} />
        )}
      </div>
    </div>
  );
}

// Interactive Radar Chart for Muscle Distribution
function RadarChart({ data, size = 220, selectedMuscle, onMuscleSelect }) {
  const [hoveredMuscle, setHoveredMuscle] = useState(null);
  const center = size / 2;
  const radius = size / 2 - 35;

  const muscleGroups = ["Arms", "Chest", "Legs", "Back", "Shoulders", "Core"];
  const angleStep = (2 * Math.PI) / muscleGroups.length;

  const values = muscleGroups.map((muscle) => {
    const found = data.find((d) => d.muscleName === muscle);
    return found ? found.percentage : 0;
  });

  const maxValue = Math.max(...values, 1);

  const points = values.map((value, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (value / maxValue) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  });

  // Create sector paths for click areas
  const getSectorPath = (index) => {
    const startAngle = index * angleStep - Math.PI / 2 - angleStep / 2;
    const endAngle = startAngle + angleStep;
    const outerRadius = radius + 25;

    const x1 = center + outerRadius * Math.cos(startAngle);
    const y1 = center + outerRadius * Math.sin(startAngle);
    const x2 = center + outerRadius * Math.cos(endAngle);
    const y2 = center + outerRadius * Math.sin(endAngle);

    return `M ${center} ${center} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} Z`;
  };

  const polygonPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Clickable sectors (invisible, for interaction) */}
      {muscleGroups.map((muscle, i) => (
        <path
          key={`sector-${muscle}`}
          d={getSectorPath(i)}
          fill={selectedMuscle === muscle ? "rgba(16, 185, 129, 0.1)" : hoveredMuscle === muscle ? "rgba(16, 185, 129, 0.05)" : "transparent"}
          stroke="none"
          className="cursor-pointer transition-all duration-200"
          onClick={() => onMuscleSelect && onMuscleSelect(selectedMuscle === muscle ? null : muscle)}
          onMouseEnter={() => setHoveredMuscle(muscle)}
          onMouseLeave={() => setHoveredMuscle(null)}
        />
      ))}

      {/* Grid circles */}
      {gridLevels.map((level) => (
        <circle key={level} cx={center} cy={center} r={radius * level} fill="none" stroke="#e5e7eb" strokeWidth="1" />
      ))}

      {/* Axis lines and labels */}
      {muscleGroups.map((muscle, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x2 = center + radius * Math.cos(angle);
        const y2 = center + radius * Math.sin(angle);
        const labelX = center + (radius + 20) * Math.cos(angle);
        const labelY = center + (radius + 20) * Math.sin(angle);
        const value = values[i];
        const isSelected = selectedMuscle === muscle;
        const isHovered = hoveredMuscle === muscle;

        return (
          <g key={muscle} className="cursor-pointer" onClick={() => onMuscleSelect && onMuscleSelect(selectedMuscle === muscle ? null : muscle)}>
            <line x1={center} y1={center} x2={x2} y2={y2} stroke={isSelected ? "#10b981" : "#e5e7eb"} strokeWidth={isSelected ? "2" : "1"} />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-xs font-medium transition-colors ${isSelected ? "fill-emerald-600" : isHovered ? "fill-emerald-500" : "fill-gray-500"}`}
            >
              {muscle}
            </text>
            {value > 0 && (
              <text
                x={labelX}
                y={labelY + 14}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`text-xs font-bold ${isSelected ? "fill-emerald-700" : "fill-emerald-600"}`}
              >
                {value.toFixed(0)}%
              </text>
            )}
          </g>
        );
      })}

      {/* Data polygon */}
      <path d={polygonPath} fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="2.5" />

      {/* Data points */}
      {points.map((p, i) => {
        const isSelected = selectedMuscle === muscleGroups[i];
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={isSelected ? 6 : 4}
            fill={isSelected ? "#059669" : "#10b981"}
            stroke="white"
            strokeWidth="2"
            className="cursor-pointer transition-all duration-200"
            onClick={() => onMuscleSelect && onMuscleSelect(selectedMuscle === muscleGroups[i] ? null : muscleGroups[i])}
          />
        );
      })}
    </svg>
  );
}

// Pie Chart for Exercise Distribution
function ExercisePieChart({ exercises, size = 200 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!exercises || exercises.length === 0) return null;

  const center = size / 2;
  const radius = size / 2 - 30;
  const innerRadius = radius * 0.5; // Donut style

  // Calculate total and percentages
  const total = exercises.reduce((sum, ex) => sum + ex.totalSets, 0);

  // Colors for pie slices
  const colors = [
    "#10b981", "#059669", "#047857", "#065f46", "#064e3b",
    "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5", "#ecfdf5"
  ];

  let currentAngle = -Math.PI / 2; // Start from top

  const slices = exercises.map((ex, i) => {
    const percentage = (ex.totalSets / total) * 100;
    const sliceAngle = (percentage / 100) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const ix1 = center + innerRadius * Math.cos(startAngle);
    const iy1 = center + innerRadius * Math.sin(startAngle);
    const ix2 = center + innerRadius * Math.cos(endAngle);
    const iy2 = center + innerRadius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    // Path for donut slice
    const path = `
      M ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${ix2} ${iy2}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}
      Z
    `;

    // Label position
    const midAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius + 15;
    const labelX = center + labelRadius * Math.cos(midAngle);
    const labelY = center + labelRadius * Math.sin(midAngle);

    return {
      path,
      color: colors[i % colors.length],
      exercise: ex,
      percentage,
      labelX,
      labelY,
      midAngle,
    };
  });

  return (
    <div className="relative">
      <svg width={size} height={size} className="mx-auto overflow-visible">
        {slices.map((slice, i) => (
          <g key={i}>
            <path
              d={slice.path}
              fill={slice.color}
              stroke="white"
              strokeWidth="2"
              className={`cursor-pointer transition-all duration-200 ${hoveredIndex === i ? "opacity-80" : ""}`}
              style={{ transform: hoveredIndex === i ? `scale(1.03)` : "scale(1)", transformOrigin: `${center}px ${center}px` }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          </g>
        ))}

        {/* Center text */}
        <text x={center} y={center - 8} textAnchor="middle" className="text-2xl font-bold fill-gray-900">
          {total}
        </text>
        <text x={center} y={center + 12} textAnchor="middle" className="text-xs fill-gray-500">
          total sets
        </text>
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && slices[hoveredIndex] && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none z-10 whitespace-nowrap">
          <p className="font-medium">{slices[hoveredIndex].exercise.name}</p>
          <p>{slices[hoveredIndex].exercise.totalSets} sets ({slices[hoveredIndex].percentage.toFixed(1)}%)</p>
        </div>
      )}
    </div>
  );
}

// Exercise Legend for Pie Chart
function ExerciseLegend({ exercises }) {
  const colors = [
    "#10b981", "#059669", "#047857", "#065f46", "#064e3b",
    "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5", "#ecfdf5"
  ];

  const total = exercises.reduce((sum, ex) => sum + ex.totalSets, 0);

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {exercises.map((ex, i) => {
        const percentage = ((ex.totalSets / total) * 100).toFixed(1);
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">{ex.name}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-medium text-gray-900">{ex.totalSets}s</span>
              <span className="text-xs text-gray-400 ml-1">({percentage}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Muscle Filter Chips
function MuscleFilterChips({ muscles, selectedMuscle, onSelect }) {
  const muscleGroups = ["Arms", "Chest", "Legs", "Back", "Shoulders", "Core"];

  // Get muscles that have data
  const availableMuscles = muscleGroups.filter(muscle =>
    muscles.some(m => m.muscleName === muscle && m.count > 0)
  );

  return (
    <div className="flex flex-wrap gap-2">
      {availableMuscles.map((muscle) => {
        const muscleData = muscles.find(m => m.muscleName === muscle);
        const isSelected = selectedMuscle === muscle;

        return (
          <button
            key={muscle}
            onClick={() => onSelect(isSelected ? null : muscle)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              isSelected
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
            }`}
          >
            {muscle}
            {muscleData && (
              <span className={`text-xs ${isSelected ? "text-emerald-100" : "text-gray-400"}`}>
                {muscleData.count}
              </span>
            )}
          </button>
        );
      })}

      {selectedMuscle && (
        <button
          onClick={() => onSelect(null)}
          className="px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-all duration-200"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// Interactive Training Intensity Chart with Bar + Line combo
function TrainingIntensityChart({ data, height = 200 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [viewMode, setViewMode] = useState("combo"); // "combo", "bars", "line"

  if (!data || data.length === 0) return null;

  const padding = { top: 30, right: 50, bottom: 40, left: 50 };
  const width = 600;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxReps = Math.max(...data.map(d => d.totalReps || 0));
  const maxCompletion = 100;

  // Calculate bar width with gap
  const barWidth = Math.min(30, (chartWidth / data.length) * 0.6);
  const barGap = (chartWidth - barWidth * data.length) / (data.length + 1);

  const getBarX = (i) => padding.left + barGap + i * (barWidth + barGap);
  const getLineX = (i) => padding.left + barGap + i * (barWidth + barGap) + barWidth / 2;
  const getCompletionY = (value) => padding.top + chartHeight - (value / maxCompletion) * chartHeight;

  // Line path for completion rate
  const completionPath = data.map((d, i) =>
    `${i === 0 ? "M" : "L"} ${getLineX(i)} ${getCompletionY(d.completionRate || 0)}`
  ).join(" ");

  // Calculate averages
  const avgReps = Math.round(data.reduce((sum, d) => sum + (d.totalReps || 0), 0) / data.length);
  const avgCompletion = (data.reduce((sum, d) => sum + (d.completionRate || 0), 0) / data.length).toFixed(1);

  return (
    <div className="space-y-3">
      {/* Chart Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("combo")}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${viewMode === "combo" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Combo
          </button>
          <button
            onClick={() => setViewMode("bars")}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${viewMode === "bars" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Bars
          </button>
          <button
            onClick={() => setViewMode("line")}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${viewMode === "line" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Line
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-gray-600">Reps</span>
            <span className="font-medium text-gray-900">avg: {avgReps}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-gray-600">Completion</span>
            <span className="font-medium text-gray-900">avg: {avgCompletion}%</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="lineGradientFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <g key={pct}>
              <line
                x1={padding.left}
                y1={padding.top + chartHeight * (1 - pct)}
                x2={width - padding.right}
                y2={padding.top + chartHeight * (1 - pct)}
                stroke="#f3f4f6"
                strokeWidth="1"
              />
              {/* Left axis labels (Reps) */}
              <text
                x={padding.left - 8}
                y={padding.top + chartHeight * (1 - pct)}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-gray-400"
              >
                {Math.round(maxReps * pct)}
              </text>
              {/* Right axis labels (Completion %) */}
              {(viewMode === "combo" || viewMode === "line") && (
                <text
                  x={width - padding.right + 8}
                  y={padding.top + chartHeight * (1 - pct)}
                  textAnchor="start"
                  dominantBaseline="middle"
                  className="text-xs fill-amber-500"
                >
                  {Math.round(100 * pct)}%
                </text>
              )}
            </g>
          ))}

          {/* Bars */}
          {(viewMode === "combo" || viewMode === "bars") && data.map((d, i) => {
            const barHeight = ((d.totalReps || 0) / (maxReps || 1)) * chartHeight;
            const isHovered = hoveredIndex === i;

            return (
              <g key={`bar-${i}`}>
                <rect
                  x={getBarX(i)}
                  y={padding.top + chartHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  fill="url(#barGradient)"
                  rx="4"
                  className={`cursor-pointer transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-80"}`}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
                {isHovered && (
                  <rect
                    x={getBarX(i) - 2}
                    y={padding.top + chartHeight - barHeight - 2}
                    width={barWidth + 4}
                    height={barHeight + 4}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    rx="5"
                  />
                )}
              </g>
            );
          })}

          {/* Line for completion rate */}
          {(viewMode === "combo" || viewMode === "line") && (
            <>
              {/* Area fill under line */}
              <path
                d={`${completionPath} L ${getLineX(data.length - 1)} ${padding.top + chartHeight} L ${getLineX(0)} ${padding.top + chartHeight} Z`}
                fill="url(#lineGradientFill)"
              />
              {/* Line */}
              <path
                d={completionPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points */}
              {data.map((d, i) => (
                <circle
                  key={`point-${i}`}
                  cx={getLineX(i)}
                  cy={getCompletionY(d.completionRate || 0)}
                  r={hoveredIndex === i ? 6 : 4}
                  fill="#f59e0b"
                  stroke="white"
                  strokeWidth="2"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ))}
            </>
          )}

          {/* X-axis labels */}
          {data.map((d, i) => {
            // Show every nth label to avoid crowding
            const showLabel = i % Math.ceil(data.length / 7) === 0 || i === data.length - 1;
            if (!showLabel) return null;

            return (
              <text
                key={`label-${i}`}
                x={getLineX(i)}
                y={height - 10}
                textAnchor="middle"
                className="text-xs fill-gray-400"
              >
                {d.date?.slice(5) || ""}
              </text>
            );
          })}

          {/* Hover indicator line */}
          {hoveredIndex !== null && (
            <line
              x1={getLineX(hoveredIndex)}
              y1={padding.top}
              x2={getLineX(hoveredIndex)}
              y2={padding.top + chartHeight}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="4"
            />
          )}
        </svg>

        {/* Tooltip */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="absolute bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none z-10 shadow-lg"
            style={{
              left: `${((getLineX(hoveredIndex) - padding.left) / chartWidth) * 100}%`,
              top: "-10px",
              transform: "translateX(-50%)"
            }}
          >
            <p className="font-semibold text-emerald-400">{data[hoveredIndex].date}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-emerald-400" />
                {data[hoveredIndex].totalReps} reps
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {data[hoveredIndex].completionRate?.toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Interactive Weekly Progress Chart
function WeeklyProgressChart({ data, height = 180 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showComparison, setShowComparison] = useState(true);

  if (!data || data.length === 0) return null;

  // Get last 8 weeks max
  const weeks = data.slice(-8);

  const padding = { top: 20, right: 20, bottom: 50, left: 50 };
  const width = 600;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxReps = Math.max(...weeks.map(w => w.completedReps || 0));
  const maxSessions = Math.max(...weeks.map(w => w.sessions || 0));

  const barWidth = Math.min(50, (chartWidth / weeks.length) * 0.7);
  const barGap = (chartWidth - barWidth * weeks.length) / (weeks.length + 1);

  const getX = (i) => padding.left + barGap + i * (barWidth + barGap);

  // Calculate week-over-week changes
  const getChange = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous * 100).toFixed(0);
  };

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-gray-600">Reps Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-gray-600">Sessions</span>
          </div>
        </div>
        <button
          onClick={() => setShowComparison(!showComparison)}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${showComparison ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          {showComparison ? "Hide" : "Show"} Changes
        </button>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          <defs>
            <linearGradient id="weekBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((pct) => (
            <g key={pct}>
              <line
                x1={padding.left}
                y1={padding.top + chartHeight * (1 - pct)}
                x2={width - padding.right}
                y2={padding.top + chartHeight * (1 - pct)}
                stroke="#f3f4f6"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={padding.top + chartHeight * (1 - pct)}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-gray-400"
              >
                {Math.round(maxReps * pct)}
              </text>
            </g>
          ))}

          {/* Bars */}
          {weeks.map((week, i) => {
            const barHeight = ((week.completedReps || 0) / (maxReps || 1)) * chartHeight;
            const sessionHeight = ((week.sessions || 0) / (maxSessions || 1)) * chartHeight * 0.3;
            const isHovered = hoveredIndex === i;
            const prevWeek = i > 0 ? weeks[i - 1] : null;
            const change = getChange(week.completedReps, prevWeek?.completedReps);

            const weekDate = new Date(week.weekStart);
            const weekLabel = weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

            return (
              <g key={i}>
                {/* Main bar (reps) */}
                <rect
                  x={getX(i)}
                  y={padding.top + chartHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  fill="url(#weekBarGradient)"
                  rx="4"
                  className={`cursor-pointer transition-all duration-200 ${isHovered ? "filter brightness-110" : ""}`}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />

                {/* Sessions indicator (small bar on top) */}
                <rect
                  x={getX(i) + barWidth * 0.3}
                  y={padding.top + chartHeight - barHeight - sessionHeight - 4}
                  width={barWidth * 0.4}
                  height={sessionHeight}
                  fill="#3b82f6"
                  rx="2"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />

                {/* Week label */}
                <text
                  x={getX(i) + barWidth / 2}
                  y={height - 25}
                  textAnchor="middle"
                  className="text-xs fill-gray-500 font-medium"
                >
                  {weekLabel}
                </text>

                {/* Reps value on bar */}
                {isHovered && (
                  <text
                    x={getX(i) + barWidth / 2}
                    y={padding.top + chartHeight - barHeight - sessionHeight - 12}
                    textAnchor="middle"
                    className="text-xs fill-gray-700 font-bold"
                  >
                    {week.completedReps.toLocaleString()}
                  </text>
                )}

                {/* Change indicator */}
                {showComparison && change && (
                  <g>
                    <rect
                      x={getX(i) + barWidth / 2 - 16}
                      y={height - 18}
                      width={32}
                      height={16}
                      rx="4"
                      fill={parseFloat(change) >= 0 ? "#d1fae5" : "#fee2e2"}
                    />
                    <text
                      x={getX(i) + barWidth / 2}
                      y={height - 7}
                      textAnchor="middle"
                      className={`text-xs font-medium ${parseFloat(change) >= 0 ? "fill-emerald-700" : "fill-red-700"}`}
                    >
                      {parseFloat(change) >= 0 ? "+" : ""}{change}%
                    </text>
                  </g>
                )}

                {/* Hover highlight */}
                {isHovered && (
                  <rect
                    x={getX(i) - 3}
                    y={padding.top}
                    width={barWidth + 6}
                    height={chartHeight}
                    fill="rgba(16, 185, 129, 0.05)"
                    rx="4"
                  />
                )}
              </g>
            );
          })}

          {/* Trend line connecting bar tops */}
          <path
            d={weeks.map((week, i) => {
              const barHeight = ((week.completedReps || 0) / (maxReps || 1)) * chartHeight;
              const x = getX(i) + barWidth / 2;
              const y = padding.top + chartHeight - barHeight;
              return `${i === 0 ? "M" : "L"} ${x} ${y}`;
            }).join(" ")}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="4"
            opacity="0.5"
          />
        </svg>

        {/* Tooltip */}
        {hoveredIndex !== null && weeks[hoveredIndex] && (
          <div
            className="absolute bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none z-10 shadow-lg"
            style={{
              left: `${((getX(hoveredIndex) + barWidth / 2 - padding.left) / chartWidth) * 100}%`,
              top: "-10px",
              transform: "translateX(-50%)"
            }}
          >
            <p className="font-semibold text-emerald-400">
              Week of {new Date(weeks[hoveredIndex].weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
              <span className="text-gray-400">Reps:</span>
              <span className="font-medium">{weeks[hoveredIndex].completedReps.toLocaleString()}</span>
              <span className="text-gray-400">Sessions:</span>
              <span className="font-medium">{weeks[hoveredIndex].sessions}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Athlete Row Component
function AthleteRow({ athlete, onClick }) {
  return (
    <tr onClick={onClick} className="hover:bg-gray-50 transition cursor-pointer">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <FiUser className="text-emerald-600 text-base" />
          </div>
          <div>
            <span className="font-medium text-gray-900 text-base block">{athlete.name || "Unnamed"}</span>
            <span className="text-sm text-gray-400">{athlete.email}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">
          {athlete.batch || "General"}
        </span>
      </td>
      <td className="px-4 py-4 text-right">
        <FiChevronRight className="text-gray-400 inline w-5 h-5" />
      </td>
    </tr>
  );
}

// Athletes List View
function AthletesListView({ athletes, loading, searchTerm, setSearchTerm, onSelectAthlete, range, setRange }) {
  const ranges = [
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "all", label: "All" },
  ];

  const filteredAthletes = athletes.filter((a) =>
    (a.name || a.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Athlete Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Select an athlete to view training insights</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            <FiCalendar className="ml-3 text-gray-400 w-4 h-4" />
            {ranges.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  range === r.value ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <FiSearch className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search athletes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Athletes Table */}
      {loading ? (
        <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
          <div className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredAthletes.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-gray-200">
          <FiUser className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-base">{searchTerm ? "No athletes found" : "No athletes assigned"}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Athlete</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAthletes.map((athlete) => (
                <AthleteRow key={athlete.id} athlete={athlete} onClick={() => onSelectAthlete(athlete)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Analytics Detail View
function AnalyticsDetailView({ athlete, analytics, loading, error, range, setRange, onBack }) {
  const [selectedMuscle, setSelectedMuscle] = useState(null);

  const ranges = [
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "all", label: "All" },
  ];

  const comparisonMetrics = useMemo(() => {
    if (!analytics?.intensityTimeline || analytics.intensityTimeline.length < 2) {
      return { current: {}, previous: {}, sparklines: {} };
    }

    const timeline = analytics.intensityTimeline;
    const midPoint = Math.floor(timeline.length / 2);
    const firstHalf = timeline.slice(0, midPoint);
    const secondHalf = timeline.slice(midPoint);

    const calcAvg = (arr, key) => arr.length > 0 ? arr.reduce((sum, d) => sum + (d[key] || 0), 0) / arr.length : 0;
    const calcSum = (arr, key) => arr.reduce((sum, d) => sum + (d[key] || 0), 0);

    return {
      current: {
        sessions: secondHalf.length,
        reps: calcSum(secondHalf, "totalReps"),
        completion: calcAvg(secondHalf, "completionRate"),
        exercises: calcSum(secondHalf, "exerciseCount"),
      },
      previous: {
        sessions: firstHalf.length,
        reps: calcSum(firstHalf, "totalReps"),
        completion: calcAvg(firstHalf, "completionRate"),
        exercises: calcSum(firstHalf, "exerciseCount"),
      },
      sparklines: {
        reps: timeline.map(d => d.totalReps),
        completion: timeline.map(d => d.completionRate),
        exercises: timeline.map(d => d.exerciseCount),
      },
    };
  }, [analytics]);

  const mostTrainedMuscle = useMemo(() => {
    if (!analytics || !analytics.muscleDistribution?.length) return null;
    return analytics.muscleDistribution[0];
  }, [analytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-base text-gray-600 hover:text-gray-900">
          <FiChevronLeft className="w-5 h-5" /> Back to Athletes
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-base">{error}</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-base text-gray-600 hover:text-gray-900">
          <FiChevronLeft className="w-5 h-5" /> Back to Athletes
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-500 text-base">No analytics data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition">
            <FiChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <FiUser className="text-emerald-600 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{athlete.name || "Athlete"}</h1>
              <p className="text-sm text-gray-500">{athlete.batch || "General"} · {athlete.email}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
          <FiCalendar className="ml-3 text-gray-400 w-4 h-4" />
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                range === r.value ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Sessions" value={analytics.totalSessions} previousValue={comparisonMetrics.previous.sessions} sparklineData={comparisonMetrics.sparklines.exercises} icon={FiCalendar} />
        <MetricCard title="Reps Done" value={analytics.totalRepsCompleted || 0} previousValue={comparisonMetrics.previous.reps} sparklineData={comparisonMetrics.sparklines.reps} icon={FiZap} />
        <MetricCard title="Avg Completion" value={analytics.averageCompletionRate?.toFixed(1) || 0} unit="%" previousValue={comparisonMetrics.previous.completion?.toFixed(1)} sparklineData={comparisonMetrics.sparklines.completion} icon={FiPercent} />
        <MetricCard title="Exercises" value={analytics.totalExercises} previousValue={comparisonMetrics.previous.exercises} sparklineData={comparisonMetrics.sparklines.exercises} icon={FiActivity} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Muscle Focus - Interactive Radar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Muscle Focus</h2>
            {mostTrainedMuscle && !selectedMuscle && (
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium">
                Top: {mostTrainedMuscle.muscleName}
              </span>
            )}
            {selectedMuscle && (
              <span className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium">
                {selectedMuscle}
              </span>
            )}
          </div>
          <RadarChart
            data={analytics.muscleDistribution}
            size={200}
            selectedMuscle={selectedMuscle}
            onMuscleSelect={setSelectedMuscle}
          />
          <p className="text-xs text-gray-400 text-center mt-2">Click a muscle to see exercise breakdown</p>
        </div>

        {/* Exercise Breakdown with Filters and Pie Chart */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Exercise Breakdown</h2>

          {/* Muscle Filter Chips */}
          <div className="mb-4">
            <MuscleFilterChips
              muscles={analytics.muscleDistribution || []}
              selectedMuscle={selectedMuscle}
              onSelect={setSelectedMuscle}
            />
          </div>

          {/* Content based on selection */}
          {selectedMuscle && analytics.exercisesByMuscle?.[selectedMuscle] ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-3 uppercase">{selectedMuscle} Distribution</p>
                <ExercisePieChart
                  exercises={analytics.exercisesByMuscle[selectedMuscle]}
                  size={180}
                />
              </div>

              {/* Exercise Legend */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-3 uppercase">Exercises</p>
                <ExerciseLegend exercises={analytics.exercisesByMuscle[selectedMuscle]} />
              </div>
            </div>
          ) : selectedMuscle ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-base">No exercises found for {selectedMuscle}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {analytics.topExercises?.length > 0 ? (
                <>
                  <p className="text-xs font-medium text-gray-500 mb-2">TOP EXERCISES</p>
                  {analytics.topExercises.slice(0, 6).map((ex, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-700">{ex.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-emerald-600">{ex.count} sets</span>
                        <span className="text-xs text-gray-400 ml-2">{ex.muscle}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-gray-400 text-center py-8 text-base">Select a muscle to see breakdown</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Training Intensity - Interactive Chart */}
      {analytics.intensityTimeline?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Training Intensity</h2>
            <span className="text-xs text-gray-400">Click bars/points for details</span>
          </div>
          <TrainingIntensityChart data={analytics.intensityTimeline} height={200} />
        </div>
      )}

      {/* Weekly Progress - Interactive Bar Chart */}
      {analytics.weeklyProgress?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Weekly Progress</h2>
            <span className="text-xs text-gray-400">Hover for week-over-week comparison</span>
          </div>
          <WeeklyProgressChart data={analytics.weeklyProgress} height={200} />
        </div>
      )}

      {/* Focus Areas */}
      {analytics.incompleteExercises?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FiTarget className="text-amber-500 w-5 h-5" />
            <h2 className="text-base font-semibold text-gray-900">Focus Areas</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {analytics.incompleteExercises.map((ex, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-amber-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 text-base">{ex.name}</p>
                  <p className="text-sm text-gray-500">{ex.muscle} · {ex.totalAttempts} attempts</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  ex.avgCompletionPct >= 80 ? "bg-emerald-100 text-emerald-700" :
                  ex.avgCompletionPct >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                }`}>
                  {ex.avgCompletionPct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Main Component
export default function AthleteAnalysis({ athletes = [] }) {
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [range, setRange] = useState("30d");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [athleteNames, setAthleteNames] = useState({});

  // Fetch athlete names
  useEffect(() => {
    if (!athletes?.length) return;

    async function fetchNames() {
      const namesMap = {};
      await Promise.all(
        athletes.map(async (athlete) => {
          const id = athlete.id || athlete.odid;
          if (id && !athlete.name) {
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

    fetchNames();
  }, [athletes]);

  // Enrich athletes with fetched names
  const enrichedAthletes = useMemo(() => {
    return athletes.map(athlete => {
      const id = athlete.id || athlete.odid;
      return {
        ...athlete,
        name: athlete.name || athleteNames[id] || null
      };
    });
  }, [athletes, athleteNames]);

  useEffect(() => {
    if (!selectedAthlete) return;

    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const res = await apiFetch(
          `${API_BASE}/trainer-app/analytics/${selectedAthlete.id}?range=${range}`,
        );

        if (!res.ok) throw new Error("Failed to fetch analytics");

        const data = await res.json();
        if (data.success) {
          setAnalytics(data.data);
        } else {
          throw new Error(data.error || "Failed to fetch analytics");
        }
      } catch (err) {
        setError(err.message);
        setAnalytics(null);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [selectedAthlete, range]);

  const handleSelectAthlete = (athlete) => {
    // Find the enriched version
    const enriched = enrichedAthletes.find(a => a.id === athlete.id) || athlete;
    setSelectedAthlete(enriched);
    setAnalytics(null);
    setError(null);
  };

  const handleBack = () => {
    setSelectedAthlete(null);
    setAnalytics(null);
    setError(null);
  };

  if (selectedAthlete) {
    return (
      <AnalyticsDetailView
        athlete={selectedAthlete}
        analytics={analytics}
        loading={loading}
        error={error}
        range={range}
        setRange={setRange}
        onBack={handleBack}
      />
    );
  }

  return (
    <AthletesListView
      athletes={enrichedAthletes}
      loading={false}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      onSelectAthlete={handleSelectAthlete}
      range={range}
      setRange={setRange}
    />
  );
}
