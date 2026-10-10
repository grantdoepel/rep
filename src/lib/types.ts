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
  test?: boolean;               // PRD 7: a Test Set move
  name?: string;                // PRD 8: custom (prescribed) move name when not in the catalog
}

export interface DailySet {
  id: string;
  date: string;                 // YYYY-MM-DD local
  tracks: Track[];
  moves: SetMove[];
  plannedMinutes: number;
  kind: "normal" | "rescue" | "rest" | "placement" | "event";
  test?: boolean;               // PRD 7
  planId?: string;              // PRD 8
  via?: "home" | "anchor" | "push" | "pro";   // how it was started (analytics)
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
  treatText?: string;
  treatMilestone?: number;
  gymLat?: number;
  gymLng?: number;
  gymName?: string;
  // the eight bets (synced through patch_profile / my_profile_extras)
  promiseDays?: number;         // 3..7, PRD 1
  promiseWeeksKept?: number;
  promiseWeekStart?: string;
  rescueAt?: string;            // "HH:MM" local, PRD 2
  anchor?: "time" | "home" | "tag";   // PRD 6
  homeLat?: number;
  homeLng?: number;
  tagCode?: string;
  noteRecordedAt?: string;      // PRD 5
  noteText?: string;
  birthYear?: number;           // PRD 7
  sex?: "f" | "m";
  healthConnected?: boolean;    // PRD 4
  createdAt: string;
}

// PRD 3 · a crew: up to six people, one shared weekly target
export interface Crew { id: string; name: string; code: string; weekStart: string; xp: number; targetXp: number; kept: boolean; members: { id: string; displayName: string; doneToday: boolean; doneAt?: string; streak: number; color: string; isYou?: boolean }[] }
// PRD 8 · a prescribed plan
export interface Plan { id: string; clinic: string; moves: { id: string; name: string; target: number; unit: "reps" | "seconds"; cue?: string }[]; weeks: number; daysPerWeek: number; startedAt: string }
// one ledger row (move_daily)
export interface LedgerRow { movement: string; date: string; achieved: number; target: number; test?: boolean }

export interface Crowns { [track: string]: { level: number; clears: number; lastClearDate?: string; misses: number } }

export interface Streak { current: number; longest: number; lastCountedDate?: string; freezes: number }

export interface Friend { id: string; username: string; displayName: string; streak: number; xpWeek: number; doneToday: boolean; atRisk: boolean; isDuo?: boolean; isCrew?: boolean; movingNow?: boolean; color: string }

export interface LeagueRow { id: string; displayName: string; goalTier: GoalTier; sets: number; xp: number; isYou?: boolean; isFriend?: boolean; isDuo?: boolean; perfect?: number }

export type LeagueTier = "bronze" | "silver" | "gold" | "sapphire" | "diamond";
export const LEAGUE_TIERS: LeagueTier[] = ["bronze", "silver", "gold", "sapphire", "diamond"];

export interface DuoQuest { partnerId: string; partnerName: string; targetXp: number; yourXp: number; partnerXp: number; weekStart: string; status: "active" | "cleared" | "failed"; wagerYou?: string; wagerPartner?: string }

export interface ProofShot { id: string; date: string; dataUrl: string; setId: string; expiresAt: string }
export interface PinkyPromise { id: string; date: string; voucherId: string; voucherName: string; status: "pending" | "vouched" | "declined" }
export interface CrewAward { id: string; name: string; userId: string; userName: string; blurb: string }

export interface DayLog { date: string; kind: "perfect" | "done" | "rest" | "missed" | "frozen" | "moved"; source?: string }
