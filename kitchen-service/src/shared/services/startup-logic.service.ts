import { OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { Recipe } from '../schemas/recipe.schema';
import { PostEnum } from '../schemas/post-enum.schema';

export class StartupLogicService implements OnApplicationBootstrap {
  constructor(@InjectConnection() private connection: Connection) {}

  createRecipe(shortName: string, post: PostEnum, cookingSteps: string[], meanCookingTimeInSec: number): Recipe {
    const recipe: Recipe = new Recipe();
    recipe.shortName = shortName;
    recipe.post = post;
    recipe.cookingSteps = cookingSteps;
    recipe.meanCookingTimeInSec = meanCookingTimeInSec;
    return recipe;
  }

  async addRecipe(shortName: string, post: PostEnum, cookingSteps: string[], meanCookingTimeInSec: number) {
    const recipeModel = this.connection.models['Recipe'];

    const alreadyExists = await recipeModel.find({ shortName });
    if (alreadyExists.length > 0) {
      throw new Error('Recipe already exists.');
    }

    return recipeModel.create(this.createRecipe(shortName, post, cookingSteps, meanCookingTimeInSec));
  }

  async onApplicationBootstrap() {
    /* Starters */
    try {
      await this.addRecipe('har gow', PostEnum.HOT_DISH, ['Fill the translucent dough with shrimp', 'Fold the dumplings', 'Steam them for a few minutes'], 14);
    } catch (e) {
    }
    try {
      await this.addRecipe('spring rolls', PostEnum.HOT_DISH, ['Roll the vegetable filling in rice paper', 'Deep-fry until golden', 'Serve with sweet chili sauce'], 12);
    } catch (e) {
    }
    try {
      await this.addRecipe('gyoza', PostEnum.HOT_DISH, ['Take the gyoza', 'Pan-fry them until crispy on one side', 'Add water and cover to steam', 'Serve with soy and vinegar dip'], 12);
    } catch (e) {
    }
    try {
      await this.addRecipe('miso soup', PostEnum.HOT_DISH, ['Heat the dashi broth', 'Dissolve the miso paste', 'Add tofu cubes and wakame'], 8);
    } catch (e) {
    }
    try {
      await this.addRecipe('edamame', PostEnum.HOT_DISH, ['Boil the edamame pods', 'Sprinkle with sea salt'], 6);
    } catch (e) {
    }
    try {
      await this.addRecipe('seaweed salad', PostEnum.COLD_DISH, ['Take the wakame seaweed', 'Add the sesame dressing', 'Sprinkle with sesame seeds'], 5);
    } catch (e) {
    }
    try {
      await this.addRecipe('salmon tartare', PostEnum.COLD_DISH, ['Dice the fresh salmon and the avocado', 'Mix with soy sauce and sesame oil', 'Shape it with a ring mold'], 10);
    } catch (e) {
    }
    /* Main */
    try {
      await this.addRecipe('salmon nigiri', PostEnum.COLD_DISH, ['Shape the sushi rice', 'Add a dab of wasabi', 'Lay a slice of salmon on top'], 8);
    } catch (e) {
    }
    try {
      await this.addRecipe('tuna nigiri', PostEnum.COLD_DISH, ['Shape the sushi rice', 'Add a dab of wasabi', 'Lay a slice of tuna on top'], 8);
    } catch (e) {
    }
    try {
      await this.addRecipe('california roll', PostEnum.COLD_DISH, ['Spread the rice on the nori sheet', 'Add crab, avocado and cucumber', 'Roll it and cut in 8 pieces'], 12);
    } catch (e) {
    }
    try {
      await this.addRecipe('dragon roll', PostEnum.COLD_DISH, ['Grill the eel', 'Roll the rice, the eel and the cucumber in the nori sheet', 'Cover with avocado slices', 'Drizzle with unagi sauce'], 18);
    } catch (e) {
    }
    try {
      await this.addRecipe('chirashi', PostEnum.COLD_DISH, ['Fill a bowl with sushi rice', 'Slice the fish', 'Arrange the sashimi on the rice', 'Add pickled ginger and wasabi'], 15);
    } catch (e) {
    }
    try {
      await this.addRecipe('sushi platter', PostEnum.COLD_DISH, ['Prepare the nigiri', 'Prepare the maki rolls', 'Arrange everything on the wooden board', 'Add pickled ginger, wasabi and soy sauce'], 28);
    } catch (e) {
    }
    try {
      await this.addRecipe('ramen', PostEnum.HOT_DISH, ['Heat the pork bone broth', 'Cook the noodles', 'Add the pork belly and the egg', 'Top with scallions and nori'], 20);
    } catch (e) {
    }
    try {
      await this.addRecipe('kung pao chicken', PostEnum.HOT_DISH, ['Marinate the chicken', 'Stir-fry it in the wok with dried chili', 'Add the sauce and the peanuts'], 15);
    } catch (e) {
    }
    try {
      await this.addRecipe('sweet and sour pork', PostEnum.HOT_DISH, ['Deep-fry the battered pork', 'Cook the sweet and sour sauce with pineapple and peppers', 'Toss everything in the wok'], 16);
    } catch (e) {
    }
    try {
      await this.addRecipe('peking duck', PostEnum.HOT_DISH, ['Take the roasted duck', 'Carve the crispy skin and the meat', 'Serve with pancakes, cucumber, scallions and hoisin sauce'], 30);
    } catch (e) {
    }
    try {
      await this.addRecipe('mapo tofu', PostEnum.HOT_DISH, ['Stir-fry the minced pork with chili bean paste', 'Add the tofu cubes and the broth', 'Simmer and sprinkle with Sichuan pepper'], 14);
    } catch (e) {
    }
    try {
      await this.addRecipe('fried rice', PostEnum.HOT_DISH, ['Heat the wok', 'Stir-fry the cold rice with the egg', 'Add shrimp and peas', 'Season with soy sauce'], 10);
    } catch (e) {
    }
    try {
      await this.addRecipe('chow mein', PostEnum.HOT_DISH, ['Boil the noodles', 'Stir-fry the vegetables in the wok', 'Toss the noodles with soy sauce'], 12);
    } catch (e) {
    }
    /* Desserts */
    try {
      await this.addRecipe('mochi', PostEnum.COLD_DISH, ['Take the mochi from the freezer', 'Let them soften for a minute', 'Put them on a plate'], 6);
    } catch (e) {
    }
    try {
      await this.addRecipe('mango sticky rice', PostEnum.COLD_DISH, ['Take the sticky rice', 'Slice the mango', 'Pour the coconut cream'], 8);
    } catch (e) {
    }
    try {
      await this.addRecipe('sesame balls', PostEnum.HOT_DISH, ['Take the sesame balls', 'Deep-fry until golden', 'Serve them hot'], 10);
    } catch (e) {
    }
    try {
      await this.addRecipe('egg tart', PostEnum.HOT_DISH, ['Take the egg tarts', 'Warm them in the oven', 'Serve them warm'], 8);
    } catch (e) {
    }
    try {
      await this.addRecipe('lychees', PostEnum.COLD_DISH, ['Peel the lychees', 'Serve them in a bowl with ice'], 5);
    } catch (e) {
    }
    /* Beverages */
    try {
      await this.addRecipe('jasmine tea', PostEnum.BAR, ['Heat the water to 80 degrees', 'Put the jasmine tea in the pot', 'Let it infuse', 'Serve it!'], 25);
    } catch (e) {
    }
    try {
      await this.addRecipe('green tea', PostEnum.BAR, ['Heat the water to 70 degrees', 'Put the sencha in the pot', 'Let it infuse', 'Serve it!'], 25);
    } catch (e) {
    }
    try {
      await this.addRecipe('ramune', PostEnum.BAR, ['Serve it!'], 2);
    } catch (e) {
    }
    try {
      await this.addRecipe('lychee juice', PostEnum.BAR, ['Serve it!'], 2);
    } catch (e) {
    }
    try {
      await this.addRecipe('bottled water', PostEnum.BAR, ['Serve it!'], 2);
    } catch (e) {
    }
    try {
      await this.addRecipe('tsingtao', PostEnum.BAR, ['Serve it!'], 2);
    } catch (e) {
    }
    try {
      await this.addRecipe('sake', PostEnum.BAR, ['Warm the sake in a tokkuri', 'Serve it!'], 8);
    } catch (e) {
    }
    try {
      await this.addRecipe('plum wine', PostEnum.BAR, ['Pour it over ice', 'Serve it!'], 3);
    } catch (e) {
    }
  }
}
