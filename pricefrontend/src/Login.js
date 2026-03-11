import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleLogin = async () => {
    const response = await fetch("http://localhost:8080/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.text();

    if (data === "Login Successful") {
      alert("Login Successful");
      onLoginSuccess(email);
      navigate("/home");
    } else {
      alert("Invalid Email or Password");
    }
  };

  const handleRegister = async () => {
    const response = await fetch("http://localhost:8080/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.text();
    alert(data);
    setIsRegister(false);
  };

  return (
    <div className="login-page">
      <div className="login-card panel">
        <div className="login-media">
          <img
            src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbDhwa2N6NWhzYnI2N3M2dWU0d21vMDM5OGI3cnk2MzB2M2F4d2RuYyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/26tn33aiTi1jkl6H6/giphy.gif"
            alt="Secure login"
          />
        </div>

        <div className="login-form">
          <p className="kicker">Welcome Back</p>
          <h1>{isRegister ? "Create Account" : "Login"}</h1>

          {isRegister && (
            <input
              type="text"
              placeholder="Enter Username"
              onChange={(e) => setUsername(e.target.value)}
            />
          )}

          <input
            type="email"
            placeholder="Enter Email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Enter Password"
            onChange={(e) => setPassword(e.target.value)}
          />

          {isRegister ? (
            <button onClick={handleRegister}>Register</button>
          ) : (
            <button onClick={handleLogin}>Login</button>
          )}

          <p className="switch-link">
            {isRegister ? (
              <span onClick={() => setIsRegister(false)}>
                Already have an account? Login
              </span>
            ) : (
              <span onClick={() => setIsRegister(true)}>
                Do not have an account? Create Account
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
