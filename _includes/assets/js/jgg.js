const menu = document.querySelector('.toggle-menu');

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