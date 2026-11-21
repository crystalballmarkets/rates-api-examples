// The browser's sums (assets/core.js), checked as they are: node wordpress/tests/core.test.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const core = require(path.join(__dirname, '../crystal-ball-markets-rates/assets/core.js'));

const rates = { EUR: { rate: 0.9 }, GBP: { rate: 0.8 }, BAD: { rate: 0 }, JPY: { rate: 150 } };
const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} is not ${b}`);

near(core.convert(100, 'GBP', 'EUR', rates), 112.5);
near(core.convert(5, 'USD', 'USD', rates), 5);
assert.equal(core.convert(1, 'USD', 'XXX', rates), null);
assert.equal(core.convert(1, 'USD', 'BAD', rates), null);
assert.equal(core.convert(NaN, 'USD', 'EUR', rates), null);
assert.equal(core.convert(1, 'USD', 'toString', rates), null, 'a name every object has is no currency');

near(core.goldValue(10, 1, 0.916, 3110.34768, 1), 916);
near(core.goldValue(1, core.UNITS.ounce, 1, 3680.47, 0.9), 3312.423);
assert.equal(core.goldValue(-1, 1, 1, 3000, 1), null);
assert.equal(core.goldValue(1, 1, 1, 3000, null), null);

assert.equal(core.moneyDigits(0.00012345, 2), 6);
assert.equal(core.moneyDigits(12.5, 2), 2);
assert.equal(core.moneyDigits(150.2, 0), 0);
assert.equal(core.rateDigits(0.8612), 6);
assert.equal(core.rateDigits(1552.01), 2);
assert.equal(core.rateDigits(83.1), 4);

// What a visitor types, in their own way of writing numbers.
assert.equal(core.parseAmount('1,234.56', '.'), 1234.56);
assert.equal(core.parseAmount('1.234,56', '.'), 1234.56);
assert.equal(core.parseAmount('1 234,56', '.'), 1234.56);
assert.equal(core.parseAmount("1'234.56", '.'), 1234.56);
assert.equal(core.parseAmount('1,000', '.'), 1000);
assert.equal(core.parseAmount('1,000', ','), 1);
assert.equal(core.parseAmount('1.000', ','), 1000);
assert.equal(core.parseAmount('0,5', '.'), 0.5);
assert.equal(core.parseAmount('2.5', ','), 2.5);
assert.equal(core.parseAmount('', '.'), null);
assert.equal(core.parseAmount('abc', '.'), null);
assert.equal(core.parseAmount('-5', '.'), null);
assert.equal(core.parseAmount('1e5', '.'), null);

const lists = core.currencyLists(rates);
assert.deepEqual(lists.common, ['USD', 'EUR', 'GBP', 'JPY']);
assert.deepEqual(lists.rest, ['BAD']);
assert.deepEqual(lists.all, ['BAD', 'EUR', 'GBP', 'JPY', 'USD']);

assert.deepEqual(core.pairOf(core.pairKey('USD', 'EUR')), { from: 'USD', to: 'EUR' });
assert.equal(core.pairOf('usd-eur'), null);
let pins = [];
for (const pair of ['USD-EUR', 'GBP-NGN', 'EUR-JPY', 'USD-INR', 'AUD-USD']) pins = core.togglePin(pins, pair);
assert.deepEqual(pins, ['AUD-USD', 'USD-INR', 'EUR-JPY', 'GBP-NGN'], 'four pins at most, newest first');
assert.deepEqual(core.togglePin(pins, 'USD-INR'), ['AUD-USD', 'EUR-JPY', 'GBP-NGN']);
assert.deepEqual(core.togglePin(['nonsense', 'USD-EUR'], 'bad'), ['USD-EUR']);

assert.equal(core.fill('%1$s %2$s =', '100', 'GBP'), '100 GBP =');
assert.equal(core.fill('%2$s after %1$s', 'a', 'b'), 'b after a');
assert.equal(core.fill('Rates updated %s', '14:05'), 'Rates updated 14:05');
assert.equal(core.fill(undefined, 'x'), '');

// The same sums as the server's (includes/sums.php): its tests use the same figures.
console.log('All browser sums passed');
