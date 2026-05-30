import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function ProtectedRoute({ children, allowedRoles, allowIncompleteProfile }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/");

  useEffect(() => {
    const checkAccess = async () => {
      const user = auth.currentUser;

      if (!user) {
        setRedirectTo("/");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const data = userDoc.exists() ? userDoc.data() : {};
      const role = data.role || "patient";
      const profileComplete = data.profileComplete === true;

      if (allowedRoles && !allowedRoles.includes(role)) {
        setRedirectTo(role === "provider" ? "/provider" : "/dashboard");
        setAllowed(false);
        setLoading(false);
        return;
      }

      if (role === "patient" && !profileComplete && !allowIncompleteProfile) {
        setRedirectTo("/profile");
        setAllowed(false);
        setLoading(false);
        return;
      }

      setAllowed(true);
      setLoading(false);
    };

    checkAccess();
  }, [allowedRoles, allowIncompleteProfile]);

  if (loading) return <div className="container">Loading...</div>;

  if (!allowed) return <Navigate to={redirectTo} replace />;

  return children;
}