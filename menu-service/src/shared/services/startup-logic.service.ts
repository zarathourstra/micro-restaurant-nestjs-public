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
    /* Starters */
    try {
      await this.addMenuItem('Steamed shrimp dumplings (har gow, 4 pcs)', 'har gow', 7.5, CategoryEnum.STARTER);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Crispy vegetable spring rolls (4 pcs)', 'spring rolls', 6, CategoryEnum.STARTER);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Pan-fried pork and chive gyoza (6 pcs)', 'gyoza', 7, CategoryEnum.STARTER);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Miso soup with tofu and wakame', 'miso soup', 4, CategoryEnum.STARTER);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Edamame with sea salt', 'edamame', 5, CategoryEnum.STARTER);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Seaweed salad with sesame dressing', 'seaweed salad', 5.5, CategoryEnum.STARTER);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Salmon tartare with avocado and sesame', 'salmon tartare', 9, CategoryEnum.STARTER);
    } catch (e) {
    }
    /* Main */
    try {
      await this.addMenuItem('Salmon nigiri (2 pcs)', 'salmon nigiri', 6, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Tuna nigiri (2 pcs)', 'tuna nigiri', 7, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('California roll with crab and avocado (8 pcs)', 'california roll', 9, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Dragon roll with grilled eel and avocado (8 pcs)', 'dragon roll', 13, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Chirashi bowl: assorted sashimi on sushi rice', 'chirashi', 19, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Assorted sushi and maki platter (24 pcs)', 'sushi platter', 32, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Tonkotsu ramen with pork belly and soft-boiled egg', 'ramen', 14, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Kung Pao chicken with peanuts', 'kung pao chicken', 15, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Sweet and sour pork', 'sweet and sour pork', 14, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Peking duck (half) with pancakes and hoisin sauce', 'peking duck', 28, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Mapo tofu with minced pork and Sichuan pepper', 'mapo tofu', 13, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Cantonese fried rice with egg and shrimp', 'fried rice', 10, CategoryEnum.MAIN);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Stir-fried noodles with vegetables', 'chow mein', 11, CategoryEnum.MAIN);
    } catch (e) {
    }
    /* Desserts */
    try {
      await this.addMenuItem('Mochi ice cream (3 pcs)', 'mochi', 6, CategoryEnum.DESSERT);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Mango sticky rice with coconut cream', 'mango sticky rice', 8, CategoryEnum.DESSERT);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Sesame balls filled with red bean paste (4 pcs)', 'sesame balls', 6.5, CategoryEnum.DESSERT);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Hong Kong egg tarts (2 pcs)', 'egg tart', 5.5, CategoryEnum.DESSERT);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Fresh lychees', 'lychees', 5, CategoryEnum.DESSERT);
    } catch (e) {
    }
    /* Beverages */
    try {
      await this.addMenuItem('Jasmine tea (pot)', 'jasmine tea', 3.5, CategoryEnum.BEVERAGE);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Japanese green tea (sencha, pot)', 'green tea', 3.5, CategoryEnum.BEVERAGE);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Ramune Japanese soda (20cl)', 'ramune', 3.5, CategoryEnum.BEVERAGE);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Lychee juice (25cl)', 'lychee juice', 3.5, CategoryEnum.BEVERAGE);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Bottled water', 'bottled water', 1, CategoryEnum.BEVERAGE);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Tsingtao beer (33cl)', 'tsingtao', 4.5, CategoryEnum.BEVERAGE);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Warm sake (18cl)', 'sake', 6, CategoryEnum.BEVERAGE);
    } catch (e) {
    }
    try {
      await this.addMenuItem('Umeshu plum wine', 'plum wine', 5.5, CategoryEnum.BEVERAGE);
    } catch (e) {
    }
  }
}
