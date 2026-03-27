const menu = document.querySelector('.toggle-menu');
const menuPanel = document.getElementById('menu-panel');

if (menu && menuPanel) {
    menu.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = document.body.classList.contains('menu-open');

        if (isOpen) {
            document.body.classList.remove('menu-open');
            menu.setAttribute('aria-expanded', 'false');
            menuPanel.setAttribute('aria-hidden', 'true');
        } else {
            document.body.classList.add('menu-open');
            menu.setAttribute('aria-expanded', 'true');
            menuPanel.setAttribute('aria-hidden', 'false');
            // Focus first menu item when opened
            const firstLink = menuPanel.querySelector('a');
            if (firstLink) {
                setTimeout(() => firstLink.focus(), 100);
            }
        }
    });

    // Handle escape key to close menu
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
            document.body.classList.remove('menu-open');
            menu.setAttribute('aria-expanded', 'false');
            menuPanel.setAttribute('aria-hidden', 'true');
            menu.focus();
        }
    });

    // Trap focus within menu when open
    menuPanel.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && document.body.classList.contains('menu-open')) {
            const focusableElements = menuPanel.querySelectorAll('a');
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
    });
}
