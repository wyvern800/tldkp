import axios from "axios";
import fs from "fs";
import path from "path";
import { Logger } from "../utils/logger.js";
import puppeteer from "puppeteer";

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
    browser = await puppeteer.launch({
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
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

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


