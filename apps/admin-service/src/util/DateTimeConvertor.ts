/**
 * Convert the ISO-8601 Date String format into UNIX timestamp (seconds).
 * */
export const isoToUnixSeconds = (iso?: string) =>
    iso ? Math.floor(new Date(iso).getTime() / 1000) : undefined;

/**
 * Convert the ISO-8601 Date String format into UNIX timestamp (milliseconds).
 * */
export const isoToUnixMilliseconds = (iso?: string) =>
    iso ? new Date(iso).getTime() : undefined;