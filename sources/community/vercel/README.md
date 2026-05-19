# Vercel Community Source

Query Vercel projects, deployments, and domains through Coral SQL using the
[Vercel REST API](https://vercel.com/docs/rest-api).

## Setup

### 1. Create a Vercel Personal Access Token

Generate a token in your Vercel Dashboard under **Account Settings > Tokens**. Ensure it has read permissions for the projects or teams you wish to inspect.

See [Vercel Token Documentation](https://vercel.com/docs/rest-api#authenticating-requests) for more details.

### 2. Add the source

```bash
export VERCEL_TOKEN="<your-token>"
# Optional: export VERCEL_TEAM_ID="<your-team-id>" if querying team resources
coral source add --file sources/community/vercel/manifest.yaml
```

### 3. Verify

```bash
coral source test vercel
```

---

## Tables

### `vercel.projects`

Lists Vercel projects. Use the projects table to query framework types, repository links, and latest deployment statuses.

| Column | Type | Description |
|---|---|---|
| `id` | Utf8 | Unique project identifier |
| `name` | Utf8 | Name of the project |
| `framework` | Utf8 | Framework associated with this project (e.g. nextjs, gatsby, vite) |
| `node_version` | Utf8 | Node.js version configured for the project |
| `account_id` | Utf8 | The ID of the owner account |
| `created_at` | Timestamp | Timestamp when the project was created |
| `updated_at` | Timestamp | Timestamp when the project was last updated |

---

### `vercel.deployments`

Lists deployments under a Vercel project or team.

| Column | Type | Description |
|---|---|---|
| `id` | Utf8 | Unique deployment identifier |
| `name` | Utf8 | Project name associated with the deployment |
| `url` | Utf8 | Deployment URL |
| `state` | Utf8 | Deployment state (e.g., READY, BUILDING, ERROR, QUEUED) |
| `creator_username` | Utf8 | Username of the team member who triggered the deployment |
| `created_at` | Timestamp | Timestamp when the deployment was created |

**Optional filter:** `project_id`

---

### `vercel.domains`

Lists Vercel domains configured for custom routing.

| Column | Type | Description |
|---|---|---|
| `name` | Utf8 | Domain name |
| `verified` | Boolean | Whether the domain configuration is verified |
| `created_at` | Timestamp | Timestamp when the domain was added |
| `expires_at` | Timestamp | Timestamp when the domain registration expires |

---

## Example Queries

```sql
-- List Next.js projects
SELECT name, framework, node_version, created_at
FROM vercel.projects
WHERE framework = 'nextjs';

-- Find active deployments with errors
SELECT name, url, creator_username, created_at
FROM vercel.deployments
WHERE state = 'ERROR'
ORDER BY created_at DESC;

-- List all verified custom domains
SELECT name, verified, expires_at
FROM vercel.domains
WHERE verified = true;
```

---

## Validation

```bash
export VERCEL_TOKEN="<your-token>"
coral source lint sources/community/vercel/manifest.yaml
coral source add --file sources/community/vercel/manifest.yaml
coral source test vercel
```

---

## Limitations

- **Read-only.** This source does not trigger deployments, create projects, register domains, or delete any Vercel resources.
- **Cursor pagination.** Large datasets are automatically and transparently walked using Vercel's native page-cursor (`until`) API.
