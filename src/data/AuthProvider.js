// src/data/AuthProvider.js (or your chosen path e.g., src/context/AuthProvider.js)
import React, { createContext, useContext, useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom'; // Only needed if login/logout here cause navigation

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null); // To store user info like { CustomerID, firstName, lastName, email }
  const [isLoading, setIsLoading] = useState(true); // To handle initial auth check

  useEffect(() => {
    // Check for a stored token or session on initial load
    // This is a simplified example. Real token validation might involve an API call.
    console.log("AuthProvider: Checking initial authentication state...");
    const token = localStorage.getItem('authToken');
    const userDataString = localStorage.getItem('metalworksUser');
    
    if (token && userDataString) {
      try {
        const userData = JSON.parse(userDataString);
        // In a real app, you might want to verify the token with the backend here
        // For now, we assume if token and user data exist, user is "authenticated"
        setUser(userData);
        setIsAuthenticated(true);
        console.log("AuthProvider: User session restored from localStorage:", userData);
      } catch (error) {
        console.error("AuthProvider: Failed to parse user data from localStorage", error);
        // Clear potentially corrupted data
        localStorage.removeItem('authToken');
        localStorage.removeItem('metalworksUser');
      }
    }
    setIsLoading(false); // Done checking initial auth state
  }, []);

  const login = (userData, token) => {
    // userData should be an object like { CustomerID, firstName, lastName, userEmail } from your backend
    // token would be a JWT or session token from your backend
    console.log("AuthProvider: login called with userData:", userData);
    localStorage.setItem('authToken', token);
    localStorage.setItem('metalworksUser', JSON.stringify(userData)); // Store user data
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    console.log("AuthProvider: logout called.");
    localStorage.removeItem('authToken');
    localStorage.removeItem('metalworksUser');
    setUser(null);
    setIsAuthenticated(false);
    // Navigation after logout is usually handled by the component calling logout (e.g., Header)
    // or by a redirect in App.js based on isAuthenticated state.
  };

  // The value provided to consuming components
  const contextValue = {
    isAuthenticated,
    user, // This object will contain CustomerID, firstName, lastName, email etc.
    login,
    logout,
    isLoadingAuth: isLoading // Renamed to avoid conflict if consumer also has 'isLoading'
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {!isLoading && children} {/* Don't render children until initial auth check is done to avoid UI flashes */}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  // If context is null, it means useAuth is used outside of AuthProvider's scope
  if (context === null) { 
    throw new Error('useAuth must be used within an AuthProvider. Make sure AuthProvider wraps your component tree.');
  }
  return context;
};
