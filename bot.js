const TelegramBot = require('node-telegram-bot-api');

// 🔑 Token
const token = '8225621650:AAHutY_ziXi5L2oICDdOl_20wj_Lt2KMPRM';
const bot = new TelegramBot(token, { polling: true });

// ===== Base de données en mémoire =====
const members = {}; // { chatId: {userId: role} }
const logs = [];
const bannedWords = ['spam','mauvaismot'];
const faq = {
  'horaires': 'Nous sommes ouverts de 8h à 18h.',
  'contact': 'Contactez-nous par email: contact@exemple.com',
};
const sharedContent = [];
const userSettings = {}; // { userId: { notifications: true, language: 'fr' } }

// =====================
// ===== MENU / START =====
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Initialiser paramètres si non existants
  const userId = msg.from.id;
  if (!userSettings[userId]) userSettings[userId] = { notifications: true, language: 'fr' };

  bot.sendMessage(chatId, `Salut ${msg.from.first_name} ! Ravie de pouvoir vous aider, je suis WeltDigitalBot. 🤖\nVoici le menu :`, {
    reply_markup: {
      keyboard: [
        ['🤖 À propos du bot', '👤 Mon compte'],
        ['⭐️ Passer premium', '⚙️ Paramètres'],
        ['Aides ❓', 'Recherche web 🔍'],
        ['Avis 📝']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
});

// =====================
// ===== GESTION DES MENUS =====
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!userSettings[userId]) userSettings[userId] = { notifications: true, language: 'fr' };

  switch (text) {
    case '🤖 À propos du bot':
      bot.sendMessage(chatId, `Je suis un bot Telegram développé pour gérer les membres, modérer les messages, lancer des sondages, partager du contenu et plus encore !`);
      break;

    case '👤 Mon compte':
      bot.sendMessage(chatId, `🆔 ID: ${userId}\nNom: ${msg.from.first_name} ${msg.from.last_name || ''}\nUsername: @${msg.from.username || 'inconnu'}\nNotifications: ${userSettings[userId].notifications ? 'ON' : 'OFF'}\nLangue: ${userSettings[userId].language}`);
      break;

    case '⭐️ Passer premium':
      bot.sendMessage(chatId, `Pour passer premium, vous pouvez payer via MTN/Orange Money via le "+237 677576783".`);
      break;

    case '⚙️ Paramètres':
      bot.sendMessage(chatId, `Paramètres disponibles :`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `Notifications: ${userSettings[userId].notifications ? 'ON' : 'OFF'}`, callback_data: 'toggle_notifications' }],
            [{ text: `Langue: ${userSettings[userId].language}`, callback_data: 'toggle_language' }]
          ]
        }
      });
      break;

    case 'Aides ❓':
      bot.sendMessage(chatId, `Voici quelques aides disponibles :\n- Tape /help pour voir toutes les commandes\n- Contactez le support si besoin.`);
      break;

    case 'Recherche web 🔍':
      bot.sendMessage(chatId, `Fonction de recherche web bientôt disponible !`);
      break;

    case 'Avis 📝':
      bot.sendMessage(chatId, `Merci de donner votre avis ! Tapez votre message et il sera archivé.`);
      break;

    default:
      break;
  }
});

// =====================
// ===== CALLBACK PARAMÈTRES =====
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (!userSettings[userId]) userSettings[userId] = { notifications: true, language: 'fr' };

  if (data === 'toggle_notifications') {
    userSettings[userId].notifications = !userSettings[userId].notifications;
    bot.editMessageReplyMarkup({
      inline_keyboard: [
        [{ text: `Notifications: ${userSettings[userId].notifications ? 'ON' : 'OFF'}`, callback_data: 'toggle_notifications' }],
        [{ text: `Langue: ${userSettings[userId].language}`, callback_data: 'toggle_language' }]
      ]
    }, { chat_id: chatId, message_id: msg.message_id });
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Notifications modifiées' });
  }

  if (data === 'toggle_language') {
    userSettings[userId].language = userSettings[userId].language === 'fr' ? 'en' : 'fr';
    bot.editMessageReplyMarkup({
      inline_keyboard: [
        [{ text: `Notifications: ${userSettings[userId].notifications ? 'ON' : 'OFF'}`, callback_data: 'toggle_notifications' }],
        [{ text: `Langue: ${userSettings[userId].language}`, callback_data: 'toggle_language' }]
      ]
    }, { chat_id: chatId, message_id: msg.message_id });
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Langue modifiée' });
  }
});

