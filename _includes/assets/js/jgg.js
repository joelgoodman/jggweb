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
let subForm = document.querySelector('form');
const handleSubmit = (e) => {
  e.preventDefault()
  let formData = new FormData(subForm)
  fetch('/', {
    method: 'POST',
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(formData).toString()
  }).then( () => subForm.classList.add('success') ).catch((error) =>
    subForm.classList.add('error'))
}
document.querySelector('form').addEventListener("submit", handleSubmit);

let emailField = document.querySelector('input[type="email"]');

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