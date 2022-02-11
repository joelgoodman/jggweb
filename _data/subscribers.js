/**
 * 1. Add subscriber to Airtable
 * 2. Generate magic code
 * 3. Send email with magic code link
 * 4. Hookup Netlify Function to confirm code against Airtable
 * 5. Check double opt-in
 */

require('dotenv').config()

const Airtable = require('airtable');
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base('appqb494LQmrvVGce');

const getSubscribersId = () => {
    base('Subscribers').select({
        // Selecting the first 3 records in Grid view:
        maxRecords: 100,
        view: "Grid view"
    }).eachPage(function page(records, fetchNextPage) {

        records.forEach(function(record) {
            console.log('Retrieved', record.get('ID'));
        });

        fetchNextPage();

    }, function done(err) {
        if (err) { console.error(err); return; }
    });
}
const addNewSubscriber = () => {
    base('Subscribers').create([
        {
            "fields": {
            "Email": email_address,
            "Double Opt-in": false,
            "Magic Code": magic_number
            }
        }
        ], function(err, records) {
        if (err) {
            console.error(err);
            return;
        }
        records.forEach(function (record) {
            console.log(record.getId());
        });
    });
}