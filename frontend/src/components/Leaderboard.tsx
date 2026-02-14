'use client';

import { Engineer } from '@/types/engineer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return username.slice(0, 2).toUpperCase();
}

const rankConfig = [
  { icon: Trophy, gradient: 'from-yellow-400 to-amber-500', label: 'Gold' },
  { icon: Medal, gradient: 'from-gray-300 to-gray-400', label: 'Silver' },
  { icon: Award, gradient: 'from-amber-500 to-orange-600', label: 'Bronze' },
  { icon: null, gradient: 'from-blue-400 to-blue-500', label: '4th' },
  { icon: null, gradient: 'from-blue-300 to-blue-400', label: '5th' },
];

export function Leaderboard({ engineers, onSelect, selected }: Props) {
  const top5 = engineers.slice(0, 5);
  const rest = engineers.slice(5);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Impact Leaderboard</CardTitle>
        <CardDescription className="text-xs">Top contributors ranked by multi-dimensional impact score</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Top 5 */}
        <div className="space-y-1.5">
          {top5.map((engineer, index) => {
            const rank = rankConfig[index];
            const RankIcon = rank?.icon;

            return (
              <div
                key={engineer.username}
                onClick={() => onSelect(engineer)}
                className={`flex items-center gap-3.5 p-3 rounded-xl transition-all cursor-pointer border ${
                  selected?.username === engineer.username
                    ? 'border-primary/50 bg-primary/5 shadow-sm'
                    : 'border-transparent hover:bg-muted/60'
                }`}
              >
                {/* Rank */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`size-9 rounded-full bg-gradient-to-br ${rank.gradient} flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm`}>
                      {RankIcon ? <RankIcon className="size-4" /> : `#${index + 1}`}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Rank #{index + 1}</TooltipContent>
                </Tooltip>

                {/* Avatar */}
                <Avatar className="size-10 border-2 border-border shadow-sm">
                  <AvatarImage src={engineer.avatar_url} alt={engineer.name || engineer.username} />
                  <AvatarFallback className="text-sm font-semibold">{getInitials(engineer.name, engineer.username)}</AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{engineer.name || engineer.username}</div>
                  <div className="text-muted-foreground text-xs">@{engineer.username}</div>
                  <div className="flex gap-1.5 mt-1">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{engineer.stats.prs_created} PRs</Badge>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{engineer.stats.reviews_given} Reviews</Badge>
                  </div>
                </div>

                {/* Score */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold tabular-nums bg-gradient-to-br from-blue-600 to-violet-600 bg-clip-text text-transparent">
                        {engineer.impact_score.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Impact</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <div className="space-y-0.5 text-xs">
                      <div className="font-semibold mb-1">Score Breakdown</div>
                      <div className="flex justify-between gap-4"><span>Quality:</span><span className="font-mono">{engineer.quality_score.toFixed(1)}</span></div>
                      <div className="flex justify-between gap-4"><span>Velocity:</span><span className="font-mono">{engineer.velocity_score.toFixed(1)}</span></div>
                      <div className="flex justify-between gap-4"><span>Collab:</span><span className="font-mono">{engineer.collaboration_score.toFixed(1)}</span></div>
                      <div className="flex justify-between gap-4"><span>Leadership:</span><span className="font-mono">{engineer.leadership_score.toFixed(1)}</span></div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>

        {/* Others */}
        {rest.length > 0 && (
          <>
            <Separator className="my-3" />
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              All Other Contributors ({rest.length})
            </h3>
            <ScrollArea className="h-72">
              <div className="space-y-0.5 pr-3">
                {rest.map((engineer, index) => (
                  <div
                    key={engineer.username}
                    onClick={() => onSelect(engineer)}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      selected?.username === engineer.username
                        ? 'bg-primary/5 border border-primary/30'
                        : 'hover:bg-muted/60 border border-transparent'
                    }`}
                  >
                    <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0 font-mono">{index + 6}</span>
                    <Avatar className="size-7">
                      <AvatarImage src={engineer.avatar_url} alt={engineer.name || engineer.username} />
                      <AvatarFallback className="text-[10px]">{getInitials(engineer.name, engineer.username)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs truncate block">{engineer.name || engineer.username}</span>
                    </div>
                    <Badge variant="outline" className="font-mono tabular-nums text-[10px] h-5">
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
