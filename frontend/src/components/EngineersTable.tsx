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
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return username.slice(0, 2).toUpperCase();
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-500';
}

export function EngineersTable({ engineers, onSelect, selected }: Props) {
  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12">#</TableHead>
            <TableHead>Engineer</TableHead>
            <TableHead className="text-right">Impact</TableHead>
            <TableHead className="text-right">Quality</TableHead>
            <TableHead className="text-right">Velocity</TableHead>
            <TableHead className="text-right">Collab</TableHead>
            <TableHead className="text-right">Leadership</TableHead>
            <TableHead className="text-right">PRs</TableHead>
            <TableHead className="text-right">Reviews</TableHead>
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
              <TableCell className="font-mono text-muted-foreground text-xs">
                {index + 1}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={engineer.avatar_url} alt={engineer.name || engineer.username} />
                    <AvatarFallback className="text-xs">
                      {getInitials(engineer.name, engineer.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {engineer.name || engineer.username}
                    </div>
                    <div className="text-xs text-muted-foreground">@{engineer.username}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Badge variant={index < 3 ? 'default' : 'secondary'} className="tabular-nums">
                        {engineer.impact_score.toFixed(1)}
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1 text-xs">
                      <div>Quality: {engineer.quality_score.toFixed(1)}</div>
                      <div>Velocity: {engineer.velocity_score.toFixed(1)}</div>
                      <div>Collab: {engineer.collaboration_score.toFixed(1)}</div>
                      <div>Leadership: {engineer.leadership_score.toFixed(1)}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className={`text-right font-mono tabular-nums text-sm ${scoreColor(engineer.quality_score)}`}>
                {engineer.quality_score.toFixed(1)}
              </TableCell>
              <TableCell className={`text-right font-mono tabular-nums text-sm ${scoreColor(engineer.velocity_score)}`}>
                {engineer.velocity_score.toFixed(1)}
              </TableCell>
              <TableCell className={`text-right font-mono tabular-nums text-sm ${scoreColor(engineer.collaboration_score)}`}>
                {engineer.collaboration_score.toFixed(1)}
              </TableCell>
              <TableCell className={`text-right font-mono tabular-nums text-sm ${scoreColor(engineer.leadership_score)}`}>
                {engineer.leadership_score.toFixed(1)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {engineer.stats.prs_created}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {engineer.stats.reviews_given}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
