export interface SheetData {
  [key: string]: any;
}

export interface DashboardData {
  rows: SheetData[];
  headers: string[];
}

export interface RaidMember {
  slot: number;
  character: string;
  player: string;
  class: string;
  spec: string;
  role: string;
  draenei: string;
  manualGroup: string;
  position: number;
  finalGroup: number;
  rowCategory: 'definite' | 'ersatz' | 'unsure';
}

export interface PointsData {
  player: string;
  points: number;
  tokens: string;
}

export interface GroupOverview {
  groupName: string;
  members: RaidMember[];
  buffs: string;
  draeneiCount: number;
}
