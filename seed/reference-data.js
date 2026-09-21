'use strict';


const menuItems = [
  /* Starters */
  ['Steamed shrimp dumplings (har gow, 4 pcs)', 'har gow', 7.5, 'STARTER', null],
  ['Crispy vegetable spring rolls (4 pcs)', 'spring rolls', 6, 'STARTER', null],
  ['Pan-fried pork and chive gyoza (6 pcs)', 'gyoza', 7, 'STARTER', null],
  ['Miso soup with tofu and wakame', 'miso soup', 4, 'STARTER', null],
  ['Edamame with sea salt', 'edamame', 5, 'STARTER', null],
  ['Seaweed salad with sesame dressing', 'seaweed salad', 5.5, 'STARTER', null],
  ['Salmon tartare with avocado and sesame', 'salmon tartare', 9, 'STARTER', null],
  /* Main */
  ['Salmon nigiri (2 pcs)', 'salmon nigiri', 6, 'MAIN', null],
  ['Tuna nigiri (2 pcs)', 'tuna nigiri', 7, 'MAIN', null],
  ['California roll with crab and avocado (8 pcs)', 'california roll', 9, 'MAIN', null],
  ['Dragon roll with grilled eel and avocado (8 pcs)', 'dragon roll', 13, 'MAIN', null],
  ['Chirashi bowl: assorted sashimi on sushi rice', 'chirashi', 19, 'MAIN', null],
  ['Assorted sushi and maki platter (24 pcs)', 'sushi platter', 32, 'MAIN', null],
  ['Tonkotsu ramen with pork belly and soft-boiled egg', 'ramen', 14, 'MAIN', null],
  ['Kung Pao chicken with peanuts', 'kung pao chicken', 15, 'MAIN', null],
  ['Sweet and sour pork', 'sweet and sour pork', 14, 'MAIN', null],
  ['Peking duck (half) with pancakes and hoisin sauce', 'peking duck', 28, 'MAIN', null],
  ['Mapo tofu with minced pork and Sichuan pepper', 'mapo tofu', 13, 'MAIN', null],
  ['Cantonese fried rice with egg and shrimp', 'fried rice', 10, 'MAIN', null],
  ['Stir-fried noodles with vegetables', 'chow mein', 11, 'MAIN', null],
  /* Desserts */
  ['Mochi ice cream (3 pcs)', 'mochi', 6, 'DESSERT', null],
  ['Mango sticky rice with coconut cream', 'mango sticky rice', 8, 'DESSERT', null],
  ['Sesame balls filled with red bean paste (4 pcs)', 'sesame balls', 6.5, 'DESSERT', null],
  ['Hong Kong egg tarts (2 pcs)', 'egg tart', 5.5, 'DESSERT', null],
  ['Fresh lychees', 'lychees', 5, 'DESSERT', null],
  /* Beverages */
  ['Jasmine tea (pot)', 'jasmine tea', 3.5, 'BEVERAGE', null],
  ['Japanese green tea (sencha, pot)', 'green tea', 3.5, 'BEVERAGE', null],
  ['Ramune Japanese soda (20cl)', 'ramune', 3.5, 'BEVERAGE', null],
  ['Lychee juice (25cl)', 'lychee juice', 3.5, 'BEVERAGE', null],
  ['Bottled water', 'bottled water', 1, 'BEVERAGE', null],
  ['Tsingtao beer (33cl)', 'tsingtao', 4.5, 'BEVERAGE', null],
  ['Warm sake (18cl)', 'sake', 6, 'BEVERAGE', null],
  ['Umeshu plum wine', 'plum wine', 5.5, 'BEVERAGE', null],
].map(([fullName, shortName, price, category, image]) => ({ fullName, shortName, price, category, image }));

