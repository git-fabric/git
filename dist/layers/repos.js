/**
 * Repos layer
 *
 * Pure read operations on repositories and files.
 * No side effects — safe to call at any frequency.
 *
 * Inputs:  GitHubAdapter + query params
 * Outputs: typed data structures
 */
export async function listRepos(github, org) {
    return github.listRepos(org);
}
export async function getRepo(github, owner, repo) {
    return github.getRepo(owner, repo);
}
export async function getFile(github, owner, repo, path, ref) {
    return github.getFileContent(owner, repo, path, ref);
}
export async function listFiles(github, owner, repo, path, ref) {
    return github.listFiles(owner, repo, path, ref);
}
//# sourceMappingURL=repos.js.map