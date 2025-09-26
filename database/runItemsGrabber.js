#!/usr/bin/env node

/**
 * Runner script for database/itemsGrabber.js
 * 
 * This script executes the items grabber to fetch items from QuestLog.gg API
 * and save them to allItems.js file.
 * 
 * Usage:
 *   node runItemsGrabber.js
 *   npm run grab-items (if added to package.json)
 * 
 * Features:
 * - Fetches items from QuestLog.gg API
 * - Saves data to allItems.js
 * - Includes retry logic and rate limiting
 * - Comprehensive error handling and logging
 */

import { main as grabItems, mainWithComparison as grabItemsIncremental, searchItem } from './itemsGrabber.js';
import { Logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const logger = new Logger();

// Function to load local items from JSON
const loadLocalItems = () => {
  try {
    const dataPath = path.join(process.cwd(), 'database', 'data', 'questlogItems.json');
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    logger.error('runner', `Error loading local items: ${error.message}`);
  }
  return [];
};

// Function to search local items
const searchLocalItems = (items, searchTerm) => {
  const term = searchTerm.toLowerCase();
  
  return items.filter(item => {
    // Search in name, description, traits, category, type, and rarity
    const searchableFields = [
      item.name,
      item.description,
      item.category,
      item.type,
      item.rarity,
      ...(item.traits || [])
    ].map(field => field ? field.toString().toLowerCase() : '');
    
    return searchableFields.some(field => field.includes(term));
  }).sort((a, b) => {
    // Sort by relevance: exact name matches first, then partial matches
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    
    if (aName === term) return -1;
    if (bName === term) return 1;
    if (aName.startsWith(term)) return -1;
    if (bName.startsWith(term)) return 1;
    
    return aName.localeCompare(bName);
  });
};

// Parse command line arguments
const args = process.argv.slice(2);
const searchTerm = args.find(arg => arg.startsWith('--search='))?.split('=')[1];
const fullFetch = args.includes('--full');
const help = args.includes('--help') || args.includes('-h');

function showHelp() {
  console.log(`
Items Grabber Runner

Usage:
  node runItemsGrabber.js [options]

Options:
  --search=<term>    Search local JSON database for specific items
  --full            Force full fetch (download all items, not just new ones)
  --help, -h         Show this help message

Examples:
  node runItemsGrabber.js                    # Incremental update (new items only)
  node runItemsGrabber.js --full             # Full fetch (all items)
  node runItemsGrabber.js --search=sword     # Search local database for sword items
  npm run grab-items                         # Run via npm script (incremental)

Output:
  - allItems.js: Contains all fetched items
  - Logs: Detailed logging of the process
`);
}

async function runItemsGrabber() {
  try {
    if (help) {
      showHelp();
      process.exit(0);
    }

    logger.log('runner', '='.repeat(50));
    logger.log('runner', 'Starting Items Grabber Runner');
    logger.log('runner', '='.repeat(50));
    
    if (searchTerm) {
      logger.log('runner', `Search mode: Looking for items containing "${searchTerm}"`);
      logger.log('runner', 'Searching local JSON database...');
      
      // Load local items from JSON
      const localItems = loadLocalItems();
      
      if (localItems.length === 0) {
        logger.log('runner', 'No local items found. Run a full fetch first: npm run grab-items-full');
        process.exit(1);
      }
      
      // Search local items
      const results = searchLocalItems(localItems, searchTerm);
      logger.log('runner', `Found ${results.length} items matching "${searchTerm}"`);
      
      if (results.length > 0) {
        // Save search results
        const searchResults = {
          searchTerm,
          timestamp: new Date().toISOString(),
          count: results.length,
          totalItems: localItems.length,
          items: results
        };
        
        const fileName = `searchResults_${searchTerm.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const filePath = path.join(process.cwd(), 'database', 'data', fileName);
        
        // Ensure data directory exists
        const dataDir = path.dirname(filePath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, JSON.stringify(searchResults, null, 2));
        logger.log('runner', `Search results saved to: ${filePath}`);
        
        // Also display first few results
        logger.log('runner', 'Sample results:');
        results.slice(0, 5).forEach((item, index) => {
          logger.log('runner', `  ${index + 1}. ${item.name} (${item.rarity} ${item.category})`);
        });
        if (results.length > 5) {
          logger.log('runner', `  ... and ${results.length - 5} more items`);
        }
      } else {
        logger.log('runner', 'No items found matching the search term');
      }
    } else if (fullFetch) {
      logger.log('runner', 'Full fetch mode: Fetching ALL items from QuestLog.gg API');
      logger.log('runner', 'Output will be saved to allItems.js and questlogItems.json');
      logger.log('runner', 'Note: This may take several minutes due to rate limiting');
      
      // Execute the full fetch function
      const result = await grabItems();
      if (result && result.success) {
        logger.log('runner', `Full fetch completed: ${result.stats?.total || 0} items processed`);
      }
    } else {
      logger.log('runner', 'Incremental update mode: Fetching only NEW items from QuestLog.gg API');
      logger.log('runner', 'This will only download items that are not already in the local database');
      logger.log('runner', 'Output will be saved to allItems.js and questlogItems.json');
      
      // Execute the incremental update function
      const result = await grabItemsIncremental();
      if (result && result.success) {
        logger.log('runner', `Incremental update completed:`);
        logger.log('runner', `  - New items added: ${result.stats?.added || 0}`);
        logger.log('runner', `  - Total items: ${result.stats?.total || 0}`);
        if (result.stats?.added === 0) {
          logger.log('runner', '  - Database is up to date!');
        }
      }
    }
    
    logger.log('runner', '='.repeat(50));
    logger.log('runner', 'Items grabber completed successfully!');
    logger.log('runner', '='.repeat(50));
    process.exit(0);
  } catch (error) {
    logger.error('runner', '='.repeat(50));
    logger.error('runner', 'Items grabber failed!');
    logger.error('runner', `Error: ${error.message}`);
    logger.error('runner', `Stack trace: ${error.stack}`);
    logger.error('runner', '='.repeat(50));
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('runner', `Uncaught Exception: ${error.message}`);
  logger.error('runner', `Stack trace: ${error.stack}`);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('runner', `Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.log('runner', 'Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.log('runner', 'Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the items grabber
runItemsGrabber();
