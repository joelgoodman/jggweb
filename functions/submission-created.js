import {} from 'dotenv/config';
import {ApiClient, ContactsApi, authentications, CreateDoiContact, CreateContact} from 'sib-api-v3-sdk';
import { promises as Fs } from "fs";

const headers = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function handler(event) {
	ApiClient.instance.authentications["api-key"].apiKey = process.env.SENDINBLUE;
    const email = JSON.parse(event.body).payload.email;
	const apiInstance = new ContactsApi();
	const createDoiContact = new CreateDoiContact();
	console.log(email);
	createDoiContact.email = email;
	createDoiContact.attributes =  {};
	createDoiContact.includeListIds = [4];
	createDoiContact.templateId = 5;
	createDoiContact.attributes = {};
	createDoiContact.redirectionUrl ="https://joelgoodman.co/?email_confirmed=true";
	console.log("Add new contact: ", email);

	return apiInstance
		.createDoiContact(createDoiContact)
		.then(() => {
			return {
				body: JSON.stringify({ message: "Success" }),
				statusCode: 200,
			};
		})
		.catch((error) => {
			return {
				body: JSON.stringify(error),
				statusCode: 500,
			};
		});
}