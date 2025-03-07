import express, { Request, Response } from "express";
import { getRawHTML, getRelevantHTMLJSDOM, getBestBuyScriptTagOnly, fixIncompleteJSON } from "../crawls/crawler";
import { log } from "console";
import { string } from "zod";



// (async () => {
//     const html = await getRawHTML();
//     const bodyResult = getRelevantHTMLJSDOM(html);
//     const scriptResult = getBestBuyScriptTagOnly(bodyResult);

//     // Check if scriptResult is not null before passing it to fixIncompleteJSON stupid typescript
//     const fixedJSON = scriptResult ? fixIncompleteJSON(scriptResult) : "";
//     const final = fixedJSON;

//     // Write the final output to a file (just for testing)
//     fs.writeFileSync("output.json", final);
// })();


const router = express.Router();

router.get("/BB", async (req: Request, res: Response) => {
    console.log(`Crawling URL request: ${req.query.url}`);
    
    const url = req.query.url as string;

    if (!url){
        res.status(400).json({ message: "URL is required" });
    }
    try {
        const html = await getRawHTML(url);
        const bodyResult = getRelevantHTMLJSDOM(html);
        const scriptResult = getBestBuyScriptTagOnly(bodyResult);
        const fixedJSON: string = scriptResult ? fixIncompleteJSON(scriptResult) : "";

        const finalData: { [key: string]: any } = JSON.parse(fixedJSON);

        // Add the URL link into the JSON object
        finalData.url = url;

        res.json(finalData);
        // Then push the data to the database
        
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ message: "Error fetching data" });
    }
});

export default router;