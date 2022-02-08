require('dotenv').config()

const sgMail = require('@sendgrid/mail')
const sgClient = require('@sendgrid/client')

const {
    SENDGRID_API_KEY,
    SENDGRID_FROM_EMAIL
} = process.env;

export