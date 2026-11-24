// Calendar dates are local dates, not UTC timestamps. Keep stored date strings
// unchanged; this helper is only for new selections and log entries.
export function localDateKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthRange(date) {
  return {
    from: localDateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
    to: localDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0))
  };
}

// Read timeouts never retry a write or mark a dose as saved.
export async function withReadTimeout(read, milliseconds = 15000) {
  let timer;
  try {
    return await Promise.race([
      read,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("The connection took too long. Please try again.");
          error.code = "calendar/timeout";
          reject(error);
        }, milliseconds);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function readCalendarMonth(db, userId, date, firestore) {
  if (!userId) throw new Error("Sign in to view your calendar.");
  const { collection, query, where, getDocsFromServer } = firestore;
  const range = monthRange(date);
  const protocolQuery = query(collection(db, "protocols"), where("userId", "==", userId));
  const logsQuery = query(
    collection(db, "logs"),
    where("userId", "==", userId),
    where("date", ">=", range.from),
    where("date", "<=", range.to)
  );
  // Both reads start immediately. Never fall back to downloading all history.
  const [protocols, logs] = await withReadTimeout(Promise.all([
    getDocsFromServer(protocolQuery),
    getDocsFromServer(logsQuery)
  ]));
  const rows = (snapshot) => snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
  return { protocols: rows(protocols), logs: rows(logs) };
}

export function calendarLoadMessage(error) {
  if (error?.code === "failed-precondition") {
    return "Calendar setup needs attention. Please ask your provider to check the calendar connection, then retry.";
  }
  if (error?.code === "permission-denied") {
    return "Your calendar could not be accessed. Please sign in again or contact your provider.";
  }
  return "Could not load your calendar. Check your connection and try again.";
}
