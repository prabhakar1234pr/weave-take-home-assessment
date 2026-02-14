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
  Tooltip as RechartsTooltip
} from 'recharts';

interface Props {
  engineer: Engineer;
}

const dimensions = [
  { key: 'quality_score', label: 'Code Quality', weight: '30%', color: '#3b82f6', description: 'Code review quality, patterns, and best practices' },
  { key: 'velocity_score', label: 'Delivery Velocity', weight: '30%', color: '#10b981', description: 'Speed and consistency of shipping code' },
  { key: 'collaboration_score', label: 'Collaboration', weight: '20%', color: '#f59e0b', description: 'Team engagement, reviews, and knowledge sharing' },
  { key: 'leadership_score', label: 'Technical Leadership', weight: '20%', color: '#8b5cf6', description: 'Mentorship, architecture, and technical direction' },
] as const;

function getInitials(name: string, username: string) {
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
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
    <Card>
      {/* Header */}
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="size-12 border-2 border-border">
            <AvatarImage src={engineer.avatar_url} alt={engineer.name || engineer.username} />
            <AvatarFallback className="text-lg font-semibold">
              {getInitials(engineer.name, engineer.username)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">
              {engineer.name || engineer.username}
            </h2>
            <p className="text-sm text-muted-foreground">@{engineer.username}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold text-primary tabular-nums">
              {engineer.impact_score.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">Overall Impact</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Radar Chart */}
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData} outerRadius="65%" margin={{ top: 5, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '13px',
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
                <div className="flex items-center justify-between mb-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-medium cursor-default">
                        {dim.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{dim.description}</TooltipContent>
                  </Tooltip>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-normal">
                      {dim.weight}
                    </Badge>
                    <span className="text-sm font-bold tabular-nums w-10 text-right" style={{ color: dim.color }}>
                      {score.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(score, 100)}%`,
                      backgroundColor: dim.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Stats row */}
      <div className="px-6">
        <Separator />
      </div>
      <CardFooter>
        <div className="w-full grid grid-cols-4 gap-2 text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default">
                <div className="text-lg font-bold tabular-nums">{engineer.stats.prs_created}</div>
                <div className="text-xs text-muted-foreground">PRs</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Pull requests created</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default">
                <div className="text-lg font-bold tabular-nums">{engineer.stats.reviews_given}</div>
                <div className="text-xs text-muted-foreground">Reviews</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Code reviews given</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default">
                <div className="text-lg font-bold tabular-nums">{engineer.stats.files_changed}</div>
                <div className="text-xs text-muted-foreground">Files</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Total files changed</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default">
                <div className="text-lg font-bold tabular-nums">{engineer.stats.avg_merge_time.toFixed(1)}h</div>
                <div className="text-xs text-muted-foreground">Avg Merge</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Average time to merge</TooltipContent>
          </Tooltip>
        </div>
      </CardFooter>
    </Card>
  );
}
