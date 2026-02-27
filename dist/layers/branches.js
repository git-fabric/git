/**
 * Branches layer
 *
 * Branch lifecycle: list, create, delete, protect.
 * Effectful — creates and deletes refs on GitHub.
 *
 * Inputs:  GitHubAdapter + branch params
 * Outputs: BranchSummary[] or void
 */
export async function listBranches(github, owner, repo) {
    return github.listBranches(owner, repo);
}
export async function createBranch(github, owner, repo, branch, fromBranch) {
    await github.createBranch(owner, repo, branch, fromBranch);
    return { owner, repo, branch, from: fromBranch };
}
export async function deleteBranch(github, owner, repo, branch) {
    await github.deleteBranch(owner, repo, branch);
    return { owner, repo, branch, deleted: true };
}
export async function protectBranch(github, owner, repo, branch, opts) {
    await github.protectBranch(owner, repo, branch, opts);
    return { owner, repo, branch, protected: true };
}
//# sourceMappingURL=branches.js.map