# NFL Data Agent Chat App

A Next.js web application that provides a natural language chat interface to Microsoft Fabric Data Agents for NFL analytics.

## Architecture

- **Frontend:** React with MSAL for Entra ID authentication
- **Backend:** Next.js API routes performing OAuth2 On-Behalf-Of (OBO) token exchange
- **Data:** Microsoft Fabric Data Agents (Semantic Model and/or Lakehouse)
- **Hosting:** Azure App Service (Node.js)

## Prerequisites

- Node.js 20+
- An Azure/Entra ID app registration (see setup below)
- A deployed Fabric Data Agent (Semantic Model or Lakehouse)

## Local Development

```bash
cd web-app
npm install
cp .env.local.example .env.local
# Edit .env.local with your values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | Browser + Server | App registration client ID |
| `NEXT_PUBLIC_AZURE_TENANT_ID` | Browser | Your Entra tenant ID |
| `NEXT_PUBLIC_REDIRECT_URI` | Browser | OAuth redirect URI |
| `AZURE_CLIENT_ID` | Server only | Same client ID (for OBO) |
| `AZURE_CLIENT_SECRET` | Server only | Client secret for OBO exchange |
| `AZURE_TENANT_ID` | Server only | Tenant ID (for OBO) |
| `FABRIC_WORKSPACE_ID` | Server only | Fabric workspace GUID |
| `FABRIC_SM_AGENT_ID` | Server only | Semantic Model Data Agent item ID |
| `FABRIC_LAKEHOUSE_AGENT_ID` | Server only | Lakehouse Data Agent item ID |

## Azure Setup Checklist

### 1. Entra ID App Registration

1. Go to **Azure Portal → Entra ID → App Registrations → New Registration**
2. Name: `NFL Data Agent Chat App`
3. Supported account types: **Single tenant**
4. Register the app

#### Add Platforms

5. Go to **Authentication → Add a platform**
6. Add **Single-page application (SPA):**
   - Redirect URI: `http://localhost:3000` (add production URL later)
7. Add **Web** platform (needed for OBO confidential client):
   - No redirect URI needed for OBO

#### Client Secret

8. Go to **Certificates & Secrets → New client secret**
9. Copy the secret value (you won't see it again)

#### Expose an API

10. Go to **Expose an API**
11. Set Application ID URI: `api://<YOUR_CLIENT_ID>`
12. Add a scope:
    - Scope name: `access_as_user`
    - Who can consent: Admins and users
    - Admin consent display name: "Access NFL Data Agent as user"
    - Admin consent description: "Allows the app to call Fabric Data Agents on behalf of the signed-in user"
    - State: Enabled

#### API Permissions

13. Go to **API Permissions → Add a permission**
14. Select **APIs my organization uses** → search for `Power BI Service` or `Microsoft Fabric`
15. Add delegated permissions:
    - `https://api.fabric.microsoft.com/DataAgent.Execute.All`
    - `https://api.fabric.microsoft.com/Workspace.Read.All`
16. Click **Grant admin consent** for your organization

#### Authorized Client Applications (Optional)

17. Under **Expose an API**, add your own client ID as an authorized client application
    - This pre-consents the SPA to request the `access_as_user` scope

### 2. Get Fabric IDs

1. **Workspace ID:** Open your Fabric workspace → copy the GUID from the URL
   (`https://app.fabric.microsoft.com/groups/<WORKSPACE_ID>/...`)
2. **Data Agent ID:** In the workspace, open your Data Agent → copy the item GUID from the URL

### 3. Deploy to Azure App Service

```bash
# Build the app
cd web-app
npm run build

# Create and deploy (first time)
az webapp up \
  --name nfl-data-agent-chat \
  --resource-group your-rg \
  --runtime "NODE:20-lts" \
  --plan your-app-plan \
  --sku B1

# Set environment variables
az webapp config appsettings set \
  --name nfl-data-agent-chat \
  --resource-group your-rg \
  --settings \
    AZURE_TENANT_ID="your-tenant-id" \
    AZURE_CLIENT_ID="your-client-id" \
    AZURE_CLIENT_SECRET="your-secret" \
    FABRIC_WORKSPACE_ID="your-workspace-id" \
    FABRIC_SM_AGENT_ID="your-sm-agent-id" \
    FABRIC_LAKEHOUSE_AGENT_ID="your-lh-agent-id" \
    NEXT_PUBLIC_AZURE_CLIENT_ID="your-client-id" \
    NEXT_PUBLIC_AZURE_TENANT_ID="your-tenant-id" \
    NEXT_PUBLIC_REDIRECT_URI="https://nfl-data-agent-chat.azurewebsites.net"
```

#### Alternative: GitHub Actions CI/CD

Add a `.github/workflows/deploy.yml` that:
1. Checks out code
2. Runs `npm ci && npm run build` in `web-app/`
3. Deploys to Azure App Service using `azure/webapps-deploy@v3`

### 4. Post-Deployment

1. Add your production URL to the app registration's SPA redirect URIs
2. Enable HTTPS Only in App Service settings
3. Optionally configure a custom domain

## How It Works

```
Browser (MSAL sign-in) → Next.js API Route → Fabric Data Agent REST API
                              ↕
                    OBO token exchange
                    (user token → Fabric token)
```

1. User signs in via MSAL popup (Entra ID)
2. Frontend acquires a token scoped to your backend API (`api://<client-id>/access_as_user`)
3. Frontend sends the user's message + token to `POST /api/chat`
4. API route exchanges the token for a Fabric-scoped token (OBO flow)
5. API route calls `POST https://api.fabric.microsoft.com/v1/workspaces/{id}/items/{agentId}/chat`
6. Response is returned to the browser and rendered

## Notes

- The Fabric Data Agent chat API requires the workspace to be in an AI-enabled region
- Response times are typically 8-25 seconds depending on query complexity
- The app manages conversation history client-side and sends it with each request for context
- Dark mode follows system preference via Tailwind CSS
