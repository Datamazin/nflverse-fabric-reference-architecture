"use client";

import React, { useEffect, useState } from "react";
import {
  MsalProvider,
  useMsal,
  useIsAuthenticated,
} from "@azure/msal-react";
import {
  PublicClientApplication,
  EventType,
  type AuthenticationResult,
} from "@azure/msal-browser";
import { msalConfig } from "@/lib/msalConfig";

const msalInstance = new PublicClientApplication(msalConfig);

// Set active account after login
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
    const result = event.payload as AuthenticationResult;
    msalInstance.setActiveAccount(result.account);
  }
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    msalInstance.initialize().then(() => {
      // Set active account if one exists
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
      }
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}

export function useAuth() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const account = accounts[0] || null;

  const signIn = async () => {
    await instance.loginPopup({
      scopes: ["https://api.fabric.microsoft.com/.default"],
    });
  };

  const signOut = async () => {
    await instance.logoutPopup();
  };

  const getAccessToken = async (): Promise<string> => {
    if (!account) throw new Error("No authenticated account");

    // Acquire token directly for Fabric API
    const result = await instance.acquireTokenSilent({
      scopes: ["https://api.fabric.microsoft.com/.default"],
      account,
    });

    return result.accessToken;
  };

  return {
    isAuthenticated,
    account,
    signIn,
    signOut,
    getAccessToken,
  };
}
