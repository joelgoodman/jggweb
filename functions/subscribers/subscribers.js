/**
 * 1. Add subscriber to Airtable
 * 2. Generate magic code
 * 3. Send email with magic code link
 * 4. Hookup Netlify Function to confirm code against Airtable
 * 5. Check double opt-in
 */

require('dotenv').config()
const fetch = require('node-fetch')
const { REVUE_TOKEN } = process.env

exports.handler = async event => {

    const email = JSON.parse(event.body).payload.email
    console.log(`Recieved a submission: ${email}`)

    return fetch('https://www.getrevue.co/api/v2/subscribers', {
        method: 'POST',
        headers: {
            Authorization: `Token ${REVUE_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
    })
    .then(response => response.json())
    .then(data => {
        console.log(`Submitted to Revue:\n ${data}`)
    })
    .catch(error => ({ statusCode: 422, body: String(error) }))

}