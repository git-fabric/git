/**
 * Commits layer
 *
 * Commit history and diff operations. Pure reads except for
 * commitFiles which writes to GitHub via the Git Data API.
 *
 * Inputs:  GitHubAdapter + commit params
 * Outputs: CommitSummary[], CommitDetail, CompareResult, CommitResult
 */
export async function listCommits(github, owner, repo, branch, limit = 20) {
    return github.listCommits(owner, repo, branch, limit);
}
export async function getCommit(github, owner, repo, sha) {
    return github.getCommit(owner, repo, sha);
}
export async function compare(github, owner, repo, base, head) {
    return github.compareCommits(owner, repo, base, head);
}
export async function commitFiles(github, owner, repo, opts) {
    return github.commitFiles(owner, repo, opts);
}
//# sourceMappingURL=commits.js.map