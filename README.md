# @git-fabric/git

Git operations fabric app -- commit, push, branch, PR, and repo management as a composable MCP layer.

Part of the [git-fabric](https://github.com/git-fabric) ecosystem. See [git-fabric/sdk](https://github.com/git-fabric/sdk) for the architecture specification (ADR-001, ADR-002, OSI mapping, BGP routing model).

## Architecture

Mapped to the fabric OSI model:

```
Layer 7 — Application    app.ts (FabricApp factory, 18 tools)
Layer 6 — Presentation   bin/cli.js (MCP stdio + HTTP, aiana_query)
Layer 5 — Session        layers/ (repos, commits, branches, pulls, files)
Layer 4 — Transport      MCP protocol (stdio + StreamableHTTP)
Layer 3 — Network        Gateway registration (AS65001, fabric.git.*)
Layer 2 — Data Link      adapters/env.ts (Octokit)
Layer 1 — Physical       GitHub API
```

## Tools

| Tool | Description |
|------|-------------|
| `git_repo_list` | List repos for an org or authenticated user |
| `git_repo_get` | Get full repo details |
| `git_repo_create` | Create a repo in an org |
| `git_repo_delete` | Permanently delete a repo |
| `git_file_get` | Get file content at a ref |
| `git_file_list` | List files at a path |
| `git_commit_list` | List recent commits on a branch |
| `git_commit_get` | Get commit details and changed files |
| `git_commit_compare` | Compare two refs |
| `git_commit_push` | Commit files via the Git Data API |
| `git_branch_list` | List branches |
| `git_branch_create` | Create a branch |
| `git_branch_delete` | Delete a branch |
| `git_branch_protect` | Apply branch protection rules |
| `git_pr_list` | List pull requests |
| `git_pr_get` | Get PR details |
| `git_pr_create` | Open a pull request |
| `git_pr_merge` | Merge a pull request |

## Gateway Registration

When `GATEWAY_URL` is set, fabric-git registers with the gateway on startup using the BGP-style routing model. The gateway discovers fabrics dynamically -- there is no static configuration file.

- **AS Number:** `65001`
- **Fabric ID:** `fabric-git`

**Advertised routes:**

| Prefix | Description |
|--------|-------------|
| `fabric.git` | Git and GitHub operations -- repos, commits, branches, PRs, files |
| `fabric.git.repos` | Repository management -- list, create, delete repos |
| `fabric.git.commits` | Commit operations -- list, get, compare, push commits |
| `fabric.git.branches` | Branch management -- list, create, delete, protect branches |
| `fabric.git.pulls` | Pull request operations -- list, get, create, merge PRs |
| `fabric.git.files` | File operations -- get file content, list directory trees |

All routes advertise `local_pref: 100`. The gateway maintains an F-RIB from these advertisements and routes queries to the best-matching fabric. Keepalives are sent every 30 seconds; if the gateway session expires, fabric-git re-registers automatically.

## Library

The `Library` class (`src/library.ts`) provides a reference knowledge source backed by the official [git/git](https://github.com/git/git) repository documentation. When an `aiana_query` arrives that does not match a live GitHub API pattern, fabric-git consults the library before falling back.

Two knowledge lanes:

1. **Live GitHub API** (deterministic, confidence >= 0.85) -- real-time state queries (list repos, show commits, etc.)
2. **Library** (reference) -- "how to" and "why" questions answered from Git's own documentation

## Usage

### Standalone MCP server (stdio)

```bash
GITHUB_TOKEN=ghp_... npx @git-fabric/git
```

### HTTP mode (for gateway registration)

```bash
GITHUB_TOKEN=ghp_... MCP_HTTP_PORT=8200 GATEWAY_URL=http://gateway:8080 npx @git-fabric/git
```

When `MCP_HTTP_PORT` is set, fabric-git starts an HTTP server exposing `/health`, `/tools`, `/tools/call`, `/mcp/tools/call`, and `/mcp` (StreamableHTTP). Without it, the server runs in stdio mode.

### Programmatic

```typescript
import { createApp } from "@git-fabric/git";

const app = createApp();
// app.tools, app.health(), etc.
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub personal access token |
| `GITHUB_ORG` | No | Default org for repo operations |
| `MCP_HTTP_PORT` | No | Port for HTTP/MCP server (enables HTTP mode) |
| `GATEWAY_URL` | No | Gateway URL for BGP-style registration |
| `POD_IP` | No | Advertised IP for gateway callbacks (default: `0.0.0.0`) |
| `OLLAMA_ENDPOINT` | No | Ollama server for local inference (default: `http://ollama.fabric-sdk:11434`) |
| `OLLAMA_MODEL` | No | Model for local inference (default: `qwen2.5-coder:3b`) |

## License

MIT
