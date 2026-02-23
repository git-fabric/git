/**
 * Environment adapter
 *
 * Creates a GitHubAdapter from environment variables.
 * Used by the CLI, the gateway loader, and GitHub Actions workflows.
 *
 * Required env vars:
 *   GITHUB_TOKEN or GIT_STEER_TOKEN  — GitHub API access
 *
 * Optional:
 *   GITHUB_ORG  — default org for repo operations (e.g. cortex-io)
 */

import { Octokit } from "octokit";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import type {
  GitHubAdapter,
  RepoSummary,
  RepoDetail,
  CreateRepoOpts,
  FileContent,
  FileSummary,
  CommitOpts,
  CommitResult,
  BranchSummary,
  BranchProtectionOpts,
  PullRequestSummary,
  PullRequestDetail,
  CreatePrOpts,
  MergePrOpts,
  MergeResult,
  CommitSummary,
  CommitDetail,
  CompareResult,
} from "../types.js";

const HardenedOctokit = Octokit.plugin(throttling, retry);

export function createAdapterFromEnv(): GitHubAdapter {
  const token = process.env.GITHUB_TOKEN ?? process.env.GIT_STEER_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN or GIT_STEER_TOKEN required");

  const octokit = new HardenedOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter: number, options: { method: string; url: string }, _octokit: unknown, retryCount: number) => {
        console.warn(`[@git-fabric/git] Rate limit: ${options.method} ${options.url} — retry ${retryCount + 1}/4 after ${retryAfter}s`);
        return retryCount < 4;
      },
      onSecondaryRateLimit: (retryAfter: number, options: { method: string; url: string }) => {
        console.warn(`[@git-fabric/git] Secondary rate limit: ${options.method} ${options.url} — backoff ${retryAfter}s`);
        return true;
      },
    },
    retry: { doNotRetry: ["429"] },
  });

  return {
    token,

    // ── Repos ───────────────────────────────────────────────────────────────

    async listRepos(org?: string): Promise<RepoSummary[]> {
      const target = org ?? process.env.GITHUB_ORG;
      let items: Awaited<ReturnType<typeof octokit.rest.repos.listForOrg>>["data"] | Awaited<ReturnType<typeof octokit.rest.repos.listForAuthenticatedUser>>["data"];
      if (target) {
        const { data } = await octokit.rest.repos.listForOrg({ org: target, per_page: 100 });
        items = data;
      } else {
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({ per_page: 100 });
        items = data;
      }
      return items.map((r) => ({
        owner: r.owner?.login ?? "",
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch ?? "main",
        description: r.description ?? undefined,
        url: r.html_url ?? "",
        pushedAt: r.pushed_at ?? undefined,
      }));
    },

    async getRepo(owner: string, repo: string): Promise<RepoDetail> {
      const { data: r } = await octokit.rest.repos.get({ owner, repo });
      return {
        owner: r.owner.login,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
        description: r.description ?? undefined,
        url: r.html_url,
        pushedAt: r.pushed_at ?? undefined,
        language: r.language ?? undefined,
        topics: r.topics ?? [],
        starCount: r.stargazers_count,
        forkCount: r.forks_count,
        openIssuesCount: r.open_issues_count,
        hasIssues: r.has_issues,
        hasWiki: r.has_wiki,
        archived: r.archived,
        disabled: r.disabled,
      };
    },

    async createRepo(org: string, name: string, opts?: CreateRepoOpts): Promise<RepoSummary> {
      const { data: r } = await octokit.rest.repos.createInOrg({
        org,
        name,
        description: opts?.description,
        private: opts?.private ?? false,
        auto_init: opts?.autoInit ?? true,
      });
      return {
        owner: r.owner.login,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch ?? "main",
        url: r.html_url,
      };
    },

    async deleteRepo(owner: string, repo: string): Promise<void> {
      await octokit.rest.repos.delete({ owner, repo });
    },

    // ── Files ────────────────────────────────────────────────────────────────

    async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<FileContent | null> {
      try {
        const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
        if (Array.isArray(data) || data.type !== "file") return null;
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return { path: data.path, content, sha: data.sha, encoding: "utf-8", size: data.size };
      } catch (e: unknown) {
        if ((e as { status?: number }).status === 404) return null;
        throw e;
      }
    },

    async listFiles(owner: string, repo: string, path = "", ref?: string): Promise<FileSummary[]> {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
      if (!Array.isArray(data)) return [];
      return data.map((f) => ({
        path: f.path,
        type: f.type as "file" | "dir" | "symlink",
        size: f.size ?? undefined,
        sha: f.sha ?? "",
      }));
    },

    async commitFiles(owner: string, repo: string, opts: CommitOpts): Promise<CommitResult> {
      // Get the base branch SHA
      const baseBranch = opts.fromBranch ?? opts.branch;
      const { data: baseRef } = await octokit.rest.git.getRef({
        owner, repo, ref: `heads/${baseBranch}`,
      });
      const baseSha = baseRef.object.sha;

      // Create branch if requested
      if (opts.createBranch && opts.branch !== baseBranch) {
        await octokit.rest.git.createRef({
          owner, repo,
          ref: `refs/heads/${opts.branch}`,
          sha: baseSha,
        });
      }

      // Get base tree SHA
      const { data: baseCommit } = await octokit.rest.git.getCommit({ owner, repo, commit_sha: baseSha });
      const baseTreeSha = baseCommit.tree.sha;

      // Create blobs
      const blobs = await Promise.all(
        opts.files.map((f) =>
          octokit.rest.git.createBlob({
            owner, repo,
            content: Buffer.from(f.content).toString("base64"),
            encoding: "base64",
          }).then((r) => ({ path: f.path, sha: r.data.sha }))
        )
      );

      // Create tree
      const { data: tree } = await octokit.rest.git.createTree({
        owner, repo,
        base_tree: baseTreeSha,
        tree: blobs.map((b) => ({
          path: b.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: b.sha,
        })),
      });

      // Create commit
      const { data: commit } = await octokit.rest.git.createCommit({
        owner, repo,
        message: opts.message,
        tree: tree.sha,
        parents: [baseSha],
      });

      // Update branch ref
      await octokit.rest.git.updateRef({
        owner, repo,
        ref: `heads/${opts.branch}`,
        sha: commit.sha,
      });

      return { sha: commit.sha, url: commit.url, branch: opts.branch };
    },

    // ── Branches ─────────────────────────────────────────────────────────────

    async listBranches(owner: string, repo: string): Promise<BranchSummary[]> {
      const { data } = await octokit.rest.repos.listBranches({ owner, repo, per_page: 100 });
      return data.map((b) => ({
        name: b.name,
        sha: b.commit.sha,
        protected: b.protected,
      }));
    },

    async createBranch(owner: string, repo: string, branch: string, fromBranch: string): Promise<void> {
      const { data: ref } = await octokit.rest.git.getRef({
        owner, repo, ref: `heads/${fromBranch}`,
      });
      await octokit.rest.git.createRef({
        owner, repo,
        ref: `refs/heads/${branch}`,
        sha: ref.object.sha,
      });
    },

    async deleteBranch(owner: string, repo: string, branch: string): Promise<void> {
      await octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${branch}` });
    },

    async protectBranch(owner: string, repo: string, branch: string, opts?: BranchProtectionOpts): Promise<void> {
      await octokit.rest.repos.updateBranchProtection({
        owner, repo, branch,
        required_status_checks: opts?.requireStatusChecks
          ? { strict: true, contexts: opts.requireStatusChecks }
          : null,
        enforce_admins: opts?.enforceAdmins ?? false,
        required_pull_request_reviews: opts?.requirePullRequest
          ? { required_approving_review_count: opts.requiredReviewers ?? 1 }
          : null,
        restrictions: null,
      });
    },

    async getDefaultBranch(owner: string, repo: string): Promise<string> {
      const { data } = await octokit.rest.repos.get({ owner, repo });
      return data.default_branch;
    },

    // ── Pull requests ─────────────────────────────────────────────────────────

    async listPullRequests(owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<PullRequestSummary[]> {
      const { data } = await octokit.rest.pulls.list({ owner, repo, state, per_page: 50 });
      return data.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? "merged" : pr.state as "open" | "closed",
        author: pr.user?.login ?? "",
        head: pr.head.ref,
        base: pr.base.ref,
        url: pr.html_url,
        draft: pr.draft ?? false,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
      }));
    },

    async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequestDetail> {
      const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: number });
      return {
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? "merged" : pr.state as "open" | "closed",
        author: pr.user?.login ?? "",
        head: pr.head.ref,
        base: pr.base.ref,
        url: pr.html_url,
        draft: pr.draft ?? false,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        body: pr.body ?? "",
        mergeable: pr.mergeable ?? undefined,
        mergeableState: pr.mergeable_state ?? undefined,
        labels: pr.labels.map((l) => l.name),
        reviewers: pr.requested_reviewers?.map((r) => r.login) ?? [],
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        commits: pr.commits,
      };
    },

    async createPullRequest(owner: string, repo: string, opts: CreatePrOpts): Promise<PullRequestSummary> {
      const { data: pr } = await octokit.rest.pulls.create({
        owner, repo,
        title: opts.title,
        body: opts.body ?? "",
        head: opts.head,
        base: opts.base,
        draft: opts.draft ?? false,
      });
      if (opts.labels?.length) {
        await octokit.rest.issues.addLabels({
          owner, repo,
          issue_number: pr.number,
          labels: opts.labels,
        });
      }
      return {
        number: pr.number,
        title: pr.title,
        state: pr.state as "open" | "closed",
        author: pr.user?.login ?? "",
        head: pr.head.ref,
        base: pr.base.ref,
        url: pr.html_url,
        draft: pr.draft ?? false,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
      };
    },

    async mergePullRequest(owner: string, repo: string, number: number, opts?: MergePrOpts): Promise<MergeResult> {
      const { data } = await octokit.rest.pulls.merge({
        owner, repo,
        pull_number: number,
        merge_method: opts?.method ?? "squash",
        commit_title: opts?.commitTitle,
        commit_message: opts?.commitMessage,
      });
      return { merged: data.merged, sha: data.sha ?? undefined, message: data.message };
    },

    // ── Commits ───────────────────────────────────────────────────────────────

    async listCommits(owner: string, repo: string, branch?: string, limit = 20): Promise<CommitSummary[]> {
      const { data } = await octokit.rest.repos.listCommits({
        owner, repo, sha: branch, per_page: limit,
      });
      return data.map((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 8),
        message: c.commit.message.split("\n")[0],
        author: c.commit.author?.name ?? c.author?.login ?? "",
        date: c.commit.author?.date ?? "",
        url: c.html_url,
      }));
    },

    async getCommit(owner: string, repo: string, sha: string): Promise<CommitDetail> {
      const { data: c } = await octokit.rest.repos.getCommit({ owner, repo, ref: sha });
      return {
        sha: c.sha,
        shortSha: c.sha.slice(0, 8),
        message: c.commit.message.split("\n")[0],
        author: c.commit.author?.name ?? c.author?.login ?? "",
        date: c.commit.author?.date ?? "",
        url: c.html_url,
        additions: c.stats?.additions ?? 0,
        deletions: c.stats?.deletions ?? 0,
        changedFiles: c.files?.length ?? 0,
        files: (c.files ?? []).map((f) => ({
          filename: f.filename ?? "",
          status: f.status ?? "",
          additions: f.additions,
          deletions: f.deletions,
        })),
      };
    },

    async compareCommits(owner: string, repo: string, base: string, head: string): Promise<CompareResult> {
      const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
        owner, repo,
        basehead: `${base}...${head}`,
        per_page: 50,
      });
      return {
        status: data.status as "ahead" | "behind" | "diverged" | "identical",
        aheadBy: data.ahead_by,
        behindBy: data.behind_by,
        commits: data.commits.map((c) => ({
          sha: c.sha,
          shortSha: c.sha.slice(0, 8),
          message: c.commit.message.split("\n")[0],
          author: c.commit.author?.name ?? c.author?.login ?? "",
          date: c.commit.author?.date ?? "",
          url: c.html_url,
        })),
        files: (data.files ?? []).map((f) => ({
          filename: f.filename,
          status: f.status,
        })),
      };
    },
  };
}
