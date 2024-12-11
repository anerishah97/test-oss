import { execSync } from 'child_process';
import path from 'path';
import { Octokit } from '@octokit/rest';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the path constant
const PATH_TO_CHECK = 'folder-to-commit';

async function getChangedFiles(octokit, owner, repo, base, head) {
    console.log('Debug: getChangedFiles called with:', { owner, repo, base, head });
    try {
        const response = await octokit.rest.repos.compareCommits({
            owner,
            repo,
            base,
            head,
        });
        console.log('Debug: Got response from GitHub API');
        console.log('Debug: Number of files changed:', response.data.files.length);
        return response.data.files;
    } catch (error) {
        console.error('Debug: Error in getChangedFiles:', error);
        throw error;
    }
}

function pushChanges(files) {
    if (files.length === 0) {
        console.log('No changes to push');
        return false;
    }

    try {
        // Filter files to only include those starting with PATH_TO_CHECK
        const filteredFiles = files.filter(file => file.filename.startsWith(PATH_TO_CHECK));
        if (filteredFiles.length === 0) {
            console.log('No relevant files to push');
            return false;
        }

        const filenames = filteredFiles.map(file => file.filename);
        console.log('Debug: Filenames to process:', filenames);
        
        const commitMsg = execSync('git log -1 --pretty=%B').toString().trim();
        const branchName = process.env.GITHUB_REF_NAME || 'main';

        // Set up Git configuration
        const authorName = execSync('git log -1 --pretty=format:"%an"').toString().trim();
        const authorEmail = execSync('git log -1 --pretty=format:"%ae"').toString().trim();

        // Fetch and checkout the correct commit
        console.log('Debug: Fetching repository');
        execSync('git fetch origin');
        execSync(`git checkout ${process.env.HEAD_COMMIT}`);
        
        // Create and switch to a new branch from the current HEAD
        const tempBranch = `temp-branch-${Date.now()}`;
        console.log('Debug: Creating temp branch:', tempBranch);
        execSync(`git checkout -b ${tempBranch}`);

        execSync(`git config user.name "${authorName}"`);
        execSync(`git config user.email "${authorEmail}"`);
        
        // Create all necessary directories at once
        const uniqueDirs = [...new Set(filteredFiles.map(file => path.dirname(file.filename)))];
        uniqueDirs.forEach(dir => {
            console.log('Debug: Creating directory:', dir);
            execSync(`mkdir -p "${dir}"`);
        });
        
        // Add files to git
        filteredFiles.forEach(file => {
            console.log('Debug: Adding file:', file.filename);
            execSync(`git add "${file.filename}"`);
        });

        // Add error checking and logging before commit
        try {
            // Check if there are files to commit
            const status = execSync('git status --porcelain').toString();
            if (!status.trim()) {
                console.log('No files to commit');
                return false;
            }

            // If there are files, proceed with commit
            execSync(`git commit -m "${commitMsg}"`);
        } catch (error) {
            console.error('Commit failed:', error.stdout?.toString());
            throw error;
        }
        
        execSync('git remote add destination git@github.com:anerishah97/test-oss-destination.git || true');
        execSync(`git push -f destination ${tempBranch}:${branchName}`);
        
        return true;
    } catch (error) {
        console.error('Error pushing changes:', error);
        return false;
    }
}

// Wrap the execution code in an async function
async function main() {
    console.log('Debug: Initializing Octokit');
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
    });

    // Debugging: Log environment variables
    console.log('Debug: Environment Variables:', {
        BASE_COMMIT: process.env.BASE_COMMIT,
        HEAD_COMMIT: process.env.HEAD_COMMIT
    });

    // Parse repository information
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    console.log('Debug: Repository info:', { owner, repo });

    const files = await getChangedFiles(
        octokit,
        owner,
        repo,
        process.env.BASE_COMMIT,
        process.env.HEAD_COMMIT
    );

    const hasChanges = files.length > 0;
    console.log('Has changes in path:', hasChanges);

    if (hasChanges) {
        const pushed = pushChanges(files);
        console.log('Changes pushed successfully:', pushed);
    }

    // Output handling
    console.log('Debug: Starting change detection');
    console.log('Debug: GITHUB_OUTPUT =', process.env.GITHUB_OUTPUT);
    console.log('Debug: hasChanges =', hasChanges);
    console.log('Debug: Setting output has_changes =', hasChanges);
    console.log(`has_changes=${hasChanges}` >> process.env.GITHUB_OUTPUT);
    console.log('Debug: Script completed');
}

// Call the main function
main().catch(error => {
    console.error('Error in main:', error);
    process.exit(1);
});