export default {
  ru: {
    shopping: {
      title: 'Покупки',
      subtitle: 'Списки покупок и их стоимость',

      // списки
      addList: 'Новый список',
      addListTitle: 'Новый список',
      renameListTitle: 'Переименовать список',
      deleteListTitle: 'Удалить список',
      deleteListConfirm: 'Удалить список «{{name}}» со всеми позициями?',
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
      deleteItemConfirm: 'Удалить «{{name}}»?',
      name: 'Название',
      namePlaceholder: 'Что купить',
      qty: 'Количество',
      price: 'Цена',
      priceOptional: 'Цена (необязательно)',
      currency: 'Валюта',

      // итоги
      total: 'Итого',
      remaining: 'Осталось купить',
      itemsCount: 'позиций: {{count}}',
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

      // частые товары
      frequent: 'Частые товары',
    },
  },
  en: {
    shopping: {
      title: 'Shopping',
      subtitle: 'Shopping lists and their cost',

      // lists
      addList: 'New list',
      addListTitle: 'New list',
      renameListTitle: 'Rename list',
      deleteListTitle: 'Delete list',
      deleteListConfirm: 'Delete the list "{{name}}" with all its items?',
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
      deleteItemConfirm: 'Delete "{{name}}"?',
      name: 'Name',
      namePlaceholder: 'What to buy',
      qty: 'Quantity',
      price: 'Price',
      priceOptional: 'Price (optional)',
      currency: 'Currency',

      // totals
      total: 'Total',
      remaining: 'Remaining to buy',
      itemsCount: 'items: {{count}}',
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

      // frequent items
      frequent: 'Frequent items',
    },
  },
}
