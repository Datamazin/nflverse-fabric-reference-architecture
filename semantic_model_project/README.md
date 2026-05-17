# NFL Play by Play Semantic Model Deployment

This folder is the deployable Power BI Project area for the Fabric semantic
model named `NFL Play by Play Model`.

Keep the existing `semantic_model/` folder for design notes and DAX reference
files. Put exported PBIP/TMDL project files here.

Expected repo layout:

```text
semantic_model_project/
  NFL Play by Play Model.SemanticModel/
    definition.pbism
    definition/
      database.tmdl
      model.tmdl
      relationships.tmdl
      tables/
        ...
```

## Export The Project Files

Preferred path from Power BI Desktop:

1. Open the PBIX that produced `NFL Play by Play Model`.
2. In Power BI Desktop, enable these preview features:
   - `Power BI Project (.pbip) save option`
   - `Store semantic model using TMDL format`
3. Use `File > Save As > Power BI Project (.pbip)`.
4. Copy the generated `<project>.SemanticModel` folder into this repo as:

```text
semantic_model_project/NFL Play by Play Model.SemanticModel/
```

5. Do not commit `.pbi/localSettings.json` or `.pbi/cache.abf`; these are local
   cache/settings files and are ignored by this repo.

Alternative path from Fabric:

- Use Fabric Git integration or the Fabric REST `getDefinition` endpoint with
  `format=TMDL` to download the semantic model public definition.
- Write the returned definition parts into the same folder structure shown
  above.
- The REST export requires read/write permissions on the semantic model and is
  blocked for a model with an encrypted sensitivity label.

## Deploy

From the repo root:

```powershell
python scripts/create_nfl_play_by_play_sm.py `
  --workspace-id <WORKSPACE_GUID>
```

If the exported model still points at another Fabric SQL endpoint, patch the
connection while deploying:

```powershell
python scripts/create_nfl_play_by_play_sm.py `
  --workspace-id <WORKSPACE_GUID> `
  --sql-endpoint-server <server.datawarehouse.fabric.microsoft.com> `
  --sql-database lh_nfl
```

The script stages a temporary copy of the semantic model, patches only the staged
files, publishes with `fabric-cicd`, then triggers a semantic model refresh.
Your checked-in TMDL files are not modified by deployment-time connection
patching.

Useful environment variables:

```powershell
$env:FABRIC_WORKSPACE_ID = "<WORKSPACE_GUID>"
$env:FABRIC_SM_DIR = "semantic_model_project/NFL Play by Play Model.SemanticModel"
$env:FABRIC_AUTH_MODE = "interactive" # or "azure-cli"
$env:FABRIC_SQL_ENDPOINT_SERVER = "<server.datawarehouse.fabric.microsoft.com>"
$env:FABRIC_SQL_DATABASE = "lh_nfl"
```

For a first deployment, Fabric may require you to configure the semantic model
data source credentials in the workspace before the refresh succeeds.

## References

- [Power BI Desktop projects](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)
- [Power BI Desktop project semantic model folder](https://learn.microsoft.com/en-za/power-bi/developer/projects/projects-dataset)
- [Deploy Power BI projects using fabric-cicd](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-deploy-fabric-cicd)
- [Fabric semantic model getDefinition API](https://learn.microsoft.com/en-us/rest/api/fabric/semanticmodel/items/get-semantic-model-definition)
