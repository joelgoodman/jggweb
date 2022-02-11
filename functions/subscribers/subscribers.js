/**
 * 1. Add subscriber to Airtable
 * 2. Generate magic code
 * 3. Send email with magic code link
 * 4. Hookup Netlify Function to confirm code against Airtable
 * 5. Check double opt-in
 */

require('dotenv').config()
const { base } = require('airtable')
const { SESClient, CloneReceiptRuleSetCommand } = require("@aws-sdk/client-ses");

const Airtable = require('airtable')

// Check if email exists on Airtable
const validateSub = async ( { email, subscribers } ) => {
    const found = subscribers.find( sub => sub.fields.Email == email )
    if ( found ) {
        return email;
    } else {
        console.log('Subscriber exists.')
        return
    }
}

// Add a new Record to our Base
const addNewSubscriber = async ( { email } ) => {
    base('Subscribers').create([
        {
            "fields": {
                "Email": email,
                "Double Opt-in": false,
            }
        }
    ],
    function(err, records) {
        if (err) {
            console.error(err);
            return;
        }
        records.forEach(function (record) {
            // console.log(record.getId());
            sendDoubleOptIn( email, record.getId() );
            // @TODO: Send double opt-in email based on ID
        });
    });
}

const sendDoubleOptIn = ( email_address, token ) => {
    let params = {
        Destination: {
            ToAddresses: [
                email_address
            ]
        },
        Source: "Joel Goodman <hello@joelgoodman.co>",
        Template: "Confirmation",
        TemplateData: {
            token: token
        },
        ReplyToAddresses: [
            'hello@joelgoodman.co'
        ]
    }
    ses.sendTemplatedEmail = (params) => function(err, data) {
        if ( err )
            console.log(err, err.stack)
        else
            console.log(data)
    }
}
exports.handler = async function(event, context, callback) {

    const email_address = JSON.parse(event.body).payload.email
    console.log(email_address);

    Airtable.configure({
        endpointUrl: process.env.AIRTABLE_API_URL,
        apiKey: process.env.AIRTABLE_API_KEY
    });

    const base = Airtable.base('appqb494LQmrvVGce');
    const allSubs = [];

    // Get our subscriber list
    base("Subscribers").select({
        view: "all"
    }).eachPage(
        function page(records, fetchNextPage) {
            records.forEach(function(record) {
                allSubs.push( record );
            });

            fetchNextPage();
        },
        function done(err) {
            if (err) {
                console.error(err); return;
            } else {
                    // Validate our email against the list
                    validateSub(email_address, allSubs);
                    addNewSubscriber( email_address );
            }
        }
    );

}