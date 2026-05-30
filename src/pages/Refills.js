import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc
} from "firebase/firestore";

export default function Refills() {
  const [requests, setRequests] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchRequests = async () => {
    try {
      const snap = await getDocs(collection(db, "refillRequests"));

      setRequests(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }))
      );
    } catch (error) {
      alert(error.message);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const updateRequestStatus = async (requestId, status) => {
    try {
      await updateDoc(doc(db, "refillRequests", requestId), {
        status,
        updatedAt: new Date().toISOString()
      });

      alert(`Request marked ${status}`);
      fetchRequests();
    } catch (error) {
      alert(error.message);
    }
  };

  const openRequests = requests.filter(
    (request) => request.status !== "completed"
  );

  const completedRequests = requests.filter(
    (request) => request.status === "completed"
  );

  const RequestCard = ({ request, completed }) => (
    <div className="card patient-card">
      <div className="patient-header">
        <div>
          <h3>{request.medName || "Medication Request"}</h3>
          <p className="muted">{request.patientEmail || request.email || "No email listed"}</p>
        </div>

        <div>
          <div
            className={
              request.status === "completed"
                ? "status-pill status-stable"
                : request.status === "in-review"
                ? "status-pill status-watch"
                : "status-pill status-watch"
            }
          >
            {request.status || "pending"}
          </div>
        </div>
      </div>

      <div className="patient-grid">
        <div>
          <p className="label">Request Type</p>
          <p>{request.requestType || "refill"}</p>
        </div>

        <div>
          <p className="label">Created</p>
          <p>{request.createdAt || "N/A"}</p>
        </div>

        <div>
          <p className="label">Patient Name</p>
          <p>{request.patientName || "N/A"}</p>
        </div>

        <div>
          <p className="label">Status</p>
          <p>{request.status || "pending"}</p>
        </div>
      </div>

      <p>
        <strong>Notes:</strong> {request.notes || "None listed"}
      </p>

      {!completed && (
        <div className="refill-actions">
          <button onClick={() => updateRequestStatus(request.id, "in-review")}>
            Mark In Review
          </button>

          <button onClick={() => updateRequestStatus(request.id, "completed")}>
            Mark Completed
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="container">
      <h1>Refill Requests</h1>

      <div className="dashboard-grid">
        <div className="card stat-card">
          <p className="label">Open Requests</p>
          <h2>{openRequests.length}</h2>
        </div>

        <div className="card stat-card">
          <p className="label">Completed</p>
          <h2>{completedRequests.length}</h2>
        </div>

        <div className="card stat-card">
          <p className="label">Total Requests</p>
          <h2>{requests.length}</h2>
        </div>
      </div>

      <h2>Open Requests</h2>

      {openRequests.length === 0 && <p>No open refill requests.</p>}

      {openRequests.map((request) => (
        <RequestCard key={request.id} request={request} completed={false} />
      ))}

      <div className="card">
        <div className="patient-header">
          <div>
            <h2>Completed Requests</h2>
            <p className="muted">
              Completed refill/reorder requests are hidden to keep this page clean.
            </p>
          </div>

          <button onClick={() => setShowCompleted(!showCompleted)}>
            {showCompleted ? "Hide Completed" : "Show Completed"}
          </button>
        </div>
      </div>

      {showCompleted && (
        <>
          {completedRequests.length === 0 && <p>No completed requests yet.</p>}

          {completedRequests.map((request) => (
            <RequestCard key={request.id} request={request} completed={true} />
          ))}
        </>
      )}
    </div>
  );
}