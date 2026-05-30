import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate
} from "react-router-dom";

import { useEffect, useState } from "react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "./firebase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import ProtocolBuilder from "./pages/ProtocolBuilder";
import ManageProtocols from "./pages/ManageProtocols";
import Calendar from "./pages/Calendar";
import WeightTracker from "./pages/WeightTracker";
import ProviderDashboard from "./pages/ProviderDashboard";
import Refills from "./pages/Refills";

import ProtectedRoute from "./components/ProtectedRoute";

import "./index.css";

function Layout() {
  const navigate = useNavigate();

  const [role, setRole] = useState("");
  const [userReady, setUserReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRole("");
        setUserReady(true);
        return;
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      setRole(userDoc.exists() ? userDoc.data().role || "patient" : "patient");
      setUserReady(true);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setMenuOpen(false);
      navigate("/");
    } catch (error) {
      alert(error.message);
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const isLoggedIn = auth.currentUser;
  const isProvider = role === "provider";
  const isPatient = role !== "provider";

  return (
    <>
      {isLoggedIn && userReady && (
        <nav className="nav app-nav">
          <div className="nav-brand">DosiQ</div>

          <button
            className="mobile-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>

          <div className={menuOpen ? "nav-links nav-open" : "nav-links"}>
            {isPatient && (
              <>
                <Link to="/dashboard" onClick={closeMenu}>
                  Dashboard
                </Link>

                <Link to="/add" onClick={closeMenu}>
                  Add
                </Link>

                <Link to="/protocols" onClick={closeMenu}>
                  Protocols
                </Link>

                <Link to="/calendar" onClick={closeMenu}>
                  Calendar
                </Link>

                <Link to="/weight" onClick={closeMenu}>
                  Weight
                </Link>

                <Link to="/profile" onClick={closeMenu}>
                  Profile
                </Link>
              </>
            )}

            {isProvider && (
              <>
                <Link to="/provider" onClick={closeMenu}>
                  Provider
                </Link>

                <Link to="/refills" onClick={closeMenu}>
                  Refills
                </Link>
              </>
            )}

            <button onClick={logout} className="logout-button">
              Logout
            </button>
          </div>
        </nav>
      )}

      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/add"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <ProtocolBuilder />
            </ProtectedRoute>
          }
        />

        <Route
          path="/protocols"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <ManageProtocols />
            </ProtectedRoute>
          }
        />

        <Route
          path="/calendar"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <Calendar />
            </ProtectedRoute>
          }
        />

        <Route
          path="/weight"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <WeightTracker />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute
              allowedRoles={["patient"]}
              allowIncompleteProfile={true}
            >
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/provider"
          element={
            <ProtectedRoute allowedRoles={["provider"]}>
              <ProviderDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/refills"
          element={
            <ProtectedRoute allowedRoles={["provider"]}>
              <Refills />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}