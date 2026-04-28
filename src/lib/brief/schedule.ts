// Per-user-local-time Monday Brief scheduling.
//
// The Monday Brief cron fires every hour. At each tick this helper decides,
// for one user with their preferred (timezone, brief_send_hour), whether a
// brief should go out *now* — i.e. is it currently Monday at their preferred
// local hour in their zone.
//
// We use Intl.DateTimeFormat with a fixed locale ('en-US') so weekday/hour
// parsing is stable across runtimes. DST is handled by the IANA tz database
// — the same UTC instant resolves to a different local hour on either side
// of a transition, which is exactly the behaviour we want.

export interface BriefScheduleInput {
  /** IANA timezone, e.g. "America/Los_Angeles". */
  timezone: string;
  /** Local hour (0–23) the user wants their Monday Brief delivered. */
  briefSendHour: number;
}

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let f = FORMATTER_CACHE.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    });
    FORMATTER_CACHE.set(timezone, f);
  }
  return f;
}

/**
 * Returns true if `now` falls inside the Monday-at-briefSendHour local-time
 * window for the user's timezone. The window is one hour wide (e.g. 08:00–
 * 08:59 local) so an hourly cron tick at minute :00 always lands inside it
 * exactly once per week.
 *
 * Throws on invalid timezone (Intl.DateTimeFormat raises a RangeError) so
 * bad data surfaces in cron logs instead of silently skipping users.
 */
export function shouldSendMondayBrief(
  now: Date,
  input: BriefScheduleInput,
): boolean {
  const { timezone, briefSendHour } = input;

  if (!Number.isInteger(briefSendHour) || briefSendHour < 0 || briefSendHour > 23) {
    return false;
  }

  const parts = formatterFor(timezone).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hourStr = parts.find((p) => p.type === 'hour')?.value;
  if (!weekday || !hourStr) return false;

  // Intl with hour12=false renders midnight as '24' in some en-US runtimes
  // and '00' in others — normalise to 0..23.
  const hour = Number(hourStr) % 24;

  return weekday === 'Mon' && hour === briefSendHour;
}

/**
 * Default fallback when a user has no stored timezone. We picked
 * America/New_York because the early customer cohort is US-East-heavy and
 * "8 AM ET on Monday" is the closest approximation to the launch promise
 * for an unprofiled user.
 */
export const DEFAULT_TIMEZONE = 'America/New_York';
export const DEFAULT_BRIEF_SEND_HOUR = 8;
