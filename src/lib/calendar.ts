import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/lib/types";

let cachedProviderToken: string | null = null;

async function getProviderToken(): Promise<string | null> {
  if (cachedProviderToken) return cachedProviderToken;
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  cachedProviderToken = session?.provider_token ?? null;
  return cachedProviderToken;
}

async function refreshProviderToken(): Promise<string | null> {
  const res = await fetch("/api/calendar/refresh-token", { method: "POST" });
  if (!res.ok) return null;
  const { access_token } = await res.json();
  cachedProviderToken = access_token;
  return access_token;
}

export async function fetchCalendarEvents(hoursAhead = 24): Promise<CalendarEvent[]> {
  let token = await getProviderToken();

  // If no token in session (common after page refresh), try refreshing
  if (!token) {
    token = await refreshProviderToken();
    if (!token) return [];
  }

  const url = `/api/calendar/events?hours=${hoursAhead}`;

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // If token expired, refresh and retry once
  if (res.status === 401) {
    token = await refreshProviderToken();
    if (!token) return [];
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!res.ok) return [];
  const { events } = await res.json();
  return events;
}
