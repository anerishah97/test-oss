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
        const filenames = filteredFiles.map(file => file.filename);
        console.log('Debug: Filenames to process:', filenames);
        
        const commitMsg = execSync('git log -1 --pretty=%B').toString().trim();
        const branchName = process.env.GITHUB_REF_NAME || 'main';

        // Fetch and checkout the correct commit
        console.log('Debug: Fetching repository');
        execSync('git fetch origin');
        execSync(`git checkout ${process.env.HEAD_COMMIT}`);
        
        // Create a temporary directory to store files
        const tempDir = `temp-${Date.now()}`;
        console.log('Debug: Creating temp directory:', tempDir);
        execSync(`mkdir -p ${tempDir}`);
        
        // Copy files to temp directory first
        filteredFiles.forEach(file => {
            console.log('Debug: Processing file:', file.filename);
            const targetDir = path.join(tempDir, path.dirname(file.filename));
            execSync(`mkdir -p "${targetDir}"`);
            execSync(`cp "${file.filename}" "${path.join(tempDir, file.filename)}"`);
        });
        
        // Create and switch to orphan branch
        const tempBranch = `temp-branch-${Date.now()}`;
        console.log('Debug: Creating temp branch:', tempBranch);
        execSync('git checkout --orphan ' + tempBranch);
        
        // Set up Git configuration
        const authorName = execSync('git log -1 --pretty=format:"%an"').toString().trim();
        const authorEmail = execSync('git log -1 --pretty=format:"%ae"').toString().trim();

        console.log('Debug: Author name:', authorName);
        console.log('Debug: Author email:', authorEmail);

        execSync(`git config user.name "${authorName}"`);
        execSync(`git config user.email "${authorEmail}"`);
        
        execSync('git rm -rf .');
        
        // Copy files back from temp directory
        filteredFiles.forEach(file => {
            const dir = path.dirname(file.filename);
            console.log('Debug: Creating directory:', dir);
            execSync(`mkdir -p "${dir}"`);
            execSync(`cp "${path.join(tempDir, file.filename)}" "${file.filename}"`);
            execSync(`git add "${file.filename}"`);
        });

        // Clean up temp directory
        execSync(`rm -rf ${tempDir}`);

        execSync(`git commit -m "${commitMsg}"`);
        
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