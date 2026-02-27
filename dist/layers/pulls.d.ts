/**
 * Pulls layer
 *
 * Pull request lifecycle: list, get, create, merge.
 * Effectful — creates and merges PRs on GitHub.
 *
 * Inputs:  GitHubAdapter + PR params
 * Outputs: PullRequestSummary, PullRequestDetail, MergeResult
 */
import type { GitHubAdapter, PullRequestSummary, PullRequestDetail, CreatePrOpts, MergePrOpts, MergeResult } from "../types.js";
export declare function listPullRequests(github: GitHubAdapter, owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<PullRequestSummary[]>;
export declare function getPullRequest(github: GitHubAdapter, owner: string, repo: string, number: number): Promise<PullRequestDetail>;
export declare function createPullRequest(github: GitHubAdapter, owner: string, repo: string, opts: CreatePrOpts): Promise<PullRequestSummary>;
export declare function mergePullRequest(github: GitHubAdapter, owner: string, repo: string, number: number, opts?: MergePrOpts): Promise<MergeResult>;
//# sourceMappingURL=pulls.d.ts.map