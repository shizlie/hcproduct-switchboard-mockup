// TODO: metadata only has 1 meta: timestamp. May include more and optimize EFS for persistent cache.

const fs = require("fs").promises;
const path = require("path");

const cacheDir = "/tmp/api-cache";
const cacheExpiration = 5 * 60 * 1000; // 5 minutes in milliseconds

const metadataCache = new Map();

async function getCachedApiData(supabase, apiId) {
    const cacheKey = `api-${apiId}`;
    const metadataPath = path.join(cacheDir, `${apiId}-metadata.json`);
    const dataPath = path.join(cacheDir, `${apiId}-data.json`);

    try {
        // Check if metadata exists and is valid
        const metadata = await getMetadata(metadataPath, cacheKey);
        if (metadata && Date.now() - metadata.timestamp < cacheExpiration) {
            console.log(`Cache hit for API ${apiId}`);
            return JSON.parse(await fs.readFile(dataPath, "utf8"));
        }

        console.log(`Cache miss for API ${apiId}, downloading data`);

        // Ensure cache directory exists
        await fs.mkdir(cacheDir, { recursive: true });

        // Fetch new data
        const { data, error } = await supabase.storage
            .from("api-data")
            .download(`${apiId}/data.json`);
        if (error) throw error;

        const jsonData = JSON.parse(await data.text());

        // Write data to file
        await fs.writeFile(dataPath, JSON.stringify(jsonData));

        // Update metadata
        await updateMetadata(metadataPath, cacheKey);

        return jsonData;
    } catch (error) {
        console.error(`Error fetching or caching data for API ${apiId}:`, error);
        throw new Error("Failed to fetch API data");
    }
}

async function getMetadata(metadataPath, cacheKey) {
    try {
        // Check in-memory cache first
        if (metadataCache.has(cacheKey)) {
            return metadataCache.get(cacheKey);
        }

        // If not in memory, try to read from file
        const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
        metadataCache.set(cacheKey, metadata);
        return metadata;
    } catch {
        // If file doesn't exist or is invalid, return null
        return null;
    }
}

async function updateMetadata(metadataPath, cacheKey) {
    const metadata = { timestamp: Date.now() };
    await fs.writeFile(metadataPath, JSON.stringify(metadata));
    metadataCache.set(cacheKey, metadata);
}

module.exports = { getCachedApiData };