/**
 * Fetch Swedish holidays from the Dagsmart API
 * API Documentation: https://dagsmart.se/api/
 *
 * Rate limit: Maximum 5 requests from a single IP address every 10 seconds
 * HTTP 429 response indicates rate limit exceeded
 */

interface DagsmartEvent {
  date: string;
  name: {
    sv: string;
    [locale: string]: string;
  };
}

const DAGSMART_API_BASE = 'https://api.dagsmart.se';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const holidayCache: Record<string, { data: string[]; timestamp: number }> = {};
const holidaysByDateCache: Record<string, DagsmartEvent> = {}; // Store full event objects for name lookups

/**
 * Get Swedish holidays for a given year from Dagsmart API
 * Returns an array of date strings in YYYY-MM-DD format
 */
export const getSwedenHolidaysForYear = async (year: number): Promise<string[]> => {
  const cacheKey = `holidays_${year}`;

  // Check cache first
  if (holidayCache[cacheKey]) {
    const { data, timestamp } = holidayCache[cacheKey];
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  try {
    const response = await fetch(`${DAGSMART_API_BASE}/holidays?year=${year}&weekends=false`);

    if (response.status === 429) {
      console.warn('Dagsmart API rate limit exceeded (429). Retrying later.');
      return [];
    }

    if (!response.ok) {
      console.error(`Dagsmart API error: ${response.status}`);
      return [];
    }

    const events: DagsmartEvent[] = await response.json();

    // Extract date strings and cache the full events for name lookups
    const holidays = events.map((event) => {
      holidaysByDateCache[event.date] = event;
      return event.date;
    });

    // Cache the result
    holidayCache[cacheKey] = {
      data: holidays,
      timestamp: Date.now()
    };

    return holidays;
  } catch (error) {
    console.error('Failed to fetch holidays from Dagsmart API:', error);
    return [];
  }
};

/**
 * Get holiday name in Swedish for a given date
 * Uses cached event data if available, otherwise fetches from API
 */
export const getHolidayName = async (dateStr: string): Promise<string | null> => {
  // Check if we already have the event cached
  if (holidaysByDateCache[dateStr]) {
    return holidaysByDateCache[dateStr].name.sv;
  }

  // Otherwise, fetch the year's holidays to populate cache
  const [year] = dateStr.split('-');

  try {
    const response = await fetch(`${DAGSMART_API_BASE}/holidays?year=${year}&weekends=false`);

    if (response.status === 429) {
      console.warn('Dagsmart API rate limit exceeded (429).');
      return null;
    }

    if (!response.ok) {
      console.error(`Dagsmart API error: ${response.status}`);
      return null;
    }

    const events: DagsmartEvent[] = await response.json();

    // Cache all events and find the matching one
    const event = events.find((e) => e.date === dateStr);
    if (event) {
      holidaysByDateCache[event.date] = event;
      return event.name.sv;
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch holiday name from Dagsmart API:', error);
    return null;
  }
};
