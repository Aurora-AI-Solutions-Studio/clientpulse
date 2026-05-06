// Aurora Suite Signal pipeline — shared payload contract.
//
// COPY THIS FILE BETWEEN CP AND ContentPulse VERBATIM. Schema drift between
// products = silent ingestion failures. Single edit point: bump
// SIGNAL_PROTOCOL_VERSION when changing the wire format and have the
// ingester reject older versions. The rf_* field names are wire
// identifiers and intentionally preserved across the rename.

export const SIGNAL_PROTOCOL_VERSION = 1 as const;

export type SignalType =
  | 'content_velocity'   // pieces approved/published per period
  | 'approval_latency'   // ms between piece-created and piece-approved
  | 'pause_resume'       // 1.0 = paused, 0.0 = active (derived from velocity gaps)
  | 'voice_freshness'    // days since voice_profile last updated
  | 'ingestion_rate'     // ingestion_jobs count for the period
  | 'engagement_velocity'; // engagement events on ContentPulse-published pieces per period (Slice 6)

export interface SignalPayload {
  /** Bumps when wire format changes — verifier rejects unknown versions. */
  v: typeof SIGNAL_PROTOCOL_VERSION;
  /** ContentPulse's external client identifier (typically the
   *  ContentPulse client UUID). Field name keeps the legacy `rf_` token
   *  because this is the wire schema shared with the sibling product. */
  rf_client_id: string;
  /** ContentPulse's display name for the client — CP uses this as the
   *  matcher fallback when no entry in cp_rf_client_map exists yet. */
  rf_client_name: string;
  /** Optional email — when present, makes the CP-side mapping more
   *  reliable than name-only match. */
  rf_client_email?: string;
  /** Email of the ContentPulse account that owns the client roster. CP
   *  uses this to scope the signal to the right agency. */
  agency_email: string;
  signal_type: SignalType;
  /** Bucket the signal describes, e.g. '2026-W17' for a weekly
   *  velocity signal. The (client_id, signal_type, period) tuple is
   *  the idempotency key on both sides. */
  period: string;
  /** Numeric value carried by the signal. Type-specific units:
   *   content_velocity     → pieces/period
   *   approval_latency     → milliseconds
   *   pause_resume         → 0.0 | 1.0
   *   voice_freshness      → days
   *   ingestion_rate       → jobs/period
   *   engagement_velocity  → engagement events/period */
  value: number;
  /** Free-form, signal-type-specific. Sparkline points, prev-period
   *  delta, contributing piece IDs, etc. */
  metadata?: Record<string, unknown>;
  /** ISO 8601 — when ContentPulse actually computed the signal. */
  emitted_at: string;
}
