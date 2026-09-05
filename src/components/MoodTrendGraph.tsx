import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
  Activity,
  Award,
  BookOpen,
} from 'lucide-react';
import type { InteractionDocument, JournalMood, MoodId } from '../types';
import { JOURNAL_MOODS } from '../types';

interface MoodTrendGraphProps {
  interactions: InteractionDocument[];
  onSelectInteraction?: (interaction: InteractionDocument) => void;
  className?: string;
  isCompact?: boolean;
}

type TimeWindow = '7days' | 'currentWeek' | '14days';

interface DailyMoodPoint {
  dateKey: string; // YYYY-MM-DD
  dayLabel: string; // "Fri 9/5"
  shortDay: string; // "Fri"
  formattedDate: string; // "Sep 5, 2026"
  score: number | null; // 1 to 5, null if unlogged
  entriesCount: number;
  dominantMood: JournalMood | null;
  moodEntries: InteractionDocument[];
}

export const MoodTrendGraph: React.FC<MoodTrendGraphProps> = ({
  interactions,
  onSelectInteraction,
  className = '',
  isCompact = false,
}) => {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7days');
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = current, -1 = previous, etc.
  const [selectedPoint, setSelectedPoint] = useState<DailyMoodPoint | null>(null);

  // Group and compute trend data based on selected window and offset
  const { trendData, stats, moodDistribution, allWeeklyEntries } = useMemo(() => {
    const now = new Date();
    // Apply week offset if viewing prior weeks
    const baseDate = new Date(now.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);

    const points: DailyMoodPoint[] = [];
    const numDays = timeWindow === '14days' ? 14 : 7;

    let startDate: Date;
    let endDate: Date;

    if (timeWindow === 'currentWeek') {
      // Find Monday of the week
      const day = baseDate.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      startDate = new Date(baseDate);
      startDate.setDate(baseDate.getDate() + diffToMonday);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Rolling days ending on baseDate
      endDate = new Date(baseDate);
      endDate.setHours(23, 59, 59, 999);

      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - (numDays - 1));
      startDate.setHours(0, 0, 0, 0);
    }

    // Map interactions with valid mood by dateKey (YYYY-MM-DD in local time)
    const entriesByDateKey = new Map<string, InteractionDocument[]>();
    const weeklyEntries: InteractionDocument[] = [];

    interactions.forEach((item) => {
      if (!item.createdAt) return;
      const itemDate = new Date(item.createdAt);
      if (itemDate >= startDate && itemDate <= endDate) {
        weeklyEntries.push(item);
        if (item.mood) {
          const key = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(
            itemDate.getDate()
          ).padStart(2, '0')}`;
          const existing = entriesByDateKey.get(key) || [];
          existing.push(item);
          entriesByDateKey.set(key, existing);
        }
      }
    });

    // Populate day points
    const current = new Date(startDate);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < numDays; i++) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const dateNum = current.getDate();
      const dayOfWeek = current.getDay();
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;

      const dayEntries = entriesByDateKey.get(dateKey) || [];
      const moodItems = dayEntries.filter((e) => e.mood);

      let avgScore: number | null = null;
      let dominant: JournalMood | null = null;

      if (moodItems.length > 0) {
        const totalScore = moodItems.reduce((acc, curr) => acc + (curr.mood?.score || 0), 0);
        avgScore = Number((totalScore / moodItems.length).toFixed(1));

        // Dominant mood: most frequent, or latest
        const moodFrequency: Record<string, number> = {};
        moodItems.forEach((e) => {
          if (e.mood) {
            moodFrequency[e.mood.id] = (moodFrequency[e.mood.id] || 0) + 1;
          }
        });
        const dominantMoodId = Object.keys(moodFrequency).reduce((a, b) =>
          moodFrequency[a] > moodFrequency[b] ? a : b
        ) as MoodId;
        dominant = JOURNAL_MOODS.find((m) => m.id === dominantMoodId) || moodItems[moodItems.length - 1].mood || null;
      }

      points.push({
        dateKey,
        dayLabel: `${dayNames[dayOfWeek]} ${month + 1}/${dateNum}`,
        shortDay: dayNames[dayOfWeek],
        formattedDate: `${dayNames[dayOfWeek]}, ${monthNames[month]} ${dateNum}`,
        score: avgScore,
        entriesCount: dayEntries.length,
        dominantMood: dominant,
        moodEntries: dayEntries,
      });

      current.setDate(current.getDate() + 1);
    }

    // Compute aggregate weekly statistics
    const loggedPoints = points.filter((p) => p.score !== null);
    const totalMoodLogs = points.reduce((acc, p) => acc + p.moodEntries.filter((e) => e.mood).length, 0);

    let avgWeeklyScore = 0;
    if (loggedPoints.length > 0) {
      const sum = loggedPoints.reduce((acc, p) => acc + (p.score || 0), 0);
      avgWeeklyScore = Number((sum / loggedPoints.length).toFixed(1));
    }

    // Mood distribution tally
    const distMap: Record<MoodId, number> = {
      serene: 0,
      grateful: 0,
      energized: 0,
      reflective: 0,
      anxious: 0,
      exhausted: 0,
    };

    weeklyEntries.forEach((item) => {
      if (item.mood) {
        distMap[item.mood.id] = (distMap[item.mood.id] || 0) + 1;
      }
    });

    const distArray = JOURNAL_MOODS.map((m) => ({
      id: m.id,
      label: m.label,
      emoji: m.emoji,
      score: m.score,
      count: distMap[m.id] || 0,
    }));

    // Find top mood
    const topMoodObj = [...distArray].sort((a, b) => b.count - a.count)[0];
    const topMood = topMoodObj.count > 0 ? topMoodObj : null;

    return {
      trendData: points,
      stats: {
        avgWeeklyScore,
        daysLogged: loggedPoints.length,
        totalDays: numDays,
        totalMoodLogs,
        topMood,
        startDateFormatted: `${monthNames[startDate.getMonth()]} ${startDate.getDate()}`,
        endDateFormatted: `${monthNames[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`,
      },
      moodDistribution: distArray,
      allWeeklyEntries: weeklyEntries,
    };
  }, [interactions, timeWindow, weekOffset]);

  // Mood color map for distribution bars
  const getMoodColor = (id: MoodId) => {
    switch (id) {
      case 'serene':
        return '#10b981'; // emerald
      case 'grateful':
        return '#f59e0b'; // amber
      case 'energized':
        return '#38bdf8'; // sky
      case 'reflective':
        return '#818cf8'; // indigo
      case 'anxious':
        return '#fb923c'; // orange
      case 'exhausted':
        return '#94a3b8'; // slate
      default:
        return '#6366f1';
    }
  };

  const getScoreDescriptor = (score: number) => {
    if (score >= 4.5) return { text: 'High Vitality & Serenity', color: 'text-emerald-400' };
    if (score >= 3.5) return { text: 'Energized & Balanced', color: 'text-amber-400' };
    if (score >= 2.5) return { text: 'Deeply Reflective', color: 'text-indigo-400' };
    if (score >= 1.8) return { text: 'Elevated Stress/Anxiety', color: 'text-orange-400' };
    return { text: 'Low Energy / Rest Needed', color: 'text-slate-400' };
  };

  return (
    <div
      id="weekly-mood-trend-container"
      className={`rounded-2xl border border-slate-800 bg-[#0E111A]/95 p-5 shadow-xl backdrop-blur-md ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400 shadow-sm">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100 tracking-tight">
                Weekly Mood & Emotional Energy Trend
              </h3>
              <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                Recharts Analytics
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Calendar className="h-3 w-3 text-slate-500" />
              <span>
                {stats.startDateFormatted} – {stats.endDateFormatted}
              </span>
              {weekOffset !== 0 && (
                <span className="text-amber-400 font-medium text-[11px]">
                  ({Math.abs(weekOffset)} week{Math.abs(weekOffset) > 1 ? 's' : ''} {weekOffset < 0 ? 'ago' : 'ahead'})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Range Controls & Week Navigators */}
        <div className="flex items-center gap-2">
          {/* Week Offset Buttons */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-[#121522] p-0.5">
            <button
              id="mood-prev-week-btn"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Previous week"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                id="mood-reset-week-btn"
                onClick={() => setWeekOffset(0)}
                className="px-2 py-0.5 text-[11px] font-medium text-amber-300 hover:text-white transition-colors"
                title="Reset to current week"
              >
                Today
              </button>
            )}
            <button
              id="mood-next-week-btn"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              disabled={weekOffset >= 0}
              className={`p-1 rounded-md transition-colors ${
                weekOffset >= 0
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Next week"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Time Window Switcher */}
          <div className="flex rounded-lg border border-slate-800 bg-[#121522] p-0.5 text-xs">
            <button
              id="mood-window-7days-btn"
              onClick={() => setTimeWindow('7days')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                timeWindow === '7days'
                  ? 'bg-amber-500/20 text-amber-300 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7 Days
            </button>
            <button
              id="mood-window-current-btn"
              onClick={() => setTimeWindow('currentWeek')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                timeWindow === 'currentWeek'
                  ? 'bg-amber-500/20 text-amber-300 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mon–Sun
            </button>
            <button
              id="mood-window-14days-btn"
              onClick={() => setTimeWindow('14days')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                timeWindow === '14days'
                  ? 'bg-amber-500/20 text-amber-300 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              14 Days
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {/* Metric 1: Avg Energy */}
        <div className="rounded-xl border border-slate-800/80 bg-[#121522]/80 p-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              Weekly Energy
            </span>
            <span className="text-[10px] text-slate-500 font-mono">1–5 scale</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-100">
              {stats.avgWeeklyScore > 0 ? stats.avgWeeklyScore : '—'}
            </span>
            {stats.avgWeeklyScore > 0 && (
              <span className={`text-[11px] font-medium ${getScoreDescriptor(stats.avgWeeklyScore).color}`}>
                {getScoreDescriptor(stats.avgWeeklyScore).text}
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: Dominant Mood */}
        <div className="rounded-xl border border-slate-800/80 bg-[#121522]/80 p-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <Award className="h-3.5 w-3.5 text-indigo-400" />
              Dominant State
            </span>
            <span className="text-[10px] text-slate-500">Most logged</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            {stats.topMood ? (
              <>
                <span className="text-xl leading-none">{stats.topMood.emoji}</span>
                <span className="text-sm font-semibold text-slate-200">
                  {stats.topMood.label}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({stats.topMood.count}x)
                </span>
              </>
            ) : (
              <span className="text-sm text-slate-500">No moods logged</span>
            )}
          </div>
        </div>

        {/* Metric 3: Log Frequency */}
        <div className="rounded-xl border border-slate-800/80 bg-[#121522]/80 p-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="h-3.5 w-3.5 text-emerald-400" />
              Journal Consistency
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-100">
              {stats.daysLogged}
            </span>
            <span className="text-xs text-slate-400">
              of {stats.totalDays} days active
            </span>
          </div>
        </div>

        {/* Metric 4: Total Mood Points */}
        <div className="rounded-xl border border-slate-800/80 bg-[#121522]/80 p-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              Mood Records
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-100">
              {stats.totalMoodLogs}
            </span>
            <span className="text-xs text-slate-400">reflections captured</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Recharts Graph */}
      <div className="relative rounded-xl border border-slate-800/80 bg-[#0B0D16] p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 shadow-xs shadow-amber-400/50" />
            <span className="font-medium text-slate-300">Emotional Energy Score</span>
            <span className="text-[11px] text-slate-500">(1: Exhausted 🕯️ → 5: Serene/Grateful 🌿)</span>
          </div>
          {stats.daysLogged > 0 && (
            <span className="text-[11px] text-amber-400/80 font-mono">
              Click any point to inspect reflections
            </span>
          )}
        </div>

        {stats.totalMoodLogs === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/80 text-amber-400 mb-3">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">No Mood Data In This Window</h4>
            <p className="mt-1 max-w-md text-xs text-slate-400">
              Log your daily mood and emotional energy while reflecting in ReflectionStudio. Your weekly trends and energy patterns will visualize here dynamically.
            </p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendData}
                margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const point = e.activePayload[0].payload as DailyMoodPoint;
                    setSelectedPoint(point);
                  }
                }}
              >
                <defs>
                  <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => {
                    switch (val) {
                      case 5:
                        return '5 🌿';
                      case 4:
                        return '4 ⚡';
                      case 3:
                        return '3 🌊';
                      case 2:
                        return '2 🌪️';
                      case 1:
                        return '1 🕯️';
                      default:
                        return String(val);
                    }
                  }}
                />
                <ReferenceLine
                  y={3}
                  stroke="#475569"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Equilibrium (3.0)',
                    fill: '#64748b',
                    fontSize: 10,
                    position: 'insideBottomRight',
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as DailyMoodPoint;
                      return (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md">
                          <div className="text-xs font-bold text-slate-200">{data.formattedDate}</div>
                          {data.score !== null ? (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{data.dominantMood?.emoji || '✨'}</span>
                                <span className="text-xs font-semibold text-amber-300">
                                  {data.dominantMood?.label || 'Reflective'}
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-100">
                                  {data.score}/5
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {data.entriesCount} reflection{data.entriesCount > 1 ? 's' : ''} logged
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-slate-500 italic">No mood recorded</div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fill="url(#moodGradient)"
                  connectNulls={true}
                  dot={{
                    r: 4,
                    fill: '#f59e0b',
                    stroke: '#0B0D16',
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 6,
                    fill: '#fbbf24',
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Secondary Insight Row: Mood Distribution Bar & Selected Day Inspector */}
      {!isCompact && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mood Distribution Card */}
          <div className="rounded-xl border border-slate-800/80 bg-[#121522]/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Mood Spectrum Distribution
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {stats.totalMoodLogs} total logs
              </span>
            </div>

            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moodDistribution} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs shadow-lg">
                            <span className="font-semibold text-slate-200">
                              {item.emoji} {item.label}:
                            </span>{' '}
                            <span className="text-amber-300 font-bold">{item.count}</span> entry
                            {item.count !== 1 ? 'ies' : 'y'}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {moodDistribution.map((entry) => (
                      <Cell key={entry.id} fill={getMoodColor(entry.id)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Selected Day / Latest Reflections Inspector */}
          <div className="rounded-xl border border-slate-800/80 bg-[#121522]/60 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                  {selectedPoint ? `Entries for ${selectedPoint.formattedDate}` : 'Recent Weekly Reflections'}
                </h4>
                {selectedPoint && (
                  <button
                    onClick={() => setSelectedPoint(null)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                  >
                    Show all week
                  </button>
                )}
              </div>

              {/* Entries list */}
              <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {(selectedPoint ? selectedPoint.moodEntries : allWeeklyEntries.slice(0, 4)).length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    No reflections recorded for this timeframe.
                  </p>
                ) : (
                  (selectedPoint ? selectedPoint.moodEntries : allWeeklyEntries.slice(0, 4)).map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => onSelectInteraction && onSelectInteraction(entry)}
                      className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 p-2 text-xs transition-all hover:border-slate-700 hover:bg-slate-850 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        {entry.mood ? (
                          <span className="text-sm shrink-0" title={`${entry.mood.label} (${entry.mood.score}/5)`}>
                            {entry.mood.emoji}
                          </span>
                        ) : (
                          <span className="text-slate-600 shrink-0">📝</span>
                        )}
                        <span className="font-medium text-slate-200 truncate">
                          {entry.title || 'Untitled Reflection'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-400 font-mono">
                        {entry.mood && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {entry.mood.score}/5
                          </span>
                        )}
                        <span>{new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Info className="h-3 w-3 text-slate-400" />
                Trends auto-update on every journal save
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
