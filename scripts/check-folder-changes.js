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

function checkFolderChanges(files, folderPath) {
    console.log('Debug: checkFolderChanges called with folderPath:', folderPath);
    console.log('Debug: Number of files to check:', files.length);
    
    const hasChanges = files.some(file => {
        const isInFolder = file.filename.startsWith(folderPath);
        console.log('Debug: Checking file:', file.filename, 'isInFolder:', isInFolder);
        return isInFolder;
    });

    console.log('Debug: Final result hasChanges:', hasChanges);
    return hasChanges;
}

function pushChanges(files) {
    if (files.length === 0) {
        console.log('No changes to push');
        return false;
    }

    try {
        const commitMsg = execSync('git log -1 --pretty=%B').toString().trim();
        const branchName = process.env.GITHUB_REF_NAME || 'main';

        const tempBranch = `temp-branch-${Date.now()}`;
        execSync('git checkout --orphan ' + tempBranch);
        
        execSync('git rm -rf .');
        
        files.forEach(file => {
            const dir = path.dirname(file);
            execSync(`mkdir -p "${dir}"`);
            execSync(`git show HEAD:"${file}" > "${file}"`);
            execSync(`git add "${file}"`);
        });

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
        GITHUB_BASE_REF: process.env.GITHUB_BASE_REF,
        GITHUB_HEAD_REF: process.env.GITHUB_HEAD_REF
    });

    // Parse repository information
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    console.log('Debug: Repository info:', { owner, repo });

    const files = await getChangedFiles(
        octokit,
        owner,
        repo,
        process.env.GITHUB_BASE_REF,
        process.env.GITHUB_HEAD_REF
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