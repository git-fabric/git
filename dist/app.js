/**
 * @git-fabric/git — FabricApp factory
 *
 * Implements the FabricApp interface from @git-fabric/gateway.
 * Exposes all git and GitHub operations as a single composable layer.
 *
 * Tools:
 *   Repos   : git_repo_list, git_repo_get, git_repo_create, git_repo_delete
 *   Files   : git_file_get, git_file_list
 *   Commits : git_commit_list, git_commit_get, git_commit_compare, git_commit_push
 *   Branches: git_branch_list, git_branch_create, git_branch_delete, git_branch_protect
 *   Pulls   : git_pr_list, git_pr_get, git_pr_create, git_pr_merge
 */
import { createAdapterFromEnv } from "./adapters/env.js";
import * as layers from "./layers/index.js";
// ── createApp ────────────────────────────────────────────────────────────────
export function createApp(githubOverride) {
    const github = githubOverride ?? createAdapterFromEnv();
    const tools = [
        // ── Repos ──────────────────────────────────────────────────────────────
        {
            name: "git_repo_list",
            description: "List repositories for an org or the authenticated user.",
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    org: { type: "string", description: "GitHub org name. Defaults to GITHUB_ORG env var." },
                },
            },
            execute: async (args) => layers.repos.listRepos(github, args.org),
        },
        {
            name: "git_repo_get",
            description: "Get full details for a repository.",
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string", description: "Repo owner (org or user)." },
                    repo: { type: "string", description: "Repository name." },
                },
                required: ["owner", "repo"],
            },
            execute: async (args) => layers.repos.getRepo(github, args.owner, args.repo),
        },
        {
            name: "git_repo_create",
            description: "Create a new repository in an org.",
            annotations: { readOnlyHint: false, destructiveHint: false },
            inputSchema: {
                type: "object",
                properties: {
                    org: { type: "string", description: "GitHub org name." },
                    name: { type: "string", description: "Repository name." },
                    description: { type: "string", description: "Short description." },
                    private: { type: "boolean", description: "Make repo private. Default: false." },
                },
                required: ["org", "name"],
            },
            execute: async (args) => layers.repos.getRepo(github, args.org, args.name)
                .catch(() => layers.repos.listRepos(github, args.org)
                .then(() => github.createRepo(args.org, args.name, { description: args.description, private: args.private }))),
        },
        {
            name: "git_repo_delete",
            description: "Permanently delete a repository. Irreversible.",
            annotations: { readOnlyHint: false, destructiveHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                },
                required: ["owner", "repo"],
            },
            execute: async (args) => {
                await github.deleteRepo(args.owner, args.repo);
                return { deleted: true, owner: args.owner, repo: args.repo };
            },
        },
        // ── Files ───────────────────────────────────────────────────────────────
        {
            name: "git_file_get",
            description: "Get the content of a file from a repository.",
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    path: { type: "string", description: "File path relative to repo root." },
                    ref: { type: "string", description: "Branch, tag, or commit SHA. Defaults to default branch." },
                },
                required: ["owner", "repo", "path"],
            },
            execute: async (args) => layers.repos.getFile(github, args.owner, args.repo, args.path, args.ref),
        },
        {
            name: "git_file_list",
            description: "List files and directories at a path in a repository.",
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    path: { type: "string", description: "Directory path. Defaults to root." },
                    ref: { type: "string", description: "Branch, tag, or commit SHA." },
                },
                required: ["owner", "repo"],
            },
            execute: async (args) => layers.repos.listFiles(github, args.owner, args.repo, args.path, args.ref),
        },
        // ── Commits ──────────────────────────────────────────────────────────────
        {
            name: "git_commit_list",
            description: "List recent commits on a branch.",
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    branch: { type: "string", description: "Branch name. Defaults to default branch." },
                    limit: { type: "number", description: "Max commits to return. Default: 20." },
                },
                required: ["owner", "repo"],
            },
            execute: async (args) => layers.commits.listCommits(github, args.owner, args.repo, args.branch, args.limit),
        },
        {
            name: "git_commit_get",
            description: "Get full details for a commit including changed files.",
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    sha: { type: "string", description: "Full or abbreviated commit SHA." },
                },
                required: ["owner", "repo", "sha"],
            },
            execute: async (args) => layers.commits.getCommit(github, args.owner, args.repo, args.sha),
        },
        {
            name: "git_commit_compare",
            description: "Compare two refs (branches, tags, or SHAs) to see divergence and changed files.",
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    base: { type: "string", description: "Base ref." },
                    head: { type: "string", description: "Head ref." },
                },
                required: ["owner", "repo", "base", "head"],
            },
            execute: async (args) => layers.commits.compare(github, args.owner, args.repo, args.base, args.head),
        },
        {
            name: "git_commit_push",
            description: "Commit one or more files to a branch via the GitHub Git Data API. Creates the branch first if createBranch is true.",
            annotations: { readOnlyHint: false, destructiveHint: false },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    branch: { type: "string", description: "Target branch name." },
                    message: { type: "string", description: "Commit message." },
                    files: {
                        type: "array",
                        description: "Files to commit.",
                        items: {
                            type: "object",
                            properties: {
                                path: { type: "string", description: "File path in repo." },
                                content: { type: "string", description: "File content (UTF-8 string)." },
                            },
                            required: ["path", "content"],
                        },
                    },
                    createBranch: { type: "boolean", description: "Create branch if it doesn't exist. Default: false." },
                    fromBranch: { type: "string", description: "Source branch for new branch creation." },
                },
                required: ["owner", "repo", "branch", "message", "files"],
            },
            execute: async (args) => layers.commits.commitFiles(github, args.owner, args.repo, {
                branch: args.branch,
                message: args.message,
                files: args.files,
                createBranch: args.createBranch,
                fromBranch: args.fromBranch,
            }),
        },
        // ── Branches ─────────────────────────────────────────────────────────────
        {
            name: "git_branch_list",
            description: "List branches in a repository.",
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                },
                required: ["owner", "repo"],
            },
            execute: async (args) => layers.branches.listBranches(github, args.owner, args.repo),
        },
        {
            name: "git_branch_create",
            description: "Create a new branch from an existing branch.",
            annotations: { readOnlyHint: false, destructiveHint: false },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    branch: { type: "string", description: "New branch name." },
                    fromBranch: { type: "string", description: "Source branch. Defaults to default branch." },
                },
                required: ["owner", "repo", "branch"],
            },
            execute: async (args) => {
                const from = args.fromBranch ?? await github.getDefaultBranch(args.owner, args.repo);
                return layers.branches.createBranch(github, args.owner, args.repo, args.branch, from);
            },
        },
        {
            name: "git_branch_delete",
            description: "Delete a branch. Will fail if the branch is protected.",
            annotations: { readOnlyHint: false, destructiveHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    branch: { type: "string" },
                },
                required: ["owner", "repo", "branch"],
            },
            execute: async (args) => layers.branches.deleteBranch(github, args.owner, args.repo, args.branch),
        },
        {
            name: "git_branch_protect",
            description: "Apply branch protection rules.",
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    branch: { type: "string" },
                    requirePullRequest: { type: "boolean", description: "Require PR before merging." },
                    requiredReviewers: { type: "number", description: "Minimum number of approving reviews." },
                    requireStatusChecks: { type: "array", items: { type: "string" }, description: "Required status check context names." },
                    enforceAdmins: { type: "boolean", description: "Enforce rules on admins too." },
                },
                required: ["owner", "repo", "branch"],
            },
            execute: async (args) => layers.branches.protectBranch(github, args.owner, args.repo, args.branch, {
                requirePullRequest: args.requirePullRequest,
                requiredReviewers: args.requiredReviewers,
                requireStatusChecks: args.requireStatusChecks,
                enforceAdmins: args.enforceAdmins,
            }),
        },
        // ── Pull requests ─────────────────────────────────────────────────────────
        {
            name: "git_pr_list",
            description: "List pull requests in a repository.",
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    state: { type: "string", enum: ["open", "closed", "all"], description: "PR state filter. Default: open." },
                },
                required: ["owner", "repo"],
            },
            execute: async (args) => layers.pulls.listPullRequests(github, args.owner, args.repo, args.state),
        },
        {
            name: "git_pr_get",
            description: "Get full details for a pull request including files changed, labels, and review state.",
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    number: { type: "number", description: "PR number." },
                },
                required: ["owner", "repo", "number"],
            },
            execute: async (args) => layers.pulls.getPullRequest(github, args.owner, args.repo, args.number),
        },
        {
            name: "git_pr_create",
            description: "Open a pull request.",
            annotations: { readOnlyHint: false, destructiveHint: false },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    title: { type: "string" },
                    head: { type: "string", description: "Source branch." },
                    base: { type: "string", description: "Target branch. Default: default branch." },
                    body: { type: "string", description: "PR description (markdown)." },
                    draft: { type: "boolean", description: "Open as draft PR. Default: false." },
                    labels: { type: "array", items: { type: "string" }, description: "Labels to apply." },
                },
                required: ["owner", "repo", "title", "head"],
            },
            execute: async (args) => {
                const base = args.base ?? await github.getDefaultBranch(args.owner, args.repo);
                return layers.pulls.createPullRequest(github, args.owner, args.repo, {
                    title: args.title,
                    head: args.head,
                    base,
                    body: args.body,
                    draft: args.draft,
                    labels: args.labels,
                });
            },
        },
        {
            name: "git_pr_merge",
            description: "Merge a pull request.",
            annotations: { readOnlyHint: false, destructiveHint: false },
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string" },
                    repo: { type: "string" },
                    number: { type: "number", description: "PR number." },
                    method: { type: "string", enum: ["merge", "squash", "rebase"], description: "Merge method. Default: squash." },
                    commitTitle: { type: "string", description: "Custom commit title (squash/merge only)." },
                    commitMessage: { type: "string", description: "Custom commit message." },
                },
                required: ["owner", "repo", "number"],
            },
            execute: async (args) => layers.pulls.mergePullRequest(github, args.owner, args.repo, args.number, {
                method: args.method,
                commitTitle: args.commitTitle,
                commitMessage: args.commitMessage,
            }),
        },
    ];
    return {
        name: "@git-fabric/git",
        version: "0.1.0",
        description: "Git operations fabric app — commit, push, branch, PR, and repo management",
        tools,
        async health() {
            const start = Date.now();
            try {
                await github.listRepos();
                return {
                    app: "@git-fabric/git",
                    status: "healthy",
                    latencyMs: Date.now() - start,
                    details: { tokenPresent: !!github.token },
                };
            }
            catch (e) {
                return {
                    app: "@git-fabric/git",
                    status: "unavailable",
                    latencyMs: Date.now() - start,
                    details: { error: String(e) },
                };
            }
        },
    };
}
//# sourceMappingURL=app.js.map