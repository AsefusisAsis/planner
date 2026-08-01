export default {
  ru: {
    shopping: {
      title: 'Покупки',
      // --- общие списки (данные двух аккаунтов) ---
      sharedTitle: 'Общие списки',
      sharedOwner: 'вы владелец',
      sharedGuest: 'вам открыли доступ',
      sharedEmpty: 'Пока пусто — добавьте первый товар.',
      sharedInvite: 'Пригласить по ссылке',
      sharedStop: 'Перестать делиться',
      sharedLeave: 'Выйти из списка',
      sharedLinkHint: 'Отправьте ссылку. Она действует 14 дней; принять её можно только с аккаунтом.',
      sharedNote: 'Общий список виден обоим и меняется обоими. Он не попадает в резервную копию — это данные двух аккаунтов.',
      itemName: 'Название товара',
      deleteItem: 'Удалить товар',
      joinTitle: 'Общий список',
      joinSubtitle: 'Приглашение к совместному списку покупок',
      joinBadLink: 'Ссылка неполная — попросите прислать её заново.',
      joinNeedAccount: 'Чтобы присоединиться, нужен аккаунт: доступ выдаётся именно ему. Войдите или создайте аккаунт и вернитесь по ссылке.',
      joinGoSignIn: 'Перейти ко входу',
      joinBusy: 'Присоединяемся…',
      joinDone: 'Готово: список добавлен к вашим общим.',
      joinOpen: 'Открыть покупки',
      joinFailed: 'Не удалось присоединиться. Возможно, ссылка устарела или доступ отозвали.',
      joinRetry: 'Попробовать снова',
      subtitle: 'Списки покупок и их стоимость',

      // списки
      addList: 'Новый список',
      addListTitle: 'Новый список',
      renameListTitle: 'Переименовать список',
      deleteListTitle: 'Удалить список',
      listName: 'Название списка',
      listNamePlaceholder: 'Например: Продукты',
      noLists: 'Пока нет ни одного списка',
      noListsHint: 'Создайте первый список покупок, чтобы начать',
      createFirstList: 'Создать список',
      emptyList: 'В этом списке пока пусто',
      emptyList_warm: 'Список пока пуст — добавим что-нибудь? 🌿',
      emptyList_emerald: 'Пока пусто.',
      emptyListHint: 'Добавьте первую позицию в список',

      // позиции
      addItem: 'Добавить позицию',
      addItemTitle: 'Новая позиция',
      editItemTitle: 'Редактировать позицию',
      name: 'Название',
      namePlaceholder: 'Что купить',
      qty: 'Количество',
      price: 'Цена',
      priceOptional: 'Цена (необязательно)',
      plannedDate: 'Дата покупки',
      plannedDateHint: 'Появится в виджете «Покупки» на Главной',
      currency: 'Валюта',

      // итоги
      total: 'Итого',
      remaining: 'Осталось купить',
      boughtCount: 'куплено {{bought}} из {{total}}',
      progress: 'Прогресс',
      totalsTitle: 'Итоги',
      addItemTitlePanel: 'Добавить позицию',

      // в траты
      toExpense: 'В траты',
      toExpenseNone: 'Нет купленных позиций с ценой',
      toExpenseNone_warm: 'Пока нечего проводить — отметьте купленное с ценой',
      toExpenseNone_emerald: 'Проводить нечего.',
      toExpenseDone: 'Добавлена трата: {{amount}}',
      toExpenseDone_warm: 'Готово — трата добавлена: {{amount}} 🌿',
      toExpenseDone_emerald: 'Трата записана: {{amount}}.',
      toExpenseDonePartial:
        'Добавлена трата: {{amount}} (пропущено позиций без курса: {{count}})',
      toExpenseNoRates:
        'Трата не создана: нет курса ни для одной позиции ({{count}})',
      exportReset: '«{{name}}» попадёт в следующее «В траты» — позиция уже проводилась',

      // частые товары
      frequent: 'Частые товары',
    },
  },
  en: {
    shopping: {
      title: 'Shopping',
      // --- shared lists (data owned by two accounts) ---
      sharedTitle: 'Shared lists',
      sharedOwner: 'you are the owner',
      sharedGuest: 'shared with you',
      sharedEmpty: 'Empty so far — add the first item.',
      sharedInvite: 'Invite by link',
      sharedStop: 'Stop sharing',
      sharedLeave: 'Leave list',
      sharedLinkHint: 'Send the link. It is valid for 14 days and can only be accepted with an account.',
      sharedNote: 'A shared list is visible to and editable by both of you. It is not part of your backup — it belongs to two accounts.',
      itemName: 'Item name',
      deleteItem: 'Delete item',
      joinTitle: 'Shared list',
      joinSubtitle: 'Invitation to a joint shopping list',
      joinBadLink: 'The link is incomplete — ask for a new one.',
      joinNeedAccount: 'You need an account to join: access is granted to it. Sign in or create an account, then open the link again.',
      joinGoSignIn: 'Go to sign in',
      joinBusy: 'Joining…',
      joinDone: 'Done: the list has been added to your shared lists.',
      joinOpen: 'Open shopping',
      joinFailed: 'Could not join. The link may have expired or access was revoked.',
      joinRetry: 'Try again',
      subtitle: 'Shopping lists and their cost',

      // lists
      addList: 'New list',
      addListTitle: 'New list',
      renameListTitle: 'Rename list',
      deleteListTitle: 'Delete list',
      listName: 'List name',
      listNamePlaceholder: 'e.g. Groceries',
      noLists: 'No lists yet',
      noListsHint: 'Create your first shopping list to get started',
      createFirstList: 'Create list',
      emptyList: 'This list is empty',
      emptyList_warm: 'The list is empty — shall we add something? 🌿',
      emptyList_emerald: 'Empty for now.',
      emptyListHint: 'Add the first item to this list',

      // items
      addItem: 'Add item',
      addItemTitle: 'New item',
      editItemTitle: 'Edit item',
      name: 'Name',
      namePlaceholder: 'What to buy',
      qty: 'Quantity',
      price: 'Price',
      priceOptional: 'Price (optional)',
      plannedDate: 'Purchase date',
      plannedDateHint: 'Shows in the Shopping widget on Home',
      currency: 'Currency',

      // totals
      total: 'Total',
      remaining: 'Remaining to buy',
      boughtCount: 'bought {{bought}} of {{total}}',
      progress: 'Progress',
      totalsTitle: 'Totals',
      addItemTitlePanel: 'Add item',

      // to expense
      toExpense: 'To expenses',
      toExpenseNone: 'No bought items with a price',
      toExpenseNone_warm: 'Nothing to record yet — mark bought items with a price',
      toExpenseNone_emerald: 'Nothing to record.',
      toExpenseDone: 'Expense added: {{amount}}',
      toExpenseDone_warm: 'Done — expense added: {{amount}} 🌿',
      toExpenseDone_emerald: 'Expense recorded: {{amount}}.',
      toExpenseDonePartial:
        'Expense added: {{amount}} ({{count}} item(s) skipped — no exchange rate)',
      toExpenseNoRates:
        'Expense not added: no exchange rate for any item ({{count}})',
      exportReset: '“{{name}}” will be included in the next “To expenses” — it was already recorded once',

      // frequent items
      frequent: 'Frequent items',
    },
  },
}