// =====================
// ===== GESTION DES MEMBRES & MODÉRATION =====
bot.on('new_chat_members', (msg) => {
  const chatId = msg.chat.id;
  msg.new_chat_members.forEach(member => {
    bot.sendMessage(chatId, `Bienvenue ${member.first_name}! 🎉`);
    if (!members[chatId]) members[chatId] = {};
    members[chatId][member.id] = 'membre';
    logs.push(`${new Date().toISOString()} - ${member.first_name} a rejoint ${msg.chat.title}`);
  });
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.toLowerCase();

  // Modération des messages inappropriés
  if (msg.chat.type !== 'private' && text) {
    if (bannedWords.some(word => text.includes(word))) {
      bot.deleteMessage(chatId, msg.message_id).catch(() => {});
      bot.sendMessage(chatId, `Message supprimé pour contenu inapproprié.`);
      logs.push(`${new Date().toISOString()} - Message supprimé de ${msg.from.first_name}: "${msg.text}"`);
    }
  }
});

// Commandes rôle & bannissement (admin uniquement)
bot.onText(/\/role (\d+) (\w+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') return;
  const userId = match[1];
  const role = match[2];

  if (!members[chatId] || members[chatId][msg.from.id] !== 'admin') {
    return bot.sendMessage(chatId, '❌ Vous n’avez pas la permission de changer les rôles.');
  }

  if (!members[chatId]) members[chatId] = {};
  members[chatId][userId] = role;
  bot.sendMessage(chatId, `Le rôle de l’utilisateur ${userId} est maintenant "${role}".`);
  logs.push(`${new Date().toISOString()} - Rôle de ${userId} changé en ${role} par ${msg.from.first_name}`);
});

bot.onText(/\/ban (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') return;
  const userId = match[1];

  if (!members[chatId] || members[chatId][msg.from.id] !== 'admin') {
    return bot.sendMessage(chatId, '❌ Vous n’avez pas la permission de bannir.');
  }

  bot.kickChatMember(chatId, userId).catch(() => {});
  bot.sendMessage(chatId, `Utilisateur ${userId} banni !`);
  logs.push(`${new Date().toISOString()} - ${msg.from.first_name} a banni ${userId}`);
});

// =====================
// ===== RÉPONSES AUTOMATIQUES =====
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.toLowerCase();

  if (faq[text]) {
    bot.sendMessage(chatId, faq[text]);
  }
});

// =====================
// ===== SONDAGES =====
bot.onText(/\/poll (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') return;
  const question = match[1];
  bot.sendPoll(chatId, question, ['Oui', 'Non']);
  logs.push(`${new Date().toISOString()} - Sondage lancé: ${question} par ${msg.from.first_name}`);
});

// =====================
// ===== NOTIFICATIONS & RAPPELS =====
bot.onText(/\/remind (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];

  setTimeout(() => {
    bot.sendMessage(chatId, `⏰ Rappel: ${text}`);
  }, 10000); // exemple 10s

  bot.sendMessage(chatId, `Rappel programmé !`);
  logs.push(`${new Date().toISOString()} - Rappel créé: ${text} par ${msg.from.first_name}`);
});

// =====================
// ===== PARTAGE & ARCHIVAGE =====
bot.onText(/\/share (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') return;
  const content = match[1];
  sharedContent.push({ user: msg.from.first_name, content });
  bot.sendMessage(chatId, `Contenu partagé et archivé.`);
  logs.push(`${new Date().toISOString()} - Contenu partagé par ${msg.from.first_name}: ${content}`);
});

bot.onText(/\/archive/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') return;
  if (sharedContent.length === 0) {
    bot.sendMessage(chatId, 'Aucun contenu archivé.');
  } else {
    let archiveMsg = '📚 Contenus archivés:\n';
    sharedContent.forEach((c, i) => {
      archiveMsg += `${i + 1}. ${c.user}: ${c.content}\n`;
    });
    bot.sendMessage(chatId, archiveMsg);
  }
});

// =====================
// ===== LOGS =====
bot.onText(/\/logs/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') return;

  if (!members[chatId] || members[chatId][msg.from.id] !== 'admin') {
    return bot.sendMessage(chatId, '❌ Vous n’avez pas la permission de voir les logs.');
  }

  if (logs.length === 0) return bot.sendMessage(chatId, 'Aucun log disponible.');
  const logsToSend = logs.slice(-20).join('\n'); // derniers 20 logs
  bot.sendMessage(chatId, `📜 Logs récents:\n${logsToSend}`);
});

// =====================
// ===== HELP =====
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
Commandes disponibles:
/start - Démarrer le bot
/help - Afficher l'aide
/role [userId] [role] - Changer le rôle (admin seulement)
/ban [userId] - Bannir un membre
/poll [question] - Lancer un sondage (admin seulement)
/remind [message] - Programmer un rappel
/share [contenu] - Partager du contenu
/archive - Afficher les contenus archivés
/logs - Voir les logs (admin seulement)
`);
});
