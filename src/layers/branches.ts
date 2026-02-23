/**
 * Branches layer
 *
 * Branch lifecycle: list, create, delete, protect.
 * Effectful — creates and deletes refs on GitHub.
 *
 * Inputs:  GitHubAdapter + branch params
 * Outputs: BranchSummary[] or void
 */

import type { GitHubAdapter, BranchSummary, BranchProtectionOpts } from "../types.js";

export async function listBranches(
  github: GitHubAdapter,
  owner: string,
  repo: string,
): Promise<BranchSummary[]> {
  return github.listBranches(owner, repo);
}

export async function createBranch(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  branch: string,
  fromBranch: string,
): Promise<{ owner: string; repo: string; branch: string; from: string }> {
  await github.createBranch(owner, repo, branch, fromBranch);
  return { owner, repo, branch, from: fromBranch };
}

export async function deleteBranch(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  branch: string,
): Promise<{ owner: string; repo: string; branch: string; deleted: true }> {
  await github.deleteBranch(owner, repo, branch);
  return { owner, repo, branch, deleted: true };
}

export async function protectBranch(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  branch: string,
  opts?: BranchProtectionOpts,
): Promise<{ owner: string; repo: string; branch: string; protected: true }> {
  await github.protectBranch(owner, repo, branch, opts);
  return { owner, repo, branch, protected: true };
}
