'use client';

import { Engineer } from '@/types/engineer';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';

interface Props {
  engineer: Engineer;
}

const dimensions = [
  { key: 'quality_score', label: 'Code Quality', weight: '30%', color: '#3b82f6', description: 'Merge speed, PR size balance, and review activity' },
  { key: 'velocity_score', label: 'Delivery Velocity', weight: '30%', color: '#10b981', description: 'PR volume, consistency, and code complexity' },
  { key: 'collaboration_score', label: 'Collaboration', weight: '20%', color: '#f59e0b', description: 'Review volume, depth, and cross-team engagement' },
  { key: 'leadership_score', label: 'Technical Leadership', weight: '20%', color: '#8b5cf6', description: 'Code ownership, balance, and domain breadth' },
] as const;

function getInitials(name: string, username: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return username.slice(0, 2).toUpperCase();
}

export function ImpactChart({ engineer }: Props) {
  const radarData = [
    { dimension: 'Quality', score: engineer.quality_score, fullMark: 100 },
    { dimension: 'Velocity', score: engineer.velocity_score, fullMark: 100 },
    { dimension: 'Collaboration', score: engineer.collaboration_score, fullMark: 100 },
    { dimension: 'Leadership', score: engineer.leadership_score, fullMark: 100 },
  ];

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center gap-4">
          <Avatar className="size-12 border-2 border-border shadow-sm">
            <AvatarImage src={engineer.avatar_url} alt={engineer.name || engineer.username} />
            <AvatarFallback className="text-lg font-semibold">
              {getInitials(engineer.name, engineer.username)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{engineer.name || engineer.username}</h2>
            <p className="text-xs text-muted-foreground">@{engineer.username}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold tabular-nums bg-gradient-to-br from-blue-600 to-violet-600 bg-clip-text text-transparent">
              {engineer.impact_score.toFixed(1)}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Overall Impact</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Radar Chart */}
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={radarData} outerRadius="65%" margin={{ top: 0, right: 30, bottom: 5, left: 30 }}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="dimension" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '10px',
                color: 'hsl(var(--popover-foreground))',
                fontSize: '12px',
                padding: '6px 10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
              formatter={(value) => [`${Number(value).toFixed(1)}`, 'Score']}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* Dimension Bars */}
        <div className="space-y-3">
          {dimensions.map((dim) => {
            const score = engineer[dim.key] as number;
            return (
              <div key={dim.key}>
                <div className="flex items-center justify-between mb-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs font-medium cursor-default">{dim.label}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px] text-xs">{dim.description}</TooltipContent>
                  </Tooltip>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-normal h-4 px-1.5">{dim.weight}</Badge>
                    <span className="text-xs font-bold tabular-nums w-8 text-right" style={{ color: dim.color }}>
                      {score.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(score, 100)}%`, backgroundColor: dim.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Stats */}
      <div className="px-6"><Separator /></div>
      <CardFooter className="pt-3 pb-4">
        <div className="w-full grid grid-cols-4 gap-2 text-center">
          {[
            { val: engineer.stats.prs_created, label: 'PRs', tip: 'Pull requests created' },
            { val: engineer.stats.reviews_given, label: 'Reviews', tip: 'Code reviews given' },
            { val: engineer.stats.files_changed, label: 'Files', tip: 'Total files changed' },
            { val: `${engineer.stats.avg_merge_time.toFixed(1)}h`, label: 'Merge', tip: 'Average time to merge' },
          ].map((s) => (
            <Tooltip key={s.label}>
              <TooltipTrigger asChild>
                <div className="cursor-default">
                  <div className="text-base font-bold tabular-nums">{s.val}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{s.tip}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
}
