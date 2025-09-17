import axios from "axios";
import fs from "fs";
import path from "path";
import { Logger } from "../utils/logger.js";

const baseURL =
  "https://questlog.gg/throne-and-liberty/api/trpc/database.getItems";

const language = "en";
const mainCategory = "";
const subCategory = "";

const apiClient = axios.create({
  timeout: 10000,
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

const transformIconPath = (iconPath) => {
  const baseCDN = "https://cdn.questlog.gg/throne-and-liberty";

  const dirname = path.dirname(iconPath);
  const basename = path.basename(iconPath).split(".")[0];

  return `${baseCDN}${dirname}/${basename}.webp`;
};

// Retry function with exponential backoff
const retryRequest = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      new Logger().log('itemsGrabber', `Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export const searchItem = async (itemName) => {
  const inputSearch = {
    language,
    page: 1,
    mainCategory,
    subCategory,
    searchTerm: itemName?.toLowerCase()
  }

  const inputParam = encodeURIComponent(JSON.stringify(inputSearch));
  const url = `${baseURL}?input=${inputParam}`;

  new Logger().log('itemsGrabber', `Searching for item: ${itemName}`);

  try {
    const response = await retryRequest(async () => {
      return await apiClient.get(url);
    });

    if (response.data && response.data.result && response.data.result.data) {
      const result = response.data.result.data.pageData;
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

const fetchPage = async (page) => {
  const input = {
    language,
    page,
    mainCategory,
    subCategory,
  };

  const inputParam = encodeURIComponent(JSON.stringify(input));
  const url = `${baseURL}?input=${inputParam}`;

  new Logger().log('itemsGrabber', `Fetching page ${page}`);

  try {
    const response = await retryRequest(async () => {
      return await apiClient.get(url);
    });

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

export const main = async () => {
  new Logger().log('itemsGrabber', "Starting data fetch...");
  let allItems = [];
  let successCount = 0;
  let errorCount = 0;

  try {
    const firstPage = await fetchPage(1);
    allItems = allItems.concat(firstPage.pageData);
    successCount++;

    const pageCount = firstPage.pageCount || 1;
    new Logger().log('itemsGrabber', `Total pages to fetch: ${pageCount}`);

    // Limit to reasonable number of pages to avoid overwhelming the API
    const maxPages = Math.min(pageCount, 50);

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

    allItems = allItems.map((item) => {
      if (item.icon) {
        item.icon = transformIconPath(item.icon);
      }
      return item;
    });

    new Logger().log('itemsGrabber', `Writing ${allItems.length} items to file...`);
    const fileContent = `export const main = ${JSON.stringify(allItems, null, 2)};`;
    
    fs.writeFile('allItems.js', fileContent, (err) => {
      if (err) {
        new Logger().error('itemsGrabber', `Error writing to allItems.js: ${err.message}`);
      } else {
        new Logger().log('itemsGrabber', `Success! ${allItems.length} items saved to allItems.js`);
        new Logger().log('itemsGrabber', `Stats: ${successCount} successful pages, ${errorCount} errors`);
      }
    });
  } catch (error) {
    new Logger().error('itemsGrabber', `Fatal error in main function: ${error.message}`);
  }
};



