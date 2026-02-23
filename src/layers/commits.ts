/**
 * Commits layer
 *
 * Commit history and diff operations. Pure reads except for
 * commitFiles which writes to GitHub via the Git Data API.
 *
 * Inputs:  GitHubAdapter + commit params
 * Outputs: CommitSummary[], CommitDetail, CompareResult, CommitResult
 */

import type {
  GitHubAdapter,
  CommitSummary,
  CommitDetail,
  CommitOpts,
  CommitResult,
  CompareResult,
} from "../types.js";

export async function listCommits(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  branch?: string,
  limit = 20,
): Promise<CommitSummary[]> {
  return github.listCommits(owner, repo, branch, limit);
}

export async function getCommit(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  sha: string,
): Promise<CommitDetail> {
  return github.getCommit(owner, repo, sha);
}

export async function compare(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<CompareResult> {
  return github.compareCommits(owner, repo, base, head);
}

export async function commitFiles(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  opts: CommitOpts,
): Promise<CommitResult> {
  return github.commitFiles(owner, repo, opts);
}
