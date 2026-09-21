#!/usr/bin/env node
'use strict';


const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');

const { menuItems, recipes, tableNumbers } = require('./reference-data');

const URIS = {
  menu: process.env.MENU_MONGODB_URI || 'mongodb://localhost:27018/menu-db',
  dining: process.env.DINING_MONGODB_URI || 'mongodb://localhost:27019/dining-db',
  kitchen: process.env.KITCHEN_MONGODB_URI || 'mongodb://localhost:27020/kitchen-db',
};


const ORDERS = [
  {
    key: 'table-1-billed',
    tableNumber: 1,
    customersCount: 2,
    openedMinutesAgo: 180,
    billedMinutesAgo: 90,
    rounds: [
      { sentMinutesAgo: 170, items: { 'jasmine tea': 2, 'dragon roll': 1, 'sweet and sour pork': 1 }, progress: 'served' },
      { sentMinutesAgo: 110, items: { mochi: 2 }, progress: 'served' },
    ],
    pending: {},
  },
  {
    key: 'table-3-in-progress',
    tableNumber: 3,
    customersCount: 4,
    openedMinutesAgo: 40,
    billedMinutesAgo: null,
    rounds: [
      { sentMinutesAgo: 35, items: { tsingtao: 2, sake: 1 }, progress: 'served' },
      { sentMinutesAgo: 4, items: { 'salmon nigiri': 2, 'miso soup': 1 }, progress: 'ready' },
      { sentMinutesAgo: 1, items: { 'peking duck': 1, 'fried rice': 2 }, progress: 'cooking' },
    ],
    pending: { 'mango sticky rice': 2 },
  },
  {
    key: 'table-5-ordering',
    tableNumber: 5,
    customersCount: 2,
    openedMinutesAgo: 5,
    billedMinutesAgo: null,
    rounds: [],
    pending: { 'plum wine': 2, 'salmon tartare': 1 },
  },
  {
    key: 'table-7-just-seated',
    tableNumber: 7,
    customersCount: 1,
    openedMinutesAgo: 1,
    billedMinutesAgo: null,
    rounds: [],
    pending: {},
  },
];

const oid = (label) => new ObjectId(crypto.createHash('sha1').update(`micro-restaurant-seed:${label}`).digest('hex').slice(0, 24));

/* Same split as KitchenFacadeService.receivePreparation: a preparation per post, cold and hot dishes share their cooking time. */
function preparationGroups(items, recipesByName) {
  const byPost = { BAR: [], COLD_DISH: [], HOT_DISH: [] };
  Object.entries(items).forEach(([shortName, howMany]) => {
    const recipe = recipesByName.get(shortName);
    if (!recipe) {
      throw new Error(`No recipe for "${shortName}"`);
    }
    byPost[recipe.post].push({ shortName, recipe, howMany });
  });

  const maxTime = (entries) => Math.max(...entries.map(({ recipe }) => recipe.meanCookingTimeInSec));
  const dishesMaxTime = maxTime([...byPost.COLD_DISH, ...byPost.HOT_DISH]);

  return [
    { post: 'BAR', entries: byPost.BAR, maxTime: byPost.BAR.length > 0 ? maxTime(byPost.BAR) : 0 },
    { post: 'COLD_DISH', entries: byPost.COLD_DISH, maxTime: dishesMaxTime },
    { post: 'HOT_DISH', entries: byPost.HOT_DISH, maxTime: dishesMaxTime },
  ].filter(({ entries }) => entries.length > 0);
}

/* 'cooking': first item is done, the second one is on the stove, the others did not start. */
function preparedItemTimes(progress, index, count, shouldStartAt, shouldBeReadyAt) {
  if (progress !== 'cooking') {
    return { startedAt: shouldStartAt, finishedAt: shouldBeReadyAt };
  }
  const doneCount = count > 1 ? 1 : 0;
  if (index < doneCount) {
    return { startedAt: shouldStartAt, finishedAt: shouldBeReadyAt };
  }
  if (index === doneCount) {
    return { startedAt: shouldStartAt, finishedAt: null };
  }
  return { startedAt: null, finishedAt: null };
}

