const express = require('express');
const cors = require('cors');
const app = express();
const puppeteer = require('puppeteer');
const mysql = require('mysql');

app.use(cors());

//Create connection with mysql database (id, title, price, location, isFurnished, link)
let payload = {};

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

app.get("/lastupdatedresult", (req, res) => {
    res.send(payload);
});

app.get("/scrape", async (req, res) => {
    const cityJson = req.query;
    const cityToScrape = cityJson.city; 
    const scrapeObj = new Scrape(cityToScrape);
    payload = await scrapeObj.initialize();
    res.send(payload);
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
        this.browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--single-process', '--no-zygote'], ignoreHTTPSErrors: true });
        this.page = await this.browser.newPage();
        await this.page.setViewport({width: 1280, height: 800});
        payload = await eval(`this.${this.city}Scrape()`);
        return payload;
    }

    async getKijijiInfo(searchPageLink) {
        let linksArr = [];
        await this.page.goto(searchPageLink);
        
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
                await new Promise(r => setTimeout(r, 2000));

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
                //console.log(adTitle, adPrice, adLocation, adIsFurnished, a, "Kijiji");
                this.insertData(adTitle, adPrice, adLocation, adIsFurnished, a, "Kijiji");
            }
            catch (e) {
                console.log(e);
                break;
            }

            // Timeout before going to next link
            await new Promise(r => setTimeout(r, 2000));
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
        try{
            const agreeBtn = await this.page.$(".btn.btn-primary");
            agreeBtn.click();
        } catch (e) {};
        

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
            await new Promise(r => setTimeout(r, 2000));

            // Getting title
            await this.page.waitForSelector("#MainContent_detailsTitle");
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
            this.insertData(listingTitle, listingPrice, listingLocation, listingIsFurnished, a, "Places4Students");
            //console.log(listingTitle, listingPrice, listingLocation, listingIsFurnished, a, "Places4Students");

            //Timeout
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    async waterlooScrape() { //Kijiji, Places4Students
        /*console.log("Scraping Waterloo data...");  

        // Deleting old data from db
        console.log("Deleting old data...")
        const sql = 'DELETE FROM `advertisements` WHERE `location` LIKE "Waterloo%" OR `location` LIKE "%Waterloo" OR `location` LIKE "%Waterloo%" OR `location` LIKE "Waterloo" OR `location` LIKE "Kitchener%" OR `location` LIKE "%Kitchener" OR `location` LIKE "%Kitchener%" OR `location` LIKE "Kitchener" OR `location` LIKE "Cambridge%" OR `location` LIKE "%Cambridge" OR `location` LIKE "%Cambridge%" OR `location` LIKE "Cambridge"';
        con.query(sql, (err, result) => {
            if (err) throw err;
            console.log("Finished deleting old data...")
        });
        
        await this.getKijijiInfo("https://www.kijiji.ca/b-canada/student-housing-waterloo/k0l0?dc=true&view=list");
        await this.getPlaces4StudentsInfo("https://www.places4students.com/Places/PropertyListings?SchoolID=j9CaTYeszhs=");

        await this.browser.close();
        console.log("Finished scraping Waterloo data...");*/
        console.log("test");
        const searchTerms = ["Waterloo", "Kitchener", "Cambridge"];
        const adObjects = await this.getAds(searchTerms);
        const statsObj = new Stats(adObjects, 'Waterloo');
        await statsObj.getTotalListings();
        await statsObj.getAverageRent();
        await statsObj.getMostExpensiveRent();
        await statsObj.getCheapestRent();
        payload = {
            'totalListings': statsObj.totalListings, 
            'averageRent': statsObj.averageRent,
            'mostExpensiveRent': statsObj.expensiveListing,
            'cheapestRent': statsObj.cheapestListing,
        };
        return payload;
    }

    async torontoScrape() {  //Kijiji, Places4Students
        console.log("Scraping Toronto data...");

        // Deleting old data from db
        console.log("Deleting old data...")
        const sql = 'DELETE FROM `advertisements` WHERE `location` LIKE "Toronto%" OR `location` LIKE "%Toronto" OR `location` LIKE "%Toronto%" OR `location` LIKE "Toronto"';
        con.query(sql, (err, result) => {
            if (err) throw err;
            console.log("Finished deleting old data...")
        });
        
        await this.getKijijiInfo("https://www.kijiji.ca/b-canada/student-housing-toronto/k0l0?dc=true&view=list");
        await this.getPlaces4StudentsInfo("https://www.places4students.com/Places/PropertyListings?SchoolID=FzhtQRDGtSU%3d"); // University of Toronto
        await this.getPlaces4StudentsInfo("https://www.places4students.com/Places/PropertyListings?SchoolID=8SnFMiLCDsA%3d"); // York University

        await this.browser.close();
        console.log("Finished scraping Toronto data...");
    }

    async hamiltonScrape() { //Kijiji, Places4Students
        console.log("Scraping Hamilton data...");

        // Deleting old data from db
        console.log("Deleting old data...")
        const sql = 'DELETE FROM `advertisements` WHERE `location` LIKE "Hamilton%" OR `location` LIKE "%Hamilton" OR `location` LIKE "%Hamilton%" OR `location` LIKE "Hamilton"';
        con.query(sql, (err, result) => {
            if (err) throw err;
            console.log("Finished deleting old data...")
        });
        
        await this.getKijijiInfo("https://www.kijiji.ca/b-canada/student-housing-hamilton/k0l0?dc=true&view=list");
        await this.getPlaces4StudentsInfo("https://www.places4students.com/Places/PropertyListings?SchoolID=pCzm%2fnN3qvQ%3d");

        await this.browser.close();
        console.log("Finished scraping Hamilton data");
    }

    insertData(title, price, location, isFurnished, link, platform) {
        const sql = 'INSERT INTO `advertisements` (`title`, `price`, `location`, `isfurnished`, `link`) VALUES (?, ?, ?, ?, ?)';
        con.query(sql, [title, price, location, isFurnished, link], (err, results, fields) => {
            if (err) throw err;
            console.log(`Inserted ${platform} ${title}`);
        });
    }

    async getAds(searchTerms) {
        let adObjects = [];

        // Promisify .query MySQL
        const queryAsync = sql => {
            return new Promise((resolve, reject) => {
                con.query(sql, (err, results) => {
                    if (err) return reject(err);
                    resolve(JSON.parse(JSON.stringify(results)));
                })
            })
        };

        for (const city of searchTerms) {
            const sql = `SELECT * FROM advertisements WHERE location LIKE '${city}%' or location like '%${city}' or location like '%${city}%'`
            const results = await queryAsync(sql);
            adObjects.push(...results);
        }
        return adObjects;
    }
}

class Stats {
    constructor(adObjects, city) {
        this.adObjects = adObjects;
        this.city = city;
        this.totalListings = null;
        this.averageRent = null;
        this.expensiveListing = null;
        this.cheapestListing = null;
    }

    queryAsync(sql) { // Promisify .query MySQL
        return new Promise((resolve, reject) => {
            con.query(sql, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            })
        });
    }

    async getTotalListings() {
        const sql = `SELECT count(*) as total_listings FROM advertisements WHERE location LIKE '${this.city}%' or location like '%${this.city}' or location like '%${this.city}%'`;
        const results = await this.queryAsync(sql);
        this.totalListings = results[0].total_listings;
    }

    async getAverageRent() {
        const sql = `SELECT round(avg(price)) as avg_rent FROM advertisements WHERE location LIKE '${this.city}%' or location like '%${this.city}' or location like '%${this.city}%'`;
        const results = await this.queryAsync(sql);
        this.averageRent = results[0].avg_rent;
    }

    async getMostExpensiveRent() {
        const sql = `SELECT round(max(price)) as max_rent FROM advertisements WHERE location LIKE '${this.city}%' or location like '%${this.city}' or location like '%${this.city}%'`;
        const results = await this.queryAsync(sql);
        this.expensiveListing = results[0].max_rent;
    }

    async getCheapestRent() {
        const sql = `SELECT round(min(price)) as min_rent FROM advertisements WHERE location LIKE '${this.city}%' or location like '%${this.city}' or location like '%${this.city}%' and price > 0`;
        const results = await this.queryAsync(sql);
        this.cheapestListing = results[0].min_rent;
    }
}