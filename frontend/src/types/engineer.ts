export interface Engineer {
  username: string;
  name: string;
  avatar_url: string;
  impact_score: number;
  quality_score: number;
  velocity_score: number;
  collaboration_score: number;
  leadership_score: number;
  stats: {
    prs_created: number;
    reviews_given: number;
    files_changed: number;
    avg_merge_time: number;
  };
}

export interface Dimension {
  name: string;
  weight: number;
  description: string;
  signals: string[];
}

export interface Methodology {
  overview: string;
  dimensions: Dimension[];
  philosophy: string;
}

export interface TrendEngineer {
  username: string;
  name: string;
}

export interface TrendData {
  engineers: TrendEngineer[];
  series: Record<string, string | number>[];
}
