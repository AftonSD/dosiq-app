import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDocFromServer } from "firebase/firestore";
import { withReadTimeout } from "../calendarData";

export default function ProtectedRoute({ children, allowedRoles, allowIncompleteProfile }) {
  const [access, setAccess] = useState({ loading: true, allowed: false, uid: null });
  const [retry, setRetry] = useState(0);
  const rolesKey = allowedRoles ? JSON.stringify(allowedRoles) : "";

  useEffect(() => {
    let active = true;
    let generation = 0;
    const roles = rolesKey ? JSON.parse(rolesKey) : null;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const request = ++generation;
      const current = () => active && request === generation && auth.currentUser?.uid === user?.uid;
      setAccess({ loading: true, allowed: false, uid: user?.uid || null });
      if (!user) {
        setAccess({ loading: false, allowed: false, uid: null, redirectTo: "/" });
        return;
      }
      try {
        const userDoc = await withReadTimeout(getDocFromServer(doc(db, "users", user.uid)));
        if (!current()) return;
        const data = userDoc.exists() ? userDoc.data() : {};
        const role = data.role || "patient";
        let redirectTo;
        if (roles && !roles.includes(role)) {
          redirectTo = role === "provider" ? "/provider" : "/dashboard";
        } else if (role === "patient" && data.profileComplete !== true && !allowIncompleteProfile) {
          redirectTo = "/profile";
        }
        setAccess({ loading: false, allowed: !redirectTo, uid: user.uid, redirectTo });
      } catch {
        if (current()) setAccess({ loading: false, allowed: false, uid: user.uid, error: true });
      }
    });
    return () => { active = false; generation++; unsubscribe(); };
  }, [rolesKey, allowIncompleteProfile, retry]);

  if (access.loading || access.uid !== (auth.currentUser?.uid || null)) {
    return <div className="container" role="status">Loading...</div>;
  }
  if (access.error) {
    return <div className="container" role="alert">
      <p>Could not verify your account. Check your connection and try again.</p>
      <button onClick={() => setRetry((value) => value + 1)}>Retry access check</button>
    </div>;
  }
  if (!access.allowed) return <Navigate to={access.redirectTo || "/"} replace />;
  return children;
}
