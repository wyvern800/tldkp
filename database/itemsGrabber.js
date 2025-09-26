/**
 * Items Grabber Module
 * 
 * This module handles fetching item data from QuestLog.gg API and managing
 * a local database of items for the Throne and Liberty DKP bot.
 * 
 * Features:
 * - API-based item fetching with retry logic
 * - Local JSON database for faster searches
 * - Incremental updates to avoid re-fetching existing data
 * - Icon path transformation for CDN compatibility
 * - Comprehensive error handling and logging
 */

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Logger } from "../utils/logger.js";

// ES Module compatibility - get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// QuestLog.gg API configuration
const baseURL = "https://questlog.gg/throne-and-liberty/api/trpc/database.getItems";

// Default search parameters for API calls
const language = "en";        // Language for item names/descriptions
const mainCategory = "";      // Empty = search all categories
const subCategory = "";       // Empty = search all subcategories

/**
 * Configured Axios client for QuestLog.gg API requests
 * 
 * Includes proper headers to mimic a real browser request and avoid
 * being blocked by the API's anti-bot measures.
 */
const apiClient = axios.create({
  timeout: 10000,  // 10 second timeout for requests
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Referer': 'https://questlog.gg/',
    'Origin': 'https://questlog.gg',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
  }
});

/**
 * Request interceptor - logs outgoing API requests
 * Useful for debugging and monitoring API usage
 */
