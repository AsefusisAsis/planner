// Совместимость: модуль курсов переехал в ./rates (агрегатор + НБРБ, пивот
// USD). Реэкспорт сохранён, чтобы старые импорты `./nbrb` не ломались; новый
// код импортирует из ./rates напрямую.
export { getRates, convert, rateOf, formatMoney, type RateTable } from './rates'
