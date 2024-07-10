function escapeRegExp(string) {
    // Sanitize the string so it can be used in a regular expression
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const replaceMultipleStringsAll = async (originalString, replacements) => {
    let modifiedString = originalString;
    let notFound = [];

    // Loop through all the replacements and replace them in the string
    replacements.forEach(replacement => {
        const [newValue, searchValue] = replacement;
        while (modifiedString.includes(searchValue)) {
            // Use regex to replace all occurrences of the searchValue
            modifiedString = modifiedString.replace(searchValue, newValue);
        }
    });

    // Check if there were strings not found and handle the error
    if (notFound.length > 0) {
        throw new Error(`The following strings were not found: ${notFound.join(', ')}`);
    }

    return modifiedString;
}

const replaceMultipleStringsOneOnOne = async (originalString, replacements) => {
    let modifiedString = originalString;
    let notFound = [];

    // Loop through all the replacements and replace them in the string
    replacements.forEach(replacement => {
        const [newValue, searchValue] = replacement;
        if (modifiedString.includes(searchValue)) {
            // Use regex to replace all occurrences of the searchValue
            modifiedString = modifiedString.replace(searchValue, newValue);
        }
    });

    // Check if there were strings not found and handle the error
    if (notFound.length > 0) {
        throw new Error(`The following strings were not found: ${notFound.join(', ')}`);
    }

    return modifiedString;
}


module.exports.replaceMultipleStringsAll = replaceMultipleStringsAll;
module.exports.replaceMultipleStringsOneOnOne = replaceMultipleStringsOneOnOne;