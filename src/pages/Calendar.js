import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
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
  const [protocols, setProtocols] = useState([]);
  const [logs, setLogs] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const [manualProtocolId, setManualProtocolId] = useState("");
  const [manualTaken, setManualTaken] = useState(true);
  const [manualNotes, setManualNotes] = useState("");
  const [manualSideEffects, setManualSideEffects] = useState("");

  const formatDate = (date) => date.toISOString().split("T")[0];

  const loadData = async (user) => {
    try {
      const protocolQuery = query(
        collection(db, "protocols"),
        where("userId", "==", user.uid)
      );

      const logsQuery = query(
        collection(db, "logs"),
        where("userId", "==", user.uid)
      );

      const protocolSnap = await getDocs(protocolQuery);
      const logsSnap = await getDocs(logsQuery);

      const protocolData = protocolSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      const logData = logsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      setProtocols(protocolData);
      setLogs(logData);

      if (!manualProtocolId && protocolData.length > 0) {
        setManualProtocolId(protocolData[0].id);
      }

      setLoading(false);
    } catch (error) {
      console.error("Calendar load error:", error);
      alert(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProtocols([]);
        setLogs([]);
        setLoading(false);
        return;
      }

      await loadData(user);
    });

    return () => unsubscribe();
  }, []);

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
    try {
      if (!auth.currentUser) {
        alert("No user logged in");
        return;
      }

      if (!protocolId) {
        alert("Please choose a protocol.");
        return;
      }

      const existingLog = getLogForProtocolDate(protocolId, date);

      if (existingLog) {
        await updateDoc(doc(db, "logs", existingLog.id), {
          taken,
          notes: notes || "",
          sideEffects: sideEffects || "",
          updatedAt: new Date().toISOString()
        });

        alert("Log updated!");
      } else {
        await addDoc(collection(db, "logs"), {
          userId: auth.currentUser.uid,
          protocolId,
          date: formatDate(date),
          time: new Date().toLocaleTimeString(),
          taken,
          notes: notes || "",
          sideEffects: sideEffects || "",
          createdAt: new Date().toISOString()
        });

        alert("Log saved!");
      }

      setManualNotes("");
      setManualSideEffects("");

      await loadData(auth.currentUser);
    } catch (error) {
      alert(error.message);
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
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const goNext = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
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

  if (loading) {
    return <div className="container">Loading calendar...</div>;
  }

  return (
    <div className="container">
      <h1>Calendar</h1>

      <div className="dashboard-grid">
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
      </div>

      <div className="card">
        <div className="calendar-actions">
          <button onClick={goPrevious}>Previous</button>
          <button onClick={goToday}>Today</button>
          <button onClick={goNext}>Next</button>
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

      <div className="card">
        <h2>Add / Edit Log for Selected Day</h2>

        {protocols.length === 0 ? (
          <p>No protocols available yet.</p>
        ) : (
          <>
            <select
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
              value={manualTaken ? "taken" : "missed"}
              onChange={(e) => setManualTaken(e.target.value === "taken")}
            >
              <option value="taken">Dose Taken</option>
              <option value="missed">Dose Missed / Skipped</option>
            </select>

            <input
              placeholder="Notes for this dose"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
            />

            <input
              placeholder="Side effects or symptoms"
              value={manualSideEffects}
              onChange={(e) => setManualSideEffects(e.target.value)}
            />

            <div className="protocol-actions">
              <button onClick={saveManualLog}>Save Calendar Log</button>
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
                  <button onClick={() => quickLogDose(protocol, selectedDate)}>
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
    </div>
  );
}