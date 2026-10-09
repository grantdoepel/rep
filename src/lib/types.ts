export type Track = "push" | "pull" | "legs" | "core" | "cardio" | "mobility";
export type Environment = "home" | "gym" | "travel";
export type Tier = "foundation" | "standard" | "advanced";
export type GoalTier = "casual" | "regular" | "serious";
export type Flag = "knees" | "shoulders" | "wrists" | "low_back" | "seated" | "low_impact";

export interface Movement {
  id: string;
  name: string;
  track: Track;
  difficulty: 1 | 2 | 3 | 4 | 5;
  env: Environment[];           // where it's available
  unit: "reps" | "seconds";
  cue: string;
  regression?: string;          // movement id
  progression?: string;         // movement id
  flags: Flag[];                // contraindications
  seated?: boolean;             // usable in a seated profile
}

export interface CrownLevel {
  track: Track;
  level: 1 | 2 | 3 | 4 | 5;
  requirements: { movement: string; target: number }[]; // home variant
  gym: { movement: string; target: number }[];
}

export interface SetMove {
  movement: string;
  target: number;
  unit: "reps" | "seconds";
  achieved?: number;
}

export interface DailySet {
  id: string;
  date: string;                 // YYYY-MM-DD local
  tracks: Track[];
  moves: SetMove[];
  plannedMinutes: number;
  kind: "normal" | "rescue" | "rest" | "placement" | "event";
  status: "planned" | "active" | "done";
  xp?: number;
  perfect?: boolean;
}

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  goalTier: GoalTier;
  environment: Environment;
  tier: Tier;
  timezone: string;
  restDays: number[];           // 0=Sun..6=Sat
  injuryFlags: Flag[];
  accessibility: Flag[];
  whyText?: string;
  whyWho?: string;
  createdAt: string;
}

export interface Crowns { [track: string]: { level: number; clears: number; lastClearDate?: string; misses: number } }

export interface Streak { current: number; longest: number; lastCountedDate?: string; freezes: number }

export interface Friend { id: string; username: string; displayName: string; streak: number; xpWeek: number; doneToday: boolean; atRisk: boolean; isDuo?: boolean; isCrew?: boolean; movingNow?: boolean; color: string }

export interface LeagueRow { id: string; displayName: string; goalTier: GoalTier; sets: number; xp: number; isYou?: boolean; isFriend?: boolean; isDuo?: boolean; perfect?: number }

export type LeagueTier = "bronze" | "silver" | "gold" | "sapphire" | "diamond";
export const LEAGUE_TIERS: LeagueTier[] = ["bronze", "silver", "gold", "sapphire", "diamond"];

export interface DuoQuest { partnerId: string; partnerName: string; targetXp: number; yourXp: number; partnerXp: number; weekStart: string; status: "active" | "cleared" | "failed" }

export interface DayLog { date: string; kind: "perfect" | "done" | "rest" | "missed" | "frozen" }
