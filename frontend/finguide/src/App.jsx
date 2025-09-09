import React from 'react'

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Auth/Login";
import SignUp from "./pages/Auth/SignUp";
import Home from "./pages/Dashboard/Home";
import Income from "./pages/Dashboard/Income";
import Expense from "./pages/Dashboard/Expense";
import UserProvider from "./context/UserContext";
import Budget from "./pages/Dashboard/Budget";

const App = () => {
  return (
    <UserProvider>
    <div>
      <Router>
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/login" exact element={<Login />} />
          <Route path="/signup" exact element={<SignUp />} />
          <Route path="/dashboard" exact element={<Home />} />
          <Route path="/income" exact element={<Income />} />
          <Route path="/expense" exact element={<Expense />} />
          <Route path="/budget" exact element={<Budget />} />
        </Routes>
      </Router>
    </div>
    </UserProvider>
  );
};

export default App;

const Root = () => {
  // Check if the token exists in the local Storage
  const isAuthenticated = !!localStorage.getItem("token");

  // Redirect to dashboard if authenticated, otherwise reditrect to login page
  return isAuthenticated ? (
    <Navigate to = "/dashboard" />
  ) : (
    <Navigate to = "/login" />
  );
};