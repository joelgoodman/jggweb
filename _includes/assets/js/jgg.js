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