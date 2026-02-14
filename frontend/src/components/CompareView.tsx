'use client';

import { useState } from 'react';
import { Engineer } from '@/types/engineer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface Props {
  engineers: Engineer[];
}

function getInitials(name: string, username: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return username.slice(0, 2).toUpperCase();
}

const DIMENSIONS = [
  { key: 'quality_score', label: 'Quality', color: '#3b82f6' },
  { key: 'velocity_score', label: 'Velocity', color: '#10b981' },
  { key: 'collaboration_score', label: 'Collaboration', color: '#f59e0b' },
  { key: 'leadership_score', label: 'Leadership', color: '#8b5cf6' },
] as const;

export function CompareView({ engineers }: Props) {
  const [leftUsername, setLeftUsername] = useState(engineers[0]?.username ?? '');
  const [rightUsername, setRightUsername] = useState(engineers[1]?.username ?? '');

  const left = engineers.find(e => e.username === leftUsername) ?? null;
  const right = engineers.find(e => e.username === rightUsername) ?? null;

  const radarData = DIMENSIONS.map(d => ({
    dimension: d.label,
    [leftUsername]: left ? (left[d.key] as number) : 0,
    [rightUsername]: right ? (right[d.key] as number) : 0,
  }));

  const statsData = [
    { label: 'PRs Created', left: left?.stats.prs_created ?? 0, right: right?.stats.prs_created ?? 0 },
    { label: 'Reviews Given', left: left?.stats.reviews_given ?? 0, right: right?.stats.reviews_given ?? 0 },
    { label: 'Files Changed', left: left?.stats.files_changed ?? 0, right: right?.stats.files_changed ?? 0 },
    { label: 'Avg Merge (h)', left: left?.stats.avg_merge_time ?? 0, right: right?.stats.avg_merge_time ?? 0 },
  ];

  function EngineerCard({ engineer, side }: { engineer: Engineer | null; side: 'left' | 'right' }) {
    if (!engineer) return null;
    return (
      <div className={`flex items-center gap-3 ${side === 'right' ? 'flex-row-reverse text-right' : ''}`}>
        <Avatar className="size-10 border-2 border-border">
          <AvatarImage src={engineer.avatar_url} alt={engineer.name || engineer.username} />
          <AvatarFallback className="text-sm font-semibold">
            {getInitials(engineer.name, engineer.username)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{engineer.name || engineer.username}</div>
          <div className="text-xs text-muted-foreground">
            Impact: <span className="font-bold tabular-nums">{engineer.impact_score.toFixed(1)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector row */}
      <Card>
        <CardHeader>
          <CardTitle>Comparative Analysis</CardTitle>
          <CardDescription>Select two engineers to compare across all impact dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Engineer A</label>
              <Select value={leftUsername} onValueChange={setLeftUsername}>
                <SelectTrigger>
                  <SelectValue placeholder="Select engineer" />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map(e => (
                    <SelectItem key={e.username} value={e.username}>
                      {e.name || e.username} ({e.impact_score.toFixed(1)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden sm:flex items-center justify-center pt-6">
              <Badge variant="outline" className="text-xs px-3 py-1">VS</Badge>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Engineer B</label>
              <Select value={rightUsername} onValueChange={setRightUsername}>
                <SelectTrigger>
                  <SelectValue placeholder="Select engineer" />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map(e => (
                    <SelectItem key={e.username} value={e.username}>
                      {e.name || e.username} ({e.impact_score.toFixed(1)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {left && right && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar overlay */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Dimension Overlay</CardTitle>
              <div className="flex items-center justify-between mt-2">
                <EngineerCard engineer={left} side="left" />
                <EngineerCard engineer={right} side="right" />
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData} outerRadius="65%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Radar
                    name={left.name || left.username}
                    dataKey={leftUsername}
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Radar
                    name={right.name || right.username}
                    dataKey={rightUsername}
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '13px', paddingTop: 8 }} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar chart stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Raw Stats Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={statsData} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis dataKey="label" type="category" tick={{ fill: '#6b7280', fontSize: 12 }} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '13px', paddingTop: 8 }} />
                  <Bar dataKey="left" name={left.name || left.username} fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="right" name={right.name || right.username} fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Dimension-by-dimension breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Score-by-Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {DIMENSIONS.map(dim => {
                  const lScore = left[dim.key] as number;
                  const rScore = right[dim.key] as number;
                  const lWins = lScore > rScore;
                  const tie = lScore === rScore;
                  return (
                    <div key={dim.key} className="rounded-lg border p-4 space-y-3">
                      <div className="text-sm font-semibold" style={{ color: dim.color }}>
                        {dim.label}
                      </div>
                      {/* Left */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate">{left.name || left.username}</span>
                          <span className={`font-bold tabular-nums ${lWins && !tie ? 'text-blue-600' : ''}`}>
                            {lScore.toFixed(1)}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(lScore, 100)}%` }} />
                        </div>
                      </div>
                      {/* Right */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate">{right.name || right.username}</span>
                          <span className={`font-bold tabular-nums ${!lWins && !tie ? 'text-red-500' : ''}`}>
                            {rScore.toFixed(1)}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${Math.min(rScore, 100)}%` }} />
                        </div>
                      </div>
                      {/* Delta */}
                      <div className="text-center">
                        {tie ? (
                          <Badge variant="outline" className="text-xs">Tied</Badge>
                        ) : (
                          <Badge variant={lWins ? 'default' : 'destructive'} className="text-xs">
                            {lWins ? (left.name || left.username) : (right.name || right.username)} +{Math.abs(lScore - rScore).toFixed(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
