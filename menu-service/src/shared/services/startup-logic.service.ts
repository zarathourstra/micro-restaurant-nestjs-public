import { OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { AddMenuItemDto } from '../../menus/dto/add-menu-item.dto';

import { CategoryEnum } from '../../menus/schemas/category-enum.schema';

export class StartupLogicService implements OnApplicationBootstrap {
  constructor(@InjectConnection() private connection: Connection) {}

  createMenuItem(fullName: string, shortName: string, price: number, category: CategoryEnum, image: string = null): AddMenuItemDto {
    const menuItem: AddMenuItemDto = new AddMenuItemDto();
    menuItem.fullName = fullName;
    menuItem.shortName = shortName;
    menuItem.price = price;
    menuItem.category = category;
    menuItem.image = image;
    return menuItem;
  }

  async addMenuItem(fullName: string, shortName: string, price: number, category: CategoryEnum, image: string = null) {
    const menuItemModel = this.connection.models['MenuItem'];

    const alreadyExists = await menuItemModel.find({ shortName });
    if (alreadyExists.length > 0) {
      throw new Error('Menu Item already exists.');
    }

    return menuItemModel.create(this.createMenuItem(fullName, shortName, price, category, image));
  }

  async onApplicationBootstrap() {
    try {
      await this.addMenuItem('Edamame au gros sel','edamame',5, CategoryEnum.STARTER, 'https://cdn.pixabay.com/photo/2020/05/15/10/59/edamame-5173230_1280.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Soupe miso au tofu et wakame','soupe miso',4, CategoryEnum.STARTER, 'https://cdn.pixabay.com/photo/2015/05/02/01/04/miso-soup-749368_1280.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Salade d\'algues à la vinaigrette sésame','salade d\'algues',5.5, CategoryEnum.STARTER, 'https://cdn.pixabay.com/photo/2015/01/26/21/37/seaweed-salad-613151_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Tartare de saumon à l\'avocat et sésame','tartare de saumon',9, CategoryEnum.STARTER, 'https://cdn.pixabay.com/photo/2022/08/09/07/27/salmon-7374357_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Gyoza au porc et ciboulette poêlés (6 pièces)','gyoza',7, CategoryEnum.STARTER, 'https://cdn.pixabay.com/photo/2015/05/10/05/07/gyoza-760510_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Tofu agedashi au bouillon dashi','tofu agedashi',6.5, CategoryEnum.STARTER, 'https://cdn.pixabay.com/photo/2012/04/09/21/58/tofu-26071_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Takoyaki, boulettes de poulpe (6 pièces)','takoyaki',7.5, CategoryEnum.STARTER, 'https://cdn.pixabay.com/photo/2015/04/02/14/18/tako-yaki-703829_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Nigiri de saumon (2 pièces)','nigiri saumon',6, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2020/02/16/20/20/sushi-4854696_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Nigiri de thon (2 pièces)','nigiri thon',7, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2022/06/26/16/15/tuna-7285848_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('California roll au crabe et avocat (8 pièces)','california roll',9, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2020/04/04/15/07/sushi-5002639_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Dragon roll à l\'anguille grillée et avocat (8 pièces)','dragon roll',13, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2017/06/01/12/39/sushi-2363418_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Roll thon épicé (8 pièces)','roll thon épicé',10, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2021/01/01/15/31/sushi-balls-5878892_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Bol chirashi : sashimis variés sur riz vinaigré','chirashi',19, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2020/01/06/19/31/japanese-sushi-4746059_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Plateau de sushis et makis variés (24 pièces)','plateau sushi',32, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2015/01/12/00/16/sushi-596930_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Sashimi de saumon (6 pièces)','sashimi saumon',12, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2021/10/02/13/08/salmon-6675201_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Sashimi de thon (6 pièces)','sashimi thon',13, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2021/08/23/17/32/tuna-6568345_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Ramen tonkotsu au porc et œuf mollet','ramen',14, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2019/11/23/15/30/ramen-4647411_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Poulet teriyaki et riz vapeur','poulet teriyaki',15, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2018/10/22/12/30/teriyaki-chicken-3765240_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Bœuf yakiniku et riz vapeur','boeuf yakiniku',17, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2016/05/22/17/00/yakiniku-1408821_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Udon aux légumes tempura','udon tempura',13, CategoryEnum.MAIN, 'https://cdn.pixabay.com/photo/2019/03/19/10/12/udon-noodles-4065311_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Mochi glacé (3 pièces)','mochi',6, CategoryEnum.DESSERT, 'https://cdn.pixabay.com/photo/2017/03/02/06/02/sakuramochi-2110491_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Dorayaki, pancake aux haricots rouges','dorayaki',5.5, CategoryEnum.DESSERT, 'https://cdn.pixabay.com/photo/2015/01/11/12/33/dorayaki-596166_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Cheesecake au matcha','cheesecake matcha',7, CategoryEnum.DESSERT, 'https://cdn.pixabay.com/photo/2015/07/16/16/42/matcha-847918_1280.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Thé au jasmin (pot)','thé jasmin',3.5, CategoryEnum.BEVERAGE, 'https://cdn.pixabay.com/photo/2014/09/24/17/48/jasmine-tea-459346_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Thé vert japonais (sencha, pot)','thé vert',3.5, CategoryEnum.BEVERAGE, 'https://cdn.pixabay.com/photo/2022/11/15/05/17/green-tea-7593087_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Ramune, soda japonais (20cl)','ramune',3.5, CategoryEnum.BEVERAGE, 'https://cdn.pixabay.com/photo/2021/08/10/23/50/drink-6537028_1280.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Eau en bouteille','eau en bouteille',1, CategoryEnum.BEVERAGE, 'https://cdn.pixabay.com/photo/2017/10/06/04/42/water-bottle-2821977_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Saké chaud (18cl)','saké',6, CategoryEnum.BEVERAGE, 'https://cdn.pixabay.com/photo/2020/02/10/15/11/sake-4836759_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Bière Asahi (33cl)','asahi',4.5, CategoryEnum.BEVERAGE, 'https://cdn.pixabay.com/photo/2018/05/06/08/49/beer-3378136_640.jpg');
    } catch (e) {
    }
    try {
      await this.addMenuItem('Umeshu, vin de prune','vin de prune',5.5, CategoryEnum.BEVERAGE, 'https://cdn.pixabay.com/photo/2021/08/24/09/15/umeshu-6570071_640.jpg');
    } catch (e) {
    }
  }
}
