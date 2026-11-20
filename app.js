const USERS_URL = 'https://jsonplaceholder.typicode.com/users';
//const USERS_URL = 'https://jsonplaceholder.typicode.com/userz';
const POSTS_URL = 'https://jsonplaceholder.typicode.com/posts';
//const POSTS_URL = 'https://jsonplaceholder.typicode.com/postz';

const loadButton = document.getElementById('load-button');
const searchInput = document.getElementById('search-input');
const usersStatus = document.getElementById('users-status');
const usersCount = document.getElementById('users-count');
const usersList = document.getElementById('users-list');
const selectedUser = document.getElementById('selected-user');
const postsStatus = document.getElementById('posts-status');
const postsList = document.getElementById('posts-list');

// Все загруженные пользователи хранятся в массиве до перезагрузки страницы
let users = [];

// ID пользователя, чьи публикации сейчас выбраны
let selectedUserId = null;

// Флаги показывают, выполняется ли запрос (для блокировки кнопок)
let isLoadingUsers = false;
let isLoadingPosts = false;

function showMessage(element, text, type = '') {
    element.textContent = text;
    element.className = 'status' + (type ? ' ' + type : '');
}

// Создаём элемент DOM 
function createTextElement(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
}

// Пока идёт любой запрос, не разрешаем запускать повторную загрузку
function updateButtons() {
    loadButton.disabled = isLoadingUsers || isLoadingPosts;
}

// Отображаем список из уже загруженного массива, без нового HTTP-запроса
function renderUsers() {
    const query = searchInput.value.trim().toLowerCase();

    // filter() создаёт новый массив; исходный users не изменяется
    const filtered = users.filter(function (user) {
        return user.name.toLowerCase().includes(query);
    });

    usersCount.textContent = filtered.length;

    // Очищаем список, чтобы при поиске заново показать только подходящих
    usersList.replaceChildren();

    if (users.length === 0) {
        return;
    }

    if (filtered.length === 0) {
        const empty = createTextElement('li', 'user-detail', 'Пользователи не найдены');
        usersList.appendChild(empty);
        return;
    }

    // Для каждого подходящего пользователя создаём карточку через DOM
    filtered.forEach(function (user) {
        const item = document.createElement('li');
        item.className = 'user-card';

        if (user.id === selectedUserId) {
            item.classList.add('selected');
        }

        item.appendChild(createTextElement('h3', 'user-name', user.name));
        item.appendChild(createTextElement('p', 'user-detail', 'Email: ' + user.email));
        item.appendChild(createTextElement('p', 'user-detail', 'Город: ' + user.address.city));

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Показать публикации';

        // Запоминаем ID пользователя в кнопке для загрузки именно его публикаций
        button.dataset.userId = user.id;

        button.disabled = isLoadingUsers || isLoadingPosts;
        button.setAttribute('aria-label', 'Показать публикации пользователя ' + user.name);

        item.appendChild(button);
        usersList.appendChild(item);
    });
}

// GET: получаем пользователей с сервера
loadButton.addEventListener('click', async function () {
    isLoadingUsers = true;
    updateButtons();
    renderUsers();
    showMessage(usersStatus, 'Загрузка...');

    // null означает, что HTTP-ответ пока не был получен
    let httpStatus = null;

    try {
        // fetch() делает GET-запрос, await ожидает HTTP-ответ
        const response = await fetch(USERS_URL);
        httpStatus = response.status;

        if (!response.ok) {
            throw new Error('Сервер вернул ошибку');
        }

        // Получаем из JSON массив объектов; затем проверяем нужные поля
        const data = await response.json();

        if (!Array.isArray(data) || !data.every(function (user) {
            return user && typeof user.id === 'number' &&
                typeof user.name === 'string' && typeof user.email === 'string' &&
                user.address && typeof user.address.city === 'string';
        })) {
            throw new Error('Некорректный формат данных');
        }

        // Сохраняем полученных пользователей, чтобы искать по ним локально
        users = data;
        selectedUserId = null;
        selectedUser.textContent = 'Пользователь не выбран';
        postsList.replaceChildren();

        showMessage(postsStatus, 'Выберите пользователя и нажмите «Показать публикации».');
        renderUsers();

        showMessage(
            usersStatus,
            'Загружено пользователей: ' + users.length + ' (HTTP ' + httpStatus + ').',
            'success'
        );

    } catch (error) {
        const statusText = httpStatus === null
            ? 'HTTP-ответ не получен'
            : 'HTTP ' + httpStatus;

        showMessage(
            usersStatus,
            'Не удалось загрузить пользователей (' + statusText + '): ' + error.message,
            'error'
        );

    } finally {
        // Кнопка снова доступна и после ошибки
        isLoadingUsers = false;
        updateButtons();
        renderUsers();
    }
});

// Поиск запускается при каждом изменении поля и не обращается к серверу
searchInput.addEventListener('input', function () {
    renderUsers();
});

// Делегирование событий: кнопки пользователей создаются динамически
usersList.addEventListener('click', async function (event) {
    // Находим нажатую кнопку по атрибуту data-user-id
    const button = event.target.closest('button[data-user-id]');

    if (!button || !usersList.contains(button) || isLoadingUsers || isLoadingPosts) {
        return;
    }

    const userId = Number(button.dataset.userId);

    // Ищем выбранного пользователя в уже загруженном массиве
    const user = users.find(function (item) {
        return item.id === userId;
    });

    if (!user) {
        return;
    }

    // Показываем имя выбранного пользователя и очищаем прежние публикации
    selectedUserId = user.id;
    selectedUser.textContent = user.name;
    postsList.replaceChildren();

    isLoadingPosts = true;
    updateButtons();
    renderUsers();
    showMessage(postsStatus, 'Загрузка...');

    let httpStatus = null;

    try {
        // GET: подставляем реальный ID выбранного пользователя в адрес
        const response = await fetch(
            POSTS_URL + '?userId=' + encodeURIComponent(user.id)
        );

        httpStatus = response.status;

        if (!response.ok) {
            throw new Error('Сервер вернул ошибку');
        }

        const data = await response.json();

        if (!Array.isArray(data) || !data.every(function (post) {
            return post && typeof post.title === 'string' &&
                typeof post.body === 'string';
        })) {
            throw new Error('Некорректный формат данных');
        }

        // Выводим только первые три публикации выбранного пользователя
        // slice(0, 3) создаёт массив из первых трёх записей ответа
        const firstThree = data.slice(0, 3);

        // Заголовки и тексты создаём как отдельные HTML-элементы
        firstThree.forEach(function (post) {
            const item = document.createElement('li');
            item.className = 'post';

            item.appendChild(createTextElement('h3', 'post-title', post.title));
            item.appendChild(createTextElement('p', 'post-body', post.body));

            postsList.appendChild(item);
        });

        showMessage(
            postsStatus,
            'Загружено публикаций: ' + firstThree.length + ' (HTTP ' + httpStatus + ').',
            'success'
        );

    } catch (error) {
        const statusText = httpStatus === null
            ? 'HTTP-ответ не получен'
            : 'HTTP ' + httpStatus;

        showMessage(
            postsStatus,
            'Не удалось загрузить публикации (' + statusText + '): ' + error.message,
            'error'
        );

    } finally {
        // После любого результата разрешаем снова нажимать кнопки
        isLoadingPosts = false;
        updateButtons();
        renderUsers();
    }
});

// Первоначально отображаем пустой список
renderUsers();
