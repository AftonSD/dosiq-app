import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

export default function Dashboard() {
  const [protocols, setProtocols] = useState([]);
  const [logs, setLogs] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);

  const [showMissedDosePopup, setShowMissedDosePopup] = useState(false);
  const [dismissedPopupForSession, setDismissedPopupForSession] =
    useState(false);

  const today = new Date().toISOString().split("T")[0];

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

      const weightsQuery = query(
        collection(db, "weightLogs"),
        where("userId", "==", user.uid)
      );

      const profileDocRef = doc(db, "users", user.uid);

      const protocolSnap = await getDocs(protocolQuery);
      const logsSnap = await getDocs(logsQuery);
      const weightsSnap = await getDocs(weightsQuery);
      const profileSnap = await getDoc(profileDocRef);

      setProtocols(
        protocolSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
      );

      setLogs(
        logsSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
      );

      setWeightLogs(
        weightsSnap.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      );

      if (profileSnap.exists()) {
        setProfile(profileSnap.data());
      }

      setLoading(false);
    } catch (error) {
      alert(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProtocols([]);
        setLogs([]);
        setWeightLogs([]);
        setProfile({});
        setLoading(false);
        return;
      }

      await loadData(user);
    });

    return () => unsubscribe();
  }, []);

  const todaysDay = new Date().toLocaleDateString("en-US", {
    weekday: "long"
  });

  const activeProtocols = protocols.filter(
    (protocol) => (protocol.status || "active") === "active"
  );

  const todaysProtocols = activeProtocols.filter((protocol) => {
    if (!protocol.days) return false;
    return protocol.days.includes(todaysDay);
  });

  const alertEnabledProtocols = todaysProtocols.filter(
    (protocol) => protocol.notificationsEnabled !== false
  );

  const isLoggedToday = (protocolId) =>
    logs.some(
      (log) =>
        log.protocolId === protocolId &&
        log.date === today &&
        log.taken === true
    );

  const isPastReminderTime = (protocol) => {
    if (!Array.isArray(protocol.times) || protocol.times.length === 0) {
      return false;
    }

    const protocolTime = protocol.times[0];

    if (!protocolTime || !protocolTime.includes(":")) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [hours, minutes] = protocolTime.split(":").map(Number);
    const protocolMinutes = hours * 60 + minutes;

    return currentMinutes > protocolMinutes;
  };

  const completedToday = todaysProtocols.filter((protocol) =>
    isLoggedToday(protocol.id)
  ).length;

  const missedProtocols = alertEnabledProtocols.filter(
    (protocol) => !isLoggedToday(protocol.id)
  );

  const overdueProtocols = missedProtocols.filter(isPastReminderTime);

  useEffect(() => {
    if (
      !loading &&
      overdueProtocols.length > 0 &&
      !dismissedPopupForSession
    ) {
      setShowMissedDosePopup(true);
    }
  }, [loading, overdueProtocols.length, dismissedPopupForSession]);

  const scheduledToday = todaysProtocols.length;

  const todayAdherence =
    scheduledToday === 0
      ? 0
      : Math.round((completedToday / scheduledToday) * 100);

  const completedLogs = logs.filter((log) => log.taken === true);

  const overallAdherence =
    logs.length === 0
      ? 0
      : Math.round((completedLogs.length / logs.length) * 100);

  const latestWeight =
    weightLogs.length > 0
      ? weightLogs[weightLogs.length - 1].weight
      : profile.weight || "N/A";

  const startingWeight =
    weightLogs.length > 0
      ? weightLogs[0].weight
      : profile.weight || "N/A";

  const goalWeight = profile.goalWeight || "N/A";

  const weightChange =
    latestWeight !== "N/A" && startingWeight !== "N/A"
      ? Number(latestWeight) - Number(startingWeight)
      : 0;

  const weekDoseData = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));

    const dateString = date.toISOString().split("T")[0];

    const completed = logs.filter(
      (log) => log.date === dateString && log.taken === true
    ).length;

    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      completed
    };
  });

  const adherenceTrendData = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));

    const dateString = date.toISOString().split("T")[0];
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });

    const scheduled = activeProtocols.filter(
      (protocol) => protocol.days && protocol.days.includes(dayName)
    ).length;

    const completed = logs.filter(
      (log) => log.date === dateString && log.taken === true
    ).length;

    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      adherence:
        scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100)
    };
  });

  const weightChartData = weightLogs.map((log) => ({
    date: log.date,
    weight: Number(log.weight)
  }));

  const sideEffectCount = logs.filter(
    (log) => log.sideEffects && log.sideEffects.trim() !== ""
  ).length;

  const symptomFreeLogs = logs.filter(
    (log) =>
      log.taken === true &&
      (!log.sideEffects || log.sideEffects.trim() === "")
  ).length;

  const weightInsight = () => {
    if (weightLogs.length < 2) {
      return "Add at least two weight logs to see your trend.";
    }

    if (weightChange < 0) {
      return `You are down ${Math.abs(
        weightChange
      )} lbs since your first logged weight.`;
    }

    if (weightChange > 0) {
      return `You are up ${weightChange} lbs since your first logged weight.`;
    }

    return "Your weight is currently stable from your first logged weight.";
  };

  const logDose = async (protocol) => {
    try {
      if (!auth.currentUser) {
        alert("No user logged in");
        return;
      }

      if (isLoggedToday(protocol.id)) {
        alert("This dose is already logged for today.");
        return;
      }

      await addDoc(collection(db, "logs"), {
        userId: auth.currentUser.uid,
        protocolId: protocol.id,
        date: today,
        time: new Date().toLocaleTimeString(),
        taken: true,
        notes: "",
        sideEffects: "",
        createdAt: new Date().toISOString()
      });

      setShowMissedDosePopup(false);

      await loadData(auth.currentUser);
    } catch (error) {
      alert(error.message);
    }
  };

  const dismissMissedDosePopup = () => {
    setShowMissedDosePopup(false);
    setDismissedPopupForSession(true);
  };

  if (loading) {
    return <div className="container">Loading dashboard...</div>;
  }

  return (
    <div className="container">
      {showMissedDosePopup && overdueProtocols.length > 0 && (
        <div className="dose-modal-overlay">
          <div className="dose-modal">
            <div className="dose-modal-icon">DQ</div>

            <p className="dose-modal-eyebrow">DosiQ Alert</p>

            <h2>Missed Dose Reminder</h2>

            <p className="dose-modal-copy">
              Your schedule shows a dose past its saved reminder time. Please
              acknowledge this alert before continuing. This reminder will show
              again each time you log in until the dose is marked complete.
            </p>

            <div className="dose-modal-list">
              {overdueProtocols.map((protocol) => (
                <div key={protocol.id} className="dose-modal-item">
                  <div>
                    <strong>{protocol.name || "Protocol"}</strong>
                    <p>
                      {protocol.dosage || "Dose"} •{" "}
                      {Array.isArray(protocol.times) &&
                      protocol.times.length > 0
                        ? protocol.times.join(", ")
                        : "scheduled today"}
                    </p>
                  </div>

                  <button onClick={() => logDose(protocol)}>Log Now</button>
                </div>
              ))}
            </div>

            <div className="dose-modal-actions">
              <button onClick={dismissMissedDosePopup} className="primary-btn">
                I Acknowledge
              </button>
            </div>

            <p className="dose-modal-footer">
              This reminder is not emergency medical guidance. Contact your
              provider directly for urgent concerns.
            </p>
          </div>
        </div>
      )}

      <h1>DosiQ Dashboard</h1>

      <div className="dashboard-grid">
        <div className="card stat-card">
          <p className="label">Today</p>
          <h2>
            {completedToday}/{scheduledToday}
          </h2>
          <p>doses completed</p>
        </div>

        <div className="card stat-card">
          <p className="label">Today’s Adherence</p>
          <h2>{todayAdherence}%</h2>

          <div className="progress-wrap">
            <div
              className="progress-bar"
              style={{
                width: `${Math.max(todayAdherence, 8)}%`
              }}
            ></div>
          </div>
        </div>

        <div className="card stat-card">
          <p className="label">Current Weight</p>
          <h2>{latestWeight}</h2>
          <p>Goal: {goalWeight}</p>
        </div>

        <div className="card stat-card">
          <p className="label">Overall Adherence</p>
          <h2>{overallAdherence}%</h2>
          <p>{completedLogs.length} doses logged</p>
        </div>
      </div>

      <div className="card">
        <h2>Smart Insight</h2>

        {overdueProtocols.length > 0 && (
          <div className="insight-box status-risk">
            <strong>Missed Dose Alert:</strong> You have{" "}
            {overdueProtocols.length} scheduled dose
            {overdueProtocols.length > 1 ? "s" : ""} past the reminder time.
          </div>
        )}

        <p>{weightInsight()}</p>

        <p>
          <strong>Side effect flags:</strong> {sideEffectCount}
        </p>

        <p>
          <strong>Symptom-free completed logs:</strong> {symptomFreeLogs}
        </p>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h2>7-Day Dose Logs</h2>

          <div className="chart-box">
            <ResponsiveContainer>
              <BarChart data={weekDoseData}>
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completed" fill="#ff4da6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2>7-Day Adherence</h2>

          <div className="chart-box">
            <ResponsiveContainer>
              <LineChart data={adherenceTrendData}>
                <XAxis dataKey="day" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="adherence"
                  stroke="#ff4da6"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Weight Trend</h2>

        {weightChartData.length === 0 ? (
          <p>No weight logs yet. Add weight logs in the Weight tab.</p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={weightChartData}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#ff4da6"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Today’s Schedule ({todaysDay})</h2>

        {todaysProtocols.length === 0 && <p>Nothing scheduled today.</p>}

        {todaysProtocols.map((protocol) => {
          const done = isLoggedToday(protocol.id);
          const overdue =
            protocol.notificationsEnabled !== false &&
            !done &&
            isPastReminderTime(protocol);

          return (
            <div key={protocol.id} className="patient-card">
              <div className="patient-header">
                <div>
                  <h3>{protocol.name}</h3>
                  <p className="muted">{protocol.dosage}</p>
                </div>

                <div
                  className={
                    done
                      ? "status-pill status-stable"
                      : overdue
                      ? "status-pill status-risk"
                      : "status-pill status-watch"
                  }
                >
                  {done ? "Completed" : overdue ? "Missed" : "Due"}
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

                <div>
                  <p className="label">Missed Dose Alerts</p>
                  <p>
                    {protocol.notificationsEnabled === false ? "Off" : "On"}
                  </p>
                </div>
              </div>

              <p>
                <strong>Instructions:</strong>{" "}
                {protocol.instructions || "None"}
              </p>

              {done ? (
                <button disabled>Dose Logged</button>
              ) : (
                <button onClick={() => logDose(protocol)}>
                  Mark Dose Taken
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}