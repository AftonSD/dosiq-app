import { useState } from "react";
import { db, auth } from "../firebase";
import { addDoc, collection } from "firebase/firestore";

const daysList = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

export default function ProtocolBuilder() {
  const [name, setName] = useState("");
  const [type, setType] = useState("medication");
  const [category, setCategory] = useState("weight-loss");
  const [dosage, setDosage] = useState("");
  const [route, setRoute] = useState("injection");
  const [frequency, setFrequency] = useState("weekly");
  const [days, setDays] = useState([]);
  const [time, setTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");

  const toggleDay = (day) => {
    setDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };

  const saveProtocol = async () => {
    try {
      if (!auth.currentUser) {
        alert("No user logged in");
        return;
      }

      if (!name.trim()) {
        alert("Please enter a protocol name.");
        return;
      }

      if (days.length === 0) {
        alert("Please select at least one scheduled day.");
        return;
      }

      await addDoc(collection(db, "protocols"), {
        userId: auth.currentUser.uid,
        name: name.trim(),
        type,
        category,
        dosage: dosage.trim(),
        route,
        frequency,
        days,
        times: time ? [time] : [],
        startDate,
        instructions: instructions.trim(),
        notes: notes.trim(),
        status,
        notificationsEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      alert("Protocol saved!");

      setName("");
      setType("medication");
      setCategory("weight-loss");
      setDosage("");
      setRoute("injection");
      setFrequency("weekly");
      setDays([]);
      setTime("");
      setStartDate("");
      setInstructions("");
      setNotes("");
      setStatus("active");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="container">
      <h1>Protocol Builder</h1>

      <div className="card">
        <h2>Protocol Details</h2>

        <input
          placeholder="Protocol / medication name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="medication">Medication</option>
          <option value="supplement">Supplement</option>
          <option value="injection">Injection</option>
          <option value="wellness">Wellness</option>
          <option value="lab">Lab / Testing</option>
        </select>

        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="weight-loss">Weight Loss</option>
          <option value="peptide">Peptide</option>
          <option value="hormone">Hormone</option>
          <option value="vitamin">Vitamin</option>
          <option value="metabolic">Metabolic</option>
          <option value="general-health">General Health</option>
        </select>

        <input
          placeholder="Dosage (ex: 2.5mg, 10 units, 1 capsule)"
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
        />

        <select value={route} onChange={(e) => setRoute(e.target.value)}>
          <option value="injection">Injection</option>
          <option value="oral">Oral</option>
          <option value="sublingual">Sublingual</option>
          <option value="topical">Topical</option>
          <option value="other">Other</option>
        </select>

        <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="twice-weekly">Twice Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="as-needed">As Needed</option>
        </select>
      </div>

      <div className="card">
        <h2>Schedule</h2>

        <p className="label">Select Scheduled Days</p>

        <div className="day-button-wrap">
          {daysList.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={days.includes(day) ? "day-button selected" : "day-button"}
            >
              {day}
            </button>
          ))}
        </div>

        <div className="schedule-field">
          <label className="field-label">Dose Time</label>
          <p className="field-hint">Example: 08:30 AM</p>
          <input
            className="compact-input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <div className="schedule-field">
          <label className="field-label">Start Date</label>
          <p className="field-hint">Example: 2026-05-15</p>
          <input
            className="compact-input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="schedule-field">
          <label className="field-label">Protocol Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="card">
        <h2>Instructions + Notes</h2>

        <input
          placeholder="Instructions (ex: inject subQ once weekly)"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />

        <input
          placeholder="Internal notes / patient notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button onClick={saveProtocol}>Save Protocol</button>
      </div>
    </div>
  );
}