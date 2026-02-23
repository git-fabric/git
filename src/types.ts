/**
 * @git-fabric/git — shared types
 *
 * Adapter interfaces decouple the layers from any specific
 * GitHub client implementation. Consumers (git-steer, k3s gateway)
 * provide concrete adapters at runtime.
 */

// ── Adapter interfaces ──────────────────────────────────────────────────────

export interface GitHubAdapter {
  token: string;

  // Repo
  listRepos(org?: string): Promise<RepoSummary[]>;
  getRepo(owner: string, repo: string): Promise<RepoDetail>;
  createRepo(org: string, name: string, opts?: CreateRepoOpts): Promise<RepoSummary>;
  deleteRepo(owner: string, repo: string): Promise<void>;

  // Files
  getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<FileContent | null>;
  listFiles(owner: string, repo: string, path?: string, ref?: string): Promise<FileSummary[]>;
  commitFiles(owner: string, repo: string, opts: CommitOpts): Promise<CommitResult>;

  // Branches
  listBranches(owner: string, repo: string): Promise<BranchSummary[]>;
  createBranch(owner: string, repo: string, branch: string, fromBranch: string): Promise<void>;
  deleteBranch(owner: string, repo: string, branch: string): Promise<void>;
  protectBranch(owner: string, repo: string, branch: string, opts?: BranchProtectionOpts): Promise<void>;
  getDefaultBranch(owner: string, repo: string): Promise<string>;

  // Pull requests
  listPullRequests(owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<PullRequestSummary[]>;
  getPullRequest(owner: string, repo: string, number: number): Promise<PullRequestDetail>;
  createPullRequest(owner: string, repo: string, opts: CreatePrOpts): Promise<PullRequestSummary>;
  mergePullRequest(owner: string, repo: string, number: number, opts?: MergePrOpts): Promise<MergeResult>;

  // Commits
  listCommits(owner: string, repo: string, branch?: string, limit?: number): Promise<CommitSummary[]>;
  getCommit(owner: string, repo: string, sha: string): Promise<CommitDetail>;
  compareCommits(owner: string, repo: string, base: string, head: string): Promise<CompareResult>;
}

// ── Repo types ──────────────────────────────────────────────────────────────

export interface RepoSummary {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description?: string;
  url: string;
  pushedAt?: string;
}

export interface RepoDetail extends RepoSummary {
  language?: string;
  topics: string[];
  starCount: number;
  forkCount: number;
  openIssuesCount: number;
  hasIssues: boolean;
  hasWiki: boolean;
  archived: boolean;
  disabled: boolean;
}

export interface CreateRepoOpts {
  description?: string;
  private?: boolean;
  autoInit?: boolean;
}

// ── File types ──────────────────────────────────────────────────────────────

export interface FileContent {
  path: string;
  content: string;
  sha: string;
  encoding: string;
  size: number;
}

export interface FileSummary {
  path: string;
  type: "file" | "dir" | "symlink";
  size?: number;
  sha: string;
}

export interface CommitOpts {
  branch: string;
  message: string;
  files: { path: string; content: string }[];
  createBranch?: boolean;
  fromBranch?: string;
}

export interface CommitResult {
  sha: string;
  url: string;
  branch: string;
}

// ── Branch types ────────────────────────────────────────────────────────────

export interface BranchSummary {
  name: string;
  sha: string;
  protected: boolean;
  lastCommitDate?: string;
}

export interface BranchProtectionOpts {
  requirePullRequest?: boolean;
  requiredReviewers?: number;
  requireStatusChecks?: string[];
  enforceAdmins?: boolean;
}

// ── Pull request types ──────────────────────────────────────────────────────

export interface PullRequestSummary {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  author: string;
  head: string;
  base: string;
  url: string;
  draft: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestDetail extends PullRequestSummary {
  body: string;
  mergeable?: boolean;
  mergeableState?: string;
  labels: string[];
  reviewers: string[];
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
}

export interface CreatePrOpts {
  title: string;
  body?: string;
  head: string;
  base: string;
  draft?: boolean;
  labels?: string[];
}

export interface MergePrOpts {
  method?: "merge" | "squash" | "rebase";
  commitTitle?: string;
  commitMessage?: string;
}

export interface MergeResult {
  merged: boolean;
  sha?: string;
  message: string;
}

// ── Commit types ────────────────────────────────────────────────────────────

export interface CommitSummary {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface CommitDetail extends CommitSummary {
  additions: number;
  deletions: number;
  changedFiles: number;
  files: { filename: string; status: string; additions: number; deletions: number }[];
}

export interface CompareResult {
  status: "ahead" | "behind" | "diverged" | "identical";
  aheadBy: number;
  behindBy: number;
  commits: CommitSummary[];
  files: { filename: string; status: string }[];
}
