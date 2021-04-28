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
document.querySelector("form").addEventListener("submit", handleSubmit);
let subForm = document.querySelector('form.subscribe');

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

const emailField = document.querySelector('input[type="email"]');

emailField.onBlur( (e) => {
    let emailVal = emailField.nodeValue;

    if ( validateEmail(emailVal) ) {
        subForm.classList.remove('error');
    } else {
        subForm.classList.add('error');
    }
} );
function validateEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}