apiClient.interceptors.request.use(
  (config) => {
    new Logger().log('itemsGrabber', `Making request to: ${config.url}`);
    return config;
  },
  (error) => {
    new Logger().error('itemsGrabber', `Request error: ${error.message}`);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - handles API responses
 * Currently just passes through, but can be used for response validation
 */
apiClient.interceptors.response.use(
  (response) => {
    //new Logger().log('itemsGrabber', `Response received: ${response.status}`);
    return response;
  },
  (error) => {
    //new Logger().error('itemsGrabber', `Response error: ${error.response?.status} - ${error.message}`);
    return Promise.reject(error);
  }
);

/**
 * Transform icon path to use QuestLog.gg CDN
 * 
 * Converts relative icon paths from the API to full CDN URLs
 * and ensures they use the .webp format for better performance.
 * 
 * @param {string} iconPath - The relative icon path from the API
 * @returns {string} - Full CDN URL with .webp extension
 * 
 * @example
 * // Input: "/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Bow_00001.png"
 * // Output: "https://cdn.questlog.gg/throne-and-liberty/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Bow_00001.webp"
 */
const transformIconPath = (iconPath) => {
  const baseCDN = "https://cdn.questlog.gg/throne-and-liberty";

  const dirname = path.dirname(iconPath);
  const basename = path.basename(iconPath).split(".")[0];

  return `${baseCDN}${dirname}/${basename}.webp`;
};

/**
 * Retry function with exponential backoff
 * 
 * Implements a robust retry mechanism for API calls that may fail due to
 * network issues, rate limiting, or temporary server problems.
 * 
 * @param {Function} fn - The async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @returns {Promise} - Result of the function or throws the last error
 * 
 * @example
 * // Will retry up to 3 times with delays: 1000ms, 2000ms, 4000ms
 * const result = await retryRequest(() => apiClient.get('/items'));
 */
const retryRequest = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: delay increases with each attempt
      const delay = baseDelay * Math.pow(2, attempt - 1);
      new Logger().log('itemsGrabber', `Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Search for items using the QuestLog.gg API
 * 
 * This function makes a live API call to search for items by name.
 * It's used as a fallback when local search fails or for real-time
 * item validation during auction creation.
 * 
 * @param {string} itemName - The item name to search for
 * @returns {Promise<Array>} - Array of matching items with transformed icon paths
 * 
 * @example
 * const items = await searchItem("Mystwood Longbow");
 * console.log(items[0].name); // "Mystwood Longbow"
 * console.log(items[0].icon); // "https://cdn.questlog.gg/..."
 */
export const searchItem = async (itemName) => {
  // Build search parameters for the API
  const inputSearch = {
    language,        // "en" - English language
    page: 1,         // First page of results
    mainCategory,    // "" - All categories
    subCategory,     // "" - All subcategories
    searchTerm: itemName?.toLowerCase()  // Convert to lowercase for better matching
  }

  // Encode the search parameters for the URL
  const inputParam = encodeURIComponent(JSON.stringify(inputSearch));
  const url = `${baseURL}?input=${inputParam}`;

  new Logger().log('itemsGrabber', `Searching for item: ${itemName}`);

  try {
    // Make the API request with retry logic
    const response = await retryRequest(async () => {
      return await apiClient.get(url);
    });

    // Check if the response contains valid data
    if (response.data && response.data.result && response.data.result.data) {
      const result = response.data.result.data.pageData;
      
      // Transform icon paths for all items
      const formatted = result.map((item) => {
        if (item.icon) {
          item.icon = transformIconPath(item.icon);
        }
        return item;
      });
      
      new Logger().log('itemsGrabber', `Found ${formatted.length} items for: ${itemName}`);
      return formatted;
    } else {
      new Logger().log('itemsGrabber', `No data found for: ${itemName}`);
      return [];
    }
  } catch (error) {
    new Logger().error('itemsGrabber', `Error searching item ${itemName}: ${error.message}`);
    return [];
  }
}

/**
 * Search for items in the local questlogItems.json database
 * 
 * This is the preferred method for item searches as it's much faster
 * and more reliable than API calls. It searches through the locally
 * cached item database that gets updated periodically.
 * 
 * @param {string} itemName - The item name to search for
 * @returns {Array} Array of matching items sorted by relevance
 * 
 * @example
 * const items = searchLocalItems("bow");
 * // Returns all items containing "bow" in their name, sorted by relevance
 * 
 * @example
 * const items = searchLocalItems("Mystwood Longbow");
 * // Returns exact match first, then any partial matches
 */
export const searchLocalItems = (itemName) => {
  try {
    // Construct path to the local items database
    const questlogItemsPath = path.join(__dirname, 'data', 'questlogItems.json');
    
    // Check if the local database file exists
    if (!fs.existsSync(questlogItemsPath)) {
      new Logger().log('itemsGrabber', 'questlogItems.json not found, falling back to API search');
      return [];
    }

    // Read and parse the local items database
    const itemsData = JSON.parse(fs.readFileSync(questlogItemsPath, 'utf8'));
    
    // Validate that the data is in the expected format
    if (!Array.isArray(itemsData)) {
      new Logger().log('itemsGrabber', 'questlogItems.json is not a valid array, falling back to API search');
      return [];
    }

    // Normalize the search term
    const searchTerm = itemName?.toLowerCase()?.trim();
    if (!searchTerm) {
      return [];
    }

    // Filter items that match the search term (case-insensitive)
    const matchingItems = itemsData.filter(item => {
      if (!item.name) return false;
      return item.name.toLowerCase().includes(searchTerm);
    });

    // Sort by relevance for better user experience:
    // 1. Exact matches first
    // 2. Items that start with the search term
    // 3. Alphabetical order for everything else
    const sortedItems = matchingItems.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      if (aName === searchTerm) return -1;        // Exact match first
      if (bName === searchTerm) return 1;         // Exact match first
      if (aName.startsWith(searchTerm)) return -1; // Starts with term
      if (bName.startsWith(searchTerm)) return 1;  // Starts with term
      
      return aName.localeCompare(bName);          // Alphabetical order
    });

    // Transform icon paths to use CDN URLs
    const formatted = sortedItems.map((item) => {
      if (item.icon) {
        item.icon = transformIconPath(item.icon);
      }
      return item;
    });

    new Logger().log('itemsGrabber', `Found ${formatted.length} local items for: ${itemName}`);
    return formatted;

  } catch (error) {
    new Logger().error('itemsGrabber', `Error searching local items ${itemName}: ${error.message}`);
    return [];
  }
}

/**
 * Fetch a single page of items from the QuestLog.gg API
 * 
 * This is a helper function used by the main data fetching functions.
 * It handles the API call for a specific page and returns the structured data.
 * 
 * @param {number} page - The page number to fetch (1-based)
 * @returns {Promise<Object>} - Object containing pageData, pageCount, and currentPage
 * 
 * @example
 * const result = await fetchPage(1);
 * console.log(result.pageData.length); // Number of items on this page
 * console.log(result.pageCount);       // Total number of pages available
 */
const fetchPage = async (page) => {
  // Build the input parameters for the API call
  const input = {
    language,        // "en" - English language
    page,            // The specific page to fetch
    mainCategory,    // "" - All categories
    subCategory,     // "" - All subcategories
  };

  // Encode parameters and build the full URL
  const inputParam = encodeURIComponent(JSON.stringify(input));
  const url = `${baseURL}?input=${inputParam}`;

  new Logger().log('itemsGrabber', `Fetching page ${page}`);

  try {
    // Make the API request with retry logic
    const response = await retryRequest(async () => {
      return await apiClient.get(url);
    });

    // Validate and extract the response data
    if (response.data && response.data.result && response.data.result.data) {
      const { pageData, pageCount, currentPage } = response.data.result.data;
      new Logger().log('itemsGrabber', `Successfully fetched page ${page}: ${pageData.length} items`);
      return { pageData, pageCount, currentPage };
    } else {
      new Logger().log('itemsGrabber', `Invalid response structure for page ${page}`);
      return { pageData: [], pageCount: 0, currentPage: page };
    }
  } catch (error) {
    new Logger().error('itemsGrabber', `Error fetching page ${page}: ${error.message}`);
    return { pageData: [], pageCount: 0, currentPage: page };
  }
};

/**
 * Main function for fetching all items from QuestLog.gg API
 * 
 * This function performs a complete fetch of all available items from the API.
 * It's used for initial setup or when you need to refresh the entire database.
 * 
 * Process:
 * 1. Fetches the first page to determine total page count
 * 2. Fetches all remaining pages with rate limiting
 * 3. Transforms icon paths for all items
 * 4. Saves data to both JSON and JS formats
 * 5. Saves metadata about the fetch operation
 * 
 * @returns {Promise<Object>} - Result object with success status and statistics
 * 
 * @example
 * const result = await main();
 * if (result.success) {
 *   console.log(`Fetched ${result.stats.total} items`);
 * }
 */
export const main = async () => {
  new Logger().log('itemsGrabber', "Starting data fetch...");
  let allItems = [];
  let successCount = 0;
  let errorCount = 0;

  try {
    // Fetch the first page to get total page count
    const firstPage = await fetchPage(1);
    allItems = allItems.concat(firstPage.pageData);
    successCount++;

    const pageCount = firstPage.pageCount || 1;
    new Logger().log('itemsGrabber', `Total pages to fetch: ${pageCount}`);

    // Fetch ALL pages - no limit
    const maxPages = pageCount;

    // Fetch remaining pages with error handling and rate limiting
    for (let page = 2; page <= maxPages; page++) {
      try {
        const pageResult = await fetchPage(page);
        allItems = allItems.concat(pageResult.pageData);
        successCount++;
        new Logger().log('itemsGrabber', `Page ${page} of ${maxPages} fetched successfully.`);

        // Rate limiting: 1 second delay between requests to be respectful to the API
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        errorCount++;
        new Logger().error('itemsGrabber', `Failed to fetch page ${page}: ${error.message}`);
        
        // Stop fetching if we get too many errors (safety mechanism)
        if (errorCount > 5) {
          new Logger().log('itemsGrabber', 'Too many errors, stopping fetch process');
          break;
        }
      }
    }

    // Transform icon paths for all items to use CDN URLs
    allItems = allItems.map((item) => {
      if (item.icon) {
        item.icon = transformIconPath(item.icon);
      }
      return item;
    });

    new Logger().log('itemsGrabber', `Writing ${allItems.length} items to file...`);
    const fileContent = `export const main = ${JSON.stringify(allItems, null, 2)};`;
    
    // Save to JSON format (primary format)
    const jsonSaved = saveItemsToJson(allItems);
    
    // Save to JS format (legacy compatibility for existing code)
    fs.writeFile('allItems.js', fileContent, (err) => {
      if (err) {
        new Logger().error('itemsGrabber', `Error writing to allItems.js: ${err.message}`);
      } else {
        new Logger().log('itemsGrabber', `Success! ${allItems.length} items saved to allItems.js`);
        new Logger().log('itemsGrabber', `Stats: ${successCount} successful pages, ${errorCount} errors`);
      }
    });

    // Save metadata about this fetch operation
    const metadata = {
      lastUpdate: new Date().toISOString(),
      lastItemId: allItems[allItems.length - 1]?.id || null,
      totalItems: allItems.length,
      pagesChecked: maxPages
    };
    saveUpdateMetadata(metadata);

    return {
      success: true,
      stats: {
        added: allItems.length,
        updated: 0,
        unchanged: 0,
        total: allItems.length
      },
      jsonSaved
    };
  } catch (error) {
    new Logger().error('itemsGrabber', `Fatal error in main function: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

// Function to load existing items from JSON file
const loadExistingItems = () => {
  try {
    const dataPath = path.join(process.cwd(), 'database', 'data', 'questlogItems.json');
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    new Logger().error('itemsGrabber', `Error loading existing items: ${error.message}`);
  }
  return [];
};

// Function to load metadata about last update
const loadLastUpdateMetadata = () => {
  try {
    const metadataPath = path.join(process.cwd(), 'database', 'data', 'updateMetadata.json');
    if (fs.existsSync(metadataPath)) {
      const data = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    new Logger().error('itemsGrabber', `Error loading update metadata: ${error.message}`);
  }
  return {
    lastUpdate: null,
    lastItemId: null,
    totalItems: 0
  };
};

// Function to save update metadata
const saveUpdateMetadata = (metadata) => {
  try {
    const dataDir = path.join(process.cwd(), 'database', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const metadataPath = path.join(dataDir, 'updateMetadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    new Logger().log('itemsGrabber', `Update metadata saved: ${metadataPath}`);
    return true;
  } catch (error) {
    new Logger().error('itemsGrabber', `Error saving update metadata: ${error.message}`);
    return false;
  }
};

// Function to save items to JSON file
const saveItemsToJson = (items) => {
  try {
    const dataDir = path.join(process.cwd(), 'database', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, 'questlogItems.json');
    const data = JSON.stringify(items, null, 2);
    fs.writeFileSync(filePath, data);
    new Logger().log('itemsGrabber', `Items saved to JSON: ${filePath}`);
    return true;
  } catch (error) {
    new Logger().error('itemsGrabber', `Error saving items to JSON: ${error.message}`);
    return false;
  }
};

// Function to compare and merge items
const compareAndMergeItems = (newItems, existingItems) => {
  const existingMap = new Map();
  existingItems.forEach(item => {
    existingMap.set(item.id, item);
  });

  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  const mergedItems = [...existingItems];

  newItems.forEach(newItem => {
    const existingItem = existingMap.get(newItem.id);
    
    if (!existingItem) {
      // New item - add it
      mergedItems.push(newItem);
      addedCount++;
    } else {
      // Check if item has been updated
      const isUpdated = JSON.stringify(existingItem) !== JSON.stringify(newItem);
      if (isUpdated) {
        const index = mergedItems.findIndex(item => item.id === newItem.id);
        if (index !== -1) {
          mergedItems[index] = newItem;
          updatedCount++;
        }
      } else {
        unchangedCount++;
      }
    }
  });

  return {
    items: mergedItems,
    stats: {
      added: addedCount,
      updated: updatedCount,
      unchanged: unchangedCount,
      total: mergedItems.length
    }
  };
};

// Function to fetch only new items (incremental update)
const fetchNewItemsOnly = async (existingItems, lastMetadata) => {
  new Logger().log('itemsGrabber', "Starting incremental update - fetching only new items...");
  
  const existingIds = new Set(existingItems.map(item => item.id));
  const newItems = [];
  let currentPage = 1;
  let foundExistingItem = false;
  let maxPages = 1;
  let successCount = 0;
  let errorCount = 0;

  try {
    // Start from page 1 and continue until we find items we already have
    while (currentPage <= 50 && !foundExistingItem) { // Limit to 50 pages max for safety
      try {
        const pageResult = await fetchPage(currentPage);
        const pageData = pageResult.pageData || [];
        maxPages = pageResult.pageCount || maxPages;
        
        new Logger().log('itemsGrabber', `Checking page ${currentPage}: ${pageData.length} items`);
        
        // Check each item in this page
        for (const item of pageData) {
          if (existingIds.has(item.id)) {
            // Found an item we already have - stop fetching
            foundExistingItem = true;
            new Logger().log('itemsGrabber', `Found existing item ${item.id} on page ${currentPage}, stopping fetch`);
            break;
          } else {
            // This is a new item
            newItems.push(item);
          }
        }
        
        successCount++;
        
        // If we found new items on this page, continue to next page
        if (pageData.length > 0 && !foundExistingItem) {
          currentPage++;
          // Small delay between pages
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          break;
        }
        
      } catch (error) {
        errorCount++;
        new Logger().error('itemsGrabber', `Failed to fetch page ${currentPage}: ${error.message}`);
        
        if (errorCount > 3) {
          new Logger().log('itemsGrabber', 'Too many errors, stopping incremental fetch');
          break;
        }
        currentPage++;
      }
    }

    new Logger().log('itemsGrabber', `Incremental fetch completed: ${newItems.length} new items found`);
    return {
      newItems,
      successCount,
      errorCount,
      pagesChecked: currentPage - 1
    };
  } catch (error) {
    new Logger().error('itemsGrabber', `Error in incremental fetch: ${error.message}`);
    return {
      newItems: [],
      successCount: 0,
      errorCount: 1,
      pagesChecked: 0
    };
  }
};

// Enhanced main function with incremental updates
export const mainWithComparison = async () => {
  new Logger().log('itemsGrabber', "Starting incremental data fetch...");
  
  // Load existing items and metadata
  const existingItems = loadExistingItems();
  const lastMetadata = loadLastUpdateMetadata();
  
  new Logger().log('itemsGrabber', `Loaded ${existingItems.length} existing items`);
  new Logger().log('itemsGrabber', `Last update: ${lastMetadata.lastUpdate || 'Never'}`);
  
  // If no existing items, do a full fetch
  if (existingItems.length === 0) {
    new Logger().log('itemsGrabber', 'No existing items found, performing full fetch...');
    return await performFullFetch();
  }

  try {
    // Fetch only new items
    const fetchResult = await fetchNewItemsOnly(existingItems, lastMetadata);
    
    if (fetchResult.newItems.length === 0) {
      new Logger().log('itemsGrabber', 'No new items found - database is up to date!');
      return {
        success: true,
        stats: {
          added: 0,
          updated: 0,
          unchanged: existingItems.length,
          total: existingItems.length
        },
        jsonSaved: true
      };
    }

    // Transform icon paths for new items
    const transformedNewItems = fetchResult.newItems.map((item) => {
      if (item.icon) {
        item.icon = transformIconPath(item.icon);
      }
      return item;
    });

    // Merge new items with existing ones
    const allItems = [...existingItems, ...transformedNewItems];
    
    new Logger().log('itemsGrabber', '='.repeat(50));
    new Logger().log('itemsGrabber', 'INCREMENTAL UPDATE RESULTS:');
    new Logger().log('itemsGrabber', `New items added: ${transformedNewItems.length}`);
    new Logger().log('itemsGrabber', `Total items: ${allItems.length}`);
    new Logger().log('itemsGrabber', `Pages checked: ${fetchResult.pagesChecked}`);
    new Logger().log('itemsGrabber', '='.repeat(50));

    // Save updated items
    const jsonSaved = saveItemsToJson(allItems);
    
    // Save to JS format (legacy compatibility)
    new Logger().log('itemsGrabber', `Writing ${allItems.length} items to allItems.js...`);
    const fileContent = `export const main = ${JSON.stringify(allItems, null, 2)};`;
    
    fs.writeFile('allItems.js', fileContent, (err) => {
      if (err) {
        new Logger().error('itemsGrabber', `Error writing to allItems.js: ${err.message}`);
      } else {
        new Logger().log('itemsGrabber', `Success! ${allItems.length} items saved to allItems.js`);
      }
    });

    // Update metadata
    const newMetadata = {
      lastUpdate: new Date().toISOString(),
      lastItemId: transformedNewItems[transformedNewItems.length - 1]?.id || lastMetadata.lastItemId,
      totalItems: allItems.length,
      pagesChecked: fetchResult.pagesChecked
    };
    saveUpdateMetadata(newMetadata);

    return {
      success: true,
      stats: {
        added: transformedNewItems.length,
        updated: 0,
        unchanged: existingItems.length,
        total: allItems.length
      },
      jsonSaved
    };
  } catch (error) {
    new Logger().error('itemsGrabber', `Fatal error in incremental update: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

// Full fetch function (for initial setup or when incremental fails)
const performFullFetch = async () => {
  new Logger().log('itemsGrabber', "Performing full data fetch...");
  
  let allItems = [];
  let successCount = 0;
  let errorCount = 0;

  try {
    const firstPage = await fetchPage(1);
    allItems = allItems.concat(firstPage.pageData);
    successCount++;

    const pageCount = firstPage.pageCount || 1;
    new Logger().log('itemsGrabber', `Total pages to fetch: ${pageCount}`);

    // Fetch ALL pages - no limit
    const maxPages = pageCount;

    for (let page = 2; page <= maxPages; page++) {
      try {
        const pageResult = await fetchPage(page);
        allItems = allItems.concat(pageResult.pageData);
        successCount++;
        new Logger().log('itemsGrabber', `Page ${page} of ${maxPages} fetched successfully.`);

        // Increased delay to be more respectful to the API
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        errorCount++;
        new Logger().error('itemsGrabber', `Failed to fetch page ${page}: ${error.message}`);
        
        // If we get too many errors, stop fetching
        if (errorCount > 5) {
          new Logger().log('itemsGrabber', 'Too many errors, stopping fetch process');
          break;
        }
      }
    }

    // Transform icon paths
    allItems = allItems.map((item) => {
      if (item.icon) {
        item.icon = transformIconPath(item.icon);
      }
      return item;
    });

    new Logger().log('itemsGrabber', `Full fetch completed: ${allItems.length} items`);

    // Save items
    const jsonSaved = saveItemsToJson(allItems);
    
    // Save to JS format (legacy compatibility)
    new Logger().log('itemsGrabber', `Writing ${allItems.length} items to allItems.js...`);
    const fileContent = `export const main = ${JSON.stringify(allItems, null, 2)};`;
    
    fs.writeFile('allItems.js', fileContent, (err) => {
      if (err) {
        new Logger().error('itemsGrabber', `Error writing to allItems.js: ${err.message}`);
      } else {
        new Logger().log('itemsGrabber', `Success! ${allItems.length} items saved to allItems.js`);
      }
    });

    // Save metadata
    const metadata = {
      lastUpdate: new Date().toISOString(),
      lastItemId: allItems[allItems.length - 1]?.id || null,
      totalItems: allItems.length,
      pagesChecked: maxPages
    };
    saveUpdateMetadata(metadata);

    return {
      success: true,
      stats: {
        added: allItems.length,
        updated: 0,
        unchanged: 0,
        total: allItems.length
      },
      jsonSaved
    };
  } catch (error) {
    new Logger().error('itemsGrabber', `Fatal error in full fetch: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};



