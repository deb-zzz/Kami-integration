/** Convert IANA timezone to offset in ms */
function getTimezoneOffsetMs(tz: string) {
    const now = new Date();
    const tzDateStr = now.toLocaleString("en-US", { timeZone: tz });
    const utcDateStr = now.toLocaleString("en-US", { timeZone: "UTC" });
    return new Date(tzDateStr).getTime() - new Date(utcDateStr).getTime();
}

export function getDateRange(
    range: string,
    tz: string = 'UTC',
    customFrom?: string,
    customTo?: string
) {
    const tzOffset = getTimezoneOffsetMs(tz);
    const nowUtc = new Date();
    const now = new Date(nowUtc.getTime() + tzOffset);

    let from: Date;
    let to: Date = now;

    switch (range) {
        case 'today':
            from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            from = new Date(from.getTime() - tzOffset);
            break;

        case 'week':
            const day = now.getUTCDay(); // Sunday=0
            const diff = day; // days since Sunday
            from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
            from = new Date(from.getTime() - tzOffset);
            break;

        case 'month':
            from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            from = new Date(from.getTime() - tzOffset);
            break;

        case 'year':
            from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
            from = new Date(from.getTime() - tzOffset);
            break;

        case 'custom':
            if (!customFrom || !customTo) throw new Error("Custom range requires dateFrom and dateTo");
            from = new Date(customFrom);
            to = new Date(customTo);
            break;

        default:
            from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            from = new Date(from.getTime() - tzOffset);
    }

    return {
        fromUnix: from.getTime(),
        toUnix: to.getTime(),
        tzOffset
    };
}

/**
 * Aggregate data into time buckets, grouped by legend (status/type)
 */
export function aggregateByTimeUnitWithLegend<T extends { timestamp: number; legend: string }>(
    data: T[],
    range: "today" | "week" | "month" | "year" | "custom",
    tzOffset: number
) {
    const grouped = new Map<string, Map<number, number>>(); // legend -> timestamp -> count

    data.forEach(d => {
        const localTs = d.timestamp + tzOffset;
        const date = new Date(localTs);
        let key: number;

        switch (range) {
            case "today":
                key = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
                break;
            case "week":
            case "month":
                key = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
                break;
            case "year":
                key = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
                break;
            default:
                key = d.timestamp;
        }

        if (!grouped.has(d.legend)) grouped.set(d.legend, new Map());
        const map = grouped.get(d.legend)!;
        map.set(key, (map.get(key) ?? 0) + 1);
    });

    const result = Array.from(grouped.entries()).map(([legend, map]) => ({
        legend,
        data: Array.from(map.entries())
            .sort(([a], [b]) => a - b)
            .map(([x, y]) => ({ x, y }))
    }));

    return result;
}
