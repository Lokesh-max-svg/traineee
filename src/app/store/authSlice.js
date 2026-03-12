'use client';

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../api/firebase';
import verificationApi from '../api/verification-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function clearLegacyStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('jwtToken');
  localStorage.removeItem('trainerData');
}

async function authenticateTrainer(firebaseToken) {
  const response = await fetch(`${API_BASE_URL}/trainer-app/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseToken }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Authentication failed');
  }

  return {
    trainer: data.data.trainer,
    jwtToken: data.data.token,
  };
}

function waitForFirebaseUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export const loginWithFirebaseToken = createAsyncThunk(
  'auth/loginWithFirebaseToken',
  async (firebaseToken) => {
    clearLegacyStorage();
    return authenticateTrainer(firebaseToken);
  }
);

export const restoreAuthSession = createAsyncThunk(
  'auth/restoreAuthSession',
  async () => {
    clearLegacyStorage();

    const user = await waitForFirebaseUser();

    if (!user) {
      return null;
    }

    const firebaseToken = await user.getIdToken();
    return authenticateTrainer(firebaseToken);
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
