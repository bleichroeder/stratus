import { createClient } from "@/lib/supabase/server";

interface GoogleAttendee {
  email: string;
  displayName?: string;
  self?: boolean;
  responseStatus?: string;
}

interface GoogleEntryPoint {
  uri?: string;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: GoogleAttendee[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: GoogleEntryPoint[] };
  recurringEventId?: string;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("Authorization");
  const providerToken = authHeader?.replace("Bearer ", "");
  if (!providerToken) {
    return Response.json({ error: "No provider token" }, { status: 400 });
  }

  const now = new Date();
  // Look ahead: accept a `hours` query param, default to 24
  const { searchParams: qp } = new URL(request.url);
  const hoursAhead = Math.min(Math.max(parseInt(qp.get("hours") ?? "24", 10) || 24, 1), 72);
  const lookAhead = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", now.toISOString());
  url.searchParams.set("timeMax", lookAhead.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("fields", "items(id,summary,description,start,end,attendees,hangoutLink,conferenceData,recurringEventId)");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${providerToken}` },
  });

  if (res.status === 401) {
    return Response.json({ error: "Token expired" }, { status: 401 });
  }
  if (!res.ok) {
    return Response.json({ error: "Google API error" }, { status: 502 });
  }

  const data = await res.json();

  const events = ((data.items || []) as GoogleEvent[]).map((item) => ({
    id: item.id,
    title: item.summary || "Untitled event",
    description: item.description || null,
    startTime: item.start?.dateTime || item.start?.date || "",
    endTime: item.end?.dateTime || item.end?.date || "",
    attendees: (item.attendees || []).map((a) => ({
      email: a.email,
      displayName: a.displayName || null,
      self: a.self || false,
      responseStatus: a.responseStatus || "needsAction",
    })),
    meetingLink: item.hangoutLink || item.conferenceData?.entryPoints?.[0]?.uri || null,
    recurringEventId: item.recurringEventId || null,
  }));

  return Response.json({ events });
}
