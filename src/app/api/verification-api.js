// app/api/verification-api.js
import { apiFetch, buildApiUrl } from './client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

class VerificationAPI {
   
  /**
   * Verify user authentication
   */
 async getCurrentUser() {
    const response = await apiFetch(`${API_BASE_URL}/auth/me`);

    if (!response.ok) {
      return { authenticated: false };
    }

    return await response.json();
  }
  /**
   * Verify user has gym access
   */
async verifyGymAccess() { 
  const response = await apiFetch(buildApiUrl(`${API_BASE_URL}/auth/verify-gym-access-headcoach`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "No gym access");
  }

  return data;
}

async getUserName(userId){
  try {
      const response = await apiFetch(`${API_BASE_URL}/username?userId=${userId}`);
      if(!response.ok){
        console.error('Failed to fetch the session');
      }
      const data = await response.json();
      return data.data.displayName;
  }
  catch (error){
     console.error(error);
  };
}

  /**
   * Logout user
   */
 async logout() {
  await apiFetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
  });
}
}

export default new VerificationAPI();
