import React from "react";

const daysList = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

export default React.memo(function ProviderPatientCard({
  user,
  adherence,
  risk,
  statusClass,
  completed,
  patientLogs,
  sideEffects,
  pending,
  missedDoses,
  notes,
  patientProtocols,
  isExpanded,
  togglePatientExpanded,
  getInsightText,
  getDraft,
  updateAssignDraft,
  toggleAssignDay,
  assignProtocolToPatient,
  updateProtocolStatus,
  markSymptomsReviewed,
  noteDrafts,
  setNoteDrafts,
  saveProviderNote,
  followUpDrafts,
  setFollowUpDrafts,
  priorityDrafts,
  setPriorityDrafts,
  saveFollowUpInfo,
  deletePatient
}) {
  const visibleBarWidth = Math.max(adherence, 8);

  const draft = getDraft(user.id);

  return (
    <div className="card patient-card">
      <div className="patient-header">
        <div>
          <h3>{user.name || "Patient"}</h3>
          <p className="muted">Email: {user.email || "N/A"}</p>
          <p className="muted">Adherence: {adherence}%</p>
        </div>

        <div>
          <div className={`status-pill ${statusClass}`}>{risk}</div>

          <button onClick={() => togglePatientExpanded(user.id)}>
            {isExpanded ? "Hide Details" : "View Details"}
          </button>
        </div>
      </div>

      <div className="progress-wrap">
        <div className="progress-bar" style={{ width: `${visibleBarWidth}%` }} />
      </div>

      {isExpanded && (
        <>
          <div className="patient-grid">
            <div><p className="label">DOB</p><p>{user.dob || "N/A"}</p></div>
            <div><p className="label">Height</p><p>{user.height || "N/A"}</p></div>
            <div><p className="label">Weight</p><p>{user.weight || "N/A"}</p></div>
            <div><p className="label">Goal Weight</p><p>{user.goalWeight || "N/A"}</p></div>
            <div><p className="label">Completed Doses</p><p>{completed.length}</p></div>
            <div><p className="label">Total Logs</p><p>{patientLogs.length}</p></div>
            <div><p className="label">Follow-Up Status</p><p>{user.followUpStatus || "not-started"}</p></div>
            <div><p className="label">Priority</p><p>{user.priority || "low"}</p></div>
          </div>

          <hr />

          <h4>Medical Intake</h4>
          <p><strong>Allergies:</strong> {user.allergies || "None listed"}</p>
          <p><strong>Current Medications:</strong> {user.currentMeds || "None listed"}</p>
          <p><strong>Goals:</strong> {user.goals || "None listed"}</p>
          <p><strong>Notes for Nurse:</strong> {user.nurseNotes || "None listed"}</p>

          <hr />

          <h4>Smart Adherence Insight</h4>
          <p className="insight-box">{getInsightText(user.id)}</p>

          {missedDoses.length > 0 && (
            <div className="mini-section">
              <h4>Missed Dose Alerts</h4>
              {missedDoses.map((protocol) => (
                <div key={protocol.id} className="insight-box">
                  <p>
                    <strong>{protocol.name}</strong> was scheduled for{" "}
                    {Array.isArray(protocol.times) && protocol.times.length > 0
                      ? protocol.times.join(", ")
                      : "today"}{" "}
                    and has not been logged.
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mini-section">
            <h4>Assign New Protocol</h4>

            <input
              placeholder="Protocol / medication name"
              value={draft.name}
              onChange={(e) => updateAssignDraft(user.id, "name", e.target.value)}
            />

            <select value={draft.type} onChange={(e) => updateAssignDraft(user.id, "type", e.target.value)}>
              <option value="medication">Medication</option>
              <option value="supplement">Supplement</option>
              <option value="injection">Injection</option>
              <option value="wellness">Wellness</option>
              <option value="lab">Lab / Testing</option>
            </select>

            <select value={draft.category} onChange={(e) => updateAssignDraft(user.id, "category", e.target.value)}>
              <option value="weight-loss">Weight Loss</option>
              <option value="peptide">Peptide</option>
              <option value="hormone">Hormone</option>
              <option value="vitamin">Vitamin</option>
              <option value="metabolic">Metabolic</option>
              <option value="general-health">General Health</option>
            </select>

            <input
              placeholder="Dosage"
              value={draft.dosage}
              onChange={(e) => updateAssignDraft(user.id, "dosage", e.target.value)}
            />

            <select value={draft.route} onChange={(e) => updateAssignDraft(user.id, "route", e.target.value)}>
              <option value="injection">Injection</option>
              <option value="oral">Oral</option>
              <option value="sublingual">Sublingual</option>
              <option value="topical">Topical</option>
              <option value="other">Other</option>
            </select>

            <select value={draft.frequency} onChange={(e) => updateAssignDraft(user.id, "frequency", e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="twice-weekly">Twice Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="as-needed">As Needed</option>
            </select>

            <p className="label">Scheduled Days</p>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {daysList.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleAssignDay(user.id, day)}
                  style={{
                    background: draft.days.includes(day) ? "#ffe7f5" : "#ff4da6",
                    color: "black"
                  }}
                >
                  {day}
                </button>
              ))}
            </div>

            <input
              type="time"
              value={draft.time}
              onChange={(e) => updateAssignDraft(user.id, "time", e.target.value)}
            />

            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => updateAssignDraft(user.id, "startDate", e.target.value)}
            />

            <input
              placeholder="Instructions"
              value={draft.instructions}
              onChange={(e) => updateAssignDraft(user.id, "instructions", e.target.value)}
            />

            <input
              placeholder="Provider notes"
              value={draft.notes}
              onChange={(e) => updateAssignDraft(user.id, "notes", e.target.value)}
            />

            <button onClick={() => assignProtocolToPatient(user)}>
              Assign Protocol
            </button>
          </div>

          <div className="mini-section">
            <h4>Patient Protocols</h4>

            {patientProtocols.length === 0 && <p>No protocols found for this patient.</p>}

            {patientProtocols.map((protocol) => (
              <div key={protocol.id} className="insight-box">
                <div className="patient-header">
                  <div>
                    <h4>{protocol.name || "Unnamed Protocol"}</h4>
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
                  <div><p className="label">Dosage</p><p>{protocol.dosage || "N/A"}</p></div>
                  <div><p className="label">Frequency</p><p>{protocol.frequency || "N/A"}</p></div>
                  <div><p className="label">Days</p><p>{Array.isArray(protocol.days) ? protocol.days.join(", ") : "N/A"}</p></div>
                  <div><p className="label">Times</p><p>{Array.isArray(protocol.times) ? protocol.times.join(", ") : "N/A"}</p></div>
                  <div><p className="label">Start Date</p><p>{protocol.startDate || "N/A"}</p></div>
                  <div><p className="label">Missed Dose Alerts</p><p>{protocol.notificationsEnabled === false ? "Off" : "On"}</p></div>
                </div>

                <p><strong>Instructions:</strong> {protocol.instructions || "None listed"}</p>
                <p><strong>Notes:</strong> {protocol.notes || "None listed"}</p>

                {(protocol.status || "active") === "active" ? (
                  <button onClick={() => updateProtocolStatus(protocol.id, "paused")}>
                    Pause Protocol
                  </button>
                ) : (
                  <button onClick={() => updateProtocolStatus(protocol.id, "active")}>
                    Activate Protocol
                  </button>
                )}
              </div>
            ))}
          </div>

          {sideEffects.length > 0 && (
            <div className="mini-section">
              <h4>Side Effect Flags</h4>

              {sideEffects.map((log) => (
                <div key={log.id} className="insight-box">
                  <p><strong>{log.date}:</strong> {log.sideEffects}</p>
                  <button onClick={() => markSymptomsReviewed(log.id)}>
                    Mark Symptoms Reviewed
                  </button>
                </div>
              ))}
            </div>
          )}

          {pending.length > 0 && (
            <div className="mini-section">
              <h4>Pending Requests</h4>

              {pending.map((request) => (
                <p key={request.id}>
                  <strong>{request.requestType}:</strong> {request.medName}
                </p>
              ))}
            </div>
          )}

          <hr />

          <h4>Provider Follow-Up</h4>

          <select
            value={followUpDrafts[user.id]?.status || user.followUpStatus || "not-started"}
            onChange={(e) =>
              setFollowUpDrafts((prev) => ({
                ...prev,
                [user.id]: {
                  ...(prev[user.id] || {}),
                  status: e.target.value
                }
              }))
            }
          >
            <option value="not-started">Not Started</option>
            <option value="needs-follow-up">Needs Follow-Up</option>
            <option value="contacted">Contacted</option>
            <option value="resolved">Resolved</option>
          </select>

          <input
            type="date"
            value={followUpDrafts[user.id]?.date || user.followUpDate || ""}
            onChange={(e) =>
              setFollowUpDrafts((prev) => ({
                ...prev,
                [user.id]: {
                  ...(prev[user.id] || {}),
                  date: e.target.value
                }
              }))
            }
          />

          <select
            value={priorityDrafts[user.id] || user.priority || "low"}
            onChange={(e) =>
              setPriorityDrafts((prev) => ({
                ...prev,
                [user.id]: e.target.value
              }))
            }
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>

          <button onClick={() => saveFollowUpInfo(user)}>
            Save Follow-Up Info
          </button>

          <hr />

          <h4>Internal Provider Notes</h4>

          <input
            placeholder="Add private provider note"
            value={noteDrafts[user.id] || ""}
            onChange={(e) =>
              setNoteDrafts((prev) => ({
                ...prev,
                [user.id]: e.target.value
              }))
            }
          />

          <button onClick={() => saveProviderNote(user)}>
            Save Provider Note
          </button>

          {notes.length > 0 && (
            <div className="mini-section">
              <h4>Note History</h4>

              {notes.map((note) => (
                <div key={note.id} className="insight-box">
                  <p>{note.note}</p>
                  <p className="muted">{note.createdAt} — {note.createdBy}</p>
                </div>
              ))}
            </div>
          )}

          <hr />

          <button
            onClick={() => deletePatient(user)}
            style={{ background: "red", color: "white" }}
          >
            Delete Patient
          </button>
        </>
      )}
    </div>
  );
});