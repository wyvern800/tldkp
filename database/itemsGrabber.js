import axios from "axios";
import fs from "fs";
import path from "path";
import { Logger } from "../utils/logger.js";
import puppeteer from "puppeteer";

// Environment-specific configuration
const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
const isDocker = process.env.DOCKER === 'true' || fs.existsSync('/.dockerenv');

const baseURL =
  "https://questlog.gg/throne-and-liberty/api/trpc/database.getItems";

const language = "en";
const mainCategory = "";
const subCategory = "";
const transformIconPath = (iconPath) => {
  const baseCDN = "https://cdn.questlog.gg/throne-and-liberty";

  const dirname = path.dirname(iconPath);
  const basename = path.basename(iconPath).split(".")[0];

  return `${baseCDN}${dirname}/${basename}.webp`;
};

export const searchItem = async (itemName) => {
  let browser;
  try {
    // Configure launch options with proper executable path handling
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    };

    // Try to get the executable path, with fallback for different environments
    console.log('Environment detection - isRender:', isRender, 'isDocker:', isDocker);
    try {
      const execPath = puppeteer.executablePath();
      console.log('Found Puppeteer executable at:', execPath);
      
      // Check if the executable actually exists
      const fs = await import('fs');
      const path = await import('path');
      if (fs.existsSync(execPath)) {
        launchOptions.executablePath = execPath;
        console.log('Using Puppeteer executable:', execPath);
      } else {
        console.log('Executable path does not exist, trying alternative paths...');
        
        // Try alternative paths based on environment
        const alternativePaths = isRender ? [
          '/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64/chrome',
          '/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64/chrome-linux64/chrome',
          '/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64/chrome-linux64/chrome-linux64/chrome',
          '/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64/chrome-linux64/chrome-linux64/chrome-linux64/chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium'
        ] : [
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium'
        ];
        
        // Debug: List the actual directory contents
        console.log('Starting comprehensive Chrome search...');
        try {
          // Check multiple possible base directories
          const possibleBaseDirs = [
            '/opt/render/.cache/puppeteer',
            '/opt/render/.cache/puppeteer/chrome',
            '/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.82',
            '/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64',
            '/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64/chrome-linux64'
          ];
          
          for (const baseDir of possibleBaseDirs) {
            console.log(`Checking directory: ${baseDir}`);
            if (fs.existsSync(baseDir)) {
              console.log(`Directory exists: ${baseDir}`);
              try {
                const items = fs.readdirSync(baseDir);
                console.log(`Contents of ${baseDir}:`, items);
                
                // Look for chrome executable
                for (const item of items) {
                  const fullPath = path.join(baseDir, item);
                  const stat = fs.statSync(fullPath);
                  console.log(`Item: ${item}, isDirectory: ${stat.isDirectory()}, isFile: ${stat.isFile()}`);
                  
                  if (stat.isFile() && (item === 'chrome' || item === 'chrome-linux64' || item.includes('chrome'))) {
                    console.log(`Found potential Chrome executable: ${fullPath}`);
                    alternativePaths.unshift(fullPath);
                  }
                }
              } catch (e) {
                console.log(`Error reading directory ${baseDir}:`, e.message);
              }
            } else {
              console.log(`Directory does not exist: ${baseDir}`);
            }
          }
          
          // Also try to find chrome using system commands
          try {
            const { execSync } = await import('child_process');
            const chromePaths = [
              execSync('which google-chrome', { encoding: 'utf8' }).trim(),
              execSync('which chromium-browser', { encoding: 'utf8' }).trim(),
              execSync('which chromium', { encoding: 'utf8' }).trim()
            ].filter(Boolean);
            
            console.log('System Chrome paths found:', chromePaths);
            alternativePaths.unshift(...chromePaths);
          } catch (e) {
            console.log('System Chrome search failed:', e.message);
          }
          
        } catch (debugError) {
          console.log('Debug listing failed:', debugError.message);
        }
        
        for (const altPath of alternativePaths) {
          if (fs.existsSync(altPath)) {
            launchOptions.executablePath = altPath;
            console.log('Using alternative executable path:', altPath);
            break;
          }
        }
        
        // If no Chrome found, try to install it
        if (!launchOptions.executablePath) {
          console.log('No Chrome executable found, attempting to install...');
          try {
            const { execSync } = await import('child_process');
            execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
            console.log('Chrome installation completed, retrying...');
            
            // Try again with the default path
            const newExecPath = puppeteer.executablePath();
            if (fs.existsSync(newExecPath)) {
              launchOptions.executablePath = newExecPath;
              console.log('Using newly installed Chrome:', newExecPath);
            }
          } catch (installError) {
            console.log('Chrome installation failed:', installError.message);
          }
        }
      }
    } catch (execPathError) {
      console.log('Could not get Puppeteer executable path, using default');
      // Let Puppeteer find Chrome automatically
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    
    // Set viewport and user agent for better compatibility
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra headers to appear more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    // Monta o objeto de pesquisa
    const inputSearch = {
      language,
      page: 1,
      mainCategory,
      subCategory,
      searchTerm: itemName?.toLowerCase()
    };

    const inputParam = encodeURIComponent(JSON.stringify(inputSearch));
    const url = `${baseURL}?input=${inputParam}`;

    // Add a small delay to make the request appear more natural
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Vai até a página
    await page.goto(url, { waitUntil: "networkidle2" });

    // Captura os dados da página (aqui vai depender do que aparece na tela ou no JSON)
    const data = await page.evaluate(() => {
      try {
        // se a resposta for JSON renderizado direto
        return JSON.parse(document.querySelector("body").innerText);
      } catch (err) {
        return null;
      }
    });

    console.log(data);

    if (data && data.result && data.result.data) {
      const result = data.result.data.pageData;
      const formatted = result.map((item) => {
        if (item.icon) {
          item.icon = transformIconPath(item.icon);
        }
        return item;
      });
      return formatted;
    } else {
      return [];
    }
  } catch (error) {
    new Logger().log("itemsGrabber", `error searching item ${itemName}: ${error}`);
    return [];
  } finally {
    if (browser) await browser.close();
  }
};

const fetchPage = async (page) => {
  const input = {
    language,
    page,
    mainCategory,
    subCategory,
  };

  const inputParam = encodeURIComponent(JSON.stringify(input));

  const url = `${baseURL}?input=${inputParam}`;

  try {
    const response = await axios.get(url);
    if (response.data && response.data.result && response.data.result.data) {
      const { pageData, pageCount, currentPage } = response.data.result.data;
      return { pageData, pageCount, currentPage };
    } else {
      console.error(`Estrutura de resposta inválida para a página ${page}`);
      return { pageData: [], pageCount: 0, currentPage: page };
    }
  } catch (error) {
    console.error(`Erro ao buscar a página ${page}:`, error.message);
    return { pageData: [], pageCount: 0, currentPage: page };
  }
};

export const main = async () => {
  console.log("Starting data fetch...");
  let allItems = [];

  const firstPage = await fetchPage(1);
  allItems = allItems.concat(firstPage.pageData);

  const pageCount = firstPage.pageCount || 1;

  console.log(`Total de páginas a serem buscadas: ${pageCount}`);

  for (let page = 2; page <= 100; page++) {
    const pageResult = await fetchPage(page);
    allItems = allItems.concat(pageResult.pageData);
    console.log(`Página ${page} de ${pageCount} buscada com sucesso.`);

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  allItems = allItems.map((item) => {
    if (item.icon) {
      item.icon = transformIconPath(item.icon);
    }
    return item;
  });

  console.log(`Writing ${allItems.length} items to file...`);
  const fileContent = `export const main = ${JSON.stringify(allItems, null, 2)};`;
  fs.writeFile('allItems.js', fileContent, (err) => {
    if (err) {
      console.error("Erro ao escrever no arquivo allItems.js:", err);
    } else {
      console.log(
        `Sucesso! ${allItems.length} itens foram salvos em allItems.js`
      );
    }
  });
};



