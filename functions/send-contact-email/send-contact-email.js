// Docs on event and context https://www.netlify.com/docs/functions/#the-handler-method
require('dotenv').config()
const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE }
const mailjet = require ('node-mailjet')
	.connect(process.env.MJ_APIKEY_PUBLIC, process.env.MJ_APIKEY_PRIVATE)

const handler = async (event) => {
  const email = JSON.parse(event.body).payload.email
  const request = mailjet
	.post("contact", {'version': 'v3'})
	.request({
      "IsExcludedFromCampaigns":"true",
      "Email": email
    })
  request
    .then((result) => {
      console.log(result.body)
    })
    .catch((err) => {
      console.log(err.statusCode)
    })
}

module.exports = { handler }
