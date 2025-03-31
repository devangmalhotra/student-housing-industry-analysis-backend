const express = require('express');
const cors = require('cors');
const app = express();
const puppeteer = require('puppeteer');
const mysql = require('mysql');

app.use(cors());

//Create connection with mysql database (id, title, price, location, isFurnished, link)
const con = mysql.createConnection({
    host: 'sql12.freesqldatabase.com', 
    user: 'sql12768879', 
    password: 'jxEhANMr7a', 
    database: 'sql12768879',
});

con.connect(function(err) {
    if (err) throw err;
    console.log("Connected to MySQL server!");
});


app.get("/scrape", (req, res) => {
    const cityJson = req.query;
    const cityToScrape = cityJson.city;
    //console.log(cityToScrape);
    res.send({hello: 'hello world'});
    
    const scrapeObj = new Scrape(cityToScrape);
    scrapeObj.initialize();
    
});

app.get("/toronto", (req, res) => {
    res.send({hello: 'hello world'});
});

app.get("/hamilton", (req, res) => {
    res.send({hello: 'hello world'});
});

app.listen(8000, () => {
    console.log("Listening on port 8000...");
});

class Scrape {
    constructor(city) {
        this.city = city;
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        this.browser = await puppeteer.launch({headless: false});
        this.page = await this.browser.newPage();
        await this.page.setViewport({width: 1280, height: 800});
        eval(`this.${this.city}Scrape()`);
    }

    async getKijijiInfo(searchPageLink) {
        let linksArr = [];
        await this.page.goto(searchPageLink);

        // Scrolling to bottom of page to load elements
        await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        
        await this.page.waitForSelector('[data-testid="pagination-list-item-selected"]');

        // Collecting links for all pages
        const resultLinksContainers = await this.page.$$('[data-testid=pagination-list-item]');

        // Saving all result page links in an array
        const resultLinks = [];
        for (const i of resultLinksContainers) {
            const resultLink = await i.$eval('[data-testid=pagination-link-item]', el => el.href);
            resultLinks.push(resultLink);
        };
        console.log(resultLinks);
        //console.log(await resultLinksContainers[0].$eval('[data-testid=pagination-link-item]', el => el.href));
        
        // Collecting all links
        const adsResultsDiv = await this.page.$('[data-testid=srp-search-list]');
        const postingsList = await adsResultsDiv.$$("li");
        for (const i of postingsList) {
            try {
                const anchorElement = await i.$('[data-testid=listing-link]');
                const adLink = await this.page.evaluate(el => el.getAttribute('href'), anchorElement);
                linksArr.push(adLink);
            }
            catch(e) {
                
            }
        }

        // Accessing all links
        for (const a of linksArr) {
            try {
                await this.page.goto(a);
                this.page.setDefaultNavigationTimeout(0);

                // Getting listing title
                const adTitle = (await this.page.$eval('.sc-9d9a3b6-0.cwhKRe', el => el.innerText)).trim();

                // Getting listing price
                const priceElement = await this.page.$('[data-testid=vip-price]');
                const adPrice = (await priceElement.evaluate(el => el.innerHTML)).trim().replace(",", "").replace("$", "");

                // Getting listing location 
                const locationElement = await this.page.$('::-p-xpath(//*[@id="base-layout-main-wrapper"]/div[1]/div[2]/section/div/div/div[1]/div/div/div[2]/div/div/button)');
                const adLocation = (await locationElement.evaluate(el => el.innerHTML)).trim();

                // Getting isFurnished
                let adIsFurnished;
                const isFurnishedCandidates = await this.page.$$('.sc-eb45309b-0.iNzWBi');
                try {
                    for (const i of isFurnishedCandidates) {
                        const candidateContainerElement = await i.$('.sc-9d9a3b6-0.fAJNmV');
                        const candidateTitle = (await candidateContainerElement.evaluate(el => el.innerHTML)).trim();
                        if (candidateTitle == "Furnished") {
                            const isFurnishedElement = await i.$('.sc-578235a5-0.hsLMPB');
                            adIsFurnished = await isFurnishedElement.evaluate(el => el.innerHTML);
                        }
                    }
                }
                catch(e) {
                    
                }
                console.log(adTitle, adPrice, adLocation, adIsFurnished, a, "Kijiji");
                //this.insertData(adTitle, adPrice, adLocation, adIsFurnished, a, "Kijiji");
            }
            catch (e) {
                console.log(e);
                break;
            }
        }

        
    }

    async getPlaces4StudentsInfo(searchPageLink) {
        //Places4Students (Wilfrid Laurier University) (await resolves a promise)
        let linksArr = [];
        let listingTitle;
        let listingPrice;
        let listingLocation;
        let listingIsFurnished = "";

        await this.page.goto(searchPageLink);

        // Accepting disclaimer
        const agreeBtn = await this.page.$(".btn.btn-primary");
        agreeBtn.click();

        await this.page.waitForSelector(".featured");
        const listingsArr = await this.page.$$(".featured");
        
        // Getting each link and storing in array
        for (const i of listingsArr) {
            const listingLinkContainer = await i.$('.listing-title');
            const listingLink = await listingLinkContainer.$eval('a', el => el.href);
            linksArr.push(listingLink);
        }

        // Traversing through each link
        for (const a of linksArr) {
            await this.page.goto(a);

            // Getting title
            listingTitle = await this.page.$eval("#MainContent_detailsTitle", el => el.innerText);

            // Getting price
            try {
                const listingPriceText = await this.page.$eval('#MainContent_trRental', el => el.innerText);
                listingPrice = listingPriceText.split("$")[1].split(".")[0].replace(",", "").trim();
            } 
            catch {
                const listingPriceText = await this.page.$eval('.element.atStart.ui-accordion-content.ui-helper-reset.ui-widget-content.ui-corner-bottom.ui-accordion-content-active', el => el.innerText);
                listingPrice = listingPriceText.split("\n")[1].replace("$", "").split(".")[0].replace(",", "").trim();
            }

            // Getting location
            const listingLocationText = await this.page.$eval('#MainContent_trCity', el => el.innerText);
            listingLocation = listingLocationText.split("\n")[1].trim();

            // Inserting into MySQL DB
            //this.insertData(listingTitle, listingPrice, listingLocation, listingIsFurnished, a, "Places4Students");
        }
    }
    
    async waterlooScrape() { //Kijiji, Places4Students
        console.log("Scraping Waterloo data...");  
        await this.getKijijiInfo("https://www.kijiji.ca/b-canada/student-housing-waterloo/k0l0?dc=true&view=list");
        //await this.getPlaces4StudentsInfo("https://www.places4students.com/Places/PropertyListings?SchoolID=j9CaTYeszhs=");
        
        

        await this.browser.close();
        console.log("Finished scraping Waterloo Data...");
    }

    torontoScrape() {
        console.log("torontoScrape");
    }

    hamiltonScrape() {
        console.log("hamiltonScrape");
    }

    insertData(title, price, location, isFurnished, link, platform) {
        const sql = 'INSERT INTO `advertisements` (`title`, `price`, `location`, `isfurnished`, `link`) VALUES (?, ?, ?, ?, ?)';
        con.query(sql, [title, price, location, isFurnished, link], (err, results, fields) => {
            if (err) throw err;
            console.log(`Inserted ${platform} ${title}`);
        });
    }
}