const recipes = [
  /* Starters */
  ['har gow', 'HOT_DISH', ['Fill the translucent dough with shrimp', 'Fold the dumplings', 'Steam them for a few minutes'], 14],
  ['spring rolls', 'HOT_DISH', ['Roll the vegetable filling in rice paper', 'Deep-fry until golden', 'Serve with sweet chili sauce'], 12],
  ['gyoza', 'HOT_DISH', ['Take the gyoza', 'Pan-fry them until crispy on one side', 'Add water and cover to steam', 'Serve with soy and vinegar dip'], 12],
  ['miso soup', 'HOT_DISH', ['Heat the dashi broth', 'Dissolve the miso paste', 'Add tofu cubes and wakame'], 8],
  ['edamame', 'HOT_DISH', ['Boil the edamame pods', 'Sprinkle with sea salt'], 6],
  ['seaweed salad', 'COLD_DISH', ['Take the wakame seaweed', 'Add the sesame dressing', 'Sprinkle with sesame seeds'], 5],
  ['salmon tartare', 'COLD_DISH', ['Dice the fresh salmon and the avocado', 'Mix with soy sauce and sesame oil', 'Shape it with a ring mold'], 10],
  /* Main */
  ['salmon nigiri', 'COLD_DISH', ['Shape the sushi rice', 'Add a dab of wasabi', 'Lay a slice of salmon on top'], 8],
  ['tuna nigiri', 'COLD_DISH', ['Shape the sushi rice', 'Add a dab of wasabi', 'Lay a slice of tuna on top'], 8],
  ['california roll', 'COLD_DISH', ['Spread the rice on the nori sheet', 'Add crab, avocado and cucumber', 'Roll it and cut in 8 pieces'], 12],
  ['dragon roll', 'COLD_DISH', ['Grill the eel', 'Roll the rice, the eel and the cucumber in the nori sheet', 'Cover with avocado slices', 'Drizzle with unagi sauce'], 18],
  ['chirashi', 'COLD_DISH', ['Fill a bowl with sushi rice', 'Slice the fish', 'Arrange the sashimi on the rice', 'Add pickled ginger and wasabi'], 15],
  ['sushi platter', 'COLD_DISH', ['Prepare the nigiri', 'Prepare the maki rolls', 'Arrange everything on the wooden board', 'Add pickled ginger, wasabi and soy sauce'], 28],
  ['ramen', 'HOT_DISH', ['Heat the pork bone broth', 'Cook the noodles', 'Add the pork belly and the egg', 'Top with scallions and nori'], 20],
  ['kung pao chicken', 'HOT_DISH', ['Marinate the chicken', 'Stir-fry it in the wok with dried chili', 'Add the sauce and the peanuts'], 15],
  ['sweet and sour pork', 'HOT_DISH', ['Deep-fry the battered pork', 'Cook the sweet and sour sauce with pineapple and peppers', 'Toss everything in the wok'], 16],
  ['peking duck', 'HOT_DISH', ['Take the roasted duck', 'Carve the crispy skin and the meat', 'Serve with pancakes, cucumber, scallions and hoisin sauce'], 30],
  ['mapo tofu', 'HOT_DISH', ['Stir-fry the minced pork with chili bean paste', 'Add the tofu cubes and the broth', 'Simmer and sprinkle with Sichuan pepper'], 14],
  ['fried rice', 'HOT_DISH', ['Heat the wok', 'Stir-fry the cold rice with the egg', 'Add shrimp and peas', 'Season with soy sauce'], 10],
  ['chow mein', 'HOT_DISH', ['Boil the noodles', 'Stir-fry the vegetables in the wok', 'Toss the noodles with soy sauce'], 12],
  /* Desserts */
  ['mochi', 'COLD_DISH', ['Take the mochi from the freezer', 'Let them soften for a minute', 'Put them on a plate'], 6],
  ['mango sticky rice', 'COLD_DISH', ['Take the sticky rice', 'Slice the mango', 'Pour the coconut cream'], 8],
  ['sesame balls', 'HOT_DISH', ['Take the sesame balls', 'Deep-fry until golden', 'Serve them hot'], 10],
  ['egg tart', 'HOT_DISH', ['Take the egg tarts', 'Warm them in the oven', 'Serve them warm'], 8],
  ['lychees', 'COLD_DISH', ['Peel the lychees', 'Serve them in a bowl with ice'], 5],
  /* Beverages */
  ['jasmine tea', 'BAR', ['Heat the water to 80 degrees', 'Put the jasmine tea in the pot', 'Let it infuse', 'Serve it!'], 25],
  ['green tea', 'BAR', ['Heat the water to 70 degrees', 'Put the sencha in the pot', 'Let it infuse', 'Serve it!'], 25],
  ['ramune', 'BAR', ['Serve it!'], 2],
  ['lychee juice', 'BAR', ['Serve it!'], 2],
  ['bottled water', 'BAR', ['Serve it!'], 2],
  ['tsingtao', 'BAR', ['Serve it!'], 2],
  ['sake', 'BAR', ['Warm the sake in a tokkuri', 'Serve it!'], 8],
  ['plum wine', 'BAR', ['Pour it over ice', 'Serve it!'], 3],
].map(([shortName, post, cookingSteps, meanCookingTimeInSec]) => ({ shortName, post, cookingSteps, meanCookingTimeInSec }));

const tableNumbers = Array.from({ length: 15 }, (_, index) => index + 1);

module.exports = { menuItems, recipes, tableNumbers };
