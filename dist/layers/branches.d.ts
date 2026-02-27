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
export declare function listBranches(github: GitHubAdapter, owner: string, repo: string): Promise<BranchSummary[]>;
export declare function createBranch(github: GitHubAdapter, owner: string, repo: string, branch: string, fromBranch: string): Promise<{
    owner: string;
    repo: string;
    branch: string;
    from: string;
}>;
export declare function deleteBranch(github: GitHubAdapter, owner: string, repo: string, branch: string): Promise<{
    owner: string;
    repo: string;
    branch: string;
    deleted: true;
}>;
export declare function protectBranch(github: GitHubAdapter, owner: string, repo: string, branch: string, opts?: BranchProtectionOpts): Promise<{
    owner: string;
    repo: string;
    branch: string;
    protected: true;
}>;
//# sourceMappingURL=branches.d.ts.map