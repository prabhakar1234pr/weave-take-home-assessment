'use client';

import { Engineer } from '@/types/engineer';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';

interface Props {
  engineers: Engineer[];
  onSelect: (engineer: Engineer) => void;
  selected: Engineer | null;
}

function getInitials(name: string, username: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return username.slice(0, 2).toUpperCase();
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

export function EngineersTable({ engineers, onSelect, selected }: Props) {
  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 text-[10px] uppercase tracking-wider">#</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider">Engineer</TableHead>
            <TableHead className="text-right text-[10px] uppercase tracking-wider">Impact</TableHead>
            <TableHead className="text-right text-[10px] uppercase tracking-wider">Quality</TableHead>
            <TableHead className="text-right text-[10px] uppercase tracking-wider">Velocity</TableHead>
            <TableHead className="text-right text-[10px] uppercase tracking-wider">Collab</TableHead>
            <TableHead className="text-right text-[10px] uppercase tracking-wider">Leadership</TableHead>
            <TableHead className="text-right text-[10px] uppercase tracking-wider">PRs</TableHead>
            <TableHead className="text-right text-[10px] uppercase tracking-wider">Reviews</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {engineers.map((engineer, index) => (
            <TableRow
              key={engineer.username}
              onClick={() => onSelect(engineer)}
              className={`cursor-pointer transition-colors ${
                selected?.username === engineer.username ? 'bg-primary/5' : ''
              }`}
            >
              <TableCell className="font-mono text-muted-foreground text-[10px]">
                {index + 1}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-7">
                    <AvatarImage src={engineer.avatar_url} alt={engineer.name || engineer.username} />
                    <AvatarFallback className="text-[10px]">{getInitials(engineer.name, engineer.username)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{engineer.name || engineer.username}</div>
                    <div className="text-[10px] text-muted-foreground">@{engineer.username}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Badge variant={index < 3 ? 'default' : 'secondary'} className="tabular-nums text-[10px] h-5">
                        {engineer.impact_score.toFixed(1)}
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-0.5 text-xs">
                      <div>Quality: {engineer.quality_score.toFixed(1)}</div>
                      <div>Velocity: {engineer.velocity_score.toFixed(1)}</div>
                      <div>Collab: {engineer.collaboration_score.toFixed(1)}</div>
                      <div>Leadership: {engineer.leadership_score.toFixed(1)}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className={`text-right font-mono tabular-nums text-xs ${scoreColor(engineer.quality_score)}`}>
                {engineer.quality_score.toFixed(1)}
              </TableCell>
              <TableCell className={`text-right font-mono tabular-nums text-xs ${scoreColor(engineer.velocity_score)}`}>
                {engineer.velocity_score.toFixed(1)}
              </TableCell>
              <TableCell className={`text-right font-mono tabular-nums text-xs ${scoreColor(engineer.collaboration_score)}`}>
                {engineer.collaboration_score.toFixed(1)}
              </TableCell>
              <TableCell className={`text-right font-mono tabular-nums text-xs ${scoreColor(engineer.leadership_score)}`}>
                {engineer.leadership_score.toFixed(1)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs">
                {engineer.stats.prs_created}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs">
                {engineer.stats.reviews_given}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
