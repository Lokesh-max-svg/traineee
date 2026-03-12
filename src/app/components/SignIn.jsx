'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaEnvelope, FaLock, FaEyeSlash } from 'react-icons/fa';
import { MdOutlineVisibility } from 'react-icons/md';
import { FcGoogle } from 'react-icons/fc';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../api/firebase';
import { useRouter } from 'next/navigation';
import LoadingOverlay from './LoadingOverlay';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginWithFirebaseToken } from '../store/authSlice';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function SignInForm() {
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector((state) => state.auth.status);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingAction, setLoadingAction] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const isLoading = loadingAction !== null;

  useEffect(() => {
    if (authStatus === 'authenticated') {
      router.replace('/trainer');
    }
  }, [authStatus, router]);


 const handleEmailLogin = async (e) => {
  e?.preventDefault();

  if (isLoading) {
    return;
  }

  if (!email.trim()) {
    toast.error('Please enter your email');
    return;
  }

  if (!password) {
    toast.error('Please enter your password');
    return;
  }

  setLoadingAction('email');
  let shouldResetLoading = true;

  try {
    // Step 1: Authenticate with Firebase using email/password
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Step 2: Get Firebase ID token
    const firebaseToken = await userCredential.user.getIdToken();

    // Step 3: Send Firebase token to trainer app backend
    await dispatch(loginWithFirebaseToken(firebaseToken)).unwrap();

    toast.success('Login successful!');
    await wait(800);
    shouldResetLoading = false;
    router.push('/trainer');
    return;

  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('Login error:', err);

    let errorMessage = 'Failed to sign in';

    if (err.code === 'auth/user-not-found') {
      errorMessage = 'Email not found. Please sign up first.';
    } else if (err.code === 'auth/wrong-password') {
      errorMessage = 'Invalid password. Please try again.';
    } else if (err.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address.';
    } else if (err.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed attempts. Please try again later.';
    } else if (err.code === 'auth/user-disabled') {
      errorMessage = 'This account has been disabled.';
    } else if (err.message.includes('Trainer account is not approved')) {
      errorMessage = 'Your account is pending approval. Please contact support.';
    } else if (err.message.includes('No trainer account found')) {
      errorMessage = 'This email is not registered as a trainer.';
    } else {
      errorMessage = err.message || errorMessage;
    }

    toast.error(errorMessage);
  } finally {
    if (shouldResetLoading) {
      setLoadingAction(null);
    }
  }
};

  // Google Login - Get token from Firebase, send to trainer app backend
  const handleGoogleLogin = async () => {
    if (isLoading) {
      return;
    }

    setLoadingAction('google');
    let shouldResetLoading = true;

    try {
      // Step 1: Get Google credentials via Firebase popup
      const result = await signInWithPopup(auth, googleProvider);

      // Step 2: Get Firebase ID token
      const firebaseToken = await result.user.getIdToken();

      // Step 3: Send Firebase token to trainer app backend
      await dispatch(loginWithFirebaseToken(firebaseToken)).unwrap();

      toast.success('Login successful!');
      await wait(800);
      shouldResetLoading = false;
      router.push('/trainer');
      return;
      
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Google login error:', err);

      let errorMessage = 'Google login failed';

      if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked. Please allow popups for this site.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in was cancelled. Please try again.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        // User closed popup, don't show error
        if (process.env.NODE_ENV === 'development') console.log('User cancelled popup');
        return;
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with this email.';
      } else if (err.message.includes('Trainer account is not approved')) {
        errorMessage = 'Your account is pending approval. Please contact support.';
      } else if (err.message.includes('No trainer account found')) {
        errorMessage = 'This email is not registered as a trainer.';
      } else {
        errorMessage = err.message || errorMessage;
      }

      toast.error(errorMessage);
    } finally {
      if (shouldResetLoading) {
        setLoadingAction(null);
      }
    }
  };

  return (
    <div className="flex bg-gradient-to-r  text-white relative min-h-screen">
      {isLoading && <LoadingOverlay />}

      <div className="flex flex-col px-4 sm:px-6 mx-auto my-8 w-full max-w-sm z-10">
        <h1 className="text-3xl font-bold text-[#A4FEB7] mb-1">Sign in</h1>
        <p className="text-gray-300 mb-4">
          Please login to continue to your account.
        </p>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          {/* Email Field */}
          <div>
            <label className="block text-sm mb-1">Email</label>
            <div className="relative">
              <FaEnvelope className="absolute top-3 left-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter Your Email"
                required
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2 bg-transparent border border-white rounded-2xl placeholder-gray-400 focus:outline-none focus:border-[#A4FEB7]"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm mb-1">Password</label>
            <div className="relative">
              <FaLock className="absolute top-3 left-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                disabled={isLoading}
                className="w-full pl-10 pr-10 py-2 bg-transparent border border-white rounded-2xl placeholder-gray-400 focus:outline-none focus:border-[#A4FEB7]"
              />
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-3 right-4 text-gray-400 hover:text-white"
              >
                {showPassword ? <MdOutlineVisibility /> : <FaEyeSlash />}
              </button>
            </div>
            <Link href="/fp" className="text-blue-400 text-sm mt-1 inline-block hover:underline">
              Forgot password?
            </Link>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 rounded-xl bg-[#A4FEB7] text-black font-semibold text-base cursor-pointer hover:bg-[#8ef0a5] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAction === 'email' ? 'Signing in...' : 'Sign in'}
          </button>

          {/* OR Divider */}
          <div className="text-center text-gray-400 text-sm">or</div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-2 flex items-center justify-center border border-gray-500 rounded-xl text-white hover:bg-gray-800 cursor-pointer text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FcGoogle className="mr-2 text-lg" />
            {loadingAction === 'google' ? 'Signing in with Google...' : 'Sign in with Google'}
          </button>

          {/* Sign Up Link */}
          <p className="text-gray-400 text-xs text-center">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-400 hover:underline">
              Sign Up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default SignInForm;
