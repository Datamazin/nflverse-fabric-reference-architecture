# NFL Data Agent Chat App

A single deployable Next.js application that provides a natural language chat
interface to Microsoft Fabric Data Agents for NFL analytics.

## Is there a separate backend?

No separate backend project or service is missing. Everything for the chat app
lives in this folder.

That said, this is not a static/browser-only React app. It is a full-stack
Next.js app:

- Browser UI: React components, MSAL sign-in, chat state, and feedback controls.
- Server routes: Next.js API route handlers under `src/app/api`.
- Data service: Microsoft Fabric Data Agents, called from the server route.

The server routes are required because the app uses a confidential client secret
and an OAuth2 On-Behalf-Of token exchange. Those values must stay server-side.

Do not deploy this as a static site or `next export` app. Deploy it to a Node.js
host such as Azure App Service.

## Architecture

```text
Browser/MSAL -> POST /api/chat -> Next.js server route -> Fabric MCP Data Agent API
```

The main flow is:

1. The user signs in with Microsoft Entra ID in the browser.
2. The browser gets an access token for this app's API scope.
3. The browser posts the question to `POST /api/chat`.
4. `src/app/api/chat/route.ts` exchanges the user token for a Fabric-scoped
   token using MSAL Node's On-Behalf-Of flow.
5. `src/lib/fabricApi.ts` calls the Fabric Data Agent MCP endpoint.
6. The server route returns the agent response to the browser.

`POST /api/feedback` currently logs feedback server-side. It does not yet write
feedback to a durable store.

## Prerequisites

- Node.js 20 or newer for local development.
- Azure CLI for Azure deployment.
- A Microsoft Entra ID app registration.
- A published Microsoft Fabric Data Agent.
- The Fabric workspace ID and one or both Data Agent item IDs.
- A Fabric workspace on a capacity/region where Fabric Data Agent external
  access is available.

## Local setup

Run these commands from the repository root:

```powershell
cd data-agent-react-chatbot-app
npm install
Copy-Item .env.local.example .env.local
```

Edit `.env.local` and set the values described below.

For bash shells, use this copy command instead:

```bash
cp .env.local.example .env.local
```

Start the development server:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, and ask one of
the sample questions.

To test the production build locally:

```powershell
npm run build
npm run start
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | Browser + build | Entra app registration client ID. |
| `NEXT_PUBLIC_AZURE_TENANT_ID` | Browser + build | Entra tenant ID. |
| `NEXT_PUBLIC_REDIRECT_URI` | Browser + build | Local or production redirect URI. |
| `NEXT_PUBLIC_SAMPLE_QUESTION_1` | Browser + build | Optional first sample question. |
| `NEXT_PUBLIC_SAMPLE_QUESTION_2` | Browser + build | Optional second sample question. |
| `NEXT_PUBLIC_SAMPLE_QUESTION_3` | Browser + build | Optional third sample question. |
| `AZURE_CLIENT_ID` | Server only | Entra app registration client ID for OBO. |
| `AZURE_CLIENT_SECRET` | Server only | Entra app client secret for OBO. |
| `AZURE_TENANT_ID` | Server only | Entra tenant ID for OBO. |
| `FABRIC_WORKSPACE_ID` | Server only | Fabric workspace GUID. |
| `FABRIC_SM_AGENT_ID` | Server only | Semantic Model Data Agent item GUID. |
| `FABRIC_LAKEHOUSE_AGENT_ID` | Server only | Lakehouse Data Agent item GUID. |

`NEXT_PUBLIC_*` values are bundled into the browser build by Next.js, so set the
correct production values before building or deploying to Azure.

## Entra ID setup

1. Create a single-tenant Microsoft Entra ID app registration.
2. Add a Single-page application redirect URI:
   `http://localhost:3000`.
3. Add the production redirect URI after Azure deployment:
   `https://<app-name>.azurewebsites.net`.
4. Create a client secret and store the secret value securely.
5. Under **Expose an API**, set the Application ID URI to
   `api://<client-id>`.
6. Add a delegated scope named `access_as_user`.
7. Under **API permissions**, add delegated Fabric permissions needed by the
   Data Agent API, then grant admin consent.

The browser requests `api://<client-id>/access_as_user`. The Next.js server
route exchanges that token for `https://api.fabric.microsoft.com/.default`.

