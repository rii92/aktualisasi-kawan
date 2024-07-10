const cheerio = require('cheerio');
const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises
puppeteerExtra.use(stealthPlugin());

async function saveDataToCSV(data) {
    const csvLines = [];
    data.forEach(row => {
      const rowLine = row.join(';'); // Join each row's columns with a comma
      csvLines.push(rowLine);
    });
  
    const csvContent = csvLines.join('\n');
    await fs.writeFile('src/data/dataSakernas.csv', csvContent, 'utf-8');
    console.log('Data saved to data.csv');
  }

const getFasihSmData = async() =>{
    const username = 'yudistiraelton'; // Ganti dengan username yang sebenarnya
    const password = 'eltonelton'; // Ganti dengan password yang sebenarnya
    const jumlahHalaman = 2; // Ganti dengan jumlah halaman yang sebenarnya

    // Launch browser
    const browser = await puppeteerExtra.launch({ headless: false }); // Set headless sesuai kebutuhan
    const page = await browser.newPage();

    // Mengunjungi halaman login
    await page.goto('https://fasih-sm.bps.go.id/');

    //klik tombol login
    await page.click('a.login-button');
    
    // Melakukan refresh halaman
    await page.evaluate(() => location.reload(true));
    
    // Tunggu hingga navigasi selesai
    await page.waitForNavigation();
    
    // // Mengisi form login
    await page.type('#username', username, { delay: 100 }); // Ganti dengan username yang sesuai
    await page.type('#password', password, { delay: 100 }); // Ganti dengan password yang sesuai

    // // Klik tombol login
    await page.click('#kc-login'); // Sesuaikan selector tombol login
    
    // // Tunggu hingga navigasi selesai
    await page.waitForNavigation();

    // Mengunjungi halaman login
    await page.waitForSelector('a[href="/survey-collection/general/08ccfdf5-9c7f-4379-9a4c-09ce265d20b9"]');
    await page.click('a[href="/survey-collection/general/08ccfdf5-9c7f-4379-9a4c-09ce265d20b9"]');

    // // Tunggu hingga navigasi selesai
    // await page.waitForSelector('#assignmentDatatable');
    await page.evaluate(() => location.reload(true));

    //inisialisasi data
    let data = [];

    // Tunggu hingga navigasi selesai
    for(let i = 1; i <= jumlahHalaman; i++){
        await page.waitForSelector('#assignmentDatatable');
        await page.waitForFunction(() => document.querySelector('#assignmentDatatable tbody tr td'));
        await page.select('select[name="assignmentDatatable_length"]', '100');

        // Function to scroll to the bottom of the page
        await page.evaluate(async () => {
            await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                clearInterval(timer);
                resolve();
                }
            }, 100);
            });
        });

        // await page.evaluate(() => {
        //     window.scrollTo(0, 0);
        // });

        const dataExtractedData = await page.evaluate(() => {
        const table = document.querySelector('#assignmentDatatable');
        const rows = table.querySelectorAll('tr');
        return Array.from(rows, row => {
            const columns = row.querySelectorAll('td');
            return Array.from(columns, column => column.innerText.trim());
        });
        });

        data = data.concat(dataExtractedData);

        await page.click('#assignmentDatatable_next');
        // Scroll back to the top of the page
        await page.evaluate(() => {
            window.scrollTo(0, 0);
        });
    }


    // Menampilkan data ke console
    console.log(data.length);

    saveDataToCSV(data);

    // Menutup browser
    await browser.close();
}

module.exports.getFasihSmData = getFasihSmData;