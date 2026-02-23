/**
 * Repos layer
 *
 * Pure read operations on repositories and files.
 * No side effects — safe to call at any frequency.
 *
 * Inputs:  GitHubAdapter + query params
 * Outputs: typed data structures
 */

import type { GitHubAdapter, RepoSummary, RepoDetail, FileContent, FileSummary } from "../types.js";

export async function listRepos(
  github: GitHubAdapter,
  org?: string,
): Promise<RepoSummary[]> {
  return github.listRepos(org);
}

export async function getRepo(
  github: GitHubAdapter,
  owner: string,
  repo: string,
): Promise<RepoDetail> {
  return github.getRepo(owner, repo);
}

export async function getFile(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<FileContent | null> {
  return github.getFileContent(owner, repo, path, ref);
}

export async function listFiles(
  github: GitHubAdapter,
  owner: string,
  repo: string,
  path?: string,
  ref?: string,
): Promise<FileSummary[]> {
  return github.listFiles(owner, repo, path, ref);
}
