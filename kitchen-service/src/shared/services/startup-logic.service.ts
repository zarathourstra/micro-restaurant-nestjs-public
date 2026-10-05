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
    const seedRecipes: Array<{ shortName: string; post: PostEnum; steps: string[]; time: number }> = [
      { shortName: 'edamame', post: PostEnum.HOT_DISH, steps: ['Rincer les edamames', 'Les faire cuire à la vapeur', 'Les assaisonner'], time: 10 },
      { shortName: 'soupe miso', post: PostEnum.HOT_DISH, steps: ['Préparer le bouillon miso', 'Ajouter le tofu', 'Servir chaud'], time: 12 },
      { shortName: 'salade d\'algues', post: PostEnum.COLD_DISH, steps: ['Laver les algues', 'Ajouter la vinaigrette', 'Servir bien frais'], time: 10 },
      { shortName: 'tartare de saumon', post: PostEnum.COLD_DISH, steps: ['Découper le saumon', 'Rajouter l\'avocat', 'Assaisonner'], time: 12 },
      { shortName: 'gyoza', post: PostEnum.HOT_DISH, steps: ['Cuire les gyoza', 'Les griller', 'Servir chaud'], time: 14 },
      { shortName: 'tofu agedashi', post: PostEnum.HOT_DISH, steps: ['Paner le tofu', 'Le frire', 'Ajouter le bouillon'], time: 15 },
      { shortName: 'takoyaki', post: PostEnum.HOT_DISH, steps: ['Préparer la pâte', 'Ajouter le poulpe', 'Griller jusqu\'à dorure'], time: 16 },
      { shortName: 'nigiri saumon', post: PostEnum.HOT_DISH, steps: ['Préparer le riz', 'Ajouter le saumon', 'Former les nigiri'], time: 8 },
      { shortName: 'nigiri thon', post: PostEnum.HOT_DISH, steps: ['Préparer le riz', 'Ajouter le thon', 'Former les nigiri'], time: 8 },
      { shortName: 'california roll', post: PostEnum.HOT_DISH, steps: ['Préparer le rouleau', 'Ajouter le crabe', 'Couper en morceaux'], time: 10 },
      { shortName: 'dragon roll', post: PostEnum.HOT_DISH, steps: ['Préparer le rouleau', 'Ajouter l\'anguille', 'Servir avec la sauce'], time: 11 },
      { shortName: 'roll thon épicé', post: PostEnum.HOT_DISH, steps: ['Préparer le riz', 'Ajouter le thon épicé', 'Rouler puis couper'], time: 10 },
      { shortName: 'chirashi', post: PostEnum.HOT_DISH, steps: ['Préparer le riz vinaigré', 'Disposer les poissons', 'Servir'], time: 12 },
      { shortName: 'plateau sushi', post: PostEnum.HOT_DISH, steps: ['Préparer les pièces', 'Disposer sur le plateau', 'Servir frais'], time: 14 },
      { shortName: 'sashimi saumon', post: PostEnum.COLD_DISH, steps: ['Tailler les tranches', 'Disposer sur assiette', 'Servir froid'], time: 10 },
      { shortName: 'sashimi thon', post: PostEnum.COLD_DISH, steps: ['Tailler les tranches', 'Disposer sur assiette', 'Servir froid'], time: 10 },
      { shortName: 'ramen', post: PostEnum.HOT_DISH, steps: ['Cuire les nouilles', 'Préparer le bouillon', 'Ajouter l\'œuf et le porc'], time: 18 },
      { shortName: 'poulet teriyaki', post: PostEnum.HOT_DISH, steps: ['Griller le poulet', 'Ajouter la sauce teriyaki', 'Servir avec le riz'], time: 18 },
      { shortName: 'boeuf yakiniku', post: PostEnum.HOT_DISH, steps: ['Griller le boeuf', 'Ajouter la sauce', 'Servir avec le riz'], time: 20 },
      { shortName: 'udon tempura', post: PostEnum.HOT_DISH, steps: ['Cuire les udon', 'Ajouter les tempuras', 'Servir chaud'], time: 16 },
      { shortName: 'mochi', post: PostEnum.COLD_DISH, steps: ['Sortir les mochi', 'Servir glacés', 'Ajouter la garniture'], time: 6 },
      { shortName: 'dorayaki', post: PostEnum.COLD_DISH, steps: ['Préparer les pancakes', 'Ajouter la pâte de haricots', 'Servir'], time: 7 },
      { shortName: 'cheesecake matcha', post: PostEnum.COLD_DISH, steps: ['Préparer le cheesecake', 'Ajouter la poudre de matcha', 'Refroidir'], time: 12 },
      { shortName: 'thé jasmin', post: PostEnum.BAR, steps: ['Infuser le thé', 'Servir bien chaud'], time: 3 },
      { shortName: 'thé vert', post: PostEnum.BAR, steps: ['Infuser le thé', 'Servir chaud'], time: 3 },
      { shortName: 'ramune', post: PostEnum.BAR, steps: ['Ouvrir la bouteille', 'Servir bien frais'], time: 2 },
      { shortName: 'eau en bouteille', post: PostEnum.BAR, steps: ['Ouvrir la bouteille', 'Servir'], time: 2 },
      { shortName: 'saké', post: PostEnum.BAR, steps: ['Servir chaud ou froid', 'Décanter si nécessaire'], time: 2 },
      { shortName: 'asahi', post: PostEnum.BAR, steps: ['Ouvrir la bière', 'Servir frais'], time: 2 },
      { shortName: 'vin de prune', post: PostEnum.BAR, steps: ['Servir bien frais', 'Déguster'], time: 3 },
    ];

    for (const recipe of seedRecipes) {
      try {
        await this.addRecipe(recipe.shortName, recipe.post, recipe.steps, recipe.time);
      } catch (e) {
      }
    }
  }
}
