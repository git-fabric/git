# @git-fabric/git

Git operations fabric app — commit, push, branch, PR, and repo management as a composable MCP layer.

Part of the [git-fabric](https://github.com/git-fabric) ecosystem.

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

## Architecture

Follows the [git-fabric layered pattern](https://github.com/git-fabric/gateway):

```
Detection / Query  →  repos.ts, commits.ts (pure reads)
Action             →  branches.ts, pulls.ts, commits.ts#commitFiles (effectful)
Adapter            →  adapters/env.ts (Octokit implementation)
Surface            →  app.ts (FabricApp factory)
```

## Usage

### Via gateway (recommended)

```yaml
# gateway.yaml
apps:
  - name: "@git-fabric/git"
    enabled: true
```

### Standalone MCP server

```bash
GITHUB_TOKEN=ghp_... npx @git-fabric/git
```

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

## License

MIT
