'use client';

import { Engineer } from '@/types/engineer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Trophy, Medal, Award } from 'lucide-react';

interface Props {
  engineers: Engineer[];
  onSelect: (engineer: Engineer) => void;
  selected: Engineer | null;
}

function getInitials(name: string, username: string) {
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return username.slice(0, 2).toUpperCase();
}

const rankConfig = [
  { icon: Trophy, bg: 'bg-yellow-500', label: 'Gold' },
  { icon: Medal, bg: 'bg-gray-400', label: 'Silver' },
  { icon: Award, bg: 'bg-amber-600', label: 'Bronze' },
  { icon: null, bg: 'bg-blue-500', label: '4th' },
  { icon: null, bg: 'bg-blue-400', label: '5th' },
];

export function Leaderboard({ engineers, onSelect, selected }: Props) {
  const top5 = engineers.slice(0, 5);
  const rest = engineers.slice(5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Top 5 Most Impactful Engineers</CardTitle>
      </CardHeader>

      <CardContent>
        {/* Top 5 */}
        <div className="space-y-2">
          {top5.map((engineer, index) => {
            const rank = rankConfig[index];
            const RankIcon = rank?.icon;

            return (
              <div
                key={engineer.username}
                onClick={() => onSelect(engineer)}
                className={`flex items-center gap-4 p-4 rounded-lg transition-all cursor-pointer border-2 ${
                  selected?.username === engineer.username
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:bg-muted'
                }`}
              >
                {/* Rank badge */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`size-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${rank.bg}`}>
                      {RankIcon ? <RankIcon className="size-5" /> : `#${index + 1}`}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Rank #{index + 1} &mdash; {rank.label}</TooltipContent>
                </Tooltip>

                {/* Avatar */}
                <Avatar className="size-14 border-2 border-border">
                  <AvatarImage src={engineer.avatar_url} alt={engineer.name || engineer.username} />
                  <AvatarFallback className="text-lg font-semibold">
                    {getInitials(engineer.name, engineer.username)}
                  </AvatarFallback>
                </Avatar>

                {/* Name & stats */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg truncate">
                    {engineer.name || engineer.username}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    @{engineer.username}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {engineer.stats.prs_created} PRs
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {engineer.stats.reviews_given} Reviews
                    </Badge>
                  </div>
                </div>

                {/* Impact Score with tooltip breakdown */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-primary tabular-nums">
                        {engineer.impact_score.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">Impact</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold mb-1">Score Breakdown</div>
                      <div className="flex justify-between gap-4">
                        <span>Quality:</span>
                        <span className="font-mono">{engineer.quality_score.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Velocity:</span>
                        <span className="font-mono">{engineer.velocity_score.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Collaboration:</span>
                        <span className="font-mono">{engineer.collaboration_score.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Leadership:</span>
                        <span className="font-mono">{engineer.leadership_score.toFixed(1)}</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>

        {/* Rest of contributors */}
        {rest.length > 0 && (
          <>
            <Separator className="my-4" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              All Other Contributors ({rest.length})
            </h3>
            <ScrollArea className="h-80">
              <div className="space-y-1 pr-3">
                {rest.map((engineer, index) => (
                  <div
                    key={engineer.username}
                    onClick={() => onSelect(engineer)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all cursor-pointer ${
                      selected?.username === engineer.username
                        ? 'bg-primary/5 border border-primary/30'
                        : 'hover:bg-muted border border-transparent'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground w-6 text-right shrink-0 font-mono">
                      {index + 6}
                    </span>
                    <Avatar>
                      <AvatarImage src={engineer.avatar_url} alt={engineer.name || engineer.username} />
                      <AvatarFallback className="text-xs">
                        {getInitials(engineer.name, engineer.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block">
                        {engineer.name || engineer.username}
                      </span>
                      <span className="text-xs text-muted-foreground">@{engineer.username}</span>
                    </div>
                    <Badge variant="outline" className="font-mono tabular-nums">
                      {engineer.impact_score.toFixed(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
