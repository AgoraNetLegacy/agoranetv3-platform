// Operator actions on the public record (ADMIN_OPS §2 via BACKUP_DR §2:
// backup access "belongs in the admin action log"). The admin log IS the
// civic ledger's admin.* events; the transparency page renders them, and
// an empty log is honestly empty. Payloads carry operational facts only
// (file names, counts, pass/fail); never soul data, never paths that
// reveal infrastructure layout beyond the file's own name.

import type { DbOrTx } from "./db";
import { appendEvent } from "./ledger";

export type OpsEventType =
  | "admin.backup.created"
  | "admin.backup.pruned"
  | "admin.backup.drill"
  | "admin.backup.restored";

export async function recordOpsEvent(
  db: DbOrTx,
  eventType: OpsEventType,
  payload: Record<string, unknown>
) {
  return appendEvent(db, {
    actorType: "system",
    actorId: null,
    eventType,
    payload: {
      // Individually attributable (ADMIN_OPS §2): a human runs jobs under
      // their name; unattended runs say so explicitly.
      operator: process.env.OPERATOR_NAME ?? "unattended-cron",
      ...payload,
    },
  });
}
