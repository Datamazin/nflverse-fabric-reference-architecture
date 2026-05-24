import { ConfidentialClientApplication } from "@azure/msal-node";

let msalInstance: ConfidentialClientApplication | null = null;

function getMsalInstance(): ConfidentialClientApplication {
  if (!msalInstance) {
    msalInstance = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.AZURE_CLIENT_ID!,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      },
    });
  }
  return msalInstance;
}

/**
 * Exchange a user access token for a Fabric-scoped token via the OBO flow.
 */
export async function exchangeTokenForFabric(
  userAccessToken: string
): Promise<string> {
  const cca = getMsalInstance();

  const result = await cca.acquireTokenOnBehalfOf({
    oboAssertion: userAccessToken,
    scopes: ["https://api.fabric.microsoft.com/.default"],
  });

  if (!result?.accessToken) {
    throw new Error("OBO token exchange failed: no access token returned");
  }

  return result.accessToken;
}
