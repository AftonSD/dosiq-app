import { useEffect, useRef, useState } from "react";
import { localDateKey, readCalendarMonth, calendarLoadMessage } from "../calendarData";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  getDocsFromServer,
  addDoc,
  doc,
  updateDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userId, setUserId] = useState(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const savePending = useRef(false);
  const monthKey = localDateKey(currentDate).slice(0, 7);
  const scope = `${userId || ""}|${monthKey}`;
  const dataReady = !!userId && auth.currentUser?.uid === userId && data?.scope === scope;
  const protocols = dataReady ? data.protocols : [];
  const logs = dataReady ? data.logs : [];

  const [manualProtocolId, setManualProtocolId] = useState("");
  const [manualTaken, setManualTaken] = useState(true);
  const [manualNotes, setManualNotes] = useState("");
  const [manualSideEffects, setManualSideEffects] = useState("");
  const formatDate = localDateKey;

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setUserId(user?.uid || null);
    setData(null);
    setLoadError(null);
    setSaveMessage(null);
    setManualProtocolId("");
    setManualNotes("");
    setManualSideEffects("");
  }), []);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    setData(null);
    if (!userId) return () => { active = false; };
    const date = new Date(`${monthKey}-01T12:00:00`);
    readCalendarMonth(db, userId, date, { collection, query, where, getDocsFromServer })
      .then((result) => {
        if (!active || auth.currentUser?.uid !== userId) return;
        setData({ ...result, scope });
        setManualProtocolId((id) => result.protocols.some((p) => p.id === id)
          ? id : result.protocols[0]?.id || "");
      })
      .catch((error) => {
        if (active && auth.currentUser?.uid === userId) setLoadError({ scope, message: calendarLoadMessage(error) });
      });
    // Results from an old month or signed-out account may not repaint this view.
    return () => { active = false; };
  }, [userId, monthKey, scope, retry]);

  const getProtocolsForDate = (date) => {
    const dayName = dayNames[date.getDay()];

    return protocols.filter((protocol) => {
      const active = (protocol.status || "active") === "active";
      const scheduled =
        Array.isArray(protocol.days) && protocol.days.includes(dayName);

      return active && scheduled;
    });
  };

  const getProtocolName = (protocolId) => {
    const protocol = protocols.find((item) => item.id === protocolId);
    return protocol?.name || "Protocol";
  };

  const getLogsForDate = (date) => {
    const dateString = formatDate(date);
    return logs.filter((log) => log.date === dateString);
  };

  const getLogForProtocolDate = (protocolId, date) => {
    const dateString = formatDate(date);

    return logs.find(
      (log) => log.protocolId === protocolId && log.date === dateString
    );
  };

  const isLogged = (protocolId, date) => {
    const log = getLogForProtocolDate(protocolId, date);
    return log?.taken === true;
  };

  const addOrUpdateLog = async ({
    protocolId,
    date,
    taken,
    notes,
    sideEffects
  }) => {
    const owner = auth.currentUser?.uid;
    if (!owner || owner !== userId || !dataReady || savePending.current) return;
    if (!protocols.some((protocol) => protocol.id === protocolId)) return;
    savePending.current = true;
    setSaving(true);
    setSaveMessage(null);
    try {
      const existingLog = getLogForProtocolDate(protocolId, date);
      const changes = { taken, notes: notes || "", sideEffects: sideEffects || "" };
      let savedLog;
      if (existingLog) {
        const updatedAt = new Date().toISOString();
        await updateDoc(doc(db, "logs", existingLog.id), { ...changes, updatedAt });
        savedLog = { ...existingLog, ...changes, updatedAt };
      } else {
        const entry = {
          userId: owner, protocolId, date: formatDate(date),
          time: new Date().toLocaleTimeString(), ...changes,
          createdAt: new Date().toISOString()
        };
        const receipt = await addDoc(collection(db, "logs"), entry);
        savedLog = { ...entry, id: receipt.id };
      }
      if (auth.currentUser?.uid !== owner) return;
      // Apply only the acknowledged save; do not download the full history again.
      setData((current) => current?.scope !== scope ? current : {
        ...current,
        logs: [...current.logs.filter((log) => log.id !== savedLog.id), savedLog]
      });
      setManualNotes("");
      setManualSideEffects("");
      setSaveMessage({ scope, message: existingLog ? "Log updated." : "Log saved." });
    } catch (error) {
      if (auth.currentUser?.uid === owner) {
        setData(null);
        setLoadError({ scope, message: "The save could not be confirmed. Reload the calendar to check before trying again." });
      }
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  };

  const quickLogDose = async (protocol, date) => {
    const existingLog = getLogForProtocolDate(protocol.id, date);

    await addOrUpdateLog({
      protocolId: protocol.id,
      date,
      taken: true,
      notes: existingLog?.notes || "",
      sideEffects: existingLog?.sideEffects || ""
    });
  };

  const saveManualLog = async () => {
    await addOrUpdateLog({
      protocolId: manualProtocolId,
      date: selectedDate,
      taken: manualTaken,
      notes: manualNotes,
      sideEffects: manualSideEffects
    });
  };

  const startOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );

  const endOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  const startDay = startOfMonth.getDay();
  const totalDays = endOfMonth.getDate();

  const calendarDays = [];

  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= totalDays; day++) {
    calendarDays.push(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    );
  }

  const goPrevious = () => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(date);
    setSelectedDate(date);
  };

  const goNext = () => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(date);
    setSelectedDate(date);
  };

  const goToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const selectedProtocols = getProtocolsForDate(selectedDate);
  const selectedLogs = getLogsForDate(selectedDate);

  const selectedScheduledCompleted = selectedProtocols.filter((protocol) =>
    isLogged(protocol.id, selectedDate)
  ).length;

  const selectedAdherence =
    selectedProtocols.length === 0
      ? 0
      : Math.round((selectedScheduledCompleted / selectedProtocols.length) * 100);

  return (
    <div className="container">
      <h1>Calendar</h1>

      {!dataReady && <div className="card" role={loadError?.scope === scope ? "alert" : "status"}>
        {loadError?.scope === scope ? <>
          <p>{loadError.message}</p>
          <button onClick={() => setRetry((value) => value + 1)}>Retry calendar</button>
        </> : <p>{userId ? "Loading calendar..." : "Sign in to view your calendar."}</p>}
      </div>}
      {saveMessage?.scope === scope && <p role="status">{saveMessage.message}</p>}

      {dataReady && <div className="dashboard-grid">
        <div className="card stat-card">
          <p className="label">Selected Date</p>
          <h2>{formatDate(selectedDate)}</h2>
        </div>

        <div className="card stat-card">
          <p className="label">Scheduled Protocols</p>
          <h2>{selectedProtocols.length}</h2>
        </div>

        <div className="card stat-card">
          <p className="label">Logged Doses</p>
          <h2>{selectedLogs.filter((log) => log.taken === true).length}</h2>
        </div>

        <div className="card stat-card">
          <p className="label">Selected Day Adherence</p>
          <h2>{selectedAdherence}%</h2>
        </div>
      </div>}

      <div className="card" aria-busy={!dataReady && loadError?.scope !== scope}>
        <div className="calendar-actions">
          <button onClick={goPrevious} disabled={saving}>Previous</button>
          <button onClick={goToday} disabled={saving}>Today</button>
          <button onClick={goNext} disabled={saving}>Next</button>
        </div>

        <h2>
          {currentDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
          })}
        </h2>

        <div className="calendar-weekdays">
          {shortDays.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={index} className="calendar-day empty"></div>;
            }

            const protocolsForDay = getProtocolsForDate(date);
            const dayLogs = getLogsForDate(date);
            const loggedCount = dayLogs.filter((log) => log.taken === true).length;
            const isSelected = formatDate(date) === formatDate(selectedDate);

            return (
              <button
                key={formatDate(date)}
                type="button"
                className={
                  isSelected
                    ? "calendar-day calendar-day-selected"
                    : "calendar-day"
                }
                disabled={saving}
                onClick={() => setSelectedDate(date)}
              >
                <span>{date.getDate()}</span>

                {protocolsForDay.length > 0 && (
                  <div className="calendar-badge">
                    {protocolsForDay.length} due
                  </div>
                )}

                {loggedCount > 0 && (
                  <div className="calendar-risk-dot">
                    {loggedCount} done
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {dataReady && <>
      <div className="card">
        <h2>Add / Edit Log for Selected Day</h2>

        {protocols.length === 0 ? (
          <p>No protocols available yet.</p>
        ) : (
          <>
            <select
              disabled={saving}
              aria-label="Protocol"
              value={manualProtocolId}
              onChange={(e) => setManualProtocolId(e.target.value)}
            >
              {protocols.map((protocol) => (
                <option key={protocol.id} value={protocol.id}>
                  {protocol.name || "Unnamed Protocol"}
                </option>
              ))}
            </select>

            <select
              disabled={saving}
              aria-label="Log status"
              value={manualTaken ? "taken" : "missed"}
              onChange={(e) => setManualTaken(e.target.value === "taken")}
            >
              <option value="taken">Dose Taken</option>
              <option value="missed">Dose Missed / Skipped</option>
            </select>

            <input
              disabled={saving}
              placeholder="Notes for this dose"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
            />

            <input
              disabled={saving}
              placeholder="Side effects or symptoms"
              value={manualSideEffects}
              onChange={(e) => setManualSideEffects(e.target.value)}
            />

            <div className="protocol-actions">
              <button onClick={saveManualLog} disabled={saving}>{saving ? "Saving..." : "Save Calendar Log"}</button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Selected Day Details</h2>

        {selectedProtocols.length === 0 && (
          <p>No protocols scheduled for this day.</p>
        )}

        {selectedProtocols.map((protocol) => {
          const log = getLogForProtocolDate(protocol.id, selectedDate);
          const done = log?.taken === true;

          return (
            <div key={protocol.id} className="patient-card">
              <div className="patient-header">
                <div>
                  <h3>{protocol.name}</h3>
                  <p className="muted">{protocol.dosage || "N/A"}</p>
                </div>

                <div
                  className={
                    done
                      ? "status-pill status-stable"
                      : log
                      ? "status-pill status-risk"
                      : "status-pill status-watch"
                  }
                >
                  {done ? "Logged" : log ? "Skipped" : "Due"}
                </div>
              </div>

              <div className="patient-grid">
                <div>
                  <p className="label">Frequency</p>
                  <p>{protocol.frequency || "N/A"}</p>
                </div>

                <div>
                  <p className="label">Route</p>
                  <p>{protocol.route || "N/A"}</p>
                </div>

                <div>
                  <p className="label">Time</p>
                  <p>
                    {Array.isArray(protocol.times)
                      ? protocol.times.join(", ")
                      : "N/A"}
                  </p>
                </div>
              </div>

              <p>
                <strong>Instructions:</strong>{" "}
                {protocol.instructions || "None"}
              </p>

              {log && (
                <div className="insight-box">
                  <p>
                    <strong>Log Notes:</strong> {log.notes || "None listed"}
                  </p>
                  <p>
                    <strong>Side Effects:</strong>{" "}
                    {log.sideEffects || "None listed"}
                  </p>
                </div>
              )}

              {!done && (
                <div className="protocol-actions">
                  <button disabled={saving} onClick={() => quickLogDose(protocol, selectedDate)}>
                    Mark Dose Taken
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {selectedLogs.length > 0 && (
          <div className="mini-section">
            <h3>All Logs for This Day</h3>

            {selectedLogs.map((log) => (
              <div key={log.id} className="insight-box">
                <p>
                  <strong>{getProtocolName(log.protocolId)}:</strong>{" "}
                  {log.taken ? "Taken" : "Missed / Skipped"}
                </p>

                <p>
                  <strong>Notes:</strong> {log.notes || "None"}
                </p>

                <p>
                  <strong>Side Effects:</strong> {log.sideEffects || "None"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      </>}
    </div>
  );
}