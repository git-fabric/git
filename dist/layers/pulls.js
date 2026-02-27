/**
 * Pulls layer
 *
 * Pull request lifecycle: list, get, create, merge.
 * Effectful — creates and merges PRs on GitHub.
 *
 * Inputs:  GitHubAdapter + PR params
 * Outputs: PullRequestSummary, PullRequestDetail, MergeResult
 */
export async function listPullRequests(github, owner, repo, state = "open") {
    return github.listPullRequests(owner, repo, state);
}
export async function getPullRequest(github, owner, repo, number) {
    return github.getPullRequest(owner, repo, number);
}
export async function createPullRequest(github, owner, repo, opts) {
    return github.createPullRequest(owner, repo, opts);
}
export async function mergePullRequest(github, owner, repo, number, opts) {
    return github.mergePullRequest(owner, repo, number, opts);
}
//# sourceMappingURL=pulls.js.map