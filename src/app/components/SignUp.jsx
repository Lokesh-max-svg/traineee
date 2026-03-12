"use client";

import React, { useState } from 'react';
import { FaEyeSlash, FaPhoneAlt } from 'react-icons/fa';
import { MdOutlineVisibility } from 'react-icons/md';
import { FcGoogle } from 'react-icons/fc';
import Link from 'next/link';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../api/firebase';
import { useRouter } from 'next/navigation';
import LoadingOverlay from './LoadingOverlay'; 
import { toast } from 'sonner';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SignUpForm = () => {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingAction, setLoadingAction] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isLoading = loadingAction !== null;
 
  //  Use Firebase's built-in email verification
  const handleSignUp = async (e) => {
    e.preventDefault();

    if (isLoading) {
      return;
    }
    
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    
    if (!password) {
      toast.error("Please enter a password");
      return;
    }
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoadingAction('email');
    let shouldResetLoading = true;

    try {
      // Step 1: Create user with Firebase Client SDK
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Step 2: Send verification email (Firebase sends it automatically!)
      await sendEmailVerification(userCredential.user);
      
      // Step 3: Save additional user data to your backend
      try {
        const idToken = await userCredential.user.getIdToken();
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

        await fetch(`${API_BASE_URL}/auth/save-user-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            idToken,
            name: name.trim(),
            phone: phone.trim() || null
          }),
        });
      } catch (backendError) {
        if (process.env.NODE_ENV === 'development') console.error("Failed to save user data to backend:", backendError);
        // User is created and email sent, so don't fail the signup
      }

      toast.success("Account created! Please check your email to verify.");
      await wait(1500);
      shouldResetLoading = false;
      router.push('/verify-email');
      return;
      
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error("Signup error:", err);
      
      let errorMessage = "Failed to create account";
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = "Email already in use";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address";
      } else if (err.code === 'auth/weak-password') {
        errorMessage = "Password is too weak";
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = "Email/password accounts are not enabled";
      }
      
      toast.error(errorMessage);
    } finally {
      if (shouldResetLoading) {
        setLoadingAction(null);
      }
    }
  };

  // Google Sign-in - send to backend for verification
  const handleGoogleSignUp = async () => {
    if (isLoading) {
      return;
    }

    setLoadingAction('google');
    let shouldResetLoading = true;
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      // Send to backend for session creation and user data storage
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
      const res = await fetch(`${API_BASE_URL}/auth/google-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Google signup failed");
      }

      toast.success("Signed in with Google!");
      await wait(800);
      shouldResetLoading = false;
      router.push('/signin');
      return;
      
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error("Google signup error:", err);
      
      if (err.code === 'auth/popup-blocked') {
        toast.error("Popup was blocked. Please allow popups for this site.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        toast.error("Sign-up cancelled");
      } else if (err.code === 'auth/cancelled-popup-request') {
        // User cancelled popup
      } else {
        toast.error(err.message || "Google signup failed");
      }
      
    } finally {
      if (shouldResetLoading) {
        setLoadingAction(null);
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-r  text-white relative">
      {isLoading && <LoadingOverlay />}

      <div className="w-full max-w-md p-8 mx-auto">
        <h2 className="text-3xl font-bold text-[#93F5AE] mb-4">Sign up</h2>

        <form onSubmit={handleSignUp} className="space-y-3">
          {/* Name Input */}
          <div className="relative w-full">
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              required
              disabled={isLoading}
              className="peer w-full px-4 pt-6 pb-1 text-white bg-transparent border border-white rounded-xl placeholder-transparent focus:outline-none"
            />
            <label 
              htmlFor="name" 
              className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-white peer-focus:top-2 peer-focus:text-sm peer-focus:text-gray-400"
            >
              Your Name
            </label>
          </div>

          {/* Email Input */}
          <div className="relative w-full">
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              disabled={isLoading}
              className="peer w-full px-4 pt-6 pb-1 text-white bg-transparent border border-white rounded-xl placeholder-transparent focus:outline-none"
            />
            <label 
              htmlFor="email" 
              className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-white peer-focus:top-2 peer-focus:text-sm peer-focus:text-gray-400"
            >
              Email
            </label>
          </div>

          {/* Password Input */}
          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              disabled={isLoading}
              className="peer w-full px-4 pt-6 pb-2 text-white bg-transparent border border-white rounded-xl placeholder-transparent focus:outline-none pr-10"
            />
            <label 
              htmlFor="password" 
              className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white peer-focus:top-2 peer-focus:text-sm peer-focus:text-gray-400"
            >
              Password
            </label>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-5 text-gray-400 hover:text-white"
            >
              {showPassword ? <MdOutlineVisibility /> : <FaEyeSlash />}
            </button>
          </div>

          {/* Confirm Password Input */}
          <div className="relative w-full">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              required
              disabled={isLoading}
              className="peer w-full px-4 pt-6 pb-2 text-white bg-transparent border border-white rounded-xl placeholder-transparent focus:outline-none pr-10"
            />
            <label 
              htmlFor="confirm-password" 
              className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white peer-focus:top-2 peer-focus:text-sm peer-focus:text-gray-400"
            >
              Confirm Password
            </label>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-5 text-gray-400 hover:text-white"
            >
              {showConfirmPassword ? <MdOutlineVisibility /> : <FaEyeSlash />}
            </button>
          </div>

          {/* Phone Number Input */}
          <div className="relative w-full">
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone Number"
              disabled={isLoading}
              className="peer w-full px-4 pt-6 pb-2 text-white bg-transparent border border-white rounded-xl placeholder-transparent focus:outline-none pr-10"
            />
            <label 
              htmlFor="phone" 
              className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white peer-focus:top-2 peer-focus:text-sm peer-focus:text-gray-400"
            >
              Phone Number (Optional)
            </label>
            <FaPhoneAlt className="absolute right-4 top-5 text-gray-400" />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-2 rounded-md bg-[#93F5AE] text-black font-semibold hover:bg-[#7ce49e] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAction === 'email' ? "Creating Account..." : "Create Account"}
          </button>

          <div className="w-full text-center text-sm text-white">or</div>

          <button 
            type="button" 
            onClick={handleGoogleSignUp}
            disabled={isLoading}
            className="w-full py-2 flex items-center justify-center bg-white text-black rounded-md hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FcGoogle className="mr-2 text-lg" />
            {loadingAction === 'google' ? 'Continuing with Google...' : 'Continue with Google'}
          </button>

          <p className="w-full text-sm text-white text-center">
            Already have an account?{' '}
            <Link href="/signin" className="text-blue-400 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignUpForm;
