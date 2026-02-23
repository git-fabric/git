/**
 * Pulls layer
 *
 * Pull request lifecycle: list, get, create, merge.
 * Effectful — creates and merges PRs on GitHub.
 *
 * Inputs:  GitHubAdapter + PR params
 * Outputs: PullRequestSummary, PullRequestDetail, MergeResult
 */

import type {
  GitHubAdapter,
  PullRequestSummary,
  PullRequestDetail,
  CreatePrOpts,
  MergePrOpts,
  MergeResult,
} from "../types.js";

export async function listPullRequests(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
): Promise<PullRequestSummary[]> {
  return github.listPullRequests(owner, repo, state);
}

export async function getPullRequest(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  number: number,
): Promise<PullRequestDetail> {
  return github.getPullRequest(owner, repo, number);
}

export async function createPullRequest(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  opts: CreatePrOpts,
): Promise<PullRequestSummary> {
  return github.createPullRequest(owner, repo, opts);
}

export async function mergePullRequest(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  number: number,
  opts?: MergePrOpts,
): Promise<MergeResult> {
  return github.mergePullRequest(owner, repo, number, opts);
}
