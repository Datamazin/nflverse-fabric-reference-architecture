import { Configuration, LogLevel } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID || "common"}`,
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message) => {
        if (level === LogLevel.Error) {
          console.error(message);
        }
      },
    },
  },
};

// Scopes for the backend API (OBO flow)
export const loginRequest = {
  scopes: [`api://${process.env.NEXT_PUBLIC_AZURE_CLIENT_ID}/access_as_user`],
};

// Used by the backend to exchange for Fabric token
export const fabricScopes = ["https://api.fabric.microsoft.com/.default"];
