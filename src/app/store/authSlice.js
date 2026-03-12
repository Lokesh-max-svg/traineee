'use client';

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { signOut } from 'firebase/auth';
import { auth } from '../api/firebase';
import { apiFetch } from '../api/client';
import verificationApi from '../api/verification-api';

function extractTrainer(data) {
  const candidates = [
    data?.data?.trainer,
    data?.trainer,
    data?.data?.user,
    data?.user,
    data?.data?.session?.trainer,
    data?.data,
  ];

  return candidates.find(
    (candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate)
  ) || null;
}

function clearLegacyStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('jwtToken');
  localStorage.removeItem('trainerData');
}

async function authenticateTrainer(firebaseToken) {
  const response = await apiFetch('/trainer-app/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseToken }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Authentication failed');
  }

  return {
    trainer: extractTrainer(data),
    jwtToken: data?.data?.token || null,
  };
}

async function getCurrentTrainerFromSession() {
  const session = await verificationApi.getCurrentUser();

  if (!session || session.authenticated === false) {
    return null;
  }

  return extractTrainer(session);
}

export const loginWithFirebaseToken = createAsyncThunk(
  'auth/loginWithFirebaseToken',
  async (firebaseToken) => {
    clearLegacyStorage();
    const authenticated = await authenticateTrainer(firebaseToken);
    await signOut(auth);
    const trainer = (await getCurrentTrainerFromSession()) || authenticated.trainer;
    if (!trainer && !authenticated.jwtToken) {
      throw new Error('Login succeeded, but no usable session was returned');
    }
    return {
      trainer,
      jwtToken: authenticated.jwtToken,
    };
  }
);

export const restoreAuthSession = createAsyncThunk(
  'auth/restoreAuthSession',
  async () => {
    clearLegacyStorage();
    const trainer = await getCurrentTrainerFromSession();
    if (!trainer) {
      return null;
    }

    return { trainer, jwtToken: null };
  }
);

export const logoutTrainer = createAsyncThunk('auth/logoutTrainer', async () => {
  try {
    await verificationApi.logout();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Backend logout failed:', error);
    }
  }

  await signOut(auth);
  clearLegacyStorage();
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    trainer: null,
    jwtToken: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    clearAuthState: (state) => {
      state.trainer = null;
      state.jwtToken = null;
      state.status = 'unauthenticated';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginWithFirebaseToken.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginWithFirebaseToken.fulfilled, (state, action) => {
        state.trainer = action.payload.trainer;
        state.jwtToken = action.payload.jwtToken;
        state.status = 'authenticated';
        state.error = null;
      })
      .addCase(loginWithFirebaseToken.rejected, (state, action) => {
        state.trainer = null;
        state.jwtToken = null;
        state.status = 'unauthenticated';
        state.error = action.error.message || 'Failed to sign in';
      })
      .addCase(restoreAuthSession.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(restoreAuthSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.trainer = action.payload.trainer;
          state.jwtToken = action.payload.jwtToken;
          state.status = 'authenticated';
        } else {
          state.trainer = null;
          state.jwtToken = null;
          state.status = 'unauthenticated';
        }

        state.error = null;
      })
      .addCase(restoreAuthSession.rejected, (state, action) => {
        state.trainer = null;
        state.jwtToken = null;
        state.status = 'unauthenticated';
        state.error = action.error.message || 'Failed to restore session';
      })
      .addCase(logoutTrainer.fulfilled, (state) => {
        state.trainer = null;
        state.jwtToken = null;
        state.status = 'unauthenticated';
        state.error = null;
      })
      .addCase(logoutTrainer.rejected, (state, action) => {
        state.trainer = null;
        state.jwtToken = null;
        state.status = 'unauthenticated';
        state.error = action.error.message || 'Failed to log out cleanly';
      });
  },
});

export const { clearAuthState } = authSlice.actions;
export default authSlice.reducer;
