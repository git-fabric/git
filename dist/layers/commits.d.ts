/**
 * Commits layer
 *
 * Commit history and diff operations. Pure reads except for
 * commitFiles which writes to GitHub via the Git Data API.
 *
 * Inputs:  GitHubAdapter + commit params
 * Outputs: CommitSummary[], CommitDetail, CompareResult, CommitResult
 */
import type { GitHubAdapter, CommitSummary, CommitDetail, CommitOpts, CommitResult, CompareResult } from "../types.js";
export declare function listCommits(github: GitHubAdapter, owner: string, repo: string, branch?: string, limit?: number): Promise<CommitSummary[]>;
export declare function getCommit(github: GitHubAdapter, owner: string, repo: string, sha: string): Promise<CommitDetail>;
export declare function compare(github: GitHubAdapter, owner: string, repo: string, base: string, head: string): Promise<CompareResult>;
export declare function commitFiles(github: GitHubAdapter, owner: string, repo: string, opts: CommitOpts): Promise<CommitResult>;
//# sourceMappingURL=commits.d.ts.map