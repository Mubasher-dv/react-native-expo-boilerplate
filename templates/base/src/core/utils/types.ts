export interface InsetsProps {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export type TeamNextEvent = {
  id: string;
  monthLabel: string;
  dayLabel: string;
  title: string;
  timeAndLocationLabel: string;
  kind: ScheduleEventKind;
};

export type TeamStatus = "active" | "inactive";
export type ScheduleEventKind = "game" | "practice";

export type Team = {
  id: string;
  name: string;
  seasonLabel: string;
  status: TeamStatus;
  logoUri?: string;
  playerCount: number;
  coachCount: number;
  eventCount: number;
  nextEvent: TeamNextEvent | null;
};

export type ScheduleRow = {
  id: string;
  monthLabel: string;
  dayLabel: string;
  title: string;
  timeAndLocationLabel: string;
  kind: ScheduleEventKind;
};

export type PlayerTransaction = {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: string;
  status: "paid" | "unpaid";
};
