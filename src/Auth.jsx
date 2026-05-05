import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "./context/AuthContext";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);

  const { login, signup, googleSignIn, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate("/dashboard");
    }
  }, [currentUser, navigate]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast.success("Welcome back to The Restro-Cafe.");
        navigate("/dashboard");
      } else {
        await signup(email, password, name, phone);
        toast.success("Membership created. Welcome.");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error(error);
      const message = error.message
        .replace("Firebase: ", "")
        .replace(/\(auth.*\)\.?/, "");
      toast.error(message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setLoading(true);
    try {
      googleSignIn();
    } catch (error) {
      console.error(error);
      toast.error("Google verification failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center pt-24 pb-12 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-md w-full bg-white border border-stone-200 p-8 md:p-12 shadow-sm"
      >
        <div className="text-center mb-10">
          <h2 className="text-xs tracking-[0.3em] uppercase text-gold mb-4 font-medium">
            {isLogin ? "Member Portal" : "Join The Registry"}
          </h2>
          <h3 className="text-3xl font-serif tracking-widest uppercase text-stone-900">
            {isLogin ? "Welcome Back" : "Become a Member"}
          </h3>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-6">
          {!isLogin && (
            <>
              <div className="flex flex-col">
                <label className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-2 font-medium">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold transition-colors font-medium text-stone-800"
                  placeholder="e.g. James Bond"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-2 font-medium">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold transition-colors font-medium text-stone-800"
                  placeholder="+91 98765 43210"
                />
              </div>
            </>
          )}

          <div className="flex flex-col">
            <label className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-2 font-medium">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold transition-colors font-medium text-stone-800"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-2 font-medium">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold transition-colors font-medium text-stone-800"
            />
            {!isLogin && (
              <p className="text-[10px] text-stone-400 mt-2 tracking-wide">
                Must be at least 6 characters.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 text-white px-8 py-4 uppercase tracking-[0.2em] text-xs hover:bg-gold transition-all duration-500 font-medium mt-8 disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : isLogin
                ? "Access Account"
                : "Secure Membership"}
          </button>
        </form>

        <div className="mt-8 flex items-center justify-between">
          <span className="border-b border-stone-200 w-1/4"></span>
          <span className="text-[10px] text-stone-400 uppercase tracking-widest">
            Or
          </span>
          <span className="border-b border-stone-200 w-1/4"></span>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full mt-8 bg-white border border-stone-300 text-stone-800 px-8 py-3 uppercase tracking-[0.2em] text-xs hover:bg-stone-50 transition-colors font-medium flex items-center justify-center space-x-3 disabled:opacity-50"
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="Google"
            className="w-4 h-4"
          />
          <span>Continue with Google</span>
        </button>

        <div className="mt-8 text-center border-t border-stone-100 pt-8">
          <p className="text-xs text-stone-500 font-medium tracking-wide">
            {isLogin
              ? "Not on the registry yet?"
              : "Already hold a membership?"}
          </p>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="mt-2 text-xs uppercase tracking-[0.2em] text-stone-900 hover:text-gold transition-colors font-bold border-b border-stone-900 hover:border-gold pb-1"
          >
            {isLogin ? "Apply for Membership" : "Sign In Here"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
