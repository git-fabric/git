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
export declare function listRepos(github: GitHubAdapter, org?: string): Promise<RepoSummary[]>;
export declare function getRepo(github: GitHubAdapter, owner: string, repo: string): Promise<RepoDetail>;
export declare function getFile(github: GitHubAdapter, owner: string, repo: string, path: string, ref?: string): Promise<FileContent | null>;
export declare function listFiles(github: GitHubAdapter, owner: string, repo: string, path?: string, ref?: string): Promise<FileSummary[]>;
//# sourceMappingURL=repos.d.ts.map