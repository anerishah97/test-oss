import { execSync } from 'child_process';

// Define the path constant
const PATH_TO_CHECK = 'folder-to-commit';

function checkFolderChanges() {
    try {
        // Get the list of changed files between HEAD and previous commit
        const diffOutput = execSync('git diff --name-only HEAD^ HEAD').toString();
        
        // Split the output into array of changed files
        const changedFiles = diffOutput.split('\n').filter(Boolean);
        
        // Check if any changed file starts with our path
        const hasChangesInPath = changedFiles.some(file => 
            file.startsWith(PATH_TO_CHECK + '/')
        );

        // return hasChangesInPath;
        return true;
    } catch (error) {
        console.error('Error checking for changes:', error);
        // In case of error (like first commit), return false
        return false;
    }
}

// Run the check and output the result in a format GHA can read
const hasChanges = checkFolderChanges();
console.log(`::set-output name=has_changes::${hasChanges}`); 