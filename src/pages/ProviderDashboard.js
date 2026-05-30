import { useEffect, useState, useCallback } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  setDoc
} from "firebase/firestore";
import ProviderPatientCard from "../components/ProviderPatientCard";

const blankDraft = {
  name: "",
  type: "medication",
  category: "weight-loss",
  dosage: "",
  route: "injection",
  frequency: "weekly",
  days: [],
  time: "",
  startDate: "",
  instructions: "",
  notes: "",
  status: "active"
};

export default function ProviderDashboard() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [providerNotes, setProviderNotes] = useState([]);
  const [protocols, setProtocols] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState("risk");

  const [noteDrafts, setNoteDrafts] = useState({});
  const [followUpDrafts, setFollowUpDrafts] = useState({});
  const [priorityDrafts, setPriorityDrafts] = useState({});
  const [assignDrafts, setAssignDrafts] = useState({});
  const [expandedPatients, setExpandedPatients] = useState({});

  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientEmail, setNewPatientEmail] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");

  const fetchData = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const logsSnap = await getDocs(collection(db, "logs"));
      const requestsSnap = await getDocs(collection(db, "refillRequests"));
      const notesSnap = await getDocs(collection(db, "providerNotes"));
      const protocolsSnap = await getDocs(collection(db, "protocols"));

      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLogs(logsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setRequests(requestsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setProviderNotes(notesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setProtocols(protocolsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      alert(error.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addPatient = async () => {
    if (!newPatientName.trim()) return alert("Please enter patient name");
    if (!newPatientEmail.trim()) return alert("Please enter patient email");

    const patientId = "patient_" + Date.now();

    await setDoc(doc(db, "users", patientId), {
      name: newPatientName.trim(),
      email: newPatientEmail.trim(),
      phone: newPatientPhone.trim(),
      role: "patient",
      profileComplete: false,
      createdBy: auth.currentUser?.email || "provider",
      createdAt: new Date().toISOString(),
      followUpStatus: "not-started",
      priority: "low"
    });

    setNewPatientName("");
    setNewPatientEmail("");
    setNewPatientPhone("");

    alert("Patient added successfully");
    fetchData();
  };

  const getTodayName = () =>
    new Date().toLocaleDateString("en-US", { weekday: "long" });

  const getTodayDate = () => new Date().toISOString().split("T")[0];

  const isLoggedTodayForProtocol = (userId, protocolId) =>
    logs.some(
      (log) =>
        log.userId === userId &&
        log.protocolId === protocolId &&
        log.date === getTodayDate() &&
        log.taken === true
    );

  const isPastReminderTime = (protocol) => {
    if (!Array.isArray(protocol.times) || protocol.times.length === 0) return false;

    const protocolTime = protocol.times[0];
    if (!protocolTime || !protocolTime.includes(":")) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [hours, minutes] = protocolTime.split(":").map(Number);
    const protocolMinutes = hours * 60 + minutes;

    return currentMinutes > protocolMinutes;
  };

  const getMissedDoseProtocols = (userId) => {
    const todayName = getTodayName();

    return protocols.filter((protocol) => {
      const active = (protocol.status || "active") === "active";
      const notificationsOn = protocol.notificationsEnabled !== false;
      const belongsToUser = protocol.userId === userId;
      const scheduledToday =
        Array.isArray(protocol.days) && protocol.days.includes(todayName);
      const notLogged = !isLoggedTodayForProtocol(userId, protocol.id);
      const pastTime = isPastReminderTime(protocol);

      return active && notificationsOn && belongsToUser && scheduledToday && notLogged && pastTime;
    });
  };

  const togglePatientExpanded = useCallback((userId) => {
    setExpandedPatients((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  }, []);

  const getDraft = useCallback(
    (userId) => assignDrafts[userId] || blankDraft,
    [assignDrafts]
  );

  const updateAssignDraft = useCallback((userId, field, value) => {
    setAssignDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || blankDraft),
        [field]: value
      }
    }));
  }, []);

  const toggleAssignDay = useCallback((userId, day) => {
    setAssignDrafts((prev) => {
      const draft = prev[userId] || blankDraft;
      const currentDays = draft.days || [];

      return {
        ...prev,
        [userId]: {
          ...draft,
          days: currentDays.includes(day)
            ? currentDays.filter((d) => d !== day)
            : [...currentDays, day]
        }
      };
    });
  }, []);

  const assignProtocolToPatient = async (user) => {
    const draft = assignDrafts[user.id] || blankDraft;

    if (!draft.name.trim()) return alert("Please enter a protocol name.");
    if (!draft.dosage.trim()) return alert("Please enter a dosage.");
    if (!draft.days || draft.days.length === 0) return alert("Please select at least one day.");

    await addDoc(collection(db, "protocols"), {
      userId: user.id,
      assignedBy: auth.currentUser?.email || "provider",
      assignedByRole: "provider",
      patientEmail: user.email || "",
      patientName: user.name || "",
      name: draft.name.trim(),
      type: draft.type,
      category: draft.category,
      dosage: draft.dosage.trim(),
      route: draft.route,
      frequency: draft.frequency,
      days: draft.days,
      times: draft.time ? [draft.time] : [],
      startDate: draft.startDate,
      instructions: draft.instructions.trim(),
      notes: draft.notes.trim(),
      status: draft.status,
      notificationsEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    setAssignDrafts((prev) => ({
      ...prev,
      [user.id]: blankDraft
    }));

    alert("Protocol assigned to patient!");
    fetchData();
  };

  const deletePatient = async (user) => {
    if (!window.confirm(`Delete ${user.name || user.email || "this patient"}?`)) return;

    await deleteDoc(doc(db, "users", user.id));
    alert("Patient deleted");
    fetchData();
  };

  const markSymptomsReviewed = async (logId) => {
    await updateDoc(doc(db, "logs", logId), {
      reviewed: true,
      reviewedAt: new Date().toISOString(),
      reviewedBy: auth.currentUser?.email || "provider"
    });

    alert("Symptoms marked reviewed");
    fetchData();
  };

  const getUserLogs = (userId) => logs.filter((log) => log.userId === userId);

  const getCompletedLogs = (userId) =>
    getUserLogs(userId).filter((log) => log.taken === true);

  const getAdherence = (userId) => {
    const total = getUserLogs(userId).length;
    const completed = getCompletedLogs(userId).length;

    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  const getSideEffectLogs = (userId) =>
    getUserLogs(userId).filter(
      (log) =>
        log.sideEffects &&
        log.sideEffects.trim() !== "" &&
        log.reviewed !== true
    );

  const getPendingRequests = (userId) =>
    requests.filter(
      (request) => request.userId === userId && request.status !== "completed"
    );

  const getPatientNotes = (userId) =>
    providerNotes
      .filter((note) => note.userId === userId)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const getPatientProtocols = (userId) =>
    protocols.filter((protocol) => protocol.userId === userId);

  const getRiskLevel = (userId) => {
    const adherence = getAdherence(userId);
    const sideEffects = getSideEffectLogs(userId);
    const pending = getPendingRequests(userId);
    const missedDoses = getMissedDoseProtocols(userId);
    const totalLogs = getUserLogs(userId).length;

    if (sideEffects.length > 0) return "Needs Review";
    if (pending.length > 0) return "Request Pending";
    if (missedDoses.length > 0) return "Missed Dose";
    if (totalLogs === 0) return "No Logs Yet";
    if (adherence < 50) return "High Risk";
    if (adherence < 80) return "Watch";

    return "Stable";
  };

  const getRiskRank = (risk) => {
    const ranks = {
      "Needs Review": 1,
      "High Risk": 2,
      "Request Pending": 3,
      "Missed Dose": 4,
      Watch: 5,
      "No Logs Yet": 6,
      Stable: 7
    };

    return ranks[risk] || 99;
  };

  const getStatusClass = (risk) => {
    if (risk === "Stable") return "status-stable";
    if (risk === "Missed Dose") return "status-risk";

    if (risk === "Watch" || risk === "Request Pending" || risk === "No Logs Yet") {
      return "status-watch";
    }

    return "status-risk";
  };

  const getInsightText = (userId) => {
    const adherence = getAdherence(userId);
    const sideEffects = getSideEffectLogs(userId);
    const pending = getPendingRequests(userId);
    const missedDoses = getMissedDoseProtocols(userId);
    const totalLogs = getUserLogs(userId).length;

    if (sideEffects.length > 0) return "Side effects reported. Nurse should review symptoms.";
    if (pending.length > 0) return "Patient has an open refill or reorder request.";
    if (missedDoses.length > 0) return "Patient has scheduled dose(s) past reminder time that have not been logged.";
    if (totalLogs === 0) return "No dose history yet. Patient may need onboarding or first check-in.";
    if (adherence < 50) return "Low adherence. Patient may need follow-up.";
    if (adherence < 80) return "Moderate adherence. Watch for missed doses.";

    return "Patient appears stable with strong adherence.";
  };

  const saveProviderNote = async (user) => {
    const noteText = noteDrafts[user.id];

    if (!noteText || noteText.trim() === "") return alert("Please enter a note first.");

    await addDoc(collection(db, "providerNotes"), {
      userId: user.id,
      patientName: user.name || "",
      patientEmail: user.email || "",
      note: noteText.trim(),
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || "provider"
    });

    setNoteDrafts((prev) => ({
      ...prev,
      [user.id]: ""
    }));

    alert("Provider note saved");
    fetchData();
  };

  const saveFollowUpInfo = async (user) => {
    await updateDoc(doc(db, "users", user.id), {
      followUpStatus:
        followUpDrafts[user.id]?.status ||
        user.followUpStatus ||
        "not-started",
      followUpDate: followUpDrafts[user.id]?.date || user.followUpDate || "",
      priority: priorityDrafts[user.id] || user.priority || "low",
      updatedAt: new Date().toISOString()
    });

    alert("Follow-up info updated");
    fetchData();
  };

  const updateProtocolStatus = async (protocolId, status) => {
    await updateDoc(doc(db, "protocols", protocolId), {
      status,
      updatedAt: new Date().toISOString()
    });

    alert(`Protocol ${status}`);
    fetchData();
  };

  const pendingRequests = requests.filter(
    (request) => request.status !== "completed"
  );

  const filteredUsers = users
    .filter((user) => {
      const search = searchTerm.toLowerCase();
      const risk = getRiskLevel(user.id);

      const matchesSearch =
        (user.name || "").toLowerCase().includes(search) ||
        (user.email || "").toLowerCase().includes(search) ||
        (user.currentMeds || "").toLowerCase().includes(search) ||
        (user.goals || "").toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        risk === statusFilter ||
        user.followUpStatus === statusFilter ||
        user.priority === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const riskA = getRiskLevel(a.id);
      const riskB = getRiskLevel(b.id);

      if (sortMode === "risk") return getRiskRank(riskA) - getRiskRank(riskB);
      if (sortMode === "adherence-low") return getAdherence(a.id) - getAdherence(b.id);
      if (sortMode === "adherence-high") return getAdherence(b.id) - getAdherence(a.id);
      if (sortMode === "name") return (a.name || "Patient").localeCompare(b.name || "Patient");

      if (sortMode === "priority") {
        const priorityRank = { high: 1, medium: 2, low: 3 };
        return (priorityRank[a.priority] || 99) - (priorityRank[b.priority] || 99);
      }

      return 0;
    });

  const needsReviewPatients = filteredUsers.filter(
    (user) => getRiskLevel(user.id) !== "Stable"
  );

  const stablePatients = filteredUsers.filter(
    (user) => getRiskLevel(user.id) === "Stable"
  );

  return (
    <div className="container">
      <h1>Provider Dashboard</h1>

      <div className="dashboard-grid">
        <div className="card stat-card"><p className="label">Total Patients</p><h2>{users.length}</h2></div>
        <div className="card stat-card"><p className="label">Total Dose Logs</p><h2>{logs.length}</h2></div>
        <div className="card stat-card"><p className="label">Total Protocols</p><h2>{protocols.length}</h2></div>
        <div className="card stat-card"><p className="label">Pending Requests</p><h2>{pendingRequests.length}</h2></div>
        <div className="card stat-card"><p className="label">Displayed Patients</p><h2>{filteredUsers.length}</h2></div>
      </div>

      <div className="card">
        <h2>Add Patient</h2>

        <input placeholder="Patient name" value={newPatientName} onChange={(e) => setNewPatientName(e.target.value)} />
        <input placeholder="Email" value={newPatientEmail} onChange={(e) => setNewPatientEmail(e.target.value)} />
        <input placeholder="Phone" value={newPatientPhone} onChange={(e) => setNewPatientPhone(e.target.value)} />

        <button onClick={addPatient}>Add Patient</button>
      </div>

      <div className="card">
        <h2>Search + Filter</h2>

        <input
          placeholder="Search by name, email, meds, or goals"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="Needs Review">Needs Review</option>
          <option value="High Risk">High Risk</option>
          <option value="Request Pending">Request Pending</option>
          <option value="Missed Dose">Missed Dose</option>
          <option value="Watch">Watch</option>
          <option value="No Logs Yet">No Logs Yet</option>
          <option value="Stable">Stable</option>
          <option value="needs-follow-up">Needs Follow-Up</option>
          <option value="contacted">Contacted</option>
          <option value="resolved">Resolved</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>

        <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
          <option value="risk">Sort by Risk</option>
          <option value="priority">Sort by Priority</option>
          <option value="adherence-low">Lowest Adherence First</option>
          <option value="adherence-high">Highest Adherence First</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      <h2>Needs Review</h2>

      {needsReviewPatients.length === 0 && <p>No matching patients currently need review.</p>}

      {needsReviewPatients.map((user) => (
        <ProviderPatientCard
          key={user.id}
          user={user}
          adherence={getAdherence(user.id)}
          risk={getRiskLevel(user.id)}
          statusClass={getStatusClass(getRiskLevel(user.id))}
          completed={getCompletedLogs(user.id)}
          patientLogs={getUserLogs(user.id)}
          sideEffects={getSideEffectLogs(user.id)}
          pending={getPendingRequests(user.id)}
          missedDoses={getMissedDoseProtocols(user.id)}
          notes={getPatientNotes(user.id)}
          patientProtocols={getPatientProtocols(user.id)}
          isExpanded={expandedPatients[user.id] || false}
          togglePatientExpanded={togglePatientExpanded}
          getInsightText={getInsightText}
          getDraft={getDraft}
          updateAssignDraft={updateAssignDraft}
          toggleAssignDay={toggleAssignDay}
          assignProtocolToPatient={assignProtocolToPatient}
          updateProtocolStatus={updateProtocolStatus}
          markSymptomsReviewed={markSymptomsReviewed}
          noteDrafts={noteDrafts}
          setNoteDrafts={setNoteDrafts}
          saveProviderNote={saveProviderNote}
          followUpDrafts={followUpDrafts}
          setFollowUpDrafts={setFollowUpDrafts}
          priorityDrafts={priorityDrafts}
          setPriorityDrafts={setPriorityDrafts}
          saveFollowUpInfo={saveFollowUpInfo}
          deletePatient={deletePatient}
        />
      ))}

      <h2>Stable Patients</h2>

      {stablePatients.length === 0 && <p>No matching stable patients.</p>}

      {stablePatients.map((user) => (
        <ProviderPatientCard
          key={user.id}
          user={user}
          adherence={getAdherence(user.id)}
          risk={getRiskLevel(user.id)}
          statusClass={getStatusClass(getRiskLevel(user.id))}
          completed={getCompletedLogs(user.id)}
          patientLogs={getUserLogs(user.id)}
          sideEffects={getSideEffectLogs(user.id)}
          pending={getPendingRequests(user.id)}
          missedDoses={getMissedDoseProtocols(user.id)}
          notes={getPatientNotes(user.id)}
          patientProtocols={getPatientProtocols(user.id)}
          isExpanded={expandedPatients[user.id] || false}
          togglePatientExpanded={togglePatientExpanded}
          getInsightText={getInsightText}
          getDraft={getDraft}
          updateAssignDraft={updateAssignDraft}
          toggleAssignDay={toggleAssignDay}
          assignProtocolToPatient={assignProtocolToPatient}
          updateProtocolStatus={updateProtocolStatus}
          markSymptomsReviewed={markSymptomsReviewed}
          noteDrafts={noteDrafts}
          setNoteDrafts={setNoteDrafts}
          saveProviderNote={saveProviderNote}
          followUpDrafts={followUpDrafts}
          setFollowUpDrafts={setFollowUpDrafts}
          priorityDrafts={priorityDrafts}
          setPriorityDrafts={setPriorityDrafts}
          saveFollowUpInfo={saveFollowUpInfo}
          deletePatient={deletePatient}
        />
      ))}
    </div>
  );
}