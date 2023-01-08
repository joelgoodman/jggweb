const menu = document.querySelector('.toggle-menu');
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const subscriber = urlParams.get("email_confirmed");
const subStatus = document.cookie.split("; ").find((row) => row.startsWith("jggsubscriber="))?.split("=")[1];

if ( menu ) {
    menu.addEventListener('click', (e) => {
        e.preventDefault();
        if ( document.body.classList.contains('menu-open') ) {
            document.body.classList.remove('menu-open');
        } else {
            document.body.classList.add('menu-open');
        }
    });
}

// Handle form submission
const subForm = document.querySelector('form');

const handleSubmit = form => {
    const data = new FormData(form)
    data.append('form-name', 'subscribe')

    fetch('/', {
        method: 'POST',
        body: data
    })
    .then( () => form.classList.add('success') )
    .catch((error) => form.classList.add('error') )

    umami('Newsletter subscription');
}
if ( subForm ) {
    subForm.addEventListener("submit", e => {
        e.preventDefault();
        handleSubmit(subForm)
    });
}

const emailField = document.querySelector('input[type="email"]');

emailField.addEventListener('blur', (e) => {
    let emailVal = emailField.value;

    if ( validateEmail(emailVal) ) {
        subForm.classList.remove('error');
    } else {
        subForm.classList.add('error');
    }
} );

function validateEmail(email){
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email.toLowerCase());
}

const disableSubForm = () => {
    emailField.disabled = true;
    emailField.placeholder = "Thanks for being a subscriber!";
    subForm.querySelector('button[type="submit"]').disabled = true;

    document.body.querySelector(".subscribe-message").innerText = "You are already subscribed and your email is confirmed 👍🏼. Thanks for being here!";
}


if ( subscriber === 'true' ) {
    document.cookie = "jggsubscriber=true; expires=Fri, 31 Dec 9999 23:59:59 GMT; Secure";
}

if ( subscriber === 'true' || subStatus.length) {
    document.body.classList.add("subscriber-confirmed");
    disableSubForm();
}

