import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const daysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const dayMap = {
  Sunday: "SU",
  Monday: "MO",
  Tuesday: "TU",
  Wednesday: "WE",
  Thursday: "TH",
  Friday: "FR",
  Saturday: "SA"
};

function formatICSDate(date, time) {
  const cleanDate = date.replaceAll("-", "");
  const cleanTime = (time || "09:00").replace(":", "") + "00";
  return `${cleanDate}T${cleanTime}`;
}

function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = (time || "09:00").split(":").map(Number);
  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes + minutesToAdd);
  return date.toTimeString().slice(0, 5);
}

function downloadCalendarFile(protocol) {
  if (!protocol.startDate) {
    alert("Please add a start date before adding this protocol to a calendar.");
    return;
  }

  const time =
    Array.isArray(protocol.times) && protocol.times.length > 0
      ? protocol.times[0]
      : "09:00";

  const endTime = addMinutesToTime(time, 15);

  const byDays =
    Array.isArray(protocol.days) && protocol.days.length > 0
      ? protocol.days.map((day) => dayMap[day]).filter(Boolean).join(",")
      : "";

  let rrule = "RRULE:FREQ=WEEKLY";

  if (protocol.frequency === "daily") {
    rrule = "RRULE:FREQ=DAILY";
  }

  if (protocol.frequency === "monthly") {
    rrule = "RRULE:FREQ=MONTHLY";
  }

  if (
    (protocol.frequency === "weekly" ||
      protocol.frequency === "twice-weekly") &&
    byDays
  ) {
    rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`;
  }

  const title = `DosiQ Reminder: ${protocol.name || "Protocol"}`;
  const description = `Dosage: ${protocol.dosage || "N/A"}\\nInstructions: ${
    protocol.instructions || "None listed"
  }\\nNotes: ${protocol.notes || "None listed"}`;

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
PRODID:-//DosiQ//Protocol Reminder//EN
BEGIN:VEVENT
UID:${protocol.id}@dosiq-app
SUMMARY:${title}
DESCRIPTION:${description}
DTSTART:${formatICSDate(protocol.startDate, time)}
DTEND:${formatICSDate(protocol.startDate, endTime)}
${rrule}
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
DESCRIPTION:DosiQ protocol reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${protocol.name || "dosiq-protocol"}-calendar.ics`;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ProtocolCard({
  protocol,
  editingId,
  editDraft,
  startEdit,
  cancelEdit,
  updateDraft,
  toggleEditDay,
  saveProtocol,
  pauseProtocol,
  activateProtocol,
  deleteProtocol,
  toggleNotifications
}) {
  const isEditing = editingId === protocol.id;
  const notificationsOn = protocol.notificationsEnabled !== false;

  return (
    <div className="card patient-card">
      {!isEditing ? (
        <>
          <div className="patient-header">
            <div>
              <h3>{protocol.name}</h3>
              <p className="muted">
                {protocol.category || "General"} • {protocol.route || "N/A"}
              </p>
            </div>

            <div
              className={
                (protocol.status || "active") === "active"
                  ? "status-pill status-stable"
                  : "status-pill status-watch"
              }
            >
              {protocol.status || "active"}
            </div>
          </div>

          <div className="patient-grid">
            <div>
              <p className="label">Dosage</p>
              <p>{protocol.dosage || "N/A"}</p>
            </div>

            <div>
              <p className="label">Frequency</p>
              <p>{protocol.frequency || "N/A"}</p>
            </div>

            <div>
              <p className="label">Days</p>
              <p>{Array.isArray(protocol.days) ? protocol.days.join(", ") : "N/A"}</p>
            </div>

            <div>
              <p className="label">Time</p>
              <p>{Array.isArray(protocol.times) ? protocol.times.join(", ") : "N/A"}</p>
            </div>

            <div>
              <p className="label">Start Date</p>
              <p>{protocol.startDate || "N/A"}</p>
            </div>

            <div>
              <p className="label">Missed Dose Alerts</p>
              <p>{notificationsOn ? "On" : "Off"}</p>
            </div>
          </div>

          <hr />

          <p>
            <strong>Instructions:</strong> {protocol.instructions || "None listed"}
          </p>

          <p>
            <strong>Notes:</strong> {protocol.notes || "None listed"}
          </p>

          <div className="protocol-actions">
            <button onClick={() => startEdit(protocol)}>Edit</button>

            <button onClick={() => downloadCalendarFile(protocol)}>
              Add to Calendar
            </button>

            <button onClick={() => toggleNotifications(protocol)}>
              {notificationsOn
                ? "Turn Missed Dose Alerts Off"
                : "Turn Missed Dose Alerts On"}
            </button>

            {(protocol.status || "active") === "active" ? (
              <button onClick={() => pauseProtocol(protocol.id)}>Pause</button>
            ) : (
              <button onClick={() => activateProtocol(protocol.id)}>Activate</button>
            )}

            <button
              onClick={() => deleteProtocol(protocol.id)}
              style={{ background: "red", color: "white" }}
            >
              Delete
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>Edit Protocol</h3>

          <input
            placeholder="Protocol name"
            value={editDraft?.name || ""}
            onChange={(e) => updateDraft("name", e.target.value)}
          />

          <input
            placeholder="Dosage"
            value={editDraft?.dosage || ""}
            onChange={(e) => updateDraft("dosage", e.target.value)}
          />

          <select
            value={editDraft?.frequency || "weekly"}
            onChange={(e) => updateDraft("frequency", e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="twice-weekly">Twice Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="as-needed">As Needed</option>
          </select>

          <select
            value={editDraft?.status || "active"}
            onChange={(e) => updateDraft("status", e.target.value)}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>

          <p className="label">Scheduled Days</p>

          <div className="day-button-wrap">
            {daysList.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleEditDay(day)}
                className={
                  editDraft?.days?.includes(day)
                    ? "day-button selected"
                    : "day-button"
                }
              >
                {day}
              </button>
            ))}
          </div>

          <label className="field-label">Dose Time</label>
          <p className="field-hint">Example: 08:30 AM</p>

          <input
            className="compact-input"
            type="time"
            value={editDraft?.time || ""}
            onChange={(e) => updateDraft("time", e.target.value)}
          />

          <input
            placeholder="Instructions"
            value={editDraft?.instructions || ""}
            onChange={(e) => updateDraft("instructions", e.target.value)}
          />

          <input
            placeholder="Notes"
            value={editDraft?.notes || ""}
            onChange={(e) => updateDraft("notes", e.target.value)}
          />

          <div className="protocol-actions">
            <button onClick={() => saveProtocol(protocol.id)}>Save Changes</button>
            <button onClick={cancelEdit}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ManageProtocols() {
  const [protocols, setProtocols] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState(null);

  const loadProtocols = async (user) => {
    try {
      const q = query(
        collection(db, "protocols"),
        where("userId", "==", user.uid)
      );

      const snap = await getDocs(q);

      setProtocols(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
      );
    } catch (error) {
      alert(error.message);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProtocols([]);
        return;
      }

      await loadProtocols(user);
    });

    return () => unsubscribe();
  }, []);

  const startEdit = (protocol) => {
    setEditingId(protocol.id);

    setEditDraft({
      name: protocol.name || "",
      dosage: protocol.dosage || "",
      frequency: protocol.frequency || "weekly",
      status: protocol.status || "active",
      days: Array.isArray(protocol.days) ? protocol.days : [],
      time:
        Array.isArray(protocol.times) && protocol.times.length > 0
          ? protocol.times[0]
          : "",
      instructions: protocol.instructions || "",
      notes: protocol.notes || ""
    });
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditDraft(null);
  };

  const updateDraft = (field, value) => {
    setEditDraft((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleEditDay = (day) => {
    setEditDraft((prev) => {
      const currentDays = prev.days || [];

      return {
        ...prev,
        days: currentDays.includes(day)
          ? currentDays.filter((d) => d !== day)
          : [...currentDays, day]
      };
    });
  };

  const saveProtocol = async (protocolId) => {
    try {
      if (!editDraft) return;

      await updateDoc(doc(db, "protocols", protocolId), {
        name: editDraft.name.trim(),
        dosage: editDraft.dosage.trim(),
        frequency: editDraft.frequency,
        status: editDraft.status,
        days: editDraft.days,
        times: editDraft.time ? [editDraft.time] : [],
        instructions: editDraft.instructions.trim(),
        notes: editDraft.notes.trim(),
        updatedAt: new Date().toISOString()
      });

      alert("Protocol updated!");

      cancelEdit();

      if (auth.currentUser) {
        await loadProtocols(auth.currentUser);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const toggleNotifications = async (protocol) => {
    try {
      const currentValue = protocol.notificationsEnabled !== false;

      await updateDoc(doc(db, "protocols", protocol.id), {
        notificationsEnabled: !currentValue,
        updatedAt: new Date().toISOString()
      });

      alert(
        !currentValue
          ? "Missed dose alerts turned on"
          : "Missed dose alerts turned off"
      );

      if (auth.currentUser) {
        await loadProtocols(auth.currentUser);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const pauseProtocol = async (protocolId) => {
    try {
      await updateDoc(doc(db, "protocols", protocolId), {
        status: "paused",
        updatedAt: new Date().toISOString()
      });

      alert("Protocol paused");

      if (auth.currentUser) {
        await loadProtocols(auth.currentUser);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const activateProtocol = async (protocolId) => {
    try {
      await updateDoc(doc(db, "protocols", protocolId), {
        status: "active",
        updatedAt: new Date().toISOString()
      });

      alert("Protocol activated");

      if (auth.currentUser) {
        await loadProtocols(auth.currentUser);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const deleteProtocol = async (protocolId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this protocol?"
    );

    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "protocols", protocolId));

      alert("Protocol deleted");

      if (auth.currentUser) {
        await loadProtocols(auth.currentUser);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const activeProtocols = protocols.filter(
    (protocol) => (protocol.status || "active") === "active"
  );

  const inactiveProtocols = protocols.filter(
    (protocol) => (protocol.status || "active") !== "active"
  );

  return (
    <div className="container">
      <h1>Manage Protocols</h1>

      <div className="dashboard-grid">
        <div className="card stat-card">
          <p className="label">Total Protocols</p>
          <h2>{protocols.length}</h2>
        </div>

        <div className="card stat-card">
          <p className="label">Active</p>
          <h2>{activeProtocols.length}</h2>
        </div>

        <div className="card stat-card">
          <p className="label">Paused / Completed</p>
          <h2>{inactiveProtocols.length}</h2>
        </div>
      </div>

      <h2>Active Protocols</h2>

      {activeProtocols.length === 0 && <p>No active protocols.</p>}

      {activeProtocols.map((protocol) => (
        <ProtocolCard
          key={protocol.id}
          protocol={protocol}
          editingId={editingId}
          editDraft={editDraft}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          updateDraft={updateDraft}
          toggleEditDay={toggleEditDay}
          saveProtocol={saveProtocol}
          pauseProtocol={pauseProtocol}
          activateProtocol={activateProtocol}
          deleteProtocol={deleteProtocol}
          toggleNotifications={toggleNotifications}
        />
      ))}

      <h2>Paused / Completed Protocols</h2>

      {inactiveProtocols.length === 0 && (
        <p>No paused or completed protocols.</p>
      )}

      {inactiveProtocols.map((protocol) => (
        <ProtocolCard
          key={protocol.id}
          protocol={protocol}
          editingId={editingId}
          editDraft={editDraft}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          updateDraft={updateDraft}
          toggleEditDay={toggleEditDay}
          saveProtocol={saveProtocol}
          pauseProtocol={pauseProtocol}
          activateProtocol={activateProtocol}
          deleteProtocol={deleteProtocol}
          toggleNotifications={toggleNotifications}
        />
      ))}
    </div>
  );
}