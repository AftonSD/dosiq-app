import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const sendUserToDashboard = async (user) => {
    if (!user) return;

    const userDoc = await getDoc(doc(db, "users", user.uid));

    const role = userDoc.exists()
      ? userDoc.data().role || "patient"
      : "patient";

    const profileComplete = userDoc.exists()
      ? userDoc.data().profileComplete === true
      : false;

    if (role === "provider") {
      navigate("/provider");
      return;
    }

    if (!profileComplete) {
      navigate("/profile");
      return;
    }

    navigate("/dashboard");
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await sendUserToDashboard(user);
      }
    });

    return () => unsubscribe();
  }, []);

  const signUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      alert("Account created!");
      await sendUserToDashboard(userCredential.user);
    } catch (error) {
      alert(error.message);
    }
  };

  const login = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      await sendUserToDashboard(userCredential.user);
    } catch (error) {
      alert(error.message);
    }
  };

  const resetPassword = async () => {
    try {
      if (!email.trim()) {
        alert("Please enter your email first.");
        return;
      }

      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent. Check inbox + spam folder.");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="lux-login-page">
      <div className="lux-login-watermark">DosiQ</div>

      <div className="lux-login-shell">
        <div className="lux-login-brand">
          <img
            src="/dosiq-logo.png"
            alt="DosiQ"
            className="lux-login-logo"
          />

          <h1>DosiQ</h1>

          <p>
            Your protocol. Your progress.
            <br />
            Your wellness dashboard.
          </p>
        </div>

        <div className="lux-login-card">
          <div className="lux-login-form">
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className="lux-primary-btn" onClick={login}>
              Login
            </button>

            <button className="lux-secondary-btn" onClick={signUp}>
              Create Account
            </button>

            <button className="lux-link-btn" onClick={resetPassword}>
              Forgot Password?
            </button>
          </div>

          <div className="lux-login-fineprint">
            <p>
              <strong>Create Account:</strong> Enter the email and password you
              want to use, then tap <strong>Create Account</strong>.
            </p>

            <p>
              <strong>Forgot Password:</strong> Please check your inbox and
              spam/junk folder for your recovery email.
            </p>

            <p className="lux-login-disclaimer">
              DosiQ is not intended for emergency medical care. Contact your
              provider directly for urgent medical concerns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}