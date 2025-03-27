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

app.listen(5000, () => {
    console.log("Listening on port 5000...");
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
    
    async waterlooScrape() { //Kijiji, Places4Students
        console.log("Scraping Waterloo data..."); 

        //Kijiji
        let linksArr = [];
        /* await this.page.goto("https://www.kijiji.ca/b-canada/student-housing-waterloo/k0l0?dc=true&view=list");
        const adsResultsDiv = await this.page.$('[data-testid=srp-search-list]');
        const postingsList = await adsResultsDiv.$$("li");
        //Collecting all links
        for (const i of postingsList) {
            try {
                const anchorElement = await i.$('[data-testid=listing-link]');
                const adLink = await this.page.evaluate(el => el.getAttribute('href'), anchorElement);
                linksArr.push(adLink);
            }
            catch(e) {
                
            }
        }
        //Accessing all links
        for (const a of linksArr) {
            try {
                await this.page.goto(a);
                const titleElement = await this.page.$('.sc-9d9a3b6-0.iacITa')
                const adTitle = (await titleElement.evaluate(el => el.innerHTML)).trim();
                const priceElement = await this.page.$('[data-testid=vip-price]');
                const adPrice = (await priceElement.evaluate(el => el.innerHTML)).trim().replace(",", "").replace("$", "");
                const locationElement = await this.page.$('::-p-xpath(//*[@id="base-layout-main-wrapper"]/div[1]/div[2]/section/div/div/div[1]/div/div/div[2]/div/div/button)');
                const adLocation = (await locationElement.evaluate(el => el.innerHTML)).trim();
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

                this.insertData(adTitle, adPrice, adLocation, adIsFurnished, a);
            }
            catch (e) {
            }
        } */

        //Places4Students (Wilfrid Laurier University) (await resolves a promise)
        linksArr = [];
        await this.page.goto("https://www.places4students.com/Places/PropertyListings?SchoolID=j9CaTYeszhs=");

        //Accepting disclaimer
        const agreeBtn = await this.page.$(".btn.btn-primary");
        agreeBtn.click();

        await this.page.waitForSelector(".featured");
        const listingsArr = await this.page.$$(".featured");
        
        for (const i of listingsArr) {
            const listingLinkContainer = await i.$('.listing-title');
            const listingLinkElement = await listingLinkContainer.$('a');
            console.log(listingLinkElement);
        }

        await this.browser.close()
        console.log("Finished scraping Waterloo Data...")
    }

    torontoScrape() {
        console.log("torontoScrape");
    }

    hamiltonScrape() {
        console.log("hamiltonScrape");
    }

    insertData(title, price, location, isFurnished, link) {
        const sql = 'INSERT INTO `advertisements` (`title`, `price`, `location`, `isfurnished`, `link`) VALUES (?, ?, ?, ?, ?)';
        con.query(sql, [title, price, location, isFurnished, link], (err, results, fields) => {
            if (err) throw err;
            console.log(`Inserted ${title}`);
        });
    }
}

