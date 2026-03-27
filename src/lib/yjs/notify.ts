export async function notifyPartyKitRoom(
  noteId: string,
  message: { type: string }
): Promise<void> {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  if (!host) return;

  const protocol = host.startsWith("localhost") ? "http" : "https";
  const url = `${protocol}://${host}/party/note:${noteId}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.error("Failed to notify PartyKit room:", err);
  }
}
