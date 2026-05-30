import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  setDoc,
  doc,
  getDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function Profile() {
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [allergies, setAllergies] = useState("");
  const [currentMeds, setCurrentMeds] = useState("");
  const [goals, setGoals] = useState("");
  const [nurseNotes, setNurseNotes] = useState("");

  const [protocols, setProtocols] = useState([]);
  const [selectedProtocol, setSelectedProtocol] = useState("");
  const [requestType, setRequestType] = useState("refill");
  const [requestNotes, setRequestNotes] = useState("");

  const loadProfile = async (user) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();

      setName(data.name || "");
      setDob(data.dob || "");
      setHeight(data.height || "");
      setWeight(data.weight || "");
      setGoalWeight(data.goalWeight || "");
      setAllergies(data.allergies || "");
      setCurrentMeds(data.currentMeds || "");
      setGoals(data.goals || "");
      setNurseNotes(data.nurseNotes || "");
    }
  };

  const loadProtocols = async (user) => {
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
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      await loadProfile(user);
      await loadProtocols(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const saveProfile = async () => {
    try {
      if (!auth.currentUser) {
        alert("No user logged in");
        return;
      }

      if (!name || !dob || !height || !weight) {
        alert("Please complete name, DOB, height, and current weight.");
        return;
      }

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          name,
          dob,
          height,
          weight,
          goalWeight,
          allergies,
          currentMeds,
          goals,
          nurseNotes,
          email: auth.currentUser.email,
          role: "patient",
          profileComplete: true,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      alert("Profile saved!");
    } catch (error) {
      alert(error.message);
    }
  };

  const submitRequest = async () => {
    try {
      const protocol = protocols.find((p) => p.id === selectedProtocol);

      await addDoc(collection(db, "refillRequests"), {
        userId: auth.currentUser.uid,
        email: auth.currentUser.email,
        protocolId: protocol?.id || "",
        medName: protocol?.name || "",
        requestType,
        notes: requestNotes,
        status: "pending",
        createdAt: new Date().toISOString()
      });

      alert("Request submitted!");

      setSelectedProtocol("");
      setRequestType("refill");
      setRequestNotes("");
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) {
    return <div className="container">Loading profile...</div>;
  }

  return (
    <div className="container">
      <h1>Patient Intake / Profile</h1>

      <div className="card">
        <h2>Basic Information</h2>

        <input placeholder="Patient full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Date of birth" value={dob} onChange={(e) => setDob(e.target.value)} />
        <input placeholder="Height" value={height} onChange={(e) => setHeight(e.target.value)} />
        <input placeholder="Current weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <input placeholder="Goal weight" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />

        <button onClick={saveProfile}>Save Profile</button>
      </div>

      <div className="card">
        <h2>Medical Intake</h2>

        <input placeholder="Allergies" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
        <input placeholder="Current medications" value={currentMeds} onChange={(e) => setCurrentMeds(e.target.value)} />
        <input placeholder="Health / wellness goals" value={goals} onChange={(e) => setGoals(e.target.value)} />
        <input placeholder="Notes for nurse" value={nurseNotes} onChange={(e) => setNurseNotes(e.target.value)} />

        <button onClick={saveProfile}>Save Intake</button>
      </div>

      <div className="card">
        <h2>Refill / Reorder Request</h2>

        <select value={selectedProtocol} onChange={(e) => setSelectedProtocol(e.target.value)}>
          <option value="">Select medication / protocol</option>
          {protocols.map((protocol) => (
            <option key={protocol.id} value={protocol.id}>
              {protocol.name}
            </option>
          ))}
        </select>

        <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
          <option value="refill">Refill</option>
          <option value="reorder">Reorder</option>
          <option value="dose-adjustment">Dose Adjustment</option>
          <option value="side-effects-review">Side Effects Review</option>
        </select>

        <input placeholder="Notes / what do you need?" value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)} />

        <button onClick={submitRequest}>Submit Request</button>
      </div>
    </div>
  );
}