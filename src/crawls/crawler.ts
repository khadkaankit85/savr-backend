import axios from "axios";
import random_user_agent from "../scrapes/agents";
import { log } from "console";
import fs, { write } from "fs";
import cheerio from "cheerio";
import { JSDOM } from "jsdom";
import puppeteer from "puppeteer";

const defaultHeaders = {
  "User-Agent": random_user_agent(),
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "application/json",
};

/**
 * Gets raw html output without loading a browser
 * @returns string
 */
export async function getRawHTML(URL: string): Promise<string> {
  try {
    const response = await axios.get(URL, {
      headers: defaultHeaders,
    });
    const htmlContent = response.data as string;

    // fs.writeFileSync("output.html", htmlContent)
    // log("HTML content saved")
    return htmlContent;
  } catch (error) {
    console.error("Error fetching the HTML");
    throw error;
  }
}

/**
 * Gets raw html with loading a browser (for dynamic content)
 * @returns  string
 */
export async function getPuppetRawHTML(URL: string): Promise<string> {
  log("Launching puppet");
  const browser = await puppeteer.launch();
  log("Puppet: opening page...");
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle2" });

  log("Puppet: Getting html content...");
  const html = await page.content();

  await browser.close();
  log("Puppet: Browser closed.");
  return html;
}

/**
 *  Gets only the body tag within the raw html
 * @param html
 * @returns string
 */
export function getRelevantHTMLJSDOM(html: string): string {
  try {
    // console.log("JSDOM: Getting body tag only...");

    const dom = new JSDOM(html);
    const body = dom.window.document.body;

    return body ? body.innerHTML : "";
  } catch (error) {
    console.error("Error JSDOM: ", error);
    return "";
  }
}

// open AI API
// TODO Add ai parser

/**
 * Only for best buy to specifically target the product object within window.__INITIAL_STATE__
 * Use this ONLY for best buy to get the price
 *
 * If not best buy, either will need a separate script, or deal with just the raw <body> parsed HTML
 * @param html
 * @returns string | null
 */
export function getBestBuyScriptTagOnly(html: string): string | null {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Select all <script> tags
    const scriptTags = document.querySelectorAll("script");

    // Find the <script> tag containing "window.__INITIAL_STATE__"
    for (const script of scriptTags) {
      if (
        script.textContent &&
        script.textContent.includes("window.__INITIAL_STATE__")
      ) {
        let scriptContent = script.textContent.trim();

        // Remove "window.__INITIAL_STATE__ =" and clean up trailing semicolon
        if (scriptContent.startsWith("window.__INITIAL_STATE__ =")) {
          scriptContent = scriptContent
            .replace("window.__INITIAL_STATE__ =", "")
            .trim();

          // Remove trailing semicolon if present
          if (scriptContent.endsWith(";")) {
            scriptContent = scriptContent.slice(0, -1);
          }

          // Use a regular expression to extract all "product" objects
          const productMatches = [
            ...scriptContent.matchAll(/"product":\{[\s\S]*?\}/g),
          ]; // Match all "product":{...}

          // Find the product object that contains "ehf"
          const productWithEHF = productMatches.find((match) =>
            match[0].includes('"ehf"'),
          );

          // If found, return it
          if (productWithEHF) {
            return productWithEHF[0]; // Return the matched "product" object as a string
          }
        }
      }
    }

    return null; // Return null if no matching <script> tag or "product" object is found
  } catch (error) {
    console.error("Error extracting and parsing product data:", error);
    return null;
  }
}

/**
 * Fixes incomplete JSON from the BestBuy script by adding missing closing braces and wrapping it in {}
 *
 * @param jsonString - The incomplete JSON string
 * @returns string - The fixed JSON string
 */
export function fixIncompleteJSON(jsonString: string): string {
  try {
    jsonString = jsonString.trim();

    // Count opening and closing braces
    const openingBraces = (jsonString.match(/{/g) || []).length;
    const closingBraces = (jsonString.match(/}/g) || []).length;

    // Add missing closing braces
    if (closingBraces < openingBraces) {
      jsonString += "}".repeat(openingBraces - closingBraces);
    }

    // Wrap in {} if not already wrapped
    if (!jsonString.startsWith("{") || !jsonString.endsWith("}")) {
      jsonString = `{${jsonString}}`;
    }

    // Validate JSON format
    JSON.parse(jsonString); // Throws an error if invalid

    return jsonString;
  } catch (error) {
    console.error("Error fixing JSON:", error);
    throw new Error("Failed to fix JSON. Please check the input format.");
  }
}

// DONT USE. WORKS but SUCKS as raw html has A LOT of numbers. Just narrow down based on tags until you get the price.
export async function priceUsingRegex(html: string): Promise<void> {
  try {
    // const priceRegex = /\$\s?(\d{1,3}(,\d{3})*(\.\d{2})?)/g;
    const priceRegex = /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g;

    const matches = [...html.matchAll(priceRegex)];

    if (matches.length > 0) {
      log("Extracted prices: ");
      matches.forEach((match) => log(match[0]));
    } else {
      log("No prices found");
    }
  } catch (error) {
    log("Error fetching prices with RegEx: ", error);
  }
}

// TEST WITH PUPPET
// (async () => {
//     const html = await getPuppetRawHTML();
//     const bodyResult = getRelevantHTMLJSDOM(html);
//     const scriptResult = getBestBuyScriptTagOnly(bodyResult)

//     const final = scriptResult ? scriptResult : "";

//     fs.writeFileSync("output.html", final);
// })();

// TEST WITHOUT PUPPET -> SAME AS WITH PUPPET RESULTS BUT FASTER

// const url_test = "https://www.bestbuy.ca/en-ca/product/asus-rog-ally-7-1080p-touch-gaming-console-amd-z1-extreme-radeon-navi3-16gb-ram-512gb-ssd-windows-11-xbox-gamepass/17083904";
// (async () => {
//     const html = await getRawHTML(url_test);
//     const bodyResult = getRelevantHTMLJSDOM(html);

//     fs.writeFileSync("tokens.txt", bodyResult)
//     const scriptResult = getBestBuyScriptTagOnly(bodyResult);

//     // Check if scriptResult is not null before passing it to fixIncompleteJSON stupid typescript
//     const fixedJSON = scriptResult ? fixIncompleteJSON(scriptResult) : "";
//     const final = fixedJSON;

//     // Write the final output to a file (just for testing)
//     fs.writeFileSync("output.json", final);
// })();