## Get Fabric IDs

- Workspace ID: open the Fabric workspace and copy the GUID from the URL:
  `https://app.fabric.microsoft.com/groups/<workspace-id>/...`
- Data Agent ID: open the Data Agent item and copy the item GUID from the URL.

Publish the Data Agent before testing the app. The API endpoint is not active
until the agent is published for external access.

## Deploy to Azure App Service

Use Azure App Service because this app needs a Node.js runtime for the Next.js
API routes.

These commands assume PowerShell and should be run from
`data-agent-react-chatbot-app`:

```powershell
$rg = "<resource-group>"
$location = "<azure-region>"
$plan = "<app-service-plan>"
$app = "<globally-unique-app-name>"
$tenantId = "<tenant-id>"
$clientId = "<client-id>"
$clientSecret = "<client-secret>"
$workspaceId = "<fabric-workspace-id>"
$semanticAgentId = "<semantic-model-agent-id>"
$lakehouseAgentId = "<lakehouse-agent-id>"

az group create `
  --name $rg `
  --location $location

az appservice plan create `
  --name $plan `
  --resource-group $rg `
  --location $location `
  --sku B1 `
  --is-linux

az webapp create `
  --name $app `
  --resource-group $rg `
  --plan $plan `
  --runtime "NODE:22-lts"

az webapp config appsettings set `
  --name $app `
  --resource-group $rg `
  --settings `
    SCM_DO_BUILD_DURING_DEPLOYMENT=true `
    NEXT_PUBLIC_AZURE_CLIENT_ID=$clientId `
    NEXT_PUBLIC_AZURE_TENANT_ID=$tenantId `
    NEXT_PUBLIC_REDIRECT_URI="https://$app.azurewebsites.net" `
    AZURE_CLIENT_ID=$clientId `
    AZURE_CLIENT_SECRET=$clientSecret `
    AZURE_TENANT_ID=$tenantId `
    FABRIC_WORKSPACE_ID=$workspaceId `
    FABRIC_SM_AGENT_ID=$semanticAgentId `
    FABRIC_LAKEHOUSE_AGENT_ID=$lakehouseAgentId

az webapp config set `
  --name $app `
  --resource-group $rg `
  --startup-file "npm run start"

az webapp up `
  --name $app `
  --resource-group $rg `
  --runtime "NODE:22-lts"
```

After deployment:

1. Add `https://<app-name>.azurewebsites.net` to the Entra app registration's
   SPA redirect URIs.
2. Confirm HTTPS Only is enabled for the App Service.
3. Restart the app if you changed app settings after deployment.
4. Open `https://<app-name>.azurewebsites.net`, sign in, and ask a sample
   question.

If your App Service region supports a newer Node.js LTS runtime, you can use it
instead of `NODE:22-lts`. Check available runtimes with:

```powershell
az webapp list-runtimes --os linux
```

## Troubleshooting

### Sign-in succeeds, but chat returns 401

Check that the Entra app exposes the `access_as_user` scope and that
`NEXT_PUBLIC_AZURE_CLIENT_ID` matches the same app registration.

### Chat returns Fabric configuration missing

The server-side Fabric variables are missing in `.env.local` or App Service app
settings:

- `FABRIC_WORKSPACE_ID`
- `FABRIC_SM_AGENT_ID`
- `FABRIC_LAKEHOUSE_AGENT_ID`

### OBO token exchange fails

Check the server-side Entra variables:

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`

Also confirm the app registration has the required delegated Fabric permissions
and admin consent has been granted.

### Fabric returns EntityNotFound or 404

Check these items:

1. The Data Agent is published.
2. The workspace ID and agent ID are correct.
3. The workspace is assigned to an active paid Fabric capacity.
4. Fabric tenant settings allow Data Agent/Copilot-style AI features.
5. The API/MCP endpoint is available in your tenant and region.

### Production build uses old auth settings

`NEXT_PUBLIC_*` values are captured at build time. Update the App Service app
settings and redeploy so Azure rebuilds the Next.js app with the correct values.

## Useful references

- [Configure Node.js apps in Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs)
- [Configure Azure App Service app settings](https://learn.microsoft.com/en-us/azure/app-service/configure-common)
- [Next.js standalone output](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output)
