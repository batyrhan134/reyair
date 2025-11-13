/**
 * Google Apps Script для ReyAir
 * 
 * ИНСТРУКЦИЯ ПО НАСТРОЙКЕ:
 * 
 * 1. Создайте новую Google Таблицу:
 *    - Перейдите на https://sheets.google.com
 *    - Создайте новую таблицу с названием "ReyAir Users"
 *    - Первый лист должен называться "Users"
 *    - В первой строке добавьте заголовки: Name | Email | Password | Age | Registration Date
 * 
 * 2. Откройте редактор скриптов:
 *    - В таблице: Расширения → Apps Script
 *    - Удалите весь код по умолчанию
 *    - Скопируйте и вставьте весь код из этого файла
 * 
 * 3. Разверните веб-приложение:
 *    - Нажмите "Развернуть" → "Новое развертывание"
 *    - Тип: "Веб-приложение"
 *    - Описание: "ReyAir Auth API"
 *    - Кто имеет доступ: "Все"
 *    - Нажмите "Развернуть"
 *    - Скопируйте URL веб-приложения
 * 
 * 4. Обновите код в index.html:
 *    - Замените GOOGLE_SCRIPT_URL на скопированный URL
 */

// Получаем активную таблицу
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Получаем лист пользователей
function getUsersSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Users');
  
  // Создаем лист, если он не существует
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    sheet.appendRow(['Name', 'Email', 'Password', 'Age', 'Registration Date']);
  }
  
  return sheet;
}

// Простое хеширование пароля (в реальном проекте используйте более надежные методы)
function hashPassword(password) {
  return Utilities.base64Encode(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + 'ReyAirSalt2024'
  ));
}

// Функция регистрации
function registerUser(data) {
  try {
    const sheet = getUsersSheet();
    const email = data.email.toLowerCase().trim();
    
    // Проверяем, существует ли пользователь
    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return {
        success: false,
        message: 'Пользователь с таким email уже зарегистрирован'
      };
    }
    
    // Валидация данных
    if (!data.name || data.name.trim().length < 2) {
      return { success: false, message: 'Имя должно содержать минимум 2 символа' };
    }
    
    if (!data.email || !isValidEmail(email)) {
      return { success: false, message: 'Неверный формат email' };
    }
    
    if (!data.password || data.password.length < 6) {
      return { success: false, message: 'Пароль должен содержать минимум 6 символов' };
    }
    
    if (!data.age || data.age < 1 || data.age > 120) {
      return { success: false, message: 'Неверный возраст' };
    }
    
    // Хешируем пароль
    const hashedPassword = hashPassword(data.password);
    
    // Добавляем пользователя
    const registrationDate = new Date().toISOString();
    sheet.appendRow([
      data.name.trim(),
      email,
      hashedPassword,
      parseInt(data.age),
      registrationDate
    ]);
    
    return {
      success: true,
      message: 'Регистрация успешна!',
      user: {
        name: data.name.trim(),
        email: email,
        age: parseInt(data.age)
      }
    };
    
  } catch (error) {
    Logger.log('Registration error: ' + error.toString());
    return {
      success: false,
      message: 'Ошибка сервера: ' + error.toString()
    };
  }
}

// Функция входа
function loginUser(data) {
  try {
    const email = data.email.toLowerCase().trim();
    const hashedPassword = hashPassword(data.password);
    
    // Находим пользователя
    const user = findUserByEmail(email);
    
    if (!user) {
      return {
        success: false,
        message: 'Пользователь не найден'
      };
    }
    
    // Проверяем пароль
    if (user.password !== hashedPassword) {
      return {
        success: false,
        message: 'Неверный пароль'
      };
    }
    
    return {
      success: true,
      message: 'Вход выполнен успешно!',
      user: {
        name: user.name,
        email: user.email,
        age: user.age
      }
    };
    
  } catch (error) {
    Logger.log('Login error: ' + error.toString());
    return {
      success: false,
      message: 'Ошибка сервера: ' + error.toString()
    };
  }
}

// Поиск пользователя по email
function findUserByEmail(email) {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  
  // Пропускаем заголовок (индекс 0)
  for (let i = 1; i < data.length; i++) {
    if (data[i][1].toLowerCase() === email.toLowerCase()) {
      return {
        row: i + 1,
        name: data[i][0],
        email: data[i][1],
        password: data[i][2],
        age: data[i][3],
        registrationDate: data[i][4]
      };
    }
  }
  
  return null;
}

// Валидация email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Главная функция обработки POST запросов
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let result;
    
    switch(action) {
      case 'register':
        result = registerUser(data);
        break;
        
      case 'login':
        result = loginUser(data);
        break;
        
      default:
        result = {
          success: false,
          message: 'Неизвестное действие'
        };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'Ошибка обработки запроса: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Обработка GET запросов (для тестирования)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ReyAir Auth API is running',
      version: '1.0',
      endpoints: {
        register: 'POST with action: register',
        login: 'POST with action: login'
      }
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Функция для тестирования (можно вызвать вручную)
function testAPI() {
  // Тест регистрации
  const registerResult = registerUser({
    name: 'Тестовый Пользователь',
    email: 'test@example.com',
    password: 'password123',
    age: 25
  });
  Logger.log('Register test: ' + JSON.stringify(registerResult));
  
  // Тест входа
  const loginResult = loginUser({
    email: 'test@example.com',
    password: 'password123'
  });
  Logger.log('Login test: ' + JSON.stringify(loginResult));
}
