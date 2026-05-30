import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function WeightTracker() {
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [weightLogs, setWeightLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadWeights = async (user) => {
    try {
      const q = query(
        collection(db, "weightLogs"),
        where("userId", "==", user.uid)
      );

      const snap = await getDocs(q);

      const logs = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      logs.sort((a, b) =>
        (b.date || "").localeCompare(a.date || "")
      );

      setWeightLogs(logs);
      setLoading(false);
    } catch (error) {
      console.error("Weight load error:", error);
      alert(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setWeightLogs([]);
        setLoading(false);
        return;
      }

      await loadWeights(user);
    });

    return () => unsubscribe();
  }, []);

  const saveWeight = async () => {
    try {
      if (!auth.currentUser) {
        alert("No user logged in");
        return;
      }

      if (!weight) {
        alert("Please enter your weight.");
        return;
      }

      await addDoc(collection(db, "weightLogs"), {
        userId: auth.currentUser.uid,
        email: auth.currentUser.email,
        weight: Number(weight),
        notes,
        date: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString()
      });

      alert("Weight saved!");

      setWeight("");
      setNotes("");

      await loadWeights(auth.currentUser);

    } catch (error) {
      console.error("Weight save error:", error);
      alert(error.message);
    }
  };

  const chartData = [...weightLogs]
    .sort((a, b) =>
      (a.date || "").localeCompare(b.date || "")
    )
    .map((log) => ({
      date: log.date,
      weight: Number(log.weight)
    }));

  const latestWeight = weightLogs[0]?.weight || "N/A";

  const startingWeight =
    weightLogs.length > 0
      ? weightLogs[weightLogs.length - 1]?.weight
      : "N/A";

  const totalChange =
    latestWeight !== "N/A" &&
    startingWeight !== "N/A"
      ? Number(latestWeight) - Number(startingWeight)
      : 0;

  if (loading) {
    return (
      <div className="container">
        Loading weight tracker...
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Weight Tracker</h1>

      <div className="dashboard-grid">

        <div className="card stat-card">
          <p className="label">
            Latest Weight
          </p>

          <h2>{latestWeight}</h2>
        </div>

        <div className="card stat-card">
          <p className="label">
            Starting Weight
          </p>

          <h2>{startingWeight}</h2>
        </div>

        <div className="card stat-card">
          <p className="label">
            Total Change
          </p>

          <h2>
            {totalChange > 0
              ? `+${totalChange}`
              : totalChange}
          </h2>
        </div>

        <div className="card stat-card">
          <p className="label">
            Total Logs
          </p>

          <h2>{weightLogs.length}</h2>
        </div>

      </div>

      <div className="card">

        <h2>Log Weight</h2>

        <input
          type="number"
          placeholder="Current weight"
          value={weight}
          onChange={(e) =>
            setWeight(e.target.value)
          }
        />

        <input
          placeholder="Notes"
          value={notes}
          onChange={(e) =>
            setNotes(e.target.value)
          }
        />

        <button onClick={saveWeight}>
          Save Weight
        </button>

      </div>

      <div className="card">

        <h2>Weight Progress</h2>

        {chartData.length === 0 ? (
          <p>No weight logs yet.</p>
        ) : (
          <div
            style={{
              width: "100%",
              height: 300
            }}
          >
            <ResponsiveContainer>
              <LineChart data={chartData}>
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

        <h2>Weight History</h2>

        {weightLogs.length === 0 ? (
          <p>No weight history yet.</p>
        ) : (

          <select>

            <option value="">
              View Weight History
            </option>

            {weightLogs.map((log) => (

              <option
                key={log.id}
                value={log.id}
              >
                {log.date}
                {" — "}
                {log.weight} lbs
                {log.notes
                  ? ` — ${log.notes}`
                  : ""}
              </option>

            ))}

          </select>

        )}

      </div>

    </div>
  );
}