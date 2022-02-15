require('dotenv').config()
const fetch = require('node-fetch')
const { REVUE_TOKEN } = process.env

exports.handler = async event => {

    const email = JSON.parse(event.body).payload.email
    console.log(`Received a submission: ${email}`)

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