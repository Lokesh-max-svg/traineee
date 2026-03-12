// app/api/verification-api.js

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

class VerificationAPI {
   
  /**
   * Verify user authentication
   */
 async getCurrentUser() {
   
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
     credentials: 'include',
    });

    if (!response.ok) {
      return { authenticated: false };
    }

    return await response.json();
  }
  /**
   * Verify user has gym access
   */
async verifyGymAccess() { 
 
  const response = await fetch(
    `${API_BASE_URL}/auth/verify-gym-access-headcoach`,
    {
      method: "POST",
      credentials: 'include',
      headers: {
        "Content-Type": "application/json"
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "No gym access");
  }

  return data;
}

async getUserName(userId){
  try {
      const response = await fetch(`${API_BASE_URL}/username?userId=${userId}`);
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
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include', // send session cookie
  });
}
}

export default new VerificationAPI();