function buildDocuments(menuByName, recipesByName, now) {
  const minutesAgo = (minutes) => new Date(now - minutes * 60 * 1000);

  const tableOrders = [];
  const preparations = [];
  const preparedItems = [];
  const takenTables = new Map(); // table number -> taken

  ORDERS.forEach((order) => {
    const lines = [];
    const orderPreparations = [];
    const toLine = (shortName, howMany, sentForPreparation) => {
      const menuItem = menuByName.get(shortName);
      if (!menuItem) {
        throw new Error(`No menu item for "${shortName}"`);
      }
      return { item: { _id: menuItem._id.toString(), shortName }, howMany, sentForPreparation };
    };

    order.rounds.forEach((round, roundIndex) => {
      const sentAt = minutesAgo(round.sentMinutesAgo);
      Object.entries(round.items).forEach(([shortName, howMany]) => lines.push(toLine(shortName, howMany, true)));

      preparationGroups(round.items, recipesByName).forEach(({ post, entries, maxTime }) => {
        const preparationLabel = `${order.key}:round-${roundIndex}:${post}`;
        const shouldBeReadyAt = new Date(sentAt.getTime() + maxTime * 1000);
        const units = entries.flatMap(({ shortName, recipe, howMany }) => Array.from({ length: howMany }, () => ({ shortName, recipe })));

        const items = units.map(({ shortName, recipe }, index) => {
          const shouldStartAt = new Date(shouldBeReadyAt.getTime() - recipe.meanCookingTimeInSec * 1000);
          return {
            _id: oid(`prepared-item:${preparationLabel}:${index}`),
            shortName,
            recipe: recipe._id,
            shouldStartAt,
            ...preparedItemTimes(round.progress, index, units.length, shouldStartAt, shouldBeReadyAt),
          };
        });

        const preparation = {
          _id: oid(`preparation:${preparationLabel}`),
          tableNumber: order.tableNumber,
          shouldBeReadyAt,
          completedAt: round.progress === 'cooking' ? null : shouldBeReadyAt,
          takenForServiceAt: round.progress === 'served' ? new Date(shouldBeReadyAt.getTime() + 45 * 1000) : null,
          preparedItems: items.map(({ _id }) => _id),
        };

        preparedItems.push(...items);
        preparations.push(preparation);
        // dining-service keeps the kitchen answer as received over HTTP: ids and dates as strings
        orderPreparations.push({
          _id: preparation._id.toString(),
          shouldBeReadyAt: shouldBeReadyAt.toISOString(),
          preparedItems: items.map(({ _id, shortName }) => ({ _id: _id.toString(), shortName })),
        });
      });
    });

    Object.entries(order.pending).forEach(([shortName, howMany]) => lines.push(toLine(shortName, howMany, false)));

    const billed = order.billedMinutesAgo === null ? null : minutesAgo(order.billedMinutesAgo);
    takenTables.set(order.tableNumber, billed === null);
    tableOrders.push({
      _id: oid(`table-order:${order.key}`),
      tableNumber: order.tableNumber,
      customersCount: order.customersCount,
      opened: minutesAgo(order.openedMinutesAgo),
      lines,
      preparations: orderPreparations,
      billed,
    });
  });

  return { tableOrders, preparations, preparedItems, takenTables };
}

/* Insert only what is missing, matched on a natural key: never overrides existing documents. */
async function insertMissing(collection, key, documents) {
  const result = await collection.bulkWrite(documents.map((document) => {
    const { [key]: keyValue, ...rest } = document;
    return { updateOne: { filter: { [key]: keyValue }, update: { $setOnInsert: rest }, upsert: true } };
  }));
  return result.upsertedCount;
}

/* Insert or replace documents that have a deterministic _id. */
async function replaceAll(collection, documents) {
  if (documents.length === 0) {
    return;
  }
  await collection.bulkWrite(documents.map((document) => (
    { replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true } }
  )));
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node seed.js [--reset]');
    return;
  }
  const reset = process.argv.includes('--reset');

  const clients = Object.fromEntries(Object.entries(URIS).map(([name, uri]) => [name, new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })]));
  try {
    await Promise.all(Object.values(clients).map((client) => client.connect()));

    const menuDb = clients.menu.db();
    const diningDb = clients.dining.db();
    const kitchenDb = clients.kitchen.db();

    const menuItemsCollection = menuDb.collection('menuitems');
    const recipesCollection = kitchenDb.collection('recipes');
    const preparationsCollection = kitchenDb.collection('preparations');
    const preparedItemsCollection = kitchenDb.collection('prepareditems');
    const tablesCollection = diningDb.collection('tables');
    const tableOrdersCollection = diningDb.collection('tableorders');

    if (reset) {
      await Promise.all([
        tableOrdersCollection.deleteMany({}),
        preparationsCollection.deleteMany({}),
        preparedItemsCollection.deleteMany({}),
        tablesCollection.updateMany({}, { $set: { taken: false } }),
      ]);
      console.log('reset: table orders, preparations and prepared items cleared, tables released');
    }

    const insertedMenuItems = await insertMissing(menuItemsCollection, 'shortName', menuItems);
    const insertedRecipes = await insertMissing(recipesCollection, 'shortName', recipes);
    const insertedTables = await insertMissing(tablesCollection, 'number', tableNumbers.map((number) => ({ number, taken: false })));

    // read back the real ids: the documents may have been created by the services' own bootstrap
    const menuByName = new Map((await menuItemsCollection.find().toArray()).map((menuItem) => [menuItem.shortName, menuItem]));
    const recipesByName = new Map((await recipesCollection.find().toArray()).map((recipe) => [recipe.shortName, recipe]));

    const { tableOrders, preparations, preparedItems, takenTables } = buildDocuments(menuByName, recipesByName, Date.now());

    await replaceAll(preparedItemsCollection, preparedItems);
    await replaceAll(preparationsCollection, preparations);
    await replaceAll(tableOrdersCollection, tableOrders);
    await Promise.all([...takenTables].map(([number, taken]) => tablesCollection.updateOne({ number }, { $set: { taken } })));

    console.log(`menu-db     menuitems      ${menuItems.length} (${insertedMenuItems} inserted)`);
    console.log(`kitchen-db  recipes        ${recipes.length} (${insertedRecipes} inserted)`);
    console.log(`kitchen-db  preparations   ${preparations.length}`);
    console.log(`kitchen-db  prepareditems  ${preparedItems.length}`);
    console.log(`dining-db   tables         ${tableNumbers.length} (${insertedTables} inserted, ${[...takenTables.values()].filter(Boolean).length} taken)`);
    console.log(`dining-db   tableorders    ${tableOrders.length}`);
  } finally {
    await Promise.all(Object.values(clients).map((client) => client.close()));
  }
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exit(1);
});
