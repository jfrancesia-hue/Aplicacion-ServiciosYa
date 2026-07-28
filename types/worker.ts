import type { Enums } from "./database.types";

export type WorkerStatus = Enums<"worker_status">;

export type WorkerAvailabilityState = {
  status: WorkerStatus;
  lastSeenAt: string | null;
  availableUntil: string | null;
  durationHours: number | null;
};

export type WorkerStatusLabels = {
  [P in WorkerStatus]: string;
};

export type WorkerStatusQueryParams = {
  worker_status_filter: WorkerStatus[] | null;
};
