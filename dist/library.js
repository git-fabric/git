/**
 * Library — git-based knowledge retrieval for fabric-git
 *
 * The librarian model: we know where the books are, we go fetch them
 * when asked, and we return them when done. No photocopies.
 *
 * Sources:
 *   - git/git — official Git source repository (documentation)
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
const LIBRARY_DIR = process.env.LIBRARY_DIR || '/tmp/fabric-library';
const SOURCES = [
    {
        id: 'git-doc',
        repo: 'https://github.com/git/git.git',
        branch: 'master',
        description: 'Official Git documentation — commands, concepts, workflows',
        useRawApi: true,
        topics: [
            { keywords: ['commit', 'amend', 'message', 'author', 'sign-off'],
                files: ['Documentation/git-commit.txt'],
                description: 'Creating and amending commits' },
            { keywords: ['branch', 'checkout', 'switch', 'create branch', 'delete branch'],
                files: ['Documentation/git-branch.txt', 'Documentation/git-switch.txt'],
                description: 'Branch creation, switching, and deletion' },
            { keywords: ['merge', 'conflict', 'fast-forward', 'no-ff', 'merge strategy'],
                files: ['Documentation/git-merge.txt'],
                description: 'Merging branches and resolving conflicts' },
            { keywords: ['rebase', 'interactive rebase', 'squash', 'fixup', 'autosquash'],
                files: ['Documentation/git-rebase.txt'],
                description: 'Rebasing commits — linear history, interactive editing' },
            { keywords: ['cherry-pick', 'cherry pick', 'pick commit', 'apply commit'],
                files: ['Documentation/git-cherry-pick.txt'],
                description: 'Applying individual commits from other branches' },
            { keywords: ['stash', 'save', 'pop', 'apply stash', 'shelve'],
                files: ['Documentation/git-stash.txt'],
                description: 'Temporarily shelving uncommitted changes' },
            { keywords: ['remote', 'origin', 'upstream', 'fetch', 'push', 'pull', 'clone'],
                files: ['Documentation/git-remote.txt', 'Documentation/git-fetch.txt', 'Documentation/git-push.txt'],
                description: 'Remote repository management — fetch, push, pull' },
            { keywords: ['tag', 'annotated tag', 'lightweight tag', 'release', 'version'],
                files: ['Documentation/git-tag.txt'],
                description: 'Tagging commits for releases and versions' },
            { keywords: ['log', 'history', 'show', 'reflog', 'oneline', 'graph'],
                files: ['Documentation/git-log.txt', 'Documentation/git-reflog.txt'],
                description: 'Viewing commit history and reflogs' },
            { keywords: ['diff', 'compare', 'changes', 'staged', 'patch', 'stat'],
                files: ['Documentation/git-diff.txt'],
                description: 'Comparing changes between commits, staging, and working tree' },
            { keywords: ['reset', 'soft', 'hard', 'mixed', 'undo', 'unstage', 'revert'],
                files: ['Documentation/git-reset.txt', 'Documentation/git-revert.txt'],
                description: 'Undoing changes — reset, revert, restore' },
            { keywords: ['bisect', 'binary search', 'bug', 'regression', 'find commit'],
                files: ['Documentation/git-bisect.txt'],
                description: 'Binary search for the commit that introduced a bug' },
        ],
    },
];
export class Library {
    cacheDir;
    constructor() {
        this.cacheDir = LIBRARY_DIR;
        if (!existsSync(this.cacheDir)) {
            mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    findTopics(query) {
        const q = query.toLowerCase();
        const matches = [];
        for (const source of SOURCES) {
            for (const topic of source.topics) {
                let score = 0;
                for (const kw of topic.keywords) {
                    if (q.includes(kw)) {
                        score += kw.length;
                    }
                }
                if (score > 0) {
                    matches.push({ source, topic, score });
                }
            }
        }
        return matches.sort((a, b) => b.score - a.score);
    }
    checkout(source) {
        if (source.useRawApi)
            return '';
        const localPath = join(this.cacheDir, source.id);
        if (existsSync(join(localPath, '.git'))) {
            try {
                execSync(`git -C ${localPath} pull --depth 1 --rebase 2>/dev/null || true`, {
                    timeout: 15000,
                    stdio: 'pipe',
                });
            }
            catch {
                // Stale cache is better than no cache
            }
            return localPath;
        }
        execSync(`git clone --depth 1 --branch ${source.branch} ${source.repo} ${localPath}`, { timeout: 60000, stdio: 'pipe' });
        return localPath;
    }
    readFiles(source, files) {
        if (source.useRawApi) {
            return this.readFilesFromGitHub(source, files);
        }
        const localPath = this.checkout(source);
        const sections = [];
        for (const file of files) {
            const fullPath = join(localPath, file);
            if (existsSync(fullPath)) {
                try {
                    const content = readFileSync(fullPath, 'utf-8');
                    const trimmed = content.length > 8000
                        ? content.slice(0, 8000) + '\n\n...[truncated — full source at ' + file + ']'
                        : content;
                    sections.push(`--- ${file} ---\n${trimmed}`);
                }
                catch {
                    // Skip unreadable files
                }
            }
        }
        return sections.join('\n\n');
    }
    readFilesFromGitHub(source, files) {
        const match = source.repo.match(/github\.com\/([^/]+\/[^/.]+)/);
        if (!match)
            return '';
        const ownerRepo = match[1];
        const sections = [];
        for (const file of files) {
            try {
                const url = `https://raw.githubusercontent.com/${ownerRepo}/${source.branch}/${file}`;
                const content = execSync(`curl -sf --max-time 10 "${url}"`, {
                    timeout: 12000,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    encoding: 'utf-8',
                });
                if (content) {
                    const trimmed = content.length > 8000
                        ? content.slice(0, 8000) + '\n\n...[truncated — full source at ' + file + ']'
                        : content;
                    sections.push(`--- ${file} ---\n${trimmed}`);
                }
            }
            catch {
                // Skip unavailable files
            }
        }
        return sections.join('\n\n');
    }
    async query(queryText) {
        const matches = this.findTopics(queryText);
        if (matches.length === 0)
            return null;
        const topMatches = matches.slice(0, 3);
        const seenFiles = new Set();
        const filesToRead = [];
        for (const m of topMatches) {
            for (const f of m.topic.files) {
                const key = `${m.source.id}:${f}`;
                if (!seenFiles.has(key)) {
                    seenFiles.add(key);
                    filesToRead.push({ source: m.source, file: f });
                }
            }
        }
        const capped = filesToRead.slice(0, 6);
        const bySource = new Map();
        for (const { source, file } of capped) {
            const existing = bySource.get(source.id);
            if (existing) {
                existing.files.push(file);
            }
            else {
                bySource.set(source.id, { source, files: [file] });
            }
        }
        const sections = [];
        const sources = [];
        for (const { source, files } of bySource.values()) {
            try {
                const content = this.readFiles(source, files);
                if (content) {
                    sections.push(content);
                    sources.push(...files.map(f => `${source.id}/${f}`));
                }
            }
            catch {
                // Continue with other sources
            }
        }
        if (sections.length === 0)
            return null;
        const context = sections.join('\n\n');
        const bestScore = topMatches[0].score;
        const confidence = Math.min(0.92, 0.6 + bestScore * 0.04);
        return { context, confidence, sources };
    }
    listSources() {
        return SOURCES.map(s => ({
            id: s.id,
            repo: s.repo,
            topics: s.topics.length,
            description: s.description,
        }));
    }
}
//# sourceMappingURL=library.js.map