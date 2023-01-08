import {} from 'dotenv/config';
const fs = require("fs").promises;
const SibApiV3Sdk = require("sib-api-v3-sdk");

let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications["api-key"];
let apiInstance = new SibApiV3Sdk.ContactsApi();

apiKey.apiKey = process.env.SENDINBLUE;

const headers = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function handler(event, context) {
    let contactObj = {
		statusCode: 200,
		headers,
		response: "Email submitted",
	};
    try {
		const data = JSON.parse(event.body);
		console.log("Add new contact: ", data.payload.email);

		let createDoiContact = new SibApiV3Sdk.CreateDoiContact();
		createDoiContact.email = data.payload.email;
        createDoiContact.attributes =  {};
		createDoiContact.includeListIds = [4];
		createDoiContact.templateId = 5;
		createDoiContact.attributes = {};
        createDoiContact.redirectionUrl ="https://joelgoodman.co/?email_confirmed=true";


		apiInstance.createDoiContact(createDoiContact).then(
			function (output) {
				output = JSON.stringify(output);
				const message =
					"API called successfully. Returned data: " + output;
				console.log(message);
				contactObj.response = message;
				return contactObj;
			},
			function (error) {
				console.log(error);
				contactObj.statusCode = error.status;
				contactObj.response = error.error;
				return contactObj;
			}
		);
	    return contactObj;
	} catch (error) {
		console.log(error);
		contactObj.statusCode = 400;
		contactObj.response = error;
		return contactObj;
	} finally {
		console.log("in finally block");
	}
}