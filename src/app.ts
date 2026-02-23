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
import type { GitHubAdapter } from "./types.js";

// ── FabricApp interface (mirrors @git-fabric/gateway types) ─────────────────
// Defined inline so @git-fabric/git has zero coupling to the gateway package.
// When the gateway ships stable types, import them directly.

interface FabricTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

interface FabricApp {
  name: string;
  version: string;
  description: string;
  tools: FabricTool[];
  health: () => Promise<{ app: string; status: "healthy" | "degraded" | "unavailable"; latencyMs?: number; details?: Record<string, unknown> }>;
}

// ── createApp ────────────────────────────────────────────────────────────────

export function createApp(githubOverride?: GitHubAdapter): FabricApp {
  const github = githubOverride ?? createAdapterFromEnv();

  const tools: FabricTool[] = [

    // ── Repos ──────────────────────────────────────────────────────────────

    {
      name: "git_repo_list",
      description: "List repositories for an org or the authenticated user.",
      inputSchema: {
        type: "object",
        properties: {
          org: { type: "string", description: "GitHub org name. Defaults to GITHUB_ORG env var." },
        },
      },
      execute: async (args) => layers.repos.listRepos(github, args.org as string | undefined),
    },

    {
      name: "git_repo_get",
      description: "Get full details for a repository.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Repo owner (org or user)." },
          repo:  { type: "string", description: "Repository name." },
        },
        required: ["owner", "repo"],
      },
      execute: async (args) => layers.repos.getRepo(github, args.owner as string, args.repo as string),
    },

    {
      name: "git_repo_create",
      description: "Create a new repository in an org.",
      inputSchema: {
        type: "object",
        properties: {
          org:         { type: "string", description: "GitHub org name." },
          name:        { type: "string", description: "Repository name." },
          description: { type: "string", description: "Short description." },
          private:     { type: "boolean", description: "Make repo private. Default: false." },
        },
        required: ["org", "name"],
      },
      execute: async (args) => layers.repos.getRepo(github, args.org as string, args.name as string)
        .catch(() => layers.repos.listRepos(github, args.org as string)
          .then(() => github.createRepo(
            args.org as string,
            args.name as string,
            { description: args.description as string | undefined, private: args.private as boolean | undefined },
          ))
        ),
    },

    {
      name: "git_repo_delete",
      description: "Permanently delete a repository. Irreversible.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo:  { type: "string" },
        },
        required: ["owner", "repo"],
      },
      execute: async (args) => {
        await github.deleteRepo(args.owner as string, args.repo as string);
        return { deleted: true, owner: args.owner, repo: args.repo };
      },
    },

    // ── Files ───────────────────────────────────────────────────────────────

    {
      name: "git_file_get",
      description: "Get the content of a file from a repository.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo:  { type: "string" },
          path:  { type: "string", description: "File path relative to repo root." },
          ref:   { type: "string", description: "Branch, tag, or commit SHA. Defaults to default branch." },
        },
        required: ["owner", "repo", "path"],
      },
      execute: async (args) =>
        layers.repos.getFile(github, args.owner as string, args.repo as string, args.path as string, args.ref as string | undefined),
    },

    {
      name: "git_file_list",
      description: "List files and directories at a path in a repository.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo:  { type: "string" },
          path:  { type: "string", description: "Directory path. Defaults to root." },
          ref:   { type: "string", description: "Branch, tag, or commit SHA." },
        },
        required: ["owner", "repo"],
      },
      execute: async (args) =>
        layers.repos.listFiles(github, args.owner as string, args.repo as string, args.path as string | undefined, args.ref as string | undefined),
    },

    // ── Commits ──────────────────────────────────────────────────────────────

    {
      name: "git_commit_list",
      description: "List recent commits on a branch.",
      inputSchema: {
        type: "object",
        properties: {
          owner:  { type: "string" },
          repo:   { type: "string" },
          branch: { type: "string", description: "Branch name. Defaults to default branch." },
          limit:  { type: "number", description: "Max commits to return. Default: 20." },
        },
        required: ["owner", "repo"],
      },
      execute: async (args) =>
        layers.commits.listCommits(github, args.owner as string, args.repo as string, args.branch as string | undefined, args.limit as number | undefined),
    },

    {
      name: "git_commit_get",
      description: "Get full details for a commit including changed files.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo:  { type: "string" },
          sha:   { type: "string", description: "Full or abbreviated commit SHA." },
        },
        required: ["owner", "repo", "sha"],
      },
      execute: async (args) =>
        layers.commits.getCommit(github, args.owner as string, args.repo as string, args.sha as string),
    },

    {
      name: "git_commit_compare",
      description: "Compare two refs (branches, tags, or SHAs) to see divergence and changed files.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo:  { type: "string" },
          base:  { type: "string", description: "Base ref." },
          head:  { type: "string", description: "Head ref." },
        },
        required: ["owner", "repo", "base", "head"],
      },
      execute: async (args) =>
        layers.commits.compare(github, args.owner as string, args.repo as string, args.base as string, args.head as string),
    },

    {
      name: "git_commit_push",
      description: "Commit one or more files to a branch via the GitHub Git Data API. Creates the branch first if createBranch is true.",
      inputSchema: {
        type: "object",
        properties: {
          owner:        { type: "string" },
          repo:         { type: "string" },
          branch:       { type: "string", description: "Target branch name." },
          message:      { type: "string", description: "Commit message." },
          files:        {
            type: "array",
            description: "Files to commit.",
            items: {
              type: "object",
              properties: {
                path:    { type: "string", description: "File path in repo." },
                content: { type: "string", description: "File content (UTF-8 string)." },
              },
              required: ["path", "content"],
            },
          },
          createBranch: { type: "boolean", description: "Create branch if it doesn't exist. Default: false." },
          fromBranch:   { type: "string", description: "Source branch for new branch creation." },
        },
        required: ["owner", "repo", "branch", "message", "files"],
      },
      execute: async (args) =>
        layers.commits.commitFiles(github, args.owner as string, args.repo as string, {
          branch: args.branch as string,
          message: args.message as string,
          files: args.files as { path: string; content: string }[],
          createBranch: args.createBranch as boolean | undefined,
          fromBranch: args.fromBranch as string | undefined,
        }),
    },

    // ── Branches ─────────────────────────────────────────────────────────────

    {
      name: "git_branch_list",
      description: "List branches in a repository.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo:  { type: "string" },
        },
        required: ["owner", "repo"],
      },
      execute: async (args) =>
        layers.branches.listBranches(github, args.owner as string, args.repo as string),
    },

    {
      name: "git_branch_create",
      description: "Create a new branch from an existing branch.",
      inputSchema: {
        type: "object",
        properties: {
          owner:      { type: "string" },
          repo:       { type: "string" },
          branch:     { type: "string", description: "New branch name." },
          fromBranch: { type: "string", description: "Source branch. Defaults to default branch." },
        },
        required: ["owner", "repo", "branch"],
      },
      execute: async (args) => {
        const from = args.fromBranch as string ?? await github.getDefaultBranch(args.owner as string, args.repo as string);
        return layers.branches.createBranch(github, args.owner as string, args.repo as string, args.branch as string, from);
      },
    },

    {
      name: "git_branch_delete",
      description: "Delete a branch. Will fail if the branch is protected.",
      inputSchema: {
        type: "object",
        properties: {
          owner:  { type: "string" },
          repo:   { type: "string" },
          branch: { type: "string" },
        },
        required: ["owner", "repo", "branch"],
      },
      execute: async (args) =>
        layers.branches.deleteBranch(github, args.owner as string, args.repo as string, args.branch as string),
    },

    {
      name: "git_branch_protect",
      description: "Apply branch protection rules.",
      inputSchema: {
        type: "object",
        properties: {
          owner:                { type: "string" },
          repo:                 { type: "string" },
          branch:               { type: "string" },
          requirePullRequest:   { type: "boolean", description: "Require PR before merging." },
          requiredReviewers:    { type: "number",  description: "Minimum number of approving reviews." },
          requireStatusChecks:  { type: "array", items: { type: "string" }, description: "Required status check context names." },
          enforceAdmins:        { type: "boolean", description: "Enforce rules on admins too." },
        },
        required: ["owner", "repo", "branch"],
      },
      execute: async (args) =>
        layers.branches.protectBranch(github, args.owner as string, args.repo as string, args.branch as string, {
          requirePullRequest: args.requirePullRequest as boolean | undefined,
          requiredReviewers: args.requiredReviewers as number | undefined,
          requireStatusChecks: args.requireStatusChecks as string[] | undefined,
          enforceAdmins: args.enforceAdmins as boolean | undefined,
        }),
    },

    // ── Pull requests ─────────────────────────────────────────────────────────

    {
      name: "git_pr_list",
      description: "List pull requests in a repository.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo:  { type: "string" },
          state: { type: "string", enum: ["open", "closed", "all"], description: "PR state filter. Default: open." },
        },
        required: ["owner", "repo"],
      },
      execute: async (args) =>
        layers.pulls.listPullRequests(github, args.owner as string, args.repo as string, args.state as "open" | "closed" | "all" | undefined),
    },

    {
      name: "git_pr_get",
      description: "Get full details for a pull request including files changed, labels, and review state.",
      inputSchema: {
        type: "object",
        properties: {
          owner:  { type: "string" },
          repo:   { type: "string" },
          number: { type: "number", description: "PR number." },
        },
        required: ["owner", "repo", "number"],
      },
      execute: async (args) =>
        layers.pulls.getPullRequest(github, args.owner as string, args.repo as string, args.number as number),
    },

    {
      name: "git_pr_create",
      description: "Open a pull request.",
      inputSchema: {
        type: "object",
        properties: {
          owner:  { type: "string" },
          repo:   { type: "string" },
          title:  { type: "string" },
          head:   { type: "string", description: "Source branch." },
          base:   { type: "string", description: "Target branch. Default: default branch." },
          body:   { type: "string", description: "PR description (markdown)." },
          draft:  { type: "boolean", description: "Open as draft PR. Default: false." },
          labels: { type: "array", items: { type: "string" }, description: "Labels to apply." },
        },
        required: ["owner", "repo", "title", "head"],
      },
      execute: async (args) => {
        const base = args.base as string ?? await github.getDefaultBranch(args.owner as string, args.repo as string);
        return layers.pulls.createPullRequest(github, args.owner as string, args.repo as string, {
          title: args.title as string,
          head: args.head as string,
          base,
          body: args.body as string | undefined,
          draft: args.draft as boolean | undefined,
          labels: args.labels as string[] | undefined,
        });
      },
    },

    {
      name: "git_pr_merge",
      description: "Merge a pull request.",
      inputSchema: {
        type: "object",
        properties: {
          owner:         { type: "string" },
          repo:          { type: "string" },
          number:        { type: "number", description: "PR number." },
          method:        { type: "string", enum: ["merge", "squash", "rebase"], description: "Merge method. Default: squash." },
          commitTitle:   { type: "string", description: "Custom commit title (squash/merge only)." },
          commitMessage: { type: "string", description: "Custom commit message." },
        },
        required: ["owner", "repo", "number"],
      },
      execute: async (args) =>
        layers.pulls.mergePullRequest(github, args.owner as string, args.repo as string, args.number as number, {
          method: args.method as "merge" | "squash" | "rebase" | undefined,
          commitTitle: args.commitTitle as string | undefined,
          commitMessage: args.commitMessage as string | undefined,
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
      } catch (e: unknown) {
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
