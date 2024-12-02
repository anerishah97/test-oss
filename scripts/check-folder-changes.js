const { execSync } = require('child_process');
const path = require('path');
const { Octokit } = require('@octokit/rest');

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
        // Get the latest commit message
        const commitMsg = execSync('git log -1 --pretty=%B').toString().trim();
        const branchName = process.env.GITHUB_REF_NAME || 'main';

        // Create a temporary branch for our changes
        const tempBranch = `temp-branch-${Date.now()}`;
        execSync('git checkout --orphan ' + tempBranch);
        
        // Reset the working directory
        execSync('git rm -rf .');
        
        // Copy only the changed files
        files.forEach(file => {
            const dir = path.dirname(file);
            execSync(`mkdir -p "${dir}"`);
            execSync(`git show HEAD:"${file}" > "${file}"`);
            execSync(`git add "${file}"`);
        });

        // Commit the changes with the same commit message
        execSync(`git commit -m "${commitMsg}"`);
        
        // Push to the destination with the same branch name
        execSync('git remote add destination git@github.com:anerishah97/test-oss-destination.git || true');
        execSync(`git push -f destination ${tempBranch}:${branchName}`);
        
        return true;
    } catch (error) {
        console.error('Error pushing changes:', error);
        return false;
    }
}

// Run the script
console.log('Debug: Initializing Octokit');
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
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

// New way
console.log('Debug: Starting change detection');
console.log('Debug: GITHUB_OUTPUT =', process.env.GITHUB_OUTPUT);
console.log('Debug: hasChanges =', hasChanges);

// Write the output
console.log('Debug: Setting output has_changes =', hasChanges);
console.log(`has_changes=${hasChanges}` >> process.env.GITHUB_OUTPUT);
console.log('Debug: Script completed